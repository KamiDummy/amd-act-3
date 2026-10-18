import { KINDS, isShown } from '../utils/show'
import ReviewCard from './ReviewCard'

function formatElapsed(seconds) {
  return `${Math.floor(seconds / 60)}:${String(seconds % 60).padStart(2, '0')}`
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

  let scanStatus
  if (scan.scanning) {
    scanStatus = (
      <span>
        Scanning the whole document… <span className="rv-elapsed">{formatElapsed(scan.elapsedSeconds)}</span>
      </span>
    )
  } else if (scan.error) {
    scanStatus = <span className="rv-error-text">{scan.error.message}</span>
  } else if (scan.result) {
    scanStatus =
      severityCounts.length === 0
        ? 'Nothing risky found'
        : severityCounts.map(([s, n]) => (
            <span key={s} className={`rv-sev sev-${s}`}>
              {n} {s}
            </span>
          ))
  } else {
    scanStatus = <span className="rv-muted">Finds risky clauses in the whole document.</span>
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

  return (
    <>
      <div className="rv-autoscan" aria-busy={scan.scanning}>
        <div className="rv-autoscan-row">
          <span className="rv-autoscan-title">Auto scan</span>
          <span className="rv-scan-status">{scanStatus}</span>
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
        </div>
        {scan.scanning && (
          <div className="rv-progress" aria-hidden="true">
            <span />
          </div>
        )}
      </div>

      <div className="rv-show" role="group" aria-label="Show">
        <span className="rv-show-label">Show</span>
        {KINDS.map((kind) => {
          const count = items.filter((item) => item.kind === kind.id && !item.hidden).length
          return (
            <button
              key={kind.id}
              type="button"
              className="rv-chip"
              aria-pressed={show[kind.id]}
              onClick={() => toggle(kind.id)}
            >
              {kind.label}
              {count > 0 && <span className="rv-chip-count">{count}</span>}
            </button>
          )
        })}
        <button
          type="button"
          className="rv-chip"
          aria-pressed={show.favoritesOnly}
          onClick={() => toggle('favoritesOnly')}
          title="Show only favourites, in the list and on the page"
        >
          ★ Favourites only
        </button>
      </div>

      <div className="rv-body">
        {visible.length === 0 ? (
          <p className="rv-empty">
            {items.length === 0
              ? 'Select text in the document to scan it, add a note or send it to chat.'
              : 'No highlights match what Show is set to.'}
          </p>
        ) : (
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
        )}

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
      </div>
    </>
  )
}

export default ReviewList
