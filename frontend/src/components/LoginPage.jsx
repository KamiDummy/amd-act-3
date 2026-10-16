import { useState } from 'react'
import { login } from '../api/auth'
import Logo from './Logo'
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
      const token = await login(code)
      onLogin(token)
    } catch (err) {
      setError(err.message)
      setLoading(false)
    }
  }

  return (
    <main className="login">
      <Logo as="h1" />
      <form className="login-card" onSubmit={handleSubmit} noValidate>
        <h2 className="login-title">Not sure what you’re signing?</h2>
        <p className="login-subtitle">
          Enter your access code to review contracts against Canadian law.
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
      </form>
      <p className="login-disclaimer">
        Information, not legal advice. For decisions that matter, talk to a lawyer.
      </p>
    </main>
  )
}

export default LoginPage
