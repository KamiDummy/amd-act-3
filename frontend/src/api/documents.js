import { apiRequest } from './client'

// Converts the backend's field names to the ones the components use.
function toDocument(apiDocument) {
  return {
    id: apiDocument.id,
    name: apiDocument.filename,
    size: apiDocument.size_bytes,
    pageCount: apiDocument.page_count,
    isSample: apiDocument.is_sample,
    createdAt: apiDocument.created_at,
  }
}

// Every document in the shared workspace, newest first, including the demo contracts.
export async function listDocuments() {
  const documents = await apiRequest('/api/documents')
  return documents.map(toDocument)
}

// The original PDF as a Blob, for the viewer. Goes through the client so the token is
// attached and an expired session still leads back to the login page.
export function getDocumentFile(id) {
  return apiRequest(`/api/documents/${id}/file`, { as: 'blob' })
}

// Uploads a PDF and returns the stored document. The backend extracts the text, so this
// can take a second or two on big files. A rejected file (bad PDF, too many pages, scanned,
// too much text, over 20 MB) throws with a message to show the user.
export async function uploadDocument(file) {
  const body = new FormData()
  body.append('file', file)
  const document = await apiRequest('/api/documents', { method: 'POST', body })
  return toDocument(document)
}
