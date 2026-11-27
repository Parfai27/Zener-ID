// A small "something changed" signal, so open pages reload after an action
// elsewhere: a decision in the review queue updates the sidebar's count, a
// suspended client updates the list.
const listeners = new Set<() => void>()

export function subscribe(fn: () => void) {
  listeners.add(fn)
  return () => { listeners.delete(fn) }
}

export function changed() {
  listeners.forEach(l => l())
}
