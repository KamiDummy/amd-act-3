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
      const { pageCount } = await validatePdf(file)
      onUpload({ file, pageCount })
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

  const zoneClass = ['upload-zone', dragging && 'is-dragging', error && 'has-error']
    .filter(Boolean)
    .join(' ')

  return (
    <section
      className={zoneClass}
      onDragOver={handleDragOver}
      onDragLeave={handleDragLeave}
      onDrop={handleDrop}
      aria-busy={checking}
    >
      <p className="upload-title">
        {checking ? 'Checking your PDF…' : 'Drag a contract PDF here'}
      </p>
      <p className="upload-hint">
        PDF only · up to {MAX_PAGES} pages · max {MAX_SIZE_MB} MB · text-based (not scanned)
      </p>

      <button
        type="button"
        onClick={() => inputRef.current.click()}
        disabled={checking}
      >
        Choose PDF
      </button>
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
