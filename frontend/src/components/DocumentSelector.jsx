import './DocumentSelector.css'

function formatSize(bytes) {
  if (bytes < 1024 * 1024) return `${Math.max(1, Math.round(bytes / 1024))} KB`
  return `${(bytes / (1024 * 1024)).toFixed(1)} MB`
}

function DocumentSelector({ documents, selectedId, onSelect, onRemove, onNew }) {
  return (
    <nav className="doc-selector" aria-label="Documents">
      <div className="doc-selector-header">
        <h2>Documents</h2>
        <button type="button" className="secondary small" onClick={onNew}>
          + New
        </button>
      </div>

      {documents.length === 0 ? (
        <p className="doc-selector-empty">No documents yet.</p>
      ) : (
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
                  <span className="doc-item-name">{doc.name}</span>
                  <span className="doc-item-meta">
                    {doc.pageCount} {doc.pageCount === 1 ? 'page' : 'pages'} ·{' '}
                    {formatSize(doc.size)}
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
      )}
    </nav>
  )
}

export default DocumentSelector
