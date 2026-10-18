import ReviewCard from './ReviewCard'

const FILTERS = [
  { id: 'all', label: 'All', test: () => true },
  { id: 'risk', label: 'Risks', test: (item) => item.isRisk },
  { id: 'highlight', label: 'Highlights', test: (item) => !item.analysis },
  { id: 'favorite', label: '★ Favourites', test: (item) => item.favorite },
]

function formatElapsed(seconds) {
  return `${Math.floor(seconds / 60)}:${String(seconds % 60).padStart(2, '0')}`
}

// The Review tab: the risk scan, then everything marked on the document in page order,
// filterable, with hidden items left out unless asked for. items come from
// DocumentWorkspace, already sorted. filter is one of FILTERS' ids; the workspace keeps
// it and showHidden, to reveal an item clicked on the page.
function ReviewList({
  scan,
  items,
  filter,
  onFilterChange,
  showHidden,
  onShowHiddenChange,
  activeKey,
  onSelect,
  onChange,
  onCheck,
  onAsk,
  onDelete,
  onReset,
}) {
  const test = FILTERS.find((f) => f.id === filter).test
  const visible = items.filter((item) => test(item) && (showHidden || !item.hidden))
  const hiddenCount = items.filter((item) => item.hidden).length
  const findings = scan.result?.findings ?? []

  const severityCounts = ['high', 'medium', 'low']
    .map((s) => [s, findings.filter((f) => f.severity === s).length])
    .filter(([, n]) => n)

  let scanBar
  if (scan.scanning) {
    scanBar = (
      <div className="rv-scan" aria-busy="true">
        <span className="rv-scan-text">Scanning for risks…</span>
        <span className="rv-elapsed">{formatElapsed(scan.elapsedSeconds)}</span>
        <div className="rv-progress" aria-hidden="true">
          <span />
        </div>
      </div>
    )
  } else if (scan.error) {
    scanBar = (
      <div className="rv-scan rv-error-text" role="alert">
        <span className="rv-scan-text">{scan.error.message}</span>
        {scan.error.status !== 503 && (
          <button type="button" className="secondary small" onClick={scan.start}>
            Try again
          </button>
        )}
      </div>
    )
  } else if (scan.result) {
    scanBar = (
      <div className="rv-scan">
        <span className="rv-scan-text">
          {severityCounts.length === 0
            ? 'The scan found no risks'
            : severityCounts.map(([s, n]) => (
                <span key={s} className={`rv-sev sev-${s}`}>
                  {n} {s}
                </span>
              ))}
        </span>
        <button type="button" className="secondary small" onClick={scan.start}>
          Re-scan
        </button>
      </div>
    )
  } else {
    scanBar = (
      <div className="rv-scan">
        <button type="button" className="rv-scan-start" onClick={scan.start}>
          Scan for risks
        </button>
      </div>
    )
  }

  function handleReset() {
    if (
      window.confirm(
        'Reset this document? Its scan, your highlights, names, descriptions and the chat are deleted from this device.',
      )
    ) {
      onReset()
    }
  }

  return (
    <>
      {scanBar}

      <div className="rv-filters" role="group" aria-label="Show">
        {FILTERS.map((f) => {
          const count = items.filter((item) => f.test(item) && (showHidden || !item.hidden)).length
          return (
            <button
              key={f.id}
              type="button"
              className="rv-chip"
              aria-pressed={filter === f.id}
              onClick={() => onFilterChange(f.id)}
            >
              {f.label}
              {f.id !== 'all' && count > 0 && <span className="rv-chip-count">{count}</span>}
            </button>
          )
        })}
      </div>

      <div className="rv-body">
        {visible.length === 0 ? (
          <p className="rv-empty">
            {items.length === 0
              ? 'Select text in the document to highlight it, check it or ask about it.'
              : 'Nothing here.'}
          </p>
        ) : (
          <ol className="rv-list">
            {visible.map((item) => (
              <li key={item.key}>
                <ReviewCard
                  item={item}
                  active={item.key === activeKey}
                  onSelect={onSelect}
                  onChange={(changes) => onChange(item, changes)}
                  onCheck={onCheck}
                  onAsk={onAsk}
                  onDelete={onDelete}
                />
              </li>
            ))}
          </ol>
        )}

        <div className="rv-foot">
          {hiddenCount > 0 && (
            <button type="button" className="rv-link" onClick={() => onShowHiddenChange(!showHidden)}>
              {showHidden ? 'Leave out hidden' : `Show ${hiddenCount} hidden`}
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
