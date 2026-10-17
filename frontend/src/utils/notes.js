// Keys for the user's notes, which are saved per document in localStorage as
// { [key]: { text, updatedAt } }.

// A note about the whole document, shown at the top of the Notes tab.
export const DOCUMENT_NOTE = 'document'

// Findings have no id, and their position in the list can change after a re-check,
// so a finding's note is keyed by its content: the same clause keeps its note.
export function findingNoteKey(finding) {
  return `finding:${hash(`${finding.title}\n${finding.quote}`)}`
}

export function explanationNoteKey(id) {
  return `explanation:${id}`
}

// A short, stable fingerprint of a string (djb2). Not for security, just for keys.
function hash(text) {
  let h = 5381
  for (const char of text) {
    h = ((h << 5) + h + char.codePointAt(0)) | 0
  }
  return (h >>> 0).toString(36)
}
