import { useEffect, useRef, useState } from 'react'
import { scanLoopholes } from '../api/analysis'
import { loadJSON, saveJSON } from '../utils/storage'

const scanKey = (documentId) => `scan:${documentId}`

// Scans still running, by document id. Kept outside the component so a scan carries
// on (and gets saved) if the user opens another document, and the workspace picks it
// up again when they come back instead of starting a second, quota-using scan.
const runningScans = new Map()

function startScan(documentId) {
  if (!runningScans.has(documentId)) {
    const promise = scanLoopholes(documentId)
      .then((report) => {
        const result = { findings: report.findings, scannedAt: new Date().toISOString() }
        saveJSON(scanKey(documentId), result)
        return result
      })
      .finally(() => runningScans.delete(documentId))
    runningScans.set(documentId, { promise, startedAt: Date.now() })
  }
  return runningScans.get(documentId)
}

// The document's loophole scan: the saved result, and starting and following a new one.
// Remount for another document.
export function useLoopholeScan(documentId) {
  const mounted = useRef(true)
  const [result, setResult] = useState(() => loadJSON(scanKey(documentId)))
  const [scan, setScan] = useState(() => runningScans.get(documentId) ?? null)
  const [error, setError] = useState(null)
  const [now, setNow] = useState(() => Date.now())

  useEffect(() => {
    mounted.current = true
    return () => {
      mounted.current = false
    }
  }, [])

  // Wait for the running scan (started here, or before switching documents).
  useEffect(() => {
    if (!scan) return
    scan.promise
      .then((scanResult) => {
        if (mounted.current) setResult(scanResult)
      })
      .catch((err) => {
        // A 401 is handled by the API client, which shows the login page.
        if (mounted.current && err.status !== 401) {
          setError({ message: err.message, status: err.status })
        }
      })
      .finally(() => {
        if (mounted.current) setScan(null)
      })
  }, [scan])

  // Tick once a second while scanning, for the elapsed-time counter.
  useEffect(() => {
    if (!scan) return
    const timer = setInterval(() => setNow(Date.now()), 1000)
    return () => clearInterval(timer)
  }, [scan])

  function start() {
    setError(null)
    setNow(Date.now())
    setScan(startScan(documentId))
  }

  return {
    result,
    scanning: Boolean(scan),
    elapsedSeconds: scan ? Math.max(0, Math.floor((now - scan.startedAt) / 1000)) : 0,
    error,
    start,
  }
}
