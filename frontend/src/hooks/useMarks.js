import { useCallback, useState } from 'react'
import { documentKey } from '../utils/documentData'
import { loadJSON, removeKey, saveJSON } from '../utils/storage'

// What the user set on each item, by item key (utils/itemKeys.js), saved on this device:
//   { [key]: { name, description, favorite, hidden, color, style } }
// Every field is optional; a missing one means the item's default.

function load(documentId) {
  const key = documentKey('marks', documentId)
  const marks = { ...(loadJSON(key) ?? {}) }
  let changed = false
  // Checks used to be keyed "explanation:<id>"; they are highlights now.
  for (const old of Object.keys(marks)) {
    if (old.startsWith('explanation:')) {
      marks[`highlight:${old.slice('explanation:'.length)}`] = marks[old]
      delete marks[old]
      changed = true
    }
  }
  // Notes from earlier versions become descriptions. The note on the whole document
  // has no item to go to and is dropped.
  const notesKey = documentKey('notes', documentId)
  const notes = loadJSON(notesKey)
  if (notes) {
    for (const [old, note] of Object.entries(notes)) {
      if (old === 'document' || !note?.text) continue
      const itemKey = old.startsWith('explanation:')
        ? `highlight:${old.slice('explanation:'.length)}`
        : old
      marks[itemKey] = { description: note.text, ...marks[itemKey] }
    }
    removeKey(notesKey)
    changed = true
  }
  if (changed) saveJSON(key, marks)
  return marks
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
