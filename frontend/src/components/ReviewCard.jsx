import { useState } from 'react'
import CitationList from './CitationList'
import DescriptionEditor from './DescriptionEditor'
import PenPicker from './PenPicker'
import './Pens.css'

const RISK_LEVEL = { high: 'High', medium: 'Medium', low: 'Low' }

// The label above an item's name: what it is, and how risky when it was checked.
function kindLabel(item) {
  if (item.status === 'loading') return 'Checking…'
  if (item.status === 'error') return 'Check didn’t finish'
  if (!item.analysis) return 'Highlight'
  if (item.analysis.severity === 'none') return 'Checked · Looks fine'
  return `Risk · ${RISK_LEVEL[item.analysis.severity]}`
}

// One marked passage in the Review list: a risk (found by the scan, or a highlight the
// user had checked) or a plain highlight. Click the header to open it; the parent
// scrolls the PDF to it. See DocumentWorkspace for the item's shape.
// onChange(changes) saves the user's marks: { name, description, favorite, hidden,
// color, style }.
function ReviewCard({ item, active, onSelect, onChange, onCheck, onAsk, onDelete }) {
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
              <span className={`rv-kind${severity ? ` sev-${severity}` : ''}`}>{kindLabel(item)}</span>
              <span className="rv-page">{item.located ? `p. ${item.pageNumber}` : 'not on page'}</span>
              {item.hidden && <span className="rv-page">hidden</span>}
            </span>
            <span className="rv-title">{item.name}</span>
            {!active && item.description && (
              <span className="rv-note-preview rv-clamp">{item.description}</span>
            )}
          </button>
        )}
        <button
          type="button"
          className={item.favorite ? 'rv-star is-on' : 'rv-star'}
          onClick={() => onChange({ favorite: !item.favorite })}
          aria-pressed={item.favorite}
          aria-label={item.favorite ? 'Remove from favourites' : 'Add to favourites'}
          title={item.favorite ? 'Favourite' : 'Add to favourites'}
        >
          {item.favorite ? '★' : '☆'}
        </button>
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

          <DescriptionEditor
            note={item.description}
            onSave={(text) => onChange({ description: text || null })}
          />

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
              <button type="button" className="rv-link" onClick={() => onChange({ hidden: !item.hidden })}>
                {item.hidden ? 'Unhide' : 'Hide'}
              </button>
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
