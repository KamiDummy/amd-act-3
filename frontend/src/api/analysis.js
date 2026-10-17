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

// The longest selection the backend accepts.
export const MAX_EXPLAIN_CHARS = 4000

// Explains a passage the user selected. Takes about 10 seconds.
// pageNumber is the page the selection starts on; it picks the right spot when the
// same text appears twice. Resolves with { model, highlight, explanation,
// severity ('high' | 'medium' | 'low' | 'none'), citations }.
// Errors: 502 the AI failed, 503 not configured, 422 empty or too long a selection.
export function explainSelection(documentId, text, pageNumber) {
  return apiRequest(`/api/documents/${documentId}/explain`, {
    method: 'POST',
    body: { text, page_number: pageNumber },
  })
}
