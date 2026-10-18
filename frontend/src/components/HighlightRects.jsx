import './HighlightRects.css'
import './Pens.css'

function area(rects) {
  return rects.reduce((sum, r) => sum + (r.x1 - r.x0) * (r.bottom - r.top), 0)
}

// Draws the highlights that fall on one page. The backend gives each rectangle as
// fractions of the page (0 to 1 from the top-left corner), so percentages place them
// correctly at any zoom.
// items: [{ key, color, style: 'fill' | 'underline' | 'box', title, hasNote, flash,
//           rects: [{ page_number, x0, top, x1, bottom }] }]
// The rectangles let the mouse through, so the text under them can still be selected;
// the workspace finds clicked highlights by position. They stay focusable buttons for
// keyboard users. Bigger highlights are drawn first, so smaller ones sit on top.
function HighlightRects({ pageNumber, items, activeKey, hoverKey, onSelect }) {
  const ordered = [...items].sort((a, b) => area(b.rects) - area(a.rects))
  return ordered.flatMap((item) => {
    const onPage = item.rects.filter((rect) => rect.page_number === pageNumber)
    const state = [
      item.key === activeKey && 'is-active',
      item.key === hoverKey && 'is-hover',
      item.flash && 'is-flash',
    ]
      .filter(Boolean)
      .join(' ')
    const shapes = onPage.map((rect, i) => (
      <button
        key={`${item.key}-${i}`}
        type="button"
        className={`hl-rect pen-${item.color} hl-${item.style} ${state}`}
        style={{
          left: `${rect.x0 * 100}%`,
          top: `${rect.top * 100}%`,
          width: `${(rect.x1 - rect.x0) * 100}%`,
          height: `${(rect.bottom - rect.top) * 100}%`,
        }}
        aria-label={`Show: ${item.title}`}
        // Only the first line of a passage is a tab stop, so keyboard users
        // don't have to tab through every line. Flashes aren't stops at all.
        tabIndex={i === 0 && !item.flash ? 0 : -1}
        onClick={() => onSelect(item.key)}
      />
    ))
    // A small ✎ at the end of the passage's first line when the user described it.
    const first = item.rects[0]
    if (item.hasNote && first?.page_number === pageNumber) {
      shapes.push(
        <span
          key={`${item.key}-note`}
          className={`hl-note-pin pen-${item.color}`}
          style={{ left: `${first.x1 * 100}%`, top: `${first.top * 100}%` }}
          aria-hidden="true"
        >
          ✎
        </span>,
      )
    }
    return shapes
  })
}

export default HighlightRects
