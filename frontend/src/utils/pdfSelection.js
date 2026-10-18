// Reading text selections and clicks on the PDF viewer's pages. Rectangles use the
// backend's format: fractions of the page (0 to 1 from the top-left corner).

// Taller than this (as a fraction of the page) is a container, not a line of text.
const MAX_LINE_HEIGHT = 0.06

const asElement = (node) => (node?.nodeType === Node.ELEMENT_NODE ? node : node?.parentElement)

function pageOf(element) {
  const sheet = element?.closest('.pdf-sheet')
  const pageNumber = Number(sheet?.closest('.pdf-page')?.dataset.pageNumber)
  return sheet && pageNumber ? { sheet, pageNumber } : null
}

// What the user has selected in the PDF's text layer, or null. Gives the text, the page
// it starts on, its rectangles, and where to put the toolbar (viewport coordinates).
export function readPdfSelection() {
  const selection = window.getSelection()
  if (!selection || selection.isCollapsed || selection.rangeCount === 0) return null
  // A drag that starts between lines anchors on the text layer element itself, not on a word.
  const startNode = asElement(selection.anchorNode)
  if (!startNode?.closest('.react-pdf__Page__textContent')) return null
  // Lines in the text layer are separate pieces; join them with single spaces.
  const text = selection.toString().replace(/\s+/g, ' ').trim()
  if (text.length < 2) return null
  // The page the selection starts on, whichever direction it was dragged in.
  const range = selection.getRangeAt(0)
  const first = pageOf(asElement(range.startContainer)) ?? pageOf(startNode)
  if (!first) return null
  const rects = rangeRects(range)
  if (rects.length === 0) return null
  // Place the toolbar above the selection, or below it near the top of the window,
  // and always on screen, even for a selection taller than the window.
  const box = range.getBoundingClientRect()
  const below = box.top < 90
  return {
    text,
    pageNumber: first.pageNumber,
    rects,
    x: Math.min(Math.max(box.left + box.width / 2, 170), window.innerWidth - 170),
    y: below ? Math.min(box.bottom, window.innerHeight - 70) : box.top,
    below,
  }
}

// The selected text as page rectangles, one per line.
function rangeRects(range) {
  const sheets = [...document.querySelectorAll('.pdf-sheet')].map((sheet) => ({
    box: sheet.getBoundingClientRect(),
    pageNumber: Number(sheet.closest('.pdf-page')?.dataset.pageNumber),
  }))
  const pieces = []
  for (const r of range.getClientRects()) {
    if (r.width < 1 || r.height < 1) continue
    const cx = r.left + r.width / 2
    const cy = r.top + r.height / 2
    const page = sheets.find(
      ({ box }) => cx >= box.left && cx <= box.right && cy >= box.top && cy <= box.bottom,
    )
    if (!page?.pageNumber) continue
    const { box } = page
    const piece = {
      page_number: page.pageNumber,
      x0: clamp((r.left - box.left) / box.width),
      top: clamp((r.top - box.top) / box.height),
      x1: clamp((r.right - box.left) / box.width),
      bottom: clamp((r.bottom - box.top) / box.height),
    }
    if (piece.bottom - piece.top <= MAX_LINE_HEIGHT) pieces.push(piece)
  }
  return mergeLines(pieces)
}

// The text layer gives one box per text run; join the runs on each line into one box.
function mergeLines(pieces) {
  const lines = []
  const sorted = [...pieces].sort((a, b) => a.page_number - b.page_number || a.top - b.top)
  for (const piece of sorted) {
    const middle = (piece.top + piece.bottom) / 2
    const line = lines.find(
      (l) => l.page_number === piece.page_number && middle > l.top && middle < l.bottom,
    )
    if (line) {
      line.x0 = Math.min(line.x0, piece.x0)
      line.x1 = Math.max(line.x1, piece.x1)
      line.top = Math.min(line.top, piece.top)
      line.bottom = Math.max(line.bottom, piece.bottom)
    } else {
      lines.push({ ...piece })
    }
  }
  return lines
}

function clamp(value) {
  return Math.min(1, Math.max(0, value))
}

// The item whose highlight is under the pointer, or null. When highlights overlap, the
// smallest wins, so a short phrase marked inside a highlighted clause can be clicked.
// items: [{ key, rects }]
export function itemAtPoint(clientX, clientY, target, items) {
  const page = pageOf(asElement(target))
  if (!page) return null
  const box = page.sheet.getBoundingClientRect()
  const x = (clientX - box.left) / box.width
  const y = (clientY - box.top) / box.height
  let best = null
  let bestArea = Infinity
  for (const item of items) {
    for (const r of item.rects) {
      if (r.page_number !== page.pageNumber) continue
      if (x < r.x0 || x > r.x1 || y < r.top || y > r.bottom) continue
      const area = (r.x1 - r.x0) * (r.bottom - r.top)
      if (area <= bestArea) {
        best = item.key
        bestArea = area
      }
    }
  }
  return best
}
