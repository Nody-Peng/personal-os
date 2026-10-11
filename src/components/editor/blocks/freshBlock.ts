'use client'

import { useEffect, useRef, type RefObject } from 'react'

// A picker block (link to page, bookmark, embed) that the slash menu just
// inserted opens and takes the focus. The same empty block met later (a
// reload, another device) stays a quiet placeholder instead of pulling the
// page down to it.

const WINDOW = 1500
let fresh: { type: string; at: number; id?: string } | null = null

/** Call just before the slash menu inserts a block of this type… */
export function markFresh(type: string) {
  fresh = { type, at: Date.now() }
}

/** …and with the inserted block, so only that one opens. */
export function freshIs(id: string) {
  if (fresh) fresh.id = id
}

export function isFresh(block: { id: string; type: string }): boolean {
  return fresh != null && fresh.type === block.type && (fresh.id == null || fresh.id === block.id) && Date.now() - fresh.at < WINDOW
}

/** A press anywhere outside `ref` (mouse or touch) dismisses a picker. */
export function useClickAway(ref: RefObject<HTMLElement | null>, onAway: () => void, active = true) {
  const away = useRef(onAway)
  useEffect(() => {
    away.current = onAway
  })
  useEffect(() => {
    if (!active) return
    const onDown = (e: PointerEvent) => {
      if (e.target instanceof Node && !ref.current?.contains(e.target)) away.current()
    }
    document.addEventListener('pointerdown', onDown, true)
    return () => document.removeEventListener('pointerdown', onDown, true)
  }, [ref, active])
}
