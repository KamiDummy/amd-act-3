export { clearToken, getStoredToken, storeToken } from './token'

// TEMPORARY mock: accepts only the code "demo".
// Replaced by a real POST /auth/login call once the backend endpoint exists.
export async function login(accessCode) {
  await new Promise((resolve) => setTimeout(resolve, 400))
  if (accessCode !== 'demo') {
    throw new Error('Invalid access code.')
  }
  return { token: 'dev-token' }
}
