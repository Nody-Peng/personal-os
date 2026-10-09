'use client'

// Leaving the reader saves the place a moment later than the library loads.
// The reader registers each save here; the library, when it mounts after a
// save, waits for it and refreshes, so the progress bars are current at once.
// Module state lives as long as the tab's JavaScript, across client navigations.

let pending: Promise<unknown> = Promise.resolve()
let stale = false

export function trackSave(save: Promise<unknown>) {
  stale = true
  pending = Promise.all([pending, save.catch(() => undefined)])
}

/** Runs `refresh` once the reader's last save has landed (if there was one). */
export function afterReaderSaves(refresh: () => void) {
  if (!stale) return
  stale = false
  void pending.then(refresh)
}
