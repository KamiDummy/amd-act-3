import { KINDS, isShown } from '../utils/show'
import ReviewCard from './ReviewCard'

function formatElapsed(seconds) {
  return `${Math.floor(seconds / 60)}:${String(seconds % 60).padStart(2, '0')}`
}

// The Review tab: Show toggles, then the user's own highlights and notes, then what the
// automatic scan found, each in page order. items come from DocumentWorkspace, already
// sorted; show is the toggles (utils/show.js), which the workspace keeps because they
// filter the page too.
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
  const mine = visible.filter((item) => item.kind !== 'auto')
  const auto = visible.filter((item) => item.kind === 'auto')
  const hiddenCount = items.filter((item) => item.hidden).length
  const findings = scan.result?.findings ?? []
  const severityCounts = ['high', 'medium', 'low']
    .map((s) => [s, findings.filter((f) => f.severity === s).length])
    .filter(([, n]) => n)

  function toggle(key) {
    onShowChange({ ...show, [key]: !show[key] })
  }

  function renderCards(list) {
    return (
      <ol className="rv-list">
        {list.map((item) => (
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

  let scanStatus = null
  if (scan.scanning) {
    scanStatus = (
      <div className="rv-scan-status" aria-busy="true">
        <span>
          Scanning… <span className="rv-elapsed">{formatElapsed(scan.elapsedSeconds)}</span>
        </span>
        <div className="rv-progress" aria-hidden="true">
          <span />
        </div>
      </div>
    )
  } else if (scan.error) {
    scanStatus = (
      <p className="rv-scan-status rv-error-text" role="alert">
        {scan.error.message}
      </p>
    )
  } else if (scan.result) {
    scanStatus = (
      <p className="rv-scan-status">
        {severityCounts.length === 0
          ? 'Nothing risky found.'
          : severityCounts.map(([s, n]) => (
              <span key={s} className={`rv-sev sev-${s}`}>
                {n} {s}
              </span>
            ))}
      </p>
    )
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

  const mineOn = show.highlight || show.note
  return (
    <>
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
        <section className="rv-section" aria-label="Your highlights and notes">
          <h3 className="rv-section-title">
            Yours
            {mine.length > 0 && <span className="rv-chip-count">{mine.length}</span>}
          </h3>
          {!mineOn ? (
            <p className="rv-empty">Turned off in Show.</p>
          ) : mine.length > 0 ? (
            renderCards(mine)
          ) : (
            <p className="rv-empty">
              {items.some((item) => item.kind !== 'auto')
                ? 'None match what Show is set to.'
                : 'Select text in the document to highlight it or add a note.'}
            </p>
          )}
        </section>

        <section className="rv-section" aria-label="Automatic scan">
          <div className="rv-section-head">
            <h3 className="rv-section-title">
              Auto scan
              {auto.length > 0 && <span className="rv-chip-count">{auto.length}</span>}
            </h3>
            {!scan.scanning && (
              <button
                type="button"
                className={scan.result ? 'secondary small' : 'small'}
                onClick={scan.start}
                disabled={scan.error?.status === 503}
              >
                {scan.result ? 'Re-run' : scan.error ? 'Try again' : 'Run auto scan'}
              </button>
            )}
          </div>
          {scanStatus}
          {!show.auto ? (
            scan.result && <p className="rv-empty">Turned off in Show.</p>
          ) : auto.length > 0 ? (
            renderCards(auto)
          ) : (
            !scan.result &&
            !scan.scanning && (
              <p className="rv-empty">Finds risky clauses in the whole document. Takes about a minute.</p>
            )
          )}
        </section>

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
