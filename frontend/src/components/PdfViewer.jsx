import { useEffect, useRef, useState } from 'react'
import { Document, Page } from 'react-pdf'
import 'react-pdf/dist/Page/TextLayer.css'
import { getDocumentFile } from '../api/documents'
import '../utils/pdf' // Configures the PDF.js worker, shared with upload validation.
import './PdfViewer.css'

const ZOOM_LEVELS = [0.75, 1, 1.25, 1.5, 2]
const MAX_PAGE_WIDTH = 820
const SIDE_PADDING = 48

// Shows every page of a stored PDF, sized to fit the available width.
// renderPageOverlay(pageNumber) can draw on top of a page; later tasks use it for
// highlight rectangles, whose coordinates are fractions of the page size.
// Give it key={documentId} so switching documents starts with fresh state.
function PdfViewer({ documentId, renderPageOverlay }) {
  const scrollRef = useRef(null)
  const [file, setFile] = useState(null)
  const [error, setError] = useState('')
  const [attempt, setAttempt] = useState(0)
  const [numPages, setNumPages] = useState(0)
  const [zoomIndex, setZoomIndex] = useState(1) // 100%
  const [containerWidth, setContainerWidth] = useState(0)

  // Download the PDF through the API client, so the token is attached.
  useEffect(() => {
    let cancelled = false
    getDocumentFile(documentId)
      .then((blob) => {
        if (!cancelled) setFile(blob)
      })
      .catch((err) => {
        // A 401 is handled by the client, which shows the login page.
        if (!cancelled && err.status !== 401) setError(err.message)
      })
    return () => {
      cancelled = true
    }
  }, [documentId, attempt])

  // Re-fit the pages when the window or panel width changes.
  useEffect(() => {
    const element = scrollRef.current
    if (!element) return
    const observer = new ResizeObserver(([entry]) => {
      setContainerWidth(entry.contentRect.width)
    })
    observer.observe(element)
    return () => observer.disconnect()
  }, [])

  function handleRetry() {
    setError('')
    setAttempt((n) => n + 1)
  }

  const zoom = ZOOM_LEVELS[zoomIndex]
  const fitWidth = Math.max(240, Math.min(containerWidth - SIDE_PADDING, MAX_PAGE_WIDTH))
  const pageWidth = Math.round(fitWidth * zoom)

  let content
  if (error) {
    content = (
      <div className="pdf-message" role="alert">
        <p>{error}</p>
        <button type="button" className="secondary small" onClick={handleRetry}>
          Try again
        </button>
      </div>
    )
  } else if (!file || !containerWidth) {
    content = (
      <p className="pdf-message" aria-busy="true">
        Loading document…
      </p>
    )
  } else {
    content = (
      <Document
        file={file}
        onLoadSuccess={({ numPages: count }) => setNumPages(count)}
        onLoadError={() => setError('This PDF could not be displayed.')}
        loading={<p className="pdf-message">Opening PDF…</p>}
        className="pdf-document"
      >
        {Array.from({ length: numPages }, (_, i) => i + 1).map((pageNumber) => (
          <div key={pageNumber} className="pdf-page" data-page-number={pageNumber}>
            <div className="pdf-sheet">
              <Page
                pageNumber={pageNumber}
                width={pageWidth}
                renderAnnotationLayer={false}
                loading={<div className="pdf-page-loading" style={{ width: pageWidth }} />}
              />
              {renderPageOverlay && (
                <div className="pdf-overlay">{renderPageOverlay(pageNumber)}</div>
              )}
            </div>
            <span className="pdf-page-label">
              Page {pageNumber} of {numPages}
            </span>
          </div>
        ))}
      </Document>
    )
  }

  return (
    <section className="pdf-viewer" aria-label="Document">
      <div className="pdf-toolbar">
        <span className="pdf-toolbar-info">
          {numPages ? `${numPages} ${numPages === 1 ? 'page' : 'pages'}` : ''}
        </span>
        <div className="pdf-zoom" role="group" aria-label="Zoom">
          <button
            type="button"
            className="secondary small"
            onClick={() => setZoomIndex((i) => Math.max(i - 1, 0))}
            disabled={zoomIndex === 0}
            aria-label="Zoom out"
          >
            −
          </button>
          <button
            type="button"
            className="secondary small pdf-zoom-level"
            onClick={() => setZoomIndex(1)}
            title="Fit to width"
          >
            {Math.round(zoom * 100)}%
          </button>
          <button
            type="button"
            className="secondary small"
            // Capped, because quick repeated clicks can arrive before the button disables.
            onClick={() => setZoomIndex((i) => Math.min(i + 1, ZOOM_LEVELS.length - 1))}
            disabled={zoomIndex === ZOOM_LEVELS.length - 1}
            aria-label="Zoom in"
          >
            +
          </button>
        </div>
      </div>
      <div className="pdf-scroll" ref={scrollRef}>
        {content}
      </div>
    </section>
  )
}

export default PdfViewer
