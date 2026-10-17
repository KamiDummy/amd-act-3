import { useCallback, useState } from 'react'
import { loadJSON, saveJSON } from '../utils/storage'

// Like useState, but the value is kept in localStorage under `key` and loaded from it
// on mount. The setter takes a value or an updater function, and saves right away.
// Remount (e.g. with a React key) to switch to another storage key.
export function useStoredState(key, initial) {
  const [value, setValue] = useState(() => loadJSON(key) ?? initial)

  const update = useCallback(
    (next) => {
      setValue((current) => {
        const resolved = typeof next === 'function' ? next(current) : next
        saveJSON(key, resolved)
        return resolved
      })
    },
    [key],
  )

  return [value, update]
}
