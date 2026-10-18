import CitationList from './CitationList'
import NoteEditor from './NoteEditor'
import PenPicker from './PenPicker'
import { SEVERITY_LABEL } from './severity'
import './Pens.css'

const KIND_LABEL = { loophole: 'Loophole', check: 'Checked', highlight: 'Highlight' }

// One marked passage in the Review list: a loophole the scan found, a clause the user
// had checked, or the user's own highlight. Click the header to open it; the parent
// scrolls the PDF to it. See DocumentWorkspace for the item's shape.
function ReviewCard({
  item,
  active,
  editingNote,
  onSelect,
  onSaveNote,
  onCancelNote,
  onChangePen,
  onAsk,
  onRemove,
  onRetry,
}) {
  const { kind, status } = item
  const removeLabel = kind === 'loophole' ? 'Dismiss' : 'Delete'

  return (
    <article
      id={`item-${item.key}`}
      className={`rv-card pen-${item.color}${active ? ' is-active' : ''}`}
      aria-busy={status === 'loading'}
    >
      <button
        type="button"
        className="rv-card-head"
        onClick={() => onSelect(active ? null : item.key)}
        aria-expanded={active}
      >
        <span className="rv-meta">
          <span className="rv-kind">{KIND_LABEL[kind]}</span>
          {status === 'done' && item.severity && (
            <span className={`rv-sev sev-${item.severity}`}>{SEVERITY_LABEL[item.severity]}</span>
          )}
          {status === 'loading' && <span className="rv-sev">Checking…</span>}
          {status === 'error' && <span className="rv-sev rv-sev-error">Didn’t finish</span>}
          <span className="rv-page">{item.located ? `p. ${item.pageNumber}` : 'not on page'}</span>
          {item.note && (
            <span className="rv-has-note" title="Has a note">
              ✎
            </span>
          )}
        </span>
        {item.title ? (
          <span className="rv-title">{item.title}</span>
        ) : (
          <span className="rv-quote rv-clamp">“{item.text}”</span>
        )}
        {!active && item.note && <span className="rv-note-preview rv-clamp">{item.note}</span>}
      </button>

      {status === 'loading' && (
        <div className="rv-card-body">
          <div className="rv-progress" aria-hidden="true">
            <span />
          </div>
        </div>
      )}

      {status === 'error' && (
        <div className="rv-card-body rv-error-text" role="alert">
          <p>{item.error.message}</p>
          {item.error.status !== 422 && item.error.status !== 503 && (
            <button type="button" className="secondary small" onClick={() => onRetry(item)}>
              Try again
            </button>
          )}
        </div>
      )}

      {active && (
        <div className="rv-card-body">
          {item.title && <blockquote className="rv-quote">“{item.text}”</blockquote>}
          {item.explanation && <p>{item.explanation}</p>}
          {item.recommendation && (
            <p className="rv-todo">
              <b>What you can do:</b> {item.recommendation}
            </p>
          )}
          {item.citations && <CitationList citations={item.citations} />}

          <NoteEditor
            note={item.note}
            onSave={onSaveNote}
            onCancel={onCancelNote}
            startEditing={editingNote}
          />

          <div className="rv-card-tools">
            <PenPicker color={item.color} style={item.style} onChange={onChangePen} />
            <div className="rv-card-actions">
              <button type="button" className="rv-link" onClick={() => onAsk(item)}>
                Ask in chat
              </button>
              <button type="button" className="rv-link rv-link-danger" onClick={() => onRemove(item)}>
                {removeLabel}
              </button>
            </div>
          </div>
        </div>
      )}
    </article>
  )
}

export default ReviewCard
