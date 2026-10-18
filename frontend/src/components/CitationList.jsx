// Where a law comes from, after its title. Federal law needs no label.
function jurisdictionLabel(jurisdiction) {
  if (!jurisdiction || jurisdiction === 'federal') return ''
  return ` (${jurisdiction[0].toUpperCase()}${jurisdiction.slice(1)})`
}

// Law sections the backend cited, shared by risks and chat answers. Searched: federal
// law and Ontario's employment and tenancy statutes. Each links to the section itself.
// hideEmpty leaves out the "no law" line, for chat answers that didn't need law.
function CitationList({ citations, hideEmpty = false }) {
  if (citations.length === 0) {
    if (hideEmpty) return null
    return <p className="rv-muted rv-small">No law in the database applies. Check your province’s rules.</p>
  }
  return (
    <>
      <h4 className="rv-eyebrow">Related law</h4>
      <ul className="rv-citations">
        {citations.map((c, i) => (
          <li key={i} className="rv-citation">
            <span className="rv-citation-ref">
              {c.law_title}
              {jurisdictionLabel(c.jurisdiction)}, s. {c.section}
            </span>
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
