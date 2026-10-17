// How a passage is marked on the page: a pen colour and a style. Each colour is a pair
// of CSS variables (--pen-<id> and --pen-<id>-bg) in index.css; the class pen-<id>
// (in Pens.css) exposes them as --pen and --pen-bg to whatever it's on.

export const PEN_COLORS = [
  { id: 'yellow', label: 'Yellow' },
  { id: 'green', label: 'Green' },
  { id: 'blue', label: 'Blue' },
  { id: 'purple', label: 'Purple' },
  { id: 'orange', label: 'Orange' },
  { id: 'red', label: 'Red' },
]

export const PEN_STYLES = [
  { id: 'fill', label: 'Highlight' },
  { id: 'underline', label: 'Underline' },
  { id: 'box', label: 'Box' },
]

const SEVERITY_COLOR = { high: 'red', medium: 'orange', low: 'blue', none: 'green' }

// The colour an item gets until the user picks one: loopholes and checked clauses are
// coloured by how risky they are, the user's own highlights are yellow.
export function defaultColor(item) {
  return SEVERITY_COLOR[item.severity] ?? 'yellow'
}
