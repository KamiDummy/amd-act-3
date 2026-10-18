import { DEFAULT_SHOW, KINDS, isShown } from '../utils/show'
import ReviewCard from './ReviewCard'

function formatElapsed(seconds) {
  return `${Math.floor(seconds / 60)}:${String(seconds % 60).padStart(2, '0')}`
}

// A page with a highlighted line and a magnifier: the automatic scan.
function ScanIcon() {
  return (
    <svg viewBox="0 0 24 24" width="20" height="20" aria-hidden="true">
      <path d="M6 3h8l4 4v6" fill="none" stroke="currentColor" strokeWidth="1.7" strokeLinejoin="round" />
      <path d="M6 3v18h6" fill="none" stroke="currentColor" strokeWidth="1.7" strokeLinejoin="round" />
      <path d="M9 9h6" stroke="currentColor" strokeWidth="1.7" strokeLinecap="round" />
      <path d="M9 12.5h3" stroke="currentColor" strokeWidth="1.7" strokeLinecap="round" />
      <circle cx="17" cy="17" r="3" fill="none" stroke="currentColor" strokeWidth="1.7" />
      <path d="m19.2 19.2 2 2" stroke="currentColor" strokeWidth="1.7" strokeLinecap="round" />
    </svg>
  )
}

// The Highlights tab: the automatic scan, the Show toggles, then every highlight top to
// bottom in page order. items come from DocumentWorkspace, already sorted; show is the
// toggles (utils/show.js), which the workspace keeps because they filter the page too.
function ReviewList({
  scan,
  items,
  show,
  onShowChange,
  activeKey,
  editNoteKey,
  onSelect,
  onChange,
  onCheck,
  onAsk,
  onDelete,
  onNoteDone,
  onReset,
}) {
  const visible = items.filter((item) => isShown(item, show))
  const hiddenCount = items.filter((item) => item.hidden).length
  const findings = scan.result?.findings ?? []
  const severityCounts = ['high', 'medium', 'low']
    .map((s) => [s, findings.filter((f) => f.severity === s).length])
    .filter(([, n]) => n)

  function toggle(key) {
    onShowChange({ ...show, [key]: !show[key] })
  }

  let status
  if (scan.scanning) {
    status = (
      <>
        Scanning the whole document · <span className="rv-elapsed">{formatElapsed(scan.elapsedSeconds)}</span>
      </>
    )
  } else if (scan.error) {
    status = <span className="rv-error-text">{scan.error.message}</span>
  } else if (scan.result) {
    status =
      severityCounts.length === 0
        ? 'Nothing risky found'
        : severityCounts.map(([s, n]) => (
            <span key={s} className={`rv-pill sev-${s}`}>
              {n} {s}
            </span>
          ))
  } else {
    status = 'Checks the whole document for risky clauses · about a minute'
  }

  function handleReset() {
    if (
      window.confirm(
        'Reset this document? Its auto scan, your highlights and notes, and the chat are deleted from this device.',
      )
    ) {
      onReset()
    }
  }

  let content
  if (items.length === 0) {
    content = (
      <div className="rv-empty-state">
        <div className="rv-empty-art" aria-hidden="true">
          <span />
          <span className="is-marked" />
          <span />
          <span className="is-short" />
        </div>
        <h3>No highlights yet</h3>
        <p>Select text in the document, then:</p>
        <ul>
          <li>
            <b>Scan</b> it for risks and related law
          </li>
          <li>
            <b>Add note</b> to keep it with your own words
          </li>
          <li>
            <b>Send to chat</b> to ask about it
          </li>
        </ul>
        <p className="rv-muted">Or run the auto scan above to check the whole document at once.</p>
      </div>
    )
  } else if (visible.length === 0) {
    content = (
      <p className="rv-empty">
        No highlights match what Show is set to.{' '}
        <button type="button" className="rv-link" onClick={() => onShowChange(DEFAULT_SHOW)}>
          Show all
        </button>
      </p>
    )
  } else {
    content = (
      <ol className="rv-list">
        {visible.map((item) => (
          <li key={item.key}>
            <ReviewCard
              item={item}
              active={item.key === activeKey}
              editingNote={item.key === editNoteKey}
              onSelect={onSelect}
              onChange={(changes) => onChange(item, changes)}
              onCheck={onCheck}
              onAsk={onAsk}
              onDelete={onDelete}
              onNoteDone={onNoteDone}
            />
          </li>
        ))}
      </ol>
    )
  }

  return (
    <>
      <div className="rv-top">
        <div className={scan.scanning ? 'rv-autoscan is-busy' : 'rv-autoscan'} aria-busy={scan.scanning}>
          <span className="rv-autoscan-icon">
            <ScanIcon />
          </span>
          <div className="rv-autoscan-text">
            <span className="rv-autoscan-title">Auto scan</span>
            <span className="rv-autoscan-status">{status}</span>
          </div>
          {!scan.scanning && (
            <button
              type="button"
              className={scan.result ? 'secondary small' : 'small'}
              onClick={scan.start}
              disabled={scan.error?.status === 503}
            >
              {scan.result ? 'Re-run' : scan.error ? 'Try again' : 'Run'}
            </button>
          )}
          {scan.scanning && (
            <div className="rv-progress rv-autoscan-progress" aria-hidden="true">
              <span />
            </div>
          )}
        </div>

        <div className="rv-show">
          <div className="rv-segments" role="group" aria-label="Show">
            {KINDS.map((kind) => {
              const count = items.filter((item) => item.kind === kind.id && !item.hidden).length
              return (
                <button
                  key={kind.id}
                  type="button"
                  className="rv-seg"
                  aria-pressed={show[kind.id]}
                  onClick={() => toggle(kind.id)}
                  title={show[kind.id] ? `Leave out ${kind.label.toLowerCase()}` : `Show ${kind.label.toLowerCase()}`}
                >
                  <span className="rv-seg-label">{kind.label}</span>
                  <span className="rv-seg-count">{count}</span>
                </button>
              )
            })}
          </div>
          <button
            type="button"
            className="rv-fav-toggle"
            aria-pressed={show.favoritesOnly}
            onClick={() => toggle('favoritesOnly')}
            aria-label="Favourites only"
            title={show.favoritesOnly ? 'Show all, not just favourites' : 'Show only favourites, in the list and on the page'}
          >
            {show.favoritesOnly ? '★' : '☆'}
          </button>
        </div>
      </div>

      <div className="rv-body">
        {content}

        {items.length > 0 && (
          <div className="rv-foot">
            {hiddenCount > 0 && (
              <button type="button" className="rv-link" onClick={() => toggle('hidden')}>
                {show.hidden ? 'Leave out hidden' : `Show ${hiddenCount} hidden`}
              </button>
            )}
            <button type="button" className="rv-link rv-link-danger" onClick={handleReset}>
              Reset this document
            </button>
          </div>
        )}
      </div>
    </>
  )
}

export default ReviewList
