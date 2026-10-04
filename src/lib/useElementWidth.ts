'use client'

import { useEffect, useRef, useState } from 'react'

/**
 * Charts are drawn at their real pixel width (not a scaled viewBox) so axis
 * text stays a readable size on a phone.
 */
export function useElementWidth<T extends HTMLElement>(fallback = 640) {
  const ref = useRef<T>(null)
  const [width, setWidth] = useState(fallback)

  useEffect(() => {
    const el = ref.current
    if (!el) return
    const observer = new ResizeObserver(([entry]) => setWidth(Math.round(entry.contentRect.width)))
    observer.observe(el)
    return () => observer.disconnect()
  }, [])

  return [ref, width] as const
}
