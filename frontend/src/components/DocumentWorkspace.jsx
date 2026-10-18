import { useEffect, useState } from 'react'
import { useChat } from '../hooks/useChat'
import { useHighlights } from '../hooks/useHighlights'
import { useLoopholeScan } from '../hooks/useLoopholeScan'
import { useMarks } from '../hooks/useMarks'
import { useStoredState } from '../hooks/useStoredState'
import { findingKey, highlightKey } from '../utils/itemKeys'
import { itemAtPoint, readPdfSelection } from '../utils/pdfSelection'
import { defaultColor } from '../utils/pens'
import { DEFAULT_SHOW, isShown, itemKind } from '../utils/show'
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
const QUOTE_CHARS_FOR_CHAT = 400

// Reading order: by page, then down the page. Passages not found on the page go last.
function byPosition(a, b) {
  const [ra, rb] = [a.rects[0], b.rects[0]]
  if (!ra || !rb) return (ra ? 0 : 1) - (rb ? 0 : 1)
  if (ra.page_number !== rb.page_number) return ra.page_number - rb.page_number
  if (Math.abs(ra.top - rb.top) > SAME_LINE) return ra.top - rb.top
  return ra.x0 - rb.x0
}

// A highlight's name until the user or the check gives it one: its first words.
function snippet(text, words = 8) {
  const all = text.split(/\s+/)
  return all.length > words ? `${all.slice(0, words).join(' ')}…` : text
}

function scrollCardIntoView(key) {
  requestAnimationFrame(() => {
    document.getElementById(`item-${key}`)?.scrollIntoView({ block: 'nearest', behavior: 'smooth' })
  })
}

// The open document: the PDF on the left, the Review and Chat panel on the right.
// Everything marked on the page is one list of items, built here:
//   { key, source: 'scan' | 'mine', kind: 'auto' | 'highlight' | 'note', id, text,
//     pageNumber, rects, located, status: 'done' | 'loading' | 'error', error,
//     analysis: { title, severity, explanation, recommendation, citations } | null,
//     isRisk, name, defaultName, note, favorite, hidden, color, style }
// Every item is a highlight: found by the automatic scan, or the user's own, with or
// without a note. Checking one adds its analysis; isRisk says whether that found a
// problem. The note is stored as the mark's "description", its name in the chat API.
// The Show toggles (utils/show.js) decide which items the list and the page show.
// onReset forgets the document's data on this device; give it key={document.id} (plus
// a reset count) so each document starts with its own state.
function DocumentWorkspace({ document: doc, onReset }) {
  const [tab, setTab] = useState('review')
  // Remembered on this device across documents.
  const [storedShow, setShow] = useStoredState('ui:show', DEFAULT_SHOW)
  const show = { ...DEFAULT_SHOW, ...storedShow }
  // An item whose note editor opens as soon as its card shows (a note started from the page).
  const [editNoteKey, setEditNoteKey] = useState(null)
  // The item open in the list and outlined on the page, and the one under the mouse.
  const [activeKey, setActiveKey] = useState(null)
  const [hoverKey, setHoverKey] = useState(null)
  const [scrollTarget, setScrollTarget] = useState(null)
  const [selection, setSelection] = useState(null)
  // A passage the chat pointed to, flashed on the page for a moment.
  const [flash, setFlash] = useState(null)
  const [attachment, setAttachment] = useState(null)
  const [chatFocus, setChatFocus] = useState(0)

  const scan = useLoopholeScan(doc.id)
  const highlights = useHighlights(doc.id)
  const marks = useMarks(doc.id)

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
  const items = [
    ...findings.map((finding) => ({
      key: findingKey(finding),
      source: 'scan',
      text: finding.quote,
      pageNumber: finding.page_number,
      rects: finding.highlight,
      status: 'done',
      analysis: {
        title: finding.title,
        severity: finding.severity,
        explanation: finding.explanation,
        recommendation: finding.recommendation,
        citations: finding.citations,
      },
    })),
    ...highlights.highlights.map((highlight) => ({
      key: highlightKey(highlight.id),
      source: 'mine',
      id: highlight.id,
      text: highlight.text,
      pageNumber: highlight.pageNumber,
      rects: highlight.rects ?? [],
      status: highlights.checking[highlight.id]?.status ?? 'done',
      error: highlights.checking[highlight.id]?.error,
      analysis: highlight.analysis ?? null,
    })),
  ]
    .map((item) => {
      const mark = marks.marks[item.key] ?? {}
      const severity = item.analysis?.severity
      const defaultName = item.analysis?.title || snippet(item.text)
      const note = mark.description ?? null
      return {
        ...item,
        kind: itemKind({ source: item.source, note }),
        located: item.rects.length > 0,
        isRisk: Boolean(severity) && severity !== 'none',
        defaultName,
        name: mark.name || defaultName,
        note,
        favorite: Boolean(mark.favorite),
        hidden: Boolean(mark.hidden),
        color: mark.color ?? defaultColor({ severity }),
        style: mark.style ?? 'fill',
      }
    })
    .sort(byPosition)
  const byKey = new Map(items.map((item) => [item.key, item]))

  // What the chat knows of the user's items, so it can find, list and change them.
  function itemsForChat() {
    return items
      .filter((item) => !item.hidden)
      .map((item) => ({
        id: item.key,
        kind: item.isRisk ? 'risk' : 'highlight',
        name: item.name,
        description: item.note ?? '',
        quote: item.text.slice(0, QUOTE_CHARS_FOR_CHAT),
        page_number: item.located ? item.pageNumber : null,
        severity: item.analysis?.severity ?? null,
      }))
  }

  // Applies what the user asked the chat to change.
  function applyChatActions(answer) {
    for (const action of answer.actions) {
      if (action.type === 'create_highlight' && action.highlight?.length) {
        const id = highlights.add({
          text: action.quote,
          pageNumber: action.page_number,
          rects: action.highlight,
        })
        marks.update(highlightKey(id), {
          name: action.name || null,
          description: action.description || null,
        })
      } else if (action.type === 'update_item' && byKey.has(action.id)) {
        const changes = {}
        if (action.name != null) changes.name = action.name || null
        if (action.description != null) changes.description = action.description || null
        marks.update(action.id, changes)
      }
    }
  }

  const chat = useChat(doc.id, { getItems: itemsForChat, onAnswer: applyChatActions })

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

  function flashRects(rects) {
    scrollToRects(rects)
    setFlash((previous) => ({ rects, nonce: (previous?.nonce ?? 0) + 1 }))
  }

  // List → page: open an item and scroll the PDF to it.
  function select(key) {
    setActiveKey(key)
    setEditNoteKey(null)
    const item = byKey.get(key)
    if (item) scrollToRects(item.rects)
  }

  // Page → list: clicking a highlight opens its card. The page only draws what Show
  // lets through, so the card is in the list.
  function selectFromPage(key) {
    setActiveKey(key)
    setEditNoteKey(null)
    setTab('review')
    scrollCardIntoView(key)
  }

  // Opens a highlight the user just made from the page, turning Show on for it if needed.
  function openNew(key, { editNote = false } = {}) {
    setShow({ ...show, highlight: true, note: true, favoritesOnly: false })
    setTab('review')
    setActiveKey(key)
    setEditNoteKey(editNote ? key : null)
    scrollCardIntoView(key)
  }

  // Chat → page: show an item the answer mentioned, without leaving the chat.
  function showItem(key) {
    const item = byKey.get(key)
    if (!item) return
    setActiveKey(key)
    flashRects(item.rects)
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
      const key = itemAtPoint(clientX, clientY, target, pageItems)
      if (key) selectFromPage(key)
    }, 0)
  }

  function handlePointerMove(event) {
    const key = itemAtPoint(event.clientX, event.clientY, event.target, pageItems)
    if (key !== hoverKey) setHoverKey(key)
  }

  function passageOf(current) {
    return { text: current.text, pageNumber: current.pageNumber, rects: current.rects }
  }

  function handleHighlight(color) {
    const id = highlights.add(passageOf(selection))
    marks.update(highlightKey(id), { color })
    clearSelection()
  }

  function handleNote() {
    const key = highlightKey(highlights.add(passageOf(selection)))
    clearSelection()
    openNew(key, { editNote: true })
  }

  function handleCheckSelection() {
    const key = highlightKey(highlights.addAndCheck(passageOf(selection)))
    clearSelection()
    openNew(key)
  }

  function askAbout(text, pageNumber) {
    setAttachment({ text, pageNumber })
    setTab('chat')
    setChatFocus((n) => n + 1)
  }

  function handleDelete(item) {
    highlights.remove(item.id)
    marks.forget(item.key)
    if (activeKey === item.key) setActiveKey(null)
  }

  function saveReference(reference) {
    highlights.add({
      text: reference.quote,
      pageNumber: reference.page_number,
      rects: reference.highlight,
    })
  }

  // The page draws what the list shows.
  const shown = items.filter((item) => isShown(item, show))
  const pageItems = shown
    .filter((item) => item.located)
    .map((item) => ({
      key: item.key,
      color: item.color,
      style: item.style,
      title: item.name,
      hasNote: Boolean(item.note),
      rects: item.rects,
    }))
  const drawnItems = flash
    ? [
        ...pageItems,
        {
          key: `flash:${flash.nonce}`,
          color: 'blue',
          style: 'fill',
          title: 'Passage from the chat',
          flash: true,
          rects: flash.rects,
        },
      ]
    : pageItems

  const savedQuotes = new Set(items.filter((item) => item.source === 'mine').map((item) => item.text))
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
              items={drawnItems}
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
        counts={{ review: shown.length || null, chat: questionCount || null }}
      >
        {tab === 'review' && (
          <ReviewList
            scan={scan}
            items={items}
            show={show}
            onShowChange={setShow}
            activeKey={activeKey}
            editNoteKey={editNoteKey}
            onSelect={select}
            onChange={(item, changes) => marks.update(item.key, changes)}
            onCheck={(item) => highlights.check(item.id)}
            onAsk={(item) => askAbout(item.text, item.pageNumber ?? 1)}
            onDelete={handleDelete}
            onNoteDone={() => setEditNoteKey(null)}
            onReset={onReset}
          />
        )}
        {tab === 'chat' && (
          <ChatPanel
            chat={chat}
            items={items}
            savedQuotes={savedQuotes}
            attachment={attachment}
            onClearAttachment={() => setAttachment(null)}
            onShowReference={(reference) => flashRects(reference.highlight)}
            onSaveReference={saveReference}
            onShowItem={showItem}
            focusSignal={chatFocus}
          />
        )}
      </ReviewPanel>

      {selection && (
        <SelectionPopover
          selection={selection}
          onHighlight={handleHighlight}
          onNote={handleNote}
          onCheck={handleCheckSelection}
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
