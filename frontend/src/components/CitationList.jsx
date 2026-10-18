import { citationTitle } from '../utils/laws'

// Law sections the backend cited for a scanned highlight. Searched: federal
// law and Ontario's employment and tenancy statutes. Each links to the section itself.
function CitationList({ citations }) {
  if (citations.length === 0) {
    return <p className="rv-muted rv-small">No law in the database applies. Check your province’s rules.</p>
  }
  return (
    <>
      <h4 className="rv-eyebrow">Related law</h4>
      <ul className="rv-citations">
        {citations.map((c, i) => (
          <li key={i} className="rv-citation">
            <span className="rv-citation-ref">{citationTitle(c)}</span>
            {c.marginal_note && <span className="rv-citation-note">{c.marginal_note}</span>}
            <span className="rv-citation-text">{c.text}</span>
            <a href={c.url} target="_blank" rel="noopener noreferrer">
              Read s. {c.section} ↗
            </a>
          </li>
        ))}
      </ul>
    </>
  )
}

export default CitationList
