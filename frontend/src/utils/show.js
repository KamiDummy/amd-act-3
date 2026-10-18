// What the user wants to see: the Show toggles in the Review tab. They apply to the
// list and to the highlights drawn on the page alike.

// Every item is one of these kinds: found by the automatic scan, or the user's own,
// with or without a note they wrote. Checking a highlight for risks doesn't change
// its kind; it only adds a risk badge.
export const KINDS = [
  { id: 'auto', label: 'Auto' },
  { id: 'highlight', label: 'Highlights' },
  { id: 'note', label: 'Notes' },
]

export const DEFAULT_SHOW = {
  auto: true,
  highlight: true,
  note: true,
  favoritesOnly: false,
  hidden: false,
}

export function itemKind(item) {
  if (item.source === 'scan') return 'auto'
  return item.note ? 'note' : 'highlight'
}

export function isShown(item, show) {
  if (item.hidden && !show.hidden) return false
  if (show.favoritesOnly && !item.favorite) return false
  return Boolean(show[item.kind])
}
