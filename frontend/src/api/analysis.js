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

// Checks a passage the user selected for risks. Takes 10 to 30 seconds.
// pageNumber is the page the selection starts on; it picks the right spot when the
// same text appears twice. Resolves with { model, highlight, explanation,
// severity ('high' | 'medium' | 'low' | 'none'), recommendation (empty when it's fine),
// citations }.
// Errors: 502 the AI failed, 503 not configured, 422 empty or too long a selection.
export function explainSelection(documentId, text, pageNumber) {
  return apiRequest(`/api/documents/${documentId}/explain`, {
    method: 'POST',
    body: { text, page_number: pageNumber },
  })
}

// The longest chat question the backend accepts.
export const MAX_QUESTION_CHARS = 2000

// Asks a question about the document. Takes 10 to 30 seconds.
// history: the conversation so far, oldest first, as [{ role: 'user' | 'assistant', content }];
// the backend only reads the last 20. selection: an attached passage { text, pageNumber }, or null.
// Resolves with { model, answer, references, citations }. Each reference is a passage
// the answer relies on: { quote, page_number, highlight }.
// Errors: 502 the AI failed, 503 not configured, 422 empty or too long a question.
export function askChat(documentId, question, history, selection) {
  return apiRequest(`/api/documents/${documentId}/chat`, {
    method: 'POST',
    body: {
      question,
      history,
      selection: selection ? { text: selection.text, page_number: selection.pageNumber } : null,
    },
  })
}
