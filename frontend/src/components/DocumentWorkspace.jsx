import { useEffect, useState } from 'react'
import { useChat } from '../hooks/useChat'
import { useChecks } from '../hooks/useChecks'
import { useLoopholeScan } from '../hooks/useLoopholeScan'
import { useStoredState } from '../hooks/useStoredState'
import {
  DOCUMENT_NOTE,
  explanationNoteKey,
  findingNoteKey,
  highlightNoteKey,
} from '../utils/notes'
import { itemAtPoint, readPdfSelection } from '../utils/pdfSelection'
import { defaultColor } from '../utils/pens'
import ChatPanel from './ChatPanel'
import HighlightRects from './HighlightRects'
import PdfViewer from './PdfViewer'
import ReviewList from './ReviewList'
import ReviewPanel from './ReviewPanel'
import SelectionPopover from './SelectionPopover'
import './DocumentWorkspace.css'

// Rectangles from the backend and from a browser selection differ slightly, so tops this
// close (a fraction of the page) are taken as the same line.
const SAME_LINE = 0.008

// Reading order: by page, then down the page. Passages not found on the page go last.
function byPosition(a, b) {
  const [ra, rb] = [a.rects[0], b.rects[0]]
  if (!ra || !rb) return (ra ? 0 : 1) - (rb ? 0 : 1)
  if (ra.page_number !== rb.page_number) return ra.page_number - rb.page_number
  if (Math.abs(ra.top - rb.top) > SAME_LINE) return ra.top - rb.top
  return ra.x0 - rb.x0
}

function scrollCardIntoView(key) {
  requestAnimationFrame(() => {
    document.getElementById(`item-${key}`)?.scrollIntoView({ block: 'nearest', behavior: 'smooth' })
  })
}

// The open document: the PDF on the left, the Review and Chat panel on the right.
// Everything marked on the page (loopholes, checked clauses, the user's highlights) is
// one list of items, each with a colour, a style and an optional note. An item's key
// is its note key (utils/notes.js). Give it key={document.id} so each document starts
// with its own state.
function DocumentWorkspace({ document: doc }) {
  const [tab, setTab] = useState('review')
  const [filter, setFilter] = useState('all')
  // The item open in the list and outlined on the page, and the one under the mouse.
  const [activeKey, setActiveKey] = useState(null)
  const [hoverKey, setHoverKey] = useState(null)
  // An item whose note editor opens as soon as its card shows (just added from the page).
  const [editNoteKey, setEditNoteKey] = useState(null)
  const [scrollTarget, setScrollTarget] = useState(null)
  const [selection, setSelection] = useState(null)
  // A passage a chat answer pointed to, flashed on the page for a moment.
  const [flash, setFlash] = useState(null)
  const [attachment, setAttachment] = useState(null)
  const [chatFocus, setChatFocus] = useState(0)

  const scan = useLoopholeScan(doc.id)
  const checks = useChecks(doc.id)
  const chat = useChat(doc.id)
  // { [key]: { text, updatedAt } }
  const [notes, setNotes] = useStoredState(`notes:${doc.id}`, {})
  // How the user wants each item drawn: { [key]: { color, style, hidden } }
  const [marks, setMarks] = useStoredState(`marks:${doc.id}`, {})
  // The user's own highlights: [{ id, text, pageNumber, rects, createdAt }]
  const [highlights, setHighlights] = useStoredState(`highlights:${doc.id}`, [])

  // Hide the selection toolbar when the selection goes away or the page moves.
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

  // A flashed passage fades out on its own (see HighlightRects.css); then drop it.
  useEffect(() => {
    if (!flash) return
    const timer = setTimeout(() => setFlash(null), 2500)
    return () => clearTimeout(timer)
  }, [flash])

  const findings = scan.result?.findings ?? []
  const allItems = [
    ...findings.map((finding) => ({
      key: findingNoteKey(finding),
      kind: 'loophole',
      status: 'done',
      severity: finding.severity,
      title: finding.title,
      text: finding.quote,
      pageNumber: finding.page_number,
      rects: finding.highlight,
      explanation: finding.explanation,
      recommendation: finding.recommendation,
      citations: finding.citations,
    })),
    ...checks.checks.map((check) => ({
      key: explanationNoteKey(check.id),
      id: check.id,
      kind: 'check',
      status: check.status,
      error: check.error,
      severity: check.result?.severity,
      text: check.text,
      pageNumber: check.result?.highlight[0]?.page_number ?? check.pageNumber,
      // Where the backend found it, or where the user selected it while it's checking.
      rects: check.result?.highlight.length ? check.result.highlight : (check.rects ?? []),
      explanation: check.result?.explanation,
      recommendation: check.result?.recommendation,
      citations: check.result?.citations,
    })),
    ...highlights.map((highlight) => ({
      key: highlightNoteKey(highlight.id),
      id: highlight.id,
      kind: 'highlight',
      status: 'done',
      text: highlight.text,
      pageNumber: highlight.pageNumber,
      rects: highlight.rects,
    })),
  ]
  const items = allItems
    .filter((item) => !marks[item.key]?.hidden)
    .map((item) => ({
      ...item,
      located: item.rects.length > 0,
      color: marks[item.key]?.color ?? defaultColor(item),
      style: marks[item.key]?.style ?? 'fill',
      note: notes[item.key]?.text ?? null,
    }))
    .sort(byPosition)
  const dismissedCount = allItems.length - items.length

  // Saves a note right away; an empty text deletes it.
  function saveNote(key, text) {
    setNotes((current) => {
      const next = { ...current }
      if (text) next[key] = { text, updatedAt: new Date().toISOString() }
      else delete next[key]
      return next
    })
  }

  function updateMark(key, change) {
    setMarks((current) => ({ ...current, [key]: { ...current[key], ...change } }))
  }

  function forget(key) {
    saveNote(key, '')
    setMarks((current) => {
      const next = { ...current }
      delete next[key]
      return next
    })
  }

  function scrollToRects(rects) {
    const first = rects?.[0]
    if (first) {
      // A fresh nonce each time, so clicking the same item again scrolls again.
      setScrollTarget((previous) => ({
        pageNumber: first.page_number,
        top: first.top,
        nonce: (previous?.nonce ?? 0) + 1,
      }))
    }
  }

  // List → page: open an item and scroll the PDF to it.
  function select(key) {
    setActiveKey(key)
    setEditNoteKey(null)
    const item = items.find((x) => x.key === key)
    if (item) scrollToRects(item.rects)
  }

  // Page → list: clicking a highlight opens its card.
  function selectFromPage(key) {
    setActiveKey(key)
    setEditNoteKey(null)
    setTab('review')
    setFilter('all')
    scrollCardIntoView(key)
  }

  function clearSelection() {
    window.getSelection()?.removeAllRanges()
    setSelection(null)
  }

  // Releasing the mouse either ends a text selection (show the toolbar) or is a click,
  // which opens the highlight under the pointer, if any.
  function handlePointerUp(event) {
    const { clientX, clientY, target, type } = event
    // Wait a tick: the browser finishes updating the selection after mouseup.
    setTimeout(() => {
      const current = readPdfSelection()
      setSelection(current)
      if (current || type !== 'mouseup') return
      const key = itemAtPoint(clientX, clientY, target, items)
      if (key) selectFromPage(key)
    }, 0)
  }

  function handlePointerMove(event) {
    const key = itemAtPoint(event.clientX, event.clientY, event.target, items)
    if (key !== hoverKey) setHoverKey(key)
  }

  function addHighlight(color, { withNote = false } = {}) {
    const { text, pageNumber, rects } = selection
    const id = crypto.randomUUID()
    const key = highlightNoteKey(id)
    setHighlights((current) => [
      ...current,
      { id, text, pageNumber, rects, createdAt: new Date().toISOString() },
    ])
    updateMark(key, { color })
    clearSelection()
    if (withNote) {
      setTab('review')
      setFilter('all')
      setActiveKey(key)
      setEditNoteKey(key)
      scrollCardIntoView(key)
    }
  }

  function handleCheck() {
    const { text, pageNumber, rects } = selection
    const key = explanationNoteKey(checks.add(text, pageNumber, rects))
    clearSelection()
    setTab('review')
    setFilter('all')
    setActiveKey(key)
    setEditNoteKey(null)
    scrollCardIntoView(key)
  }

  function askAbout(text, pageNumber) {
    setAttachment({ text, pageNumber })
    setTab('chat')
    setChatFocus((n) => n + 1)
  }

  function handleRemove(item) {
    if (item.kind === 'loophole') {
      updateMark(item.key, { hidden: true }) // Dismissed; a re-scan finds it again.
    } else {
      if (item.kind === 'check') checks.remove(item.id)
      else setHighlights((current) => current.filter((h) => h.id !== item.id))
      forget(item.key)
    }
    if (activeKey === item.key) setActiveKey(null)
  }

  function restoreDismissed() {
    setMarks((current) =>
      Object.fromEntries(
        Object.entries(current).map(([key, mark]) => [key, { ...mark, hidden: false }]),
      ),
    )
  }

  function showReference(reference) {
    scrollToRects(reference.highlight)
    setFlash((previous) => ({ rects: reference.highlight, nonce: (previous?.nonce ?? 0) + 1 }))
  }

  const pageItems = items
    .filter((item) => item.located)
    .map((item) => ({
      key: item.key,
      color: item.color,
      style: item.style,
      title: item.title ?? item.text,
      hasNote: Boolean(item.note),
      rects: item.rects,
    }))
  if (flash) {
    pageItems.push({
      key: `flash:${flash.nonce}`,
      color: 'blue',
      style: 'fill',
      title: 'Passage from the answer',
      flash: true,
      rects: flash.rects,
    })
  }

  const questionCount = chat.messages.filter((m) => m.role === 'user').length

  return (
    <section className="workspace">
      <div
        className={hoverKey ? 'workspace-doc is-over-mark' : 'workspace-doc'}
        onMouseUp={handlePointerUp}
        onKeyUp={handlePointerUp}
        onMouseMove={handlePointerMove}
        onMouseLeave={() => setHoverKey(null)}
      >
        <PdfViewer
          documentId={doc.id}
          scrollTarget={scrollTarget}
          renderPageOverlay={(pageNumber) => (
            <HighlightRects
              pageNumber={pageNumber}
              items={pageItems}
              activeKey={activeKey}
              hoverKey={hoverKey}
              onSelect={selectFromPage}
            />
          )}
        />
      </div>

      <ReviewPanel
        tab={tab}
        onTabChange={setTab}
        counts={{ review: items.length || null, chat: questionCount || null }}
      >
        {tab === 'review' && (
          <ReviewList
            scan={scan}
            items={items}
            filter={filter}
            onFilterChange={setFilter}
            activeKey={activeKey}
            editNoteKey={editNoteKey}
            onSelect={select}
            onSaveNote={(item, text) => {
              saveNote(item.key, text)
              setEditNoteKey(null)
            }}
            onCancelNote={() => setEditNoteKey(null)}
            onChangePen={(item, change) => updateMark(item.key, change)}
            onAsk={(item) => askAbout(item.text, item.pageNumber ?? 1)}
            onRemove={handleRemove}
            onRetry={(item) => checks.retry(item.id)}
            documentNote={notes[DOCUMENT_NOTE]?.text ?? null}
            onSaveDocumentNote={(text) => saveNote(DOCUMENT_NOTE, text)}
            dismissedCount={dismissedCount}
            onRestoreDismissed={restoreDismissed}
          />
        )}
        {tab === 'chat' && (
          <ChatPanel
            chat={chat}
            attachment={attachment}
            onClearAttachment={() => setAttachment(null)}
            onShowReference={showReference}
            focusSignal={chatFocus}
          />
        )}
      </ReviewPanel>

      {selection && (
        <SelectionPopover
          selection={selection}
          onHighlight={(color) => addHighlight(color)}
          onNote={() => addHighlight('yellow', { withNote: true })}
          onCheck={handleCheck}
          onAsk={() => {
            askAbout(selection.text, selection.pageNumber)
            clearSelection()
          }}
        />
      )}
    </section>
  )
}

export default DocumentWorkspace
