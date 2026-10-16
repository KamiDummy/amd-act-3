import { apiRequest } from './client'

// Converts the backend's field names to the ones the components use.
export function toDocument(apiDocument) {
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
