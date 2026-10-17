import './HighlightRects.css'

// Draws the highlight rectangles that fall on one page. The backend gives each
// rectangle as fractions of the page (0 to 1 from the top-left corner), so
// percentages place them correctly at any zoom.
// items: [{ id, severity, title, rects: [{ page_number, x0, top, x1, bottom }] }]
function HighlightRects({ pageNumber, items, activeId, onSelect }) {
  return items.flatMap((item) =>
    item.rects
      .filter((rect) => rect.page_number === pageNumber)
      .map((rect, i) => (
        <button
          key={`${item.id}-${i}`}
          type="button"
          className={`hl-rect sev-${item.severity}${item.id === activeId ? ' is-active' : ''}`}
          style={{
            left: `${rect.x0 * 100}%`,
            top: `${rect.top * 100}%`,
            width: `${(rect.x1 - rect.x0) * 100}%`,
            height: `${(rect.bottom - rect.top) * 100}%`,
          }}
          title={item.title}
          aria-label={`Show finding: ${item.title}`}
          // Only the first line of a passage is a tab stop, so keyboard users
          // don't have to tab through every line.
          tabIndex={i === 0 ? 0 : -1}
          onClick={() => onSelect(item.id)}
        />
      )),
  )
}

export default HighlightRects
