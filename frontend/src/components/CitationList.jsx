// Law sections the backend cited, shared by loophole findings and explanations.
// Often empty: only federal law is loaded, and most contracts fall under provincial law.
function CitationList({ citations }) {
  return (
    <>
      <h4 className="lp-eyebrow">Related Canadian law</h4>
      {citations.length === 0 ? (
        <p className="lp-muted lp-small">
          No federal law matched. Contracts like this are usually governed by provincial
          law, so check your province’s rules.
        </p>
      ) : (
        <ul className="lp-citations">
          {citations.map((c, i) => (
            <li key={i} className="lp-citation">
              <span className="lp-citation-ref">
                {c.law_title}, s. {c.section}
              </span>
              {c.marginal_note && <span className="lp-citation-note">{c.marginal_note}</span>}
              <span className="lp-citation-text">{c.text}</span>
              <a href={c.url} target="_blank" rel="noopener noreferrer">
                Read the law ↗
              </a>
            </li>
          ))}
        </ul>
      )}
    </>
  )
}

export default CitationList
