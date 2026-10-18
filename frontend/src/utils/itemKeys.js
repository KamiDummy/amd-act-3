// Every passage marked on a document (a risk the scan found, or the user's own
// highlight) has a key. It names the item in the workspace and in the chat, and keys
// its name, description, colour and so on in the document's saved marks.

// Findings have no id, and their position in the list can change after a re-scan,
// so a finding is keyed by its content: the same clause keeps its marks.
export function findingKey(finding) {
  return `finding:${hash(`${finding.title}\n${finding.quote}`)}`
}

export function highlightKey(id) {
  return `highlight:${id}`
}

// A short, stable fingerprint of a string (djb2). Not for security, just for keys.
function hash(text) {
  let h = 5381
  for (const char of text) {
    h = ((h << 5) + h + char.codePointAt(0)) | 0
  }
  return (h >>> 0).toString(36)
}
