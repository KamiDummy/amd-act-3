// Where a cited law comes from, to put after its title. Federal law needs no label.
function jurisdictionLabel(jurisdiction) {
  if (!jurisdiction || jurisdiction === 'federal') return ''
  return ` (${jurisdiction[0].toUpperCase()}${jurisdiction.slice(1)})`
}

// "Employment Standards Act, 2000 (Ontario), s. 33"
export function citationTitle(citation) {
  return `${citation.law_title}${jurisdictionLabel(citation.jurisdiction)}, s. ${citation.section}`
}
