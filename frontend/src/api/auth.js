import { apiRequest } from './client'

export { clearToken, getStoredToken, storeToken } from './token'

// Whether the backend has an access code set. When it doesn't, there's no login page.
export async function isAuthRequired() {
  const { auth_required } = await apiRequest('/auth/status', { auth: false })
  return auth_required
}

// Exchanges the access code for a token. A wrong code throws "Invalid access code."
// auth: false, so that 401 is shown as an error instead of signing the user out.
export async function login(accessCode) {
  const { access_token } = await apiRequest('/auth/login', {
    method: 'POST',
    body: { access_code: accessCode },
    auth: false,
  })
  return access_token
}

// Resolves if the saved token still works. A 401 (expired, or the backend restarted
// without a fixed JWT_SECRET) clears it and sends the user to the login page via the client.
export async function verifyToken() {
  await apiRequest('/auth/verify')
}
