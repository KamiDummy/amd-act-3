import { useState } from 'react'
import './NoteEditor.css'

// A personal note on a marked passage or the whole document.
// note: the saved text, or null. onSave(text): an empty text deletes the note.
// startEditing opens the editor right away, e.g. for a note just added from the page;
// onCancel is called when the user closes the editor without saving.
function NoteEditor({
  note,
  onSave,
  onCancel,
  startEditing = false,
  addLabel = '+ Add a note',
  label = 'Your note',
  placeholder,
}) {
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
          placeholder={placeholder ?? 'Write a note for yourself or your lawyer…'}
          aria-label={label}
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
        <span className="note-label">{label}</span>
        <p className="note-text">{note}</p>
        <div className="note-actions">
          <button type="button" className="note-link" onClick={edit}>
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
      <button type="button" className="note-link note-add" onClick={edit}>
        {addLabel}
      </button>
    </div>
  )
}

export default NoteEditor
