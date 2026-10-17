import NoteEditor from './NoteEditor'

// The "Notes" tab: a note about the whole document, then every note written on a
// finding or explanation, each with a link back to it.
// entries: [{ key, kind: 'Loophole' | 'Explanation', label, text, onShow }]
function NotesPanel({ documentNote, onSaveDocumentNote, entries }) {
  return (
    <div className="lp-body lp-notes">
      <section className="lp-card">
        <h3 className="lp-card-title">This document</h3>
        <NoteEditor
          note={documentNote}
          onSave={onSaveDocumentNote}
          addLabel="+ Add a note about this document"
          placeholder="Questions to ask, things to check, what to negotiate…"
        />
      </section>

      <h4 className="lp-eyebrow">On highlights</h4>
      {entries.length === 0 ? (
        <p className="lp-muted lp-small">
          Open a loophole or an explanation and click <b>+ Add a note</b>. Your notes are
          saved on this device and listed here.
        </p>
      ) : (
        <ul className="lp-note-list">
          {entries.map((entry) => (
            <li key={entry.key} className="lp-note-item">
              <span className="lp-note-kind">{entry.kind}</span>
              <span className="lp-note-about">{entry.label}</span>
              <p className="note-text">{entry.text}</p>
              <button type="button" className="note-link" onClick={entry.onShow}>
                Show in document
              </button>
            </li>
          ))}
        </ul>
      )}
    </div>
  )
}

export default NotesPanel
