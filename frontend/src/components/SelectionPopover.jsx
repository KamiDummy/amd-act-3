import { MAX_EXPLAIN_CHARS } from '../api/analysis'
import { PEN_COLORS } from '../utils/pens'
import './Pens.css'
import './SelectionPopover.css'

// A small dark toolbar that floats over the text the user selected in the PDF:
// highlight it in a colour, write a note on it, check it for risks and related law, or
// ask about it in chat.
// selection: { text, x, y, below } in viewport coordinates (from the selection's box).
function SelectionPopover({ selection, onHighlight, onNote, onCheck, onAsk }) {
  const tooLong = selection.text.length > MAX_EXPLAIN_CHARS
  const limit = `Select up to ${MAX_EXPLAIN_CHARS.toLocaleString()} characters`
  return (
    <div
      className={`sel-popover${selection.below ? ' is-below' : ''}`}
      style={{ left: selection.x, top: selection.y }}
      role="toolbar"
      aria-label="Selected text"
      // Keep the text selected while clicking the buttons.
      onMouseDown={(event) => event.preventDefault()}
    >
      <div className="sel-pens" role="group" aria-label="Highlight">
        {PEN_COLORS.map((pen) => (
          <button
            key={pen.id}
            type="button"
            className={`sel-pen pen-${pen.id}`}
            onClick={() => onHighlight(pen.id)}
            aria-label={`Highlight in ${pen.label.toLowerCase()}`}
            title={`Highlight in ${pen.label.toLowerCase()}`}
          />
        ))}
      </div>
      <span className="sel-divider" aria-hidden="true" />
      <button type="button" className="sel-action" onClick={onNote} title="Highlight it and write a note">
        Note
      </button>
      <button
        type="button"
        className="sel-action"
        onClick={onCheck}
        disabled={tooLong}
        title={tooLong ? limit : 'Check this clause for risks and related law'}
      >
        Check
      </button>
      <button
        type="button"
        className="sel-action"
        onClick={onAsk}
        disabled={tooLong}
        title={tooLong ? limit : 'Ask about this in chat'}
      >
        Ask
      </button>
    </div>
  )
}

export default SelectionPopover
