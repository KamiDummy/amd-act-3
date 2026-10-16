import { useState } from 'react'
import LoginPage from './components/LoginPage'
import FileUpload from './components/FileUpload'
import DocumentSelector from './components/DocumentSelector'
import { clearToken, getStoredToken, storeToken } from './api/auth'
import './App.css'

function App() {
  const [token, setToken] = useState(getStoredToken)
  // Uploaded documents live in memory for now; a refresh clears them until the backend stores them.
  const [documents, setDocuments] = useState([])
  // null means "no document open", which shows the upload screen.
  const [selectedId, setSelectedId] = useState(null)

  function handleLogin(newToken) {
    storeToken(newToken)
    setToken(newToken)
  }

  function handleLogout() {
    clearToken()
    setToken(null)
    setDocuments([])
    setSelectedId(null)
  }

  function handleUpload({ file, pageCount }) {
    const newDocument = {
      id: crypto.randomUUID(),
      name: file.name,
      size: file.size,
      pageCount,
      file,
      uploadedAt: Date.now(),
    }
    setDocuments((current) => [...current, newDocument])
    setSelectedId(newDocument.id) // Open what was just uploaded.
  }

  function handleRemove(id) {
    const index = documents.findIndex((doc) => doc.id === id)
    const remaining = documents.filter((doc) => doc.id !== id)
    setDocuments(remaining)
    if (id === selectedId) {
      // Open the neighbour that slid into this spot, or the new last one.
      const next = remaining[index] ?? remaining.at(-1)
      setSelectedId(next ? next.id : null)
    }
  }

  if (!token) {
    return <LoginPage onLogin={handleLogin} />
  }

  const selected = documents.find((doc) => doc.id === selectedId)

  return (
    <div className="app">
      <header className="app-header">
        <h1>Contract Review</h1>
        <button type="button" className="secondary" onClick={handleLogout}>
          Sign out
        </button>
      </header>

      <div className="app-body">
        <aside className="app-sidebar">
          <DocumentSelector
            documents={documents}
            selectedId={selectedId}
            onSelect={setSelectedId}
            onRemove={handleRemove}
            onNew={() => setSelectedId(null)}
          />
        </aside>

        <main className="app-main">
          {selected ? (
            <section className="doc-view">
              <h2>{selected.name}</h2>
              <p>
                {selected.pageCount} {selected.pageCount === 1 ? 'page' : 'pages'}
              </p>
              <div className="doc-view-placeholder">
                The PDF viewer and AI workspace will appear here.
              </div>
            </section>
          ) : (
            <div className="upload-screen">
              <FileUpload onUpload={handleUpload} />
            </div>
          )}
        </main>
      </div>
    </div>
  )
}

export default App
