import './ReviewPanel.css'

const TABS = [
  { id: 'review', label: 'Review' },
  { id: 'chat', label: 'Chat' },
]

// The right-hand panel: tabs on top and the chosen tab's content.
// counts: { review, chat } shown next to the tab names (null hides it).
function ReviewPanel({ tab, onTabChange, counts, children }) {
  return (
    <aside className="rv" aria-label="Review">
      <div className="rv-tabs" role="tablist">
        {TABS.map((t) => (
          <button
            key={t.id}
            type="button"
            role="tab"
            className="rv-tab"
            aria-selected={tab === t.id}
            onClick={() => onTabChange(t.id)}
          >
            {t.label}
            {counts[t.id] != null && <span className="rv-tab-count">{counts[t.id]}</span>}
          </button>
        ))}
      </div>
      {children}
    </aside>
  )
}

export default ReviewPanel
