// Per-device storage for results the user shouldn't have to wait for twice (a loophole
// scan takes about a minute and uses the team's shared AI quota) and for their notes.
// localStorage can throw (private mode, blocked or full storage), so every access is
// guarded: the app keeps working, it just won't remember things across reloads.
const PREFIX = 'nal:'

export function loadJSON(key) {
  try {
    const raw = localStorage.getItem(PREFIX + key)
    return raw ? JSON.parse(raw) : null
  } catch {
    return null
  }
}

export function saveJSON(key, value) {
  try {
    localStorage.setItem(PREFIX + key, JSON.stringify(value))
  } catch {
    // Not saved; the result is still shown for this visit.
  }
}

export function removeKey(key) {
  try {
    localStorage.removeItem(PREFIX + key)
  } catch {
    // Nothing to remove.
  }
}
