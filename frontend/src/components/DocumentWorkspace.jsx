import { useEffect, useRef, useState } from 'react'
import { explainSelection, scanLoopholes } from '../api/analysis'
import { loadJSON, saveJSON } from '../utils/storage'
import ExplanationsPanel from './ExplanationsPanel'
import HighlightRects from './HighlightRects'
import LoopholePanel from './LoopholePanel'
import PdfViewer from './PdfViewer'
import ReviewPanel from './ReviewPanel'
import SelectionPopover from './SelectionPopover'
import './DocumentWorkspace.css'

const scanKey = (documentId) => `scan:${documentId}`
const explanationsKey = (documentId) => `explanations:${documentId}`

// Scans still running, by document id. Kept outside the component so a scan carries
// on (and gets saved) if the user opens another document, and the workspace picks it
// up again when they come back instead of starting a second, quota-using scan.
const runningScans = new Map()

function startScan(documentId) {
  if (!runningScans.has(documentId)) {
    const promise = scanLoopholes(documentId)
      .then((report) => {
        const result = {
          model: report.model,
          findings: report.findings,
          scannedAt: new Date().toISOString(),
        }
        saveJSON(scanKey(documentId), result)
        return result
      })
      .finally(() => runningScans.delete(documentId))
    runningScans.set(documentId, { promise, startedAt: Date.now() })
  }
  return runningScans.get(documentId)
}

// Saved explanations hold only finished ones; loading and failed ones live in state.
function saveExplanation(documentId, item) {
  const saved = loadJSON(explanationsKey(documentId)) ?? []
  saveJSON(explanationsKey(documentId), [item, ...saved.filter((x) => x.id !== item.id)])
}

function forgetExplanation(documentId, id) {
  const saved = loadJSON(explanationsKey(documentId)) ?? []
  saveJSON(
    explanationsKey(documentId),
    saved.filter((x) => x.id !== id),
  )
}

// What the user has selected in the PDF's text layer, if anything worth explaining.
function readPdfSelection() {
  const selection = window.getSelection()
  if (!selection || selection.isCollapsed || selection.rangeCount === 0) return null
  // A drag that starts between lines anchors on the text layer element itself, not on a word.
  const asElement = (node) => (node?.nodeType === Node.ELEMENT_NODE ? node : node?.parentElement)
  const startNode = asElement(selection.anchorNode)
  if (!startNode?.closest('.react-pdf__Page__textContent')) return null
  // Lines in the text layer are separate pieces; join them with single spaces.
  const text = selection.toString().replace(/\s+/g, ' ').trim()
  if (text.length < 2) return null
  // The page the selection starts on, whichever direction it was dragged in.
  const range = selection.getRangeAt(0)
  const firstPage = asElement(range.startContainer)?.closest('.pdf-page') ?? startNode.closest('.pdf-page')
  const pageNumber = Number(firstPage?.dataset.pageNumber)
  if (!pageNumber) return null
  // Place the button above the selection, or below it near the top of the window,
  // and always on screen, even for a selection taller than the window.
  const box = range.getBoundingClientRect()
  const below = box.top < 80
  return {
    text,
    pageNumber,
    x: Math.min(Math.max(box.left + box.width / 2, 140), window.innerWidth - 140),
    y: below ? Math.min(box.bottom, window.innerHeight - 60) : box.top,
    below,
  }
}

// The open document: title, PDF viewer and the review panel (loopholes, explanations).
// Give it key={document.id} so each document starts with its own state.
function DocumentWorkspace({ document: doc }) {
  const mounted = useRef(true)
  const [tab, setTab] = useState('loopholes')
  // What's selected in the panel and on the PDF: 'f:<index>' or 'e:<id>'.
  const [activeKey, setActiveKey] = useState(null)
  const [scrollTarget, setScrollTarget] = useState(null)

  // Loophole scan
  const [result, setResult] = useState(() => loadJSON(scanKey(doc.id)))
  const [scan, setScan] = useState(() => runningScans.get(doc.id) ?? null)
  const [scanError, setScanError] = useState(null)
  const [now, setNow] = useState(() => Date.now())

  // Explanations of selected text, newest first
  const [explanations, setExplanations] = useState(() =>
    (loadJSON(explanationsKey(doc.id)) ?? []).map((item) => ({ ...item, status: 'done' })),
  )
  const [selection, setSelection] = useState(null)

  useEffect(() => {
    mounted.current = true
    return () => {
      mounted.current = false
    }
  }, [])

  // Wait for the running scan (started here, or before switching documents).
  useEffect(() => {
    if (!scan) return
    scan.promise
      .then((scanResult) => {
        if (!mounted.current) return
        setResult(scanResult)
        setActiveKey(null)
      })
      .catch((err) => {
        // A 401 is handled by the API client, which shows the login page.
        if (mounted.current && err.status !== 401) {
          setScanError({ message: err.message, status: err.status })
        }
      })
      .finally(() => {
        if (mounted.current) setScan(null)
      })
  }, [scan])

  // Tick once a second while scanning, for the elapsed-time counter.
  useEffect(() => {
    if (!scan) return
    const timer = setInterval(() => setNow(Date.now()), 1000)
    return () => clearInterval(timer)
  }, [scan])

  // Hide the "Explain this" button when the selection goes away or the page moves.
  useEffect(() => {
    if (!selection) return
    function hideIfEmpty() {
      if (!readPdfSelection()) setSelection(null)
    }
    function hide() {
      setSelection(null)
    }
    function hideOnEscape(event) {
      if (event.key === 'Escape') hide()
    }
    document.addEventListener('selectionchange', hideIfEmpty)
    document.addEventListener('scroll', hide, true) // true: also when the viewer scrolls
    window.addEventListener('resize', hide)
    document.addEventListener('keydown', hideOnEscape)
    return () => {
      document.removeEventListener('selectionchange', hideIfEmpty)
      document.removeEventListener('scroll', hide, true)
      window.removeEventListener('resize', hide)
      document.removeEventListener('keydown', hideOnEscape)
    }
  }, [selection])

  function handleScan() {
    setScanError(null)
    setNow(Date.now())
    setTab('loopholes')
    setScan(startScan(doc.id))
  }

  const findings = result?.findings ?? []

  function scrollToRects(rects) {
    const first = rects?.[0]
    if (first) {
      setScrollTarget({ pageNumber: first.page_number, top: first.top, nonce: Date.now() })
    }
  }

  // Panel → PDF: select an item and scroll the page to its first highlighted line.
  function selectFinding(index) {
    setActiveKey(index === null ? null : `f:${index}`)
    if (index !== null) scrollToRects(findings[index].highlight)
  }

  function selectExplanation(id) {
    setActiveKey(id === null ? null : `e:${id}`)
    const item = explanations.find((x) => x.id === id)
    if (item?.result) scrollToRects(item.result.highlight)
  }

  // PDF → panel: clicking a highlight opens its card in the right tab.
  function selectFromPage(key) {
    setActiveKey(key)
    const [kind, id] = key.split(/:(.*)/)
    setTab(kind === 'f' ? 'loopholes' : 'explanations')
    const elementId = kind === 'f' ? `finding-${id}` : `explanation-${id}`
    requestAnimationFrame(() => {
      document.getElementById(elementId)?.scrollIntoView({ block: 'nearest', behavior: 'smooth' })
    })
  }

  // Selecting text in the PDF shows the "Explain this" button above it.
  function handlePointerUp() {
    // Wait a tick: the browser finishes updating the selection after mouseup.
    setTimeout(() => setSelection(readPdfSelection()), 0)
  }

  function updateExplanation(id, changes) {
    setExplanations((items) => items.map((x) => (x.id === id ? { ...x, ...changes } : x)))
  }

  async function runExplanation(id, text, pageNumber) {
    try {
      const response = await explainSelection(doc.id, text, pageNumber)
      const done = {
        id,
        text,
        pageNumber,
        createdAt: new Date().toISOString(),
        result: {
          model: response.model,
          severity: response.severity,
          explanation: response.explanation,
          citations: response.citations,
          highlight: response.highlight,
        },
      }
      // Saved even if the user has opened another document meanwhile.
      saveExplanation(doc.id, done)
      if (!mounted.current) return
      updateExplanation(id, { ...done, status: 'done' })
      // Open it, unless the user has moved on to something else meanwhile.
      setActiveKey((current) => (current === null || current === `e:${id}` ? `e:${id}` : current))
      if (response.highlight.length > 0) scrollToRects(response.highlight)
    } catch (err) {
      if (mounted.current && err.status !== 401) {
        updateExplanation(id, { status: 'error', error: { message: err.message, status: err.status } })
      }
    }
  }

  function handleExplain() {
    if (!selection) return
    const { text, pageNumber } = selection
    const id = crypto.randomUUID()
    window.getSelection()?.removeAllRanges()
    setSelection(null)
    setExplanations((items) => [{ id, text, pageNumber, status: 'loading' }, ...items])
    setActiveKey(`e:${id}`)
    setTab('explanations')
    runExplanation(id, text, pageNumber)
  }

  function handleRetryExplanation(id) {
    const item = explanations.find((x) => x.id === id)
    if (!item) return
    updateExplanation(id, { status: 'loading', error: null })
    runExplanation(id, item.text, item.pageNumber)
  }

  function handleRemoveExplanation(id) {
    setExplanations((items) => items.filter((x) => x.id !== id))
    forgetExplanation(doc.id, id)
    if (activeKey === `e:${id}`) setActiveKey(null)
  }

  // Everything to draw on the PDF: loophole findings in their severity colour,
  // explained passages in yellow.
  const highlightItems = [
    ...findings.map((finding, index) => ({
      id: `f:${index}`,
      severity: finding.severity,
      title: finding.title,
      rects: finding.highlight,
    })),
    ...explanations
      .filter((item) => item.status === 'done')
      .map((item) => ({
        id: `e:${item.id}`,
        severity: 'mine',
        title: 'Your highlight: click to see the explanation',
        rects: item.result.highlight,
      })),
  ]

  const activeFinding = activeKey?.startsWith('f:') ? Number(activeKey.slice(2)) : null
  const activeExplanation = activeKey?.startsWith('e:') ? activeKey.slice(2) : null

  return (
    <section className="workspace">
      <div className="workspace-head">
        <h2>{doc.name}</h2>
        <p>
          {doc.pageCount} {doc.pageCount === 1 ? 'page' : 'pages'}
          {doc.isSample && ' · Demo contract'}
          {' · Select any text to have it explained'}
        </p>
      </div>

      <div className="workspace-body">
        <div className="workspace-doc" onMouseUp={handlePointerUp} onKeyUp={handlePointerUp}>
          <PdfViewer
            documentId={doc.id}
            scrollTarget={scrollTarget}
            renderPageOverlay={(pageNumber) => (
              <HighlightRects
                pageNumber={pageNumber}
                items={highlightItems}
                activeId={activeKey}
                onSelect={selectFromPage}
              />
            )}
          />
        </div>

        <ReviewPanel
          tab={tab}
          onTabChange={setTab}
          counts={{
            loopholes: result ? findings.length : null,
            explanations: explanations.length || null,
          }}
        >
          {tab === 'loopholes' ? (
            <LoopholePanel
              scanning={Boolean(scan)}
              elapsedSeconds={scan ? Math.max(0, Math.floor((now - scan.startedAt) / 1000)) : 0}
              error={scanError}
              result={result}
              activeIndex={activeFinding}
              onSelect={selectFinding}
              onScan={handleScan}
            />
          ) : (
            <ExplanationsPanel
              items={explanations}
              activeId={activeExplanation}
              onSelect={selectExplanation}
              onRemove={handleRemoveExplanation}
              onRetry={handleRetryExplanation}
            />
          )}
        </ReviewPanel>
      </div>

      {selection && <SelectionPopover selection={selection} onExplain={handleExplain} />}
    </section>
  )
}

export default DocumentWorkspace
