import { apiRequest } from './client'

// Asks the AI to find risky clauses. Takes about a minute (two AI calls plus a law search).
// Resolves with { document_id, model, findings }, most severe first. Each finding has
// title, severity ('high' | 'medium' | 'low'), quote, page_number (null if not found),
// highlight (rectangles as page fractions, empty if not found), explanation,
// recommendation and citations (often empty: only federal law is loaded).
// Errors: 502 the AI failed (offer "Try again"), 503 the AI isn't configured on the server.
export function scanLoopholes(documentId) {
  return apiRequest(`/api/documents/${documentId}/loopholes`, { method: 'POST' })
}
