import { useState } from 'react'
import './NoteEditor.css'

// The user's own note on a highlight: what it means to them, what to ask or negotiate.
// note: the saved text, or null. onSave(text): an empty text deletes it.
// startEditing opens the editor right away, for a note just started from the page;
// onCancel is called when the user closes the editor without saving.
function NoteEditor({ note, onSave, onCancel, startEditing = false }) {
  const [editing, setEditing] = useState(startEditing)
  const [draft, setDraft] = useState(note ?? '')

  function edit() {
    setDraft(note ?? '')
    setEditing(true)
  }

  function save() {
    onSave(draft.trim())
    setEditing(false)
  }

  function cancel() {
    setEditing(false)
    onCancel?.()
  }

  function handleKeyDown(event) {
    if (event.key === 'Enter' && (event.ctrlKey || event.metaKey)) save()
    if (event.key === 'Escape') {
      event.stopPropagation()
      cancel()
    }
  }

  if (editing) {
    return (
      <div className="note note-editing">
        <textarea
          value={draft}
          onChange={(event) => setDraft(event.target.value)}
          onKeyDown={handleKeyDown}
          placeholder="What this means for you, what to ask or negotiate…"
          aria-label="Note"
          rows={3}
          autoFocus
        />
        <div className="note-actions">
          <button type="button" className="small" onClick={save}>
            Save note
          </button>
          <button type="button" className="note-link" onClick={cancel}>
            Cancel
          </button>
          <span className="note-hint">Ctrl+Enter to save</span>
        </div>
      </div>
    )
  }

  if (note) {
    return (
      <div className="note">
        <span className="note-label">Your note</span>
        <p className="note-text">{note}</p>
        <div className="note-actions">
          <button type="button" className="note-link" onClick={edit}>
            Edit
          </button>
          <button type="button" className="note-link" onClick={() => onSave('')}>
            Delete note
          </button>
        </div>
      </div>
    )
  }

  return (
    <div className="note">
      <button type="button" className="note-link note-add" onClick={edit}>
        + Add a note
      </button>
    </div>
  )
}

export default NoteEditor
