import { findingNoteKey } from '../utils/notes'
import CitationList from './CitationList'
import NoteEditor from './NoteEditor'
import { SEVERITY_LABEL } from './severity'

function formatElapsed(seconds) {
  return `${Math.floor(seconds / 60)}:${String(seconds % 60).padStart(2, '0')}`
}

function formatDate(iso) {
  return new Date(iso).toLocaleString(undefined, {
    month: 'short',
    day: 'numeric',
    hour: 'numeric',
    minute: '2-digit',
  })
}

// The "Loopholes" tab: start a scan, follow its progress, and read the findings.
// Clicking a finding selects it; the parent scrolls the PDF to its highlight.
// notes: { [key]: { text } }; onSaveNote(key, text) saves (empty text deletes).
function LoopholePanel({
  scanning,
  elapsedSeconds,
  error,
  result,
  activeIndex,
  onSelect,
  onScan,
  notes,
  onSaveNote,
}) {
  const findings = result?.findings ?? []
  const counts = { high: 0, medium: 0, low: 0 }
  findings.forEach((f) => {
    counts[f.severity] += 1
  })

  let body
  if (scanning) {
    body = (
      <div className="lp-card" aria-busy="true">
        <h3 className="lp-card-title">Checking for loopholes…</h3>
        <div className="lp-progress" aria-hidden="true">
          <span />
        </div>
        <p className="lp-muted">
          Reading the contract and comparing each risky clause with Canadian law. This
          usually takes about a minute.
        </p>
        <p className="lp-elapsed">{formatElapsed(elapsedSeconds)}</p>
      </div>
    )
  } else if (error) {
    body = (
      <div className="lp-card lp-error" role="alert">
        <h3 className="lp-card-title">The check didn’t finish</h3>
        <p>{error.message}</p>
        {error.status === 503 ? (
          <p className="lp-muted">
            The AI isn’t set up on the server yet. Ask the team to add the Token Factory
            key to the backend’s .env.
          </p>
        ) : (
          <button type="button" onClick={onScan}>
            Try again
          </button>
        )}
      </div>
    )
  } else if (!result) {
    body = (
      <div className="lp-card lp-intro">
        <h3 className="lp-intro-title">Not sure what you’re signing?</h3>
        <p className="lp-muted">
          We read the whole contract and flag clauses that look unfair, unclear or may not
          hold up under Canadian law, and highlight them on the page.
        </p>
        <button type="button" onClick={onScan}>
          Check for loopholes
        </button>
        <p className="lp-hint">Takes about a minute. Results are saved on this device.</p>
      </div>
    )
  } else if (findings.length === 0) {
    body = (
      <div className="lp-card">
        <h3 className="lp-card-title">No loopholes found</h3>
        <p className="lp-muted">
          Nothing stood out in this contract. That isn’t legal advice; for important
          decisions, ask a lawyer.
        </p>
      </div>
    )
  } else {
    body = (
      <ol className="lp-list">
        {findings.map((finding, index) => (
          <li key={index}>
            <FindingCard
              finding={finding}
              index={index}
              active={index === activeIndex}
              onSelect={onSelect}
              note={notes[findingNoteKey(finding)]?.text ?? null}
              onSaveNote={(text) => onSaveNote(findingNoteKey(finding), text)}
            />
          </li>
        ))}
      </ol>
    )
  }

  return (
    <>
      {result && !scanning && (
        <div className="lp-subheader">
          <p className="lp-summary">
            {findings.length === 0
              ? 'No issues'
              : ['high', 'medium', 'low']
                  .filter((s) => counts[s])
                  .map((s) => `${counts[s]} ${s}`)
                  .join(' · ')}
            <span className="lp-checked">
              {' '}
              · checked {formatDate(result.scannedAt)} · {result.model}
            </span>
          </p>
          <button type="button" className="secondary small" onClick={onScan}>
            Re-check
          </button>
        </div>
      )}
      <div className="lp-body">{body}</div>
    </>
  )
}

function FindingCard({ finding, index, active, onSelect, note, onSaveNote }) {
  const located = finding.highlight.length > 0
  return (
    <article
      id={`finding-${index}`}
      className={`lp-finding sev-${finding.severity}${active ? ' is-active' : ''}`}
    >
      <button
        type="button"
        className="lp-finding-head"
        onClick={() => onSelect(active ? null : index)}
        aria-expanded={active}
      >
        <span className="lp-finding-meta">
          <span className={`lp-sev sev-${finding.severity}`}>
            {SEVERITY_LABEL[finding.severity]}
          </span>
          <span className="lp-page">
            {located ? `p. ${finding.page_number}` : 'Not found in PDF'}
          </span>
          {note && <span className="lp-has-note">✎ Note</span>}
        </span>
        <span className="lp-finding-title">{finding.title}</span>
      </button>

      {active && (
        <div className="lp-finding-body">
          <blockquote className="lp-quote">“{finding.quote}”</blockquote>
          <p>{finding.explanation}</p>
          <p className="lp-todo">
            <b>What you can do:</b> {finding.recommendation}
          </p>
          <CitationList citations={finding.citations} />
          <NoteEditor note={note} onSave={onSaveNote} />
        </div>
      )}
    </article>
  )
}

export default LoopholePanel
