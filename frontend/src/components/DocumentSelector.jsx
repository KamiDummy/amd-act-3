import './DocumentSelector.css'

function formatSize(bytes) {
  if (bytes < 1024 * 1024) return `${Math.max(1, Math.round(bytes / 1024))} KB`
  return `${(bytes / (1024 * 1024)).toFixed(1)} MB`
}

function DocumentSelector({
  documents,
  loading,
  error,
  onRetry,
  selectedId,
  onSelect,
  onRemove,
  onNew,
}) {
  let content
  if (loading) {
    content = (
      <p className="doc-selector-empty" aria-busy="true">
        Loading documents…
      </p>
    )
  } else if (error) {
    content = (
      <div className="doc-selector-error" role="alert">
        <p>{error}</p>
        <button type="button" className="secondary small" onClick={onRetry}>
          Retry
        </button>
      </div>
    )
  } else if (documents.length === 0) {
    content = <p className="doc-selector-empty">No documents yet.</p>
  } else {
    content = (
      <ul className="doc-list">
        {documents.map((doc) => {
          const selected = doc.id === selectedId
          return (
            <li key={doc.id} className={selected ? 'doc-item is-selected' : 'doc-item'}>
              <button
                type="button"
                className="doc-item-main"
                onClick={() => onSelect(doc.id)}
                aria-current={selected ? 'true' : undefined}
                title={doc.name}
              >
                <span className="doc-thumb" aria-hidden="true" />
                <span className="doc-item-text">
                  <span className="doc-item-title">
                    <span className="doc-item-name">{doc.name}</span>
                    {doc.isSample && <span className="doc-badge">Demo</span>}
                  </span>
                  <span className="doc-item-meta">
                    {doc.pageCount} {doc.pageCount === 1 ? 'page' : 'pages'} ·{' '}
                    {formatSize(doc.size)}
                  </span>
                </span>
              </button>
              <button
                type="button"
                className="doc-item-remove"
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
    <nav className="doc-selector" aria-label="Documents">
      <div className="doc-selector-header">
        <h2>Documents</h2>
        <button type="button" className="secondary small" onClick={onNew}>
          + New
        </button>
      </div>
      {content}
    </nav>
  )
}

export default DocumentSelector
