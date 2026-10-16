import { useEffect, useState } from 'react'
import LoginPage from './components/LoginPage'
import FileUpload from './components/FileUpload'
import DocumentSelector from './components/DocumentSelector'
import {
  clearToken,
  getStoredToken,
  isAuthRequired,
  storeToken,
  verifyToken,
} from './api/auth'
import { setUnauthorizedHandler } from './api/client'
import { listDocuments, uploadDocument } from './api/documents'
import './App.css'

function App() {
  // 'checking' → asking the backend on page load, 'offline' → backend unreachable,
  // 'login' → show the login page, 'ready' → show the workspace.
  const [authStatus, setAuthStatus] = useState('checking')
  // False when the backend has no access code: no login page and no Sign out button.
  const [authRequired, setAuthRequired] = useState(true)
  const [connectionError, setConnectionError] = useState('')
  // Bumped by the Retry button to run the page-load check again.
  const [checkAttempt, setCheckAttempt] = useState(0)
  // The shared workspace's documents, loaded from the backend once signed in.
  const [documents, setDocuments] = useState([])
  const [documentsLoading, setDocumentsLoading] = useState(true)
  const [documentsError, setDocumentsError] = useState('')
  // Bumped by the list's Retry button to load the documents again.
  const [documentsAttempt, setDocumentsAttempt] = useState(0)
  // null means "no document open", which shows the upload screen.
  const [selectedId, setSelectedId] = useState(null)

  // On page load: is a login needed, and if we have a saved token, does it still work?
  useEffect(() => {
    let cancelled = false

    async function checkAuth() {
      try {
        const required = await isAuthRequired()
        if (cancelled) return
        setAuthRequired(required)
        if (!required) {
          setAuthStatus('ready')
          return
        }
        if (!getStoredToken()) {
          setAuthStatus('login')
          return
        }
        await verifyToken()
        if (!cancelled) setAuthStatus('ready')
      } catch (err) {
        if (cancelled) return
        if (err.status === 401) {
          setAuthStatus('login') // The client already cleared the expired token.
        } else {
          setConnectionError(err.message)
          setAuthStatus('offline')
        }
      }
    }

    checkAuth()
    return () => {
      cancelled = true
    }
  }, [checkAttempt])

  // A 401 from any API call means the token expired or the backend restarted: back to login.
  useEffect(() => {
    setUnauthorizedHandler(() => {
      setAuthStatus('login')
      setDocuments([])
      setDocumentsLoading(true)
      setDocumentsError('')
      setSelectedId(null)
    })
    return () => setUnauthorizedHandler(null)
  }, [])

  // Once signed in, load the shared workspace. Runs again after Retry or a new sign-in.
  useEffect(() => {
    if (authStatus !== 'ready') return
    let cancelled = false

    async function loadDocuments() {
      try {
        const loaded = await listDocuments()
        if (cancelled) return
        setDocuments(loaded)
        setDocumentsLoading(false)
      } catch (err) {
        // A 401 is handled by the unauthorized handler above, which shows the login page.
        if (cancelled || err.status === 401) return
        setDocumentsError(err.message)
        setDocumentsLoading(false)
      }
    }

    loadDocuments()
    return () => {
      cancelled = true
    }
  }, [authStatus, documentsAttempt])

  function handleRetry() {
    setAuthStatus('checking')
    setCheckAttempt((n) => n + 1)
  }

  function handleRetryDocuments() {
    setDocumentsError('')
    setDocumentsLoading(true)
    setDocumentsAttempt((n) => n + 1)
  }

  function handleLogin(token) {
    storeToken(token)
    setAuthStatus('ready')
  }

  function handleLogout() {
    clearToken()
    setAuthStatus('login')
    setDocuments([])
    setDocumentsLoading(true)
    setDocumentsError('')
    setSelectedId(null)
  }

  // Errors (bad PDF, too large, …) are thrown back to FileUpload, which shows them.
  async function handleUpload(file) {
    const newDocument = await uploadDocument(file)
    // The list is newest first, so the new document goes on top.
    setDocuments((current) => [newDocument, ...current])
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

  if (authStatus === 'checking') {
    return (
      <main className="app-status" aria-busy="true">
        <p>Connecting…</p>
      </main>
    )
  }

  if (authStatus === 'offline') {
    return (
      <main className="app-status">
        <p role="alert">{connectionError}</p>
        <button type="button" onClick={handleRetry}>
          Retry
        </button>
      </main>
    )
  }

  if (authStatus === 'login') {
    return <LoginPage onLogin={handleLogin} />
  }

  const selected = documents.find((doc) => doc.id === selectedId)

  return (
    <div className="app">
      <header className="app-header">
        <h1>Contract Review</h1>
        {authRequired && (
          <button type="button" className="secondary" onClick={handleLogout}>
            Sign out
          </button>
        )}
      </header>

      <div className="app-body">
        <aside className="app-sidebar">
          <DocumentSelector
            documents={documents}
            loading={documentsLoading}
            error={documentsError}
            onRetry={handleRetryDocuments}
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
