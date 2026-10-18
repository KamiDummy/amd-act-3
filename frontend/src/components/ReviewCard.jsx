import { useState } from 'react'
import CitationList from './CitationList'
import NoteEditor from './NoteEditor'
import PenPicker from './PenPicker'
import './Pens.css'

const KIND_LABEL = { auto: 'Auto', highlight: 'Highlight', note: 'Note' }
const RISK_LABEL = { high: 'High risk', medium: 'Medium risk', low: 'Low risk', none: 'Looks fine' }

// One highlight in the Review list: found by the automatic scan, or the user's own
// (with or without a note). A checked one carries a risk badge. Click the header to
// open it; the parent scrolls the PDF to it. See DocumentWorkspace for the item's shape.
// onChange(changes) saves the user's marks: { name, description (the note), favorite,
// hidden, color, style }. editingNote opens the note editor at once.
function ReviewCard({ item, active, editingNote, onSelect, onChange, onCheck, onAsk, onDelete, onNoteDone }) {
  const [renaming, setRenaming] = useState(false)
  const [draftName, setDraftName] = useState('')
  const busy = item.status === 'loading'
  const severity = item.analysis?.severity

  function startRename() {
    setDraftName(item.name)
    setRenaming(true)
  }

  function saveName(event) {
    event.preventDefault()
    const name = draftName.trim()
    // An empty name, or the default one, goes back to the default.
    onChange({ name: name && name !== item.defaultName ? name : null })
    setRenaming(false)
  }

  const classes = ['rv-card', `pen-${item.color}`, active && 'is-active', item.hidden && 'is-hidden']
  return (
    <article id={`item-${item.key}`} className={classes.filter(Boolean).join(' ')} aria-busy={busy}>
      <div className="rv-card-top">
        {renaming ? (
          <form className="rv-rename" onSubmit={saveName}>
            <input
              value={draftName}
              onChange={(event) => setDraftName(event.target.value)}
              onKeyDown={(event) => event.key === 'Escape' && setRenaming(false)}
              aria-label="Name"
              maxLength={120}
              autoFocus
            />
            <button type="submit" className="small">
              Save
            </button>
          </form>
        ) : (
          <button
            type="button"
            className="rv-card-head"
            onClick={() => onSelect(active ? null : item.key)}
            aria-expanded={active}
          >
            <span className="rv-meta">
              <span className="rv-kind">{KIND_LABEL[item.kind]}</span>
              {busy && <span className="rv-sev">Checking…</span>}
              {item.status === 'error' && <span className="rv-sev rv-sev-error">Check didn’t finish</span>}
              {!busy && severity && <span className={`rv-sev sev-${severity}`}>{RISK_LABEL[severity]}</span>}
              <span className="rv-page">{item.located ? `p. ${item.pageNumber}` : 'not on page'}</span>
            </span>
            <span className="rv-title">{item.name}</span>
            {!active && item.note && <span className="rv-note-preview rv-clamp">✎ {item.note}</span>}
          </button>
        )}
        <div className="rv-card-icons">
          <button
            type="button"
            className={item.favorite ? 'rv-icon is-on rv-star' : 'rv-icon rv-star'}
            onClick={() => onChange({ favorite: !item.favorite })}
            aria-pressed={item.favorite}
            aria-label="Favourite"
            title={item.favorite ? 'Remove from favourites' : 'Add to favourites'}
          >
            {item.favorite ? '★' : '☆'}
          </button>
          <button
            type="button"
            className={item.hidden ? 'rv-icon is-on' : 'rv-icon'}
            onClick={() => onChange({ hidden: !item.hidden })}
            aria-pressed={item.hidden}
            aria-label="Hidden"
            title={item.hidden ? 'Show on the page again' : 'Hide from the page and the list'}
          >
            <svg viewBox="0 0 24 24" width="16" height="16" aria-hidden="true">
              <path
                d="M2 12s3.6-7 10-7 10 7 10 7-3.6 7-10 7S2 12 2 12Z"
                fill="none"
                stroke="currentColor"
                strokeWidth="1.8"
              />
              <circle cx="12" cy="12" r="3" fill="none" stroke="currentColor" strokeWidth="1.8" />
              {item.hidden && <path d="M3 3l18 18" stroke="currentColor" strokeWidth="1.8" />}
            </svg>
          </button>
        </div>
      </div>

      {busy && (
        <div className="rv-card-body">
          <div className="rv-progress" aria-hidden="true">
            <span />
          </div>
        </div>
      )}

      {item.status === 'error' && (
        <div className="rv-card-body rv-error-text" role="alert">
          <p>{item.error.message}</p>
          {item.error.status !== 422 && item.error.status !== 503 && (
            <button type="button" className="secondary small" onClick={() => onCheck(item)}>
              Try again
            </button>
          )}
        </div>
      )}

      {active && (
        <div className="rv-card-body">
          {item.name !== item.text && <blockquote className="rv-quote">“{item.text}”</blockquote>}

          <NoteEditor
            note={item.note}
            onSave={(text) => {
              onChange({ description: text || null })
              onNoteDone()
            }}
            onCancel={onNoteDone}
            startEditing={editingNote}
          />

          {item.analysis ? (
            <>
              {item.analysis.explanation && <p>{item.analysis.explanation}</p>}
              {item.analysis.recommendation && (
                <p className="rv-todo">
                  <b>What you can do:</b> {item.analysis.recommendation}
                </p>
              )}
              <CitationList citations={item.analysis.citations} />
            </>
          ) : (
            !busy && (
              <button type="button" className="secondary small rv-check" onClick={() => onCheck(item)}>
                Check for risks and related law
              </button>
            )
          )}

          <div className="rv-card-tools">
            <PenPicker color={item.color} style={item.style} onChange={onChange} />
            <div className="rv-card-actions">
              <button type="button" className="rv-link" onClick={startRename}>
                Rename
              </button>
              <button type="button" className="rv-link" onClick={() => onAsk(item)}>
                Ask in chat
              </button>
              {item.source === 'mine' && item.analysis && !busy && (
                <button type="button" className="rv-link" onClick={() => onCheck(item)}>
                  Re-check
                </button>
              )}
              {item.source === 'mine' && (
                <button type="button" className="rv-link rv-link-danger" onClick={() => onDelete(item)}>
                  Delete
                </button>
              )}
            </div>
          </div>
        </div>
      )}
    </article>
  )
}

export default ReviewCard
