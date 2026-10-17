import { useState } from 'react'
import './NoteEditor.css'

// A personal note on a finding, an explanation or the whole document.
// note: the saved text, or null. onSave(text): an empty text deletes the note.
function NoteEditor({ note, onSave, addLabel = '+ Add a note', placeholder }) {
  const [editing, setEditing] = useState(false)
  const [draft, setDraft] = useState('')

  function startEditing() {
    setDraft(note ?? '')
    setEditing(true)
  }

  function save() {
    onSave(draft.trim())
    setEditing(false)
  }

  function handleKeyDown(event) {
    if (event.key === 'Enter' && (event.ctrlKey || event.metaKey)) save()
    if (event.key === 'Escape') {
      event.stopPropagation()
      setEditing(false)
    }
  }

  if (editing) {
    return (
      <div className="note note-editing">
        <textarea
          value={draft}
          onChange={(event) => setDraft(event.target.value)}
          onKeyDown={handleKeyDown}
          placeholder={placeholder ?? 'Write a note for yourself or your lawyer…'}
          aria-label="Note"
          rows={3}
          autoFocus
        />
        <div className="note-actions">
          <button type="button" className="small" onClick={save}>
            Save note
          </button>
          <button type="button" className="note-link" onClick={() => setEditing(false)}>
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
          <button type="button" className="note-link" onClick={startEditing}>
            Edit
          </button>
          <button type="button" className="note-link" onClick={() => onSave('')}>
            Delete
          </button>
        </div>
      </div>
    )
  }

  return (
    <div className="note">
      <button type="button" className="note-link note-add" onClick={startEditing}>
        {addLabel}
      </button>
    </div>
  )
}

export default NoteEditor
