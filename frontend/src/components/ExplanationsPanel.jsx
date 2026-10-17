import CitationList from './CitationList'
import { SEVERITY_LABEL } from './severity'

// The "Explanations" tab: every passage the user asked about, newest first.
// items: [{ id, text, pageNumber, status: 'loading' | 'done' | 'error', error, result }]
function ExplanationsPanel({ items, activeId, onSelect, onRemove, onRetry }) {
  return (
    <div className="lp-body">
      {items.length === 0 ? (
        <div className="lp-card">
          <h3 className="lp-card-title">Ask about any sentence</h3>
          <p className="lp-muted">
            Select text in the contract and click <b>Explain this</b>. You’ll get a
            plain-language explanation, how risky it is, and related Canadian law. The
            passage is highlighted in yellow.
          </p>
          <p className="lp-hint">Takes about 10 seconds. Saved on this device.</p>
        </div>
      ) : (
        <ol className="lp-list">
          {items.map((item) => (
            <li key={item.id}>
              <ExplanationCard
                item={item}
                active={item.id === activeId}
                onSelect={onSelect}
                onRemove={onRemove}
                onRetry={onRetry}
              />
            </li>
          ))}
        </ol>
      )}
    </div>
  )
}

function ExplanationCard({ item, active, onSelect, onRemove, onRetry }) {
  const { status, result } = item
  const severity = result?.severity
  return (
    <article
      id={`explanation-${item.id}`}
      className={`lp-finding sev-mine${active ? ' is-active' : ''}`}
      aria-busy={status === 'loading'}
    >
      <div className="lp-explain-head">
        <button
          type="button"
          className="lp-finding-head"
          onClick={() => onSelect(active ? null : item.id)}
          aria-expanded={active}
        >
          <span className="lp-finding-meta">
            {status === 'done' && (
              <span className={`lp-sev sev-${severity}`}>{SEVERITY_LABEL[severity]}</span>
            )}
            {status === 'loading' && <span className="lp-sev">Explaining…</span>}
            {status === 'error' && <span className="lp-sev lp-sev-error">Didn’t finish</span>}
            <span className="lp-page">p. {item.pageNumber}</span>
          </span>
          <span className="lp-quote lp-quote-clamp">“{item.text}”</span>
        </button>
        <button
          type="button"
          className="lp-remove"
          onClick={() => onRemove(item.id)}
          aria-label="Remove this explanation"
          title="Remove"
        >
          ×
        </button>
      </div>

      {status === 'loading' && (
        <div className="lp-finding-body">
          <div className="lp-progress" aria-hidden="true">
            <span />
          </div>
          <p className="lp-muted lp-small">Reading the passage and searching the law. About 10 seconds.</p>
        </div>
      )}

      {status === 'error' && (
        <div className="lp-finding-body lp-error-text" role="alert">
          <p>{item.error.message}</p>
          {item.error.status === 503 ? (
            <p className="lp-muted lp-small">
              The AI isn’t set up on the server yet. Ask the team to add the Token Factory
              key to the backend’s .env.
            </p>
          ) : (
            item.error.status !== 422 && (
              <button type="button" className="secondary small" onClick={() => onRetry(item.id)}>
                Try again
              </button>
            )
          )}
        </div>
      )}

      {status === 'done' && active && (
        <div className="lp-finding-body">
          <p>{result.explanation}</p>
          <CitationList citations={result.citations} />
        </div>
      )}
    </article>
  )
}

export default ExplanationsPanel
