import { useState } from 'react'
import LoginPage from './components/LoginPage'
import FileUpload from './components/FileUpload'
import { clearToken, getStoredToken, storeToken } from './api/auth'
import './App.css'

function App() {
  const [token, setToken] = useState(getStoredToken)
  // Uploaded documents live in memory for now; a refresh clears them until the backend stores them.
  const [documents, setDocuments] = useState([])

  function handleLogin(newToken) {
    storeToken(newToken)
    setToken(newToken)
  }

  function handleLogout() {
    clearToken()
    setToken(null)
    setDocuments([])
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
  }

  if (!token) {
    return <LoginPage onLogin={handleLogin} />
  }

  const latest = documents.at(-1)

  return (
    <>
      <header className="app-header">
        <h1>Contract Review</h1>
        <button type="button" className="secondary" onClick={handleLogout}>
          Sign out
        </button>
      </header>
      <main className="app-main">
        <FileUpload onUpload={handleUpload} />
        {latest && (
          <p className="upload-success">
            Added <strong>{latest.name}</strong> ({latest.pageCount}{' '}
            {latest.pageCount === 1 ? 'page' : 'pages'}). {documents.length}{' '}
            {documents.length === 1 ? 'document' : 'documents'} uploaded.
          </p>
        )}
      </main>
    </>
  )
}

export default App
