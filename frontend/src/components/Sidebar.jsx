import { useStoredState } from '../hooks/useStoredState'
import Logo from './Logo'
import './Sidebar.css'

function formatSize(bytes) {
  if (bytes < 1024 * 1024) return `${Math.max(1, Math.round(bytes / 1024))} KB`
  return `${(bytes / (1024 * 1024)).toFixed(1)} MB`
}

// The left menu: logo, documents, and Sign out at the bottom. Collapses to a narrow
// strip of icons, remembered on this device, so the document gets the whole screen.
function Sidebar({
  documents,
  loading,
  error,
  onRetry,
  selectedId,
  onSelect,
  onNew,
  onSignOut,
}) {
  const [collapsed, setCollapsed] = useStoredState('ui:sidebar-collapsed', false)

  let list
  if (loading) {
    list = (
      <p className="sb-empty" aria-busy="true">
        Loading…
      </p>
    )
  } else if (error) {
    list = (
      <div className="sb-error" role="alert">
        <p>{error}</p>
        <button type="button" className="secondary small" onClick={onRetry}>
          Retry
        </button>
      </div>
    )
  } else if (documents.length === 0) {
    list = <p className="sb-empty">No documents yet.</p>
  } else {
    // Demo contracts stay on top, so they're the first thing a new visitor sees. Each
    // group keeps its newest-first order.
    const ordered = [...documents.filter((d) => d.isSample), ...documents.filter((d) => !d.isSample)]
    list = (
      <ul className="sb-docs">
        {ordered.map((doc) => {
          const selected = doc.id === selectedId
          const classes = ['sb-doc', selected && 'is-selected', doc.isSample && 'is-demo']
          return (
            <li key={doc.id} className={classes.filter(Boolean).join(' ')}>
              <button
                type="button"
                className="sb-doc-main"
                onClick={() => onSelect(doc.id)}
                aria-current={selected ? 'true' : undefined}
                title={doc.isSample ? `${doc.name} (demo)` : doc.name}
              >
                <span className="sb-thumb" aria-hidden="true" />
                <span className="sb-doc-text">
                  <span className="sb-doc-title">
                    <span className="sb-doc-name">{doc.name}</span>
                    {doc.isSample && <span className="demo-tag">Demo</span>}
                  </span>
                  <span className="sb-doc-meta">
                    {doc.pageCount} {doc.pageCount === 1 ? 'page' : 'pages'} · {formatSize(doc.size)}
                  </span>
                </span>
              </button>
            </li>
          )
        })}
      </ul>
    )
  }

  return (
    <aside className={collapsed ? 'sidebar is-collapsed' : 'sidebar'}>
      <div className="sb-top">
        <Logo compact={collapsed} />
        <button
          type="button"
          className="sb-icon"
          onClick={() => setCollapsed((c) => !c)}
          aria-label={collapsed ? 'Expand menu' : 'Collapse menu'}
          aria-expanded={!collapsed}
          title={collapsed ? 'Expand menu' : 'Collapse menu'}
        >
          {collapsed ? '»' : '«'}
        </button>
      </div>

      <button type="button" className="secondary sb-new" onClick={onNew} title="Upload a document">
        <span aria-hidden="true">+</span>
        <span className="sb-label">New document</span>
      </button>

      <nav className="sb-list" aria-label="Documents">
        {list}
      </nav>

      <div className="sb-bottom">
        <span className="sb-label sb-disclaimer">Information, not legal advice</span>
        {onSignOut && (
          <button type="button" className="sb-signout" onClick={onSignOut} title="Sign out">
            <svg viewBox="0 0 24 24" width="18" height="18" aria-hidden="true">
              <path
                d="M10 4H6a2 2 0 0 0-2 2v12a2 2 0 0 0 2 2h4"
                fill="none"
                stroke="currentColor"
                strokeWidth="1.8"
                strokeLinecap="round"
              />
              <path
                d="M15 8l4 4-4 4M19 12H9"
                fill="none"
                stroke="currentColor"
                strokeWidth="1.8"
                strokeLinecap="round"
                strokeLinejoin="round"
              />
            </svg>
            <span className="sb-label">Sign out</span>
          </button>
        )}
      </div>
    </aside>
  )
}

export default Sidebar
