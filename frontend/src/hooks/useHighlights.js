import { useEffect, useRef, useState } from 'react'
import { explainSelection } from '../api/analysis'
import { documentKey } from '../utils/documentData'
import { loadJSON, saveJSON } from '../utils/storage'

// The user's own highlights, saved on this device:
//   [{ id, text, pageNumber, rects, createdAt, analysis }]
// analysis is set once the passage has been checked for risks:
//   { title, severity, explanation, recommendation, citations }
// A checked highlight is a risk the user found, next to the ones the scan found.

function load(documentId) {
  return loadJSON(documentKey('highlights', documentId)) ?? []
}

function toAnalysis(response) {
  return {
    title: response.title ?? null,
    severity: response.severity,
    explanation: response.explanation,
    recommendation: response.recommendation ?? '',
    citations: response.citations ?? [],
  }
}

// Changes one highlight in storage, so a check that finishes after the user opened
// another document is still saved.
function updateSaved(documentId, id, changes) {
  const key = documentKey('highlights', documentId)
  const saved = loadJSON(key) ?? []
  saveJSON(
    key,
    saved.map((h) => (h.id === id ? { ...h, ...changes } : h)),
  )
}

// Remount for another document.
export function useHighlights(documentId) {
  const mounted = useRef(true)
  const [highlights, setHighlights] = useState(() => load(documentId))
  // Checks in progress or failed, by highlight id: { status: 'loading' | 'error', error }.
  const [checking, setChecking] = useState({})

  useEffect(() => {
    mounted.current = true
    return () => {
      mounted.current = false
    }
  }, [])

  // Updates the list and saves it. Takes an updater, so several changes in one event
  // (like two highlights the chat created) all land.
  function save(update) {
    setHighlights((current) => {
      const next = update(current)
      saveJSON(documentKey('highlights', documentId), next)
      return next
    })
  }

  function setStatus(id, status) {
    setChecking((current) => {
      const next = { ...current }
      if (status) next[id] = status
      else delete next[id]
      return next
    })
  }

  // Adds a highlight and returns its id.
  function add({ text, pageNumber, rects }) {
    const id = crypto.randomUUID()
    save((current) => [...current, { id, text, pageNumber, rects, createdAt: new Date().toISOString() }])
    return id
  }

  async function runCheck(highlight) {
    setStatus(highlight.id, { status: 'loading' })
    try {
      const response = await explainSelection(documentId, highlight.text, highlight.pageNumber)
      const changes = { analysis: toAnalysis(response) }
      // Use the backend's rectangles only if the selection's weren't saved.
      if (!highlight.rects?.length && response.highlight.length) changes.rects = response.highlight
      updateSaved(documentId, highlight.id, changes)
      if (!mounted.current) return
      setHighlights((current) => current.map((h) => (h.id === highlight.id ? { ...h, ...changes } : h)))
      setStatus(highlight.id, null)
    } catch (err) {
      if (mounted.current && err.status !== 401) {
        setStatus(highlight.id, { status: 'error', error: { message: err.message, status: err.status } })
      }
    }
  }

  // Checks a highlight for risks and related law. Pass the highlight itself when it was
  // just added, since it isn't in this render's list yet.
  function check(idOrHighlight) {
    const highlight =
      typeof idOrHighlight === 'string' ? highlights.find((h) => h.id === idOrHighlight) : idOrHighlight
    if (highlight) runCheck(highlight)
  }

  // Adds a highlight and checks it straight away. Returns its id.
  function addAndCheck(passage) {
    const id = add(passage)
    runCheck({ id, ...passage })
    return id
  }

  function remove(id) {
    save((current) => current.filter((h) => h.id !== id))
    setStatus(id, null)
  }

  return { highlights, checking, add, addAndCheck, check, remove }
}
