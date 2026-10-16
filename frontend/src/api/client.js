import { clearToken, getStoredToken } from './token'

// The one place the backend address lives. Set VITE_API_URL in frontend/.env to override.
export const API_URL = import.meta.env.VITE_API_URL ?? 'http://localhost:8000'

// An error from the backend. `message` is safe to show to the user.
export class ApiError extends Error {
  constructor(message, status, options) {
    super(message, options)
    this.name = 'ApiError'
    this.status = status
  }
}

let unauthorizedHandler = null

// App registers this so an expired or invalid token sends the user back to the login page.
export function setUnauthorizedHandler(handler) {
  unauthorizedHandler = handler
}

// Sends a request to the backend and returns the parsed JSON (or null for empty replies).
// Options:
//   method - 'GET' by default
//   body   - a plain object (sent as JSON) or FormData (sent as-is, for file uploads)
//   auth   - false for requests that must not log the user out on a 401, like the login itself
export async function apiRequest(path, { method = 'GET', body, auth = true } = {}) {
  const headers = {}
  const token = getStoredToken()
  if (auth && token) {
    headers.Authorization = `Bearer ${token}`
  }

  let requestBody = body
  if (body !== undefined && !(body instanceof FormData)) {
    headers['Content-Type'] = 'application/json'
    requestBody = JSON.stringify(body)
  }
  // For FormData the browser sets Content-Type itself, including the boundary; setting it breaks uploads.

  let response
  try {
    response = await fetch(`${API_URL}${path}`, { method, headers, body: requestBody })
  } catch (err) {
    throw new ApiError("Can't reach the server. Is the backend running?", 0, { cause: err })
  }

  if (response.status === 401 && auth) {
    clearToken()
    unauthorizedHandler?.()
    throw new ApiError('Your session has expired. Please sign in again.', 401)
  }

  if (!response.ok) {
    throw new ApiError(await readErrorMessage(response), response.status)
  }

  if (response.status === 204) {
    return null
  }
  const text = await response.text()
  return text ? JSON.parse(text) : null
}

// Backend errors look like { "detail": "message" }. FastAPI's own validation errors
// use a list instead: { "detail": [{ "msg": "..." }] }.
async function readErrorMessage(response) {
  const fallback = `Something went wrong (error ${response.status}).`
  try {
    const { detail } = await response.json()
    if (typeof detail === 'string') return detail
    if (Array.isArray(detail) && detail[0]?.msg) return detail[0].msg
  } catch {
    // Not JSON, e.g. a proxy error page.
  }
  return fallback
}
