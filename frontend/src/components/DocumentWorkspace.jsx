import { useEffect, useRef, useState } from 'react'
import { scanLoopholes } from '../api/analysis'
import { loadJSON, saveJSON } from '../utils/storage'
import HighlightRects from './HighlightRects'
import LoopholePanel from './LoopholePanel'
import PdfViewer from './PdfViewer'
import './DocumentWorkspace.css'

const scanKey = (documentId) => `scan:${documentId}`

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

// The open document: title, PDF viewer and the loophole panel.
// Give it key={document.id} so each document starts with its own state.
function DocumentWorkspace({ document: doc }) {
  const mounted = useRef(true)
  const [result, setResult] = useState(() => loadJSON(scanKey(doc.id)))
  const [scan, setScan] = useState(() => runningScans.get(doc.id) ?? null)
  const [error, setError] = useState(null)
  const [now, setNow] = useState(() => Date.now())
  const [activeIndex, setActiveIndex] = useState(null)
  const [scrollTarget, setScrollTarget] = useState(null)

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
        setActiveIndex(null)
      })
      .catch((err) => {
        // A 401 is handled by the API client, which shows the login page.
        if (mounted.current && err.status !== 401) {
          setError({ message: err.message, status: err.status })
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

  function handleScan() {
    setError(null)
    setNow(Date.now())
    setScan(startScan(doc.id))
  }

  const findings = result?.findings ?? []

  // Panel → PDF: select a finding and scroll the page to its first highlighted line.
  function selectFinding(index) {
    setActiveIndex(index)
    const firstRect = index === null ? null : findings[index].highlight[0]
    if (firstRect) {
      setScrollTarget({ pageNumber: firstRect.page_number, top: firstRect.top, nonce: Date.now() })
    }
  }

  // PDF → panel: clicking a highlight opens its card and brings it into view.
  function selectFromPage(index) {
    setActiveIndex(index)
    requestAnimationFrame(() => {
      document
        .getElementById(`finding-${index}`)
        ?.scrollIntoView({ block: 'nearest', behavior: 'smooth' })
    })
  }

  const highlightItems = findings.map((finding, index) => ({
    id: index,
    severity: finding.severity,
    title: finding.title,
    rects: finding.highlight,
  }))

  return (
    <section className="workspace">
      <div className="workspace-head">
        <h2>{doc.name}</h2>
        <p>
          {doc.pageCount} {doc.pageCount === 1 ? 'page' : 'pages'}
          {doc.isSample && ' · Demo contract'}
        </p>
      </div>

      <div className="workspace-body">
        <PdfViewer
          documentId={doc.id}
          scrollTarget={scrollTarget}
          renderPageOverlay={(pageNumber) => (
            <HighlightRects
              pageNumber={pageNumber}
              items={highlightItems}
              activeId={activeIndex}
              onSelect={selectFromPage}
            />
          )}
        />
        <LoopholePanel
          scanning={Boolean(scan)}
          elapsedSeconds={scan ? Math.max(0, Math.floor((now - scan.startedAt) / 1000)) : 0}
          error={error}
          result={result}
          activeIndex={activeIndex}
          onSelect={selectFinding}
          onScan={handleScan}
        />
      </div>
    </section>
  )
}

export default DocumentWorkspace
