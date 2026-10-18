import { useEffect, useRef } from 'react'
import { APP_NAME } from '../config'
import './WelcomeDialog.css'

// "employment-agreement.pdf" → "Employment agreement"
function demoTitle(filename) {
  const words = filename.replace(/\.pdf$/i, '').replace(/[-_]+/g, ' ').trim()
  return words.charAt(0).toUpperCase() + words.slice(1)
}

// Shown once per browser, after the first sign-in: what the app knows, and a nudge to
// start with a demo contract. Every way out (a choice, ×, Escape, a click outside)
// calls onClose too, so it doesn't come back.
function WelcomeDialog({ demos, onOpenDemo, onUpload, onClose }) {
  const ref = useRef(null)

  // Opened as a modal: focus moves in, Escape closes it, and the page behind is inert.
  // Unmounting removes it. The check covers React running effects twice in development.
  useEffect(() => {
    if (!ref.current.open) ref.current.showModal()
  }, [])

  function choose(action) {
    action()
    onClose()
  }

  return (
    <dialog
      ref={ref}
      className="welcome"
      aria-labelledby="welcome-title"
      onClose={onClose}
      // A click on the backdrop lands on the dialog itself, outside its content.
      onClick={(event) => event.target === ref.current && onClose()}
    >
      <div className="welcome-body">
        <h2 id="welcome-title" className="welcome-title">
          Welcome to {APP_NAME}
        </h2>
        <p className="welcome-text">
          Upload a contract and {APP_NAME} flags the clauses that work against you, explains them in
          plain language, and links each one to the exact section of <strong>Canadian law</strong>.
          It knows federal law and Ontario’s laws on jobs, homes and consumer contracts.
        </p>

        {demos.length > 0 && (
          <>
            <p className="welcome-lead">
              <strong>We recommend starting with a demo contract.</strong> They’re fictional Ontario
              contracts with problems planted in them, so every feature has something to find.
            </p>
            <ul className="welcome-demos">
              {demos.map((doc) => (
                <li key={doc.id}>
                  <button
                    type="button"
                    className="welcome-demo"
                    onClick={() => choose(() => onOpenDemo(doc.id))}
                  >
                    <span className="welcome-thumb" aria-hidden="true" />
                    <span className="welcome-demo-text">
                      <span className="welcome-demo-name">{demoTitle(doc.name)}</span>
                      <span className="welcome-demo-meta">
                        {doc.pageCount} {doc.pageCount === 1 ? 'page' : 'pages'}
                      </span>
                    </span>
                    <span className="demo-tag">Demo</span>
                  </button>
                </li>
              ))}
            </ul>
          </>
        )}

        <button type="button" className="secondary welcome-upload" onClick={() => choose(onUpload)}>
          {demos.length > 0 ? 'Or upload your own PDF' : 'Upload a PDF'}
        </button>

        <p className="welcome-note">Information, not legal advice.</p>

        {/* Last, so the dialog's focus starts on the first choice; it sits in the corner. */}
        <button type="button" className="welcome-close" onClick={onClose} aria-label="Close">
          ×
        </button>
      </div>
    </dialog>
  )
}

export default WelcomeDialog
