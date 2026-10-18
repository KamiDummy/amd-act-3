import NoteEditor from './NoteEditor'
import ReviewCard from './ReviewCard'

const FILTERS = [
  { id: 'all', label: 'All', test: () => true },
  { id: 'loophole', label: 'Loopholes', test: (item) => item.kind === 'loophole' },
  { id: 'check', label: 'Checked', test: (item) => item.kind === 'check' },
  { id: 'highlight', label: 'Highlights', test: (item) => item.kind === 'highlight' },
  { id: 'note', label: 'Notes', test: (item) => Boolean(item.note) },
]

function formatElapsed(seconds) {
  return `${Math.floor(seconds / 60)}:${String(seconds % 60).padStart(2, '0')}`
}

// The Review tab: the loophole scan, then everything marked on the document, in page
// order, filterable by kind. items come from DocumentWorkspace, already sorted.
// filter is one of FILTERS' ids; the workspace keeps it, to show all when a highlight
// on the page is clicked.
function ReviewList({
  scan,
  items,
  filter,
  onFilterChange,
  activeKey,
  editNoteKey,
  onSelect,
  onSaveNote,
  onCancelNote,
  onChangePen,
  onAsk,
  onRemove,
  onRetry,
  documentNote,
  onSaveDocumentNote,
  dismissedCount,
  onRestoreDismissed,
}) {
  const visible = items.filter(FILTERS.find((f) => f.id === filter).test)
  const findings = scan.result?.findings ?? []

  const severityCounts = ['high', 'medium', 'low']
    .map((s) => [s, findings.filter((f) => f.severity === s).length])
    .filter(([, n]) => n)

  let scanBar
  if (scan.scanning) {
    scanBar = (
      <div className="rv-scan" aria-busy="true">
        <span className="rv-scan-text">Scanning for loopholes…</span>
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
            ? 'No loopholes found'
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
          Find loopholes
        </button>
      </div>
    )
  }

  return (
    <>
      {scanBar}

      <div className="rv-filters" role="group" aria-label="Show">
        {FILTERS.map((f) => {
          const count = items.filter(f.test).length
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
        {(filter === 'all' || filter === 'note') && (
          <section className="rv-doc-note">
            <NoteEditor
              note={documentNote}
              onSave={onSaveDocumentNote}
              addLabel="+ Note on this document"
              label="Document note"
              placeholder="Questions to ask, things to check, what to negotiate…"
            />
          </section>
        )}

        {visible.length === 0 ? (
          <p className="rv-empty">
            {items.length === 0
              ? 'Select text in the document to highlight it, add a note, check it or ask about it.'
              : 'Nothing here yet.'}
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
                  onSaveNote={(text) => onSaveNote(item, text)}
                  onCancelNote={onCancelNote}
                  onChangePen={(change) => onChangePen(item, change)}
                  onAsk={onAsk}
                  onRemove={onRemove}
                  onRetry={onRetry}
                />
              </li>
            ))}
          </ol>
        )}

        {dismissedCount > 0 && (filter === 'all' || filter === 'loophole') && (
          <p className="rv-dismissed">
            {dismissedCount} dismissed ·{' '}
            <button type="button" className="rv-link" onClick={onRestoreDismissed}>
              Show again
            </button>
          </p>
        )}
      </div>
    </>
  )
}

export default ReviewList
