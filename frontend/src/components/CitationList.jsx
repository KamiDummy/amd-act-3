// Law sections the backend cited, shared by loopholes, checked clauses and chat answers.
// Often empty: only federal law is loaded, and most contracts fall under provincial law.
// hideEmpty leaves out the "no federal law" line, for chat answers that didn't need law.
function CitationList({ citations, hideEmpty = false }) {
  if (citations.length === 0) {
    if (hideEmpty) return null
    return <p className="rv-muted rv-small">No federal law applies. Check your province’s rules.</p>
  }
  return (
    <>
      <h4 className="rv-eyebrow">Related Canadian law</h4>
      <ul className="rv-citations">
        {citations.map((c, i) => (
          <li key={i} className="rv-citation">
            <span className="rv-citation-ref">
              {c.law_title}, s. {c.section}
            </span>
            {c.marginal_note && <span className="rv-citation-note">{c.marginal_note}</span>}
            <span className="rv-citation-text">{c.text}</span>
            <a href={c.url} target="_blank" rel="noopener noreferrer">
              Read the law ↗
            </a>
          </li>
        ))}
      </ul>
    </>
  )
}

export default CitationList
