import { useRef, useState } from 'react'
import { MAX_PAGES, MAX_SIZE_MB, validatePdf } from '../utils/pdf'
import './FileUpload.css'

function FileUpload({ onUpload }) {
  const inputRef = useRef(null)
  const [dragging, setDragging] = useState(false)
  const [checking, setChecking] = useState(false)
  const [error, setError] = useState('')

  async function handleFiles(fileList) {
    if (!fileList || fileList.length === 0) return
    if (fileList.length > 1) {
      setError('Please upload one file at a time.')
      return
    }

    const file = fileList[0]
    setError('')
    setChecking(true)
    try {
      // Quick checks in the browser first, so obvious problems show instantly.
      await validatePdf(file)
      // Then the real upload; the checking state stays on while the backend extracts the text.
      await onUpload(file)
    } catch (err) {
      setError(err.message)
    } finally {
      setChecking(false)
    }
  }

  function handleDragOver(event) {
    event.preventDefault() // Required, or the browser opens the file instead.
    if (!checking) setDragging(true)
  }

  function handleDragLeave(event) {
    // Moving over a child element also fires dragleave; ignore those.
    if (!event.currentTarget.contains(event.relatedTarget)) {
      setDragging(false)
    }
  }

  function handleDrop(event) {
    event.preventDefault()
    setDragging(false)
    if (!checking) handleFiles(event.dataTransfer.files)
  }

  function handleInputChange(event) {
    handleFiles(event.target.files)
    // Reset so choosing the same file again still triggers onChange.
    event.target.value = ''
  }

  function openPicker() {
    if (!checking) inputRef.current.click()
  }

  // Clicking anywhere on the card opens the file picker, like the design.
  // The button inside handles its own clicks, so ignore those here.
  function handleZoneClick(event) {
    if (!event.target.closest('button')) openPicker()
  }

  const zoneClass = ['upload-zone', dragging && 'is-dragging', error && 'has-error']
    .filter(Boolean)
    .join(' ')

  return (
    <section
      className={zoneClass}
      onClick={handleZoneClick}
      onDragOver={handleDragOver}
      onDragLeave={handleDragLeave}
      onDrop={handleDrop}
      aria-busy={checking}
    >
      <button type="button" className="upload-button" onClick={openPicker} disabled={checking}>
        <span className="upload-plus" aria-hidden="true">
          {checking ? <span className="upload-spinner" /> : '+'}
        </span>
        <span className="upload-title">
          {checking ? 'Checking your PDF…' : 'Upload a contract PDF'}
        </span>
        <span className="upload-hint">
          {dragging ? 'Drop it here' : 'Drag and drop, or click to browse'}
        </span>
      </button>
      <p className="upload-limits">
        Text-based PDF · up to {MAX_PAGES} pages · {MAX_SIZE_MB} MB max
      </p>
      <input
        ref={inputRef}
        type="file"
        accept="application/pdf,.pdf"
        onChange={handleInputChange}
        hidden
      />

      {error && (
        <p className="upload-error" role="alert">
          {error}
        </p>
      )}
    </section>
  )
}

export default FileUpload
