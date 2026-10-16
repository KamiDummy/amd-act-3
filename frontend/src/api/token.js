const TOKEN_KEY = 'auth_token'

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
