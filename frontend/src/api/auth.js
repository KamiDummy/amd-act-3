const TOKEN_KEY = 'auth_token'

// TEMPORARY mock: accepts only the code "demo".
// Replaced by a real POST /auth/login call once the backend endpoint exists.
export async function login(accessCode) {
  await new Promise((resolve) => setTimeout(resolve, 400))
  if (accessCode !== 'demo') {
    throw new Error('Invalid access code.')
  }
  return { token: 'dev-token' }
}

// sessionStorage can throw (private mode, blocked storage), so every access is guarded.
export function getStoredToken() {
  try {
    return sessionStorage.getItem(TOKEN_KEY)
  } catch {
    return null
  }
}

export function storeToken(token) {
  try {
    sessionStorage.setItem(TOKEN_KEY, token)
  } catch {
    // Login still works for this page load; it just won't survive a refresh.
  }
}

export function clearToken() {
  try {
    sessionStorage.removeItem(TOKEN_KEY)
  } catch {
    // Nothing to clear.
  }
}
