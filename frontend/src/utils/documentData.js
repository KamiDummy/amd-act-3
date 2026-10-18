import { removeKey } from './storage'

// Everything this device keeps about one document, by storage key. "explanations" and
// "notes" hold data from earlier versions, which is moved into highlights and marks
// when the document opens; they are listed so a reset clears them too.
const KEYS = ['scan', 'highlights', 'marks', 'chat', 'explanations', 'notes']

export const documentKey = (name, documentId) => `${name}:${documentId}`

// Forgets the document's scan, highlights, marks and chat on this device. The document
// itself stays on the server.
export function clearDocumentData(documentId) {
  for (const name of KEYS) removeKey(documentKey(name, documentId))
}
