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
  onRemove,
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
    list = (
      <ul className="sb-docs">
        {documents.map((doc) => {
          const selected = doc.id === selectedId
          return (
            <li key={doc.id} className={selected ? 'sb-doc is-selected' : 'sb-doc'}>
              <button
                type="button"
                className="sb-doc-main"
                onClick={() => onSelect(doc.id)}
                aria-current={selected ? 'true' : undefined}
                title={doc.name}
              >
                <span className="sb-thumb" aria-hidden="true" />
                <span className="sb-doc-text">
                  <span className="sb-doc-name">{doc.name}</span>
                  <span className="sb-doc-meta">
                    {doc.pageCount} {doc.pageCount === 1 ? 'page' : 'pages'} · {formatSize(doc.size)}
                    {doc.isSample && ' · Demo'}
                  </span>
                </span>
              </button>
              <button
                type="button"
                className="sb-doc-remove"
                onClick={() => onRemove(doc.id)}
                aria-label={`Remove ${doc.name}`}
                title="Remove"
              >
                ×
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
            <span aria-hidden="true">⎋</span>
            <span className="sb-label">Sign out</span>
          </button>
        )}
      </div>
    </aside>
  )
}

export default Sidebar
