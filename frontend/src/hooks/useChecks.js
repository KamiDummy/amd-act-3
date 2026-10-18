import { useEffect, useRef, useState } from 'react'
import { explainSelection } from '../api/analysis'
import { loadJSON, saveJSON } from '../utils/storage'

// Stored under the old "explanations" name so checks saved before the redesign still load.
const checksKey = (documentId) => `explanations:${documentId}`

// Saved checks hold only finished ones; loading and failed ones live in state.
function saveCheck(documentId, item) {
  const saved = loadJSON(checksKey(documentId)) ?? []
  saveJSON(checksKey(documentId), [item, ...saved.filter((x) => x.id !== item.id)])
}

function forgetCheck(documentId, id) {
  const saved = loadJSON(checksKey(documentId)) ?? []
  saveJSON(
    checksKey(documentId),
    saved.filter((x) => x.id !== id),
  )
}

// Passages the user asked to have checked for risks, newest first:
// [{ id, text, pageNumber, rects, status: 'loading' | 'done' | 'error', error, result }].
// rects is where the selection was drawn until the backend returns its own highlight.
// Remount for another document.
export function useChecks(documentId) {
  const mounted = useRef(true)
  const [checks, setChecks] = useState(() =>
    (loadJSON(checksKey(documentId)) ?? []).map((item) => ({ ...item, status: 'done' })),
  )

  useEffect(() => {
    mounted.current = true
    return () => {
      mounted.current = false
    }
  }, [])

  function update(id, changes) {
    setChecks((items) => items.map((x) => (x.id === id ? { ...x, ...changes } : x)))
  }

  async function run(id, text, pageNumber, rects) {
    try {
      const response = await explainSelection(documentId, text, pageNumber)
      const done = {
        id,
        text,
        pageNumber,
        rects,
        createdAt: new Date().toISOString(),
        result: {
          severity: response.severity,
          explanation: response.explanation,
          recommendation: response.recommendation ?? '',
          citations: response.citations,
          highlight: response.highlight,
        },
      }
      // Saved even if the user has opened another document meanwhile.
      saveCheck(documentId, done)
      if (!mounted.current) return
      update(id, { ...done, status: 'done' })
    } catch (err) {
      if (mounted.current && err.status !== 401) {
        update(id, { status: 'error', error: { message: err.message, status: err.status } })
      }
    }
  }

  // Starts a check and returns its id.
  function add(text, pageNumber, rects) {
    const id = crypto.randomUUID()
    setChecks((items) => [{ id, text, pageNumber, rects, status: 'loading' }, ...items])
    run(id, text, pageNumber, rects)
    return id
  }

  function retry(id) {
    const item = checks.find((x) => x.id === id)
    if (!item) return
    update(id, { status: 'loading', error: null })
    run(id, item.text, item.pageNumber, item.rects)
  }

  function remove(id) {
    setChecks((items) => items.filter((x) => x.id !== id))
    forgetCheck(documentId, id)
  }

  return { checks, add, retry, remove }
}
