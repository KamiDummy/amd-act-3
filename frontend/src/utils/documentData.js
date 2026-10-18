import { removeKey } from './storage'

// Everything this device keeps about one document, by storage key.
const KEYS = ['scan', 'highlights', 'marks', 'chat']

export const documentKey = (name, documentId) => `${name}:${documentId}`

// Forgets the document's scan, highlights, marks and chat on this device. The document
// itself stays on the server.
export function clearDocumentData(documentId) {
  for (const name of KEYS) removeKey(documentKey(name, documentId))
}
