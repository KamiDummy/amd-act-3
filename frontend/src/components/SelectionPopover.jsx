import { MAX_EXPLAIN_CHARS } from '../api/analysis'
import './SelectionPopover.css'

// A small dark toolbar that floats above the text the user selected in the PDF.
// selection: { text, x, y, below } in viewport coordinates (from the selection's box).
function SelectionPopover({ selection, onExplain }) {
  const tooLong = selection.text.length > MAX_EXPLAIN_CHARS
  return (
    <div
      className={`sel-popover${selection.below ? ' is-below' : ''}`}
      style={{ left: selection.x, top: selection.y }}
      role="toolbar"
      aria-label="Selected text"
      // Keep the text selected while clicking the button.
      onMouseDown={(event) => event.preventDefault()}
    >
      {tooLong ? (
        <span className="sel-popover-note">
          Too long to explain — select up to {MAX_EXPLAIN_CHARS.toLocaleString()} characters
        </span>
      ) : (
        <button type="button" onClick={onExplain}>
          Explain this
        </button>
      )}
    </div>
  )
}

export default SelectionPopover
