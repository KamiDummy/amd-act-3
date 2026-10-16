import { useState } from 'react'
import { login } from '../api/auth'
import './LoginPage.css'

function LoginPage({ onLogin }) {
  const [accessCode, setAccessCode] = useState('')
  const [error, setError] = useState('')
  const [loading, setLoading] = useState(false)

  async function handleSubmit(event) {
    event.preventDefault()
    const code = accessCode.trim()
    if (!code) {
      setError('Enter your access code.')
      return
    }

    setError('')
    setLoading(true)
    try {
      const { token } = await login(code)
      onLogin(token)
    } catch (err) {
      setError(err.message)
      setLoading(false)
    }
  }

  return (
    <main className="login">
      <form className="login-card" onSubmit={handleSubmit} noValidate>
        <h1>Contract Review</h1>
        <p className="login-subtitle">
          AI review of contracts, grounded in Canadian law.
        </p>

        <label htmlFor="access-code">Access code</label>
        <input
          id="access-code"
          type="password"
          autoComplete="current-password"
          autoFocus
          value={accessCode}
          onChange={(event) => setAccessCode(event.target.value)}
          aria-invalid={Boolean(error)}
          aria-describedby={error ? 'login-error' : undefined}
          disabled={loading}
        />

        {error && (
          <p id="login-error" className="login-error" role="alert">
            {error}
          </p>
        )}

        <button type="submit" disabled={loading}>
          {loading ? 'Checking…' : 'Sign in'}
        </button>

        <p className="login-disclaimer">
          This tool does not provide legal advice.
        </p>
      </form>
    </main>
  )
}

export default LoginPage
