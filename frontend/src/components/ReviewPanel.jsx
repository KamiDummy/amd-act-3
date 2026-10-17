import './LoopholePanel.css'

const TABS = [
  { id: 'loopholes', label: 'Loopholes' },
  { id: 'explanations', label: 'Explanations' },
  { id: 'notes', label: 'Notes' },
]

// The right-hand panel: tabs on top, the chosen tab's content, a disclaimer below.
// counts: { loopholes, explanations, notes } shown next to the tab names (null hides it).
function ReviewPanel({ tab, onTabChange, counts, children }) {
  return (
    <aside className="lp" aria-label="Review">
      <div className="lp-tabs" role="tablist">
        {TABS.map((t) => (
          <button
            key={t.id}
            type="button"
            role="tab"
            className="lp-tab"
            aria-selected={tab === t.id}
            onClick={() => onTabChange(t.id)}
          >
            {t.label}
            {counts[t.id] != null && <span className="lp-tab-count">{counts[t.id]}</span>}
          </button>
        ))}
      </div>
      {children}
      <footer className="lp-footer">Information, not legal advice.</footer>
    </aside>
  )
}

export default ReviewPanel
