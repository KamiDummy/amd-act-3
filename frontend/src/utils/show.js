// What the user wants to see: the Show toggles in the Highlights tab. They apply to the
// list and to the highlights drawn on the page alike.

// Every item is a highlight, of one of these kinds:
//   auto: found by the automatic scan of the whole document.
//   scan: one of the user's own highlights that they had scanned for risks.
//   note: one of the user's own highlights that no LLM has looked at. It may or may
//         not carry text they wrote.
export const KINDS = [
  { id: 'auto', label: 'Auto scan' },
  { id: 'scan', label: 'My scans' },
  { id: 'note', label: 'Notes' },
]

export const DEFAULT_SHOW = {
  auto: true,
  scan: true,
  note: true,
  favoritesOnly: false,
  hidden: false,
}

// item: { source: 'scan' | 'mine', analysis, status }. A highlight being scanned counts
// as a scan already, so it stays in view.
export function itemKind(item) {
  if (item.source === 'scan') return 'auto'
  return item.analysis || item.status !== 'done' ? 'scan' : 'note'
}

export function isShown(item, show) {
  if (item.hidden && !show.hidden) return false
  if (show.favoritesOnly && !item.favorite) return false
  return Boolean(show[item.kind])
}
