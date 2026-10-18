import { MAX_EXPLAIN_CHARS } from '../api/analysis'
import './SelectionPopover.css'

// A small dark toolbar that floats over the text the user selected in the PDF: scan it
// for risks and related law, add it as a note (no LLM involved), or send it to chat.
// selection: { text, x, y, below } in viewport coordinates (from the selection's box).
function SelectionPopover({ selection, onScan, onNote, onSendToChat }) {
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
      <button
        type="button"
        className="sel-action"
        onClick={onScan}
        disabled={tooLong}
        title={tooLong ? limit : 'Scan this passage for risks and related law'}
      >
        Scan
      </button>
      <button type="button" className="sel-action" onClick={onNote} title="Highlight it and add a note">
        Add note
      </button>
      <button
        type="button"
        className="sel-action"
        onClick={onSendToChat}
        disabled={tooLong}
        title={tooLong ? limit : 'Ask about this in chat'}
      >
        Send to chat
      </button>
    </div>
  )
}

export default SelectionPopover
