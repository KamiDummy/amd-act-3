import { useCallback, useState } from 'react'
import { documentKey } from '../utils/documentData'
import { loadJSON, saveJSON } from '../utils/storage'

// What the user set on each item, by item key (utils/itemKeys.js), saved on this device:
//   { [key]: { name, description, favorite, hidden, color, style } }
// Every field is optional; a missing one means the item's default.

function load(documentId) {
  return loadJSON(documentKey('marks', documentId)) ?? {}
}

// Remount for another document.
export function useMarks(documentId) {
  const [marks, setMarks] = useState(() => load(documentId))

  // Merges changes into one item's marks and saves.
  const update = useCallback(
    (itemKey, changes) => {
      setMarks((current) => {
        const next = { ...current, [itemKey]: { ...current[itemKey], ...changes } }
        saveJSON(documentKey('marks', documentId), next)
        return next
      })
    },
    [documentId],
  )

  const forget = useCallback(
    (itemKey) => {
      setMarks((current) => {
        const next = { ...current }
        delete next[itemKey]
        saveJSON(documentKey('marks', documentId), next)
        return next
      })
    },
    [documentId],
  )

  return { marks, update, forget }
}
