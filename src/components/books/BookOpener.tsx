'use client'

import Link from 'next/link'
import { usePathname, useRouter } from 'next/navigation'
import { createContext, useCallback, useContext, useEffect, useLayoutEffect, useRef, useState, type ReactNode } from 'react'

type Opening = { href: string; rect: DOMRect; cover: HTMLElement; reduced: boolean }
type Open = (cover: HTMLElement, href: string, rect?: DOMRect) => void

const OpenContext = createContext<Open | null>(null)

const DURATION = 650
const REDUCED_DURATION = 150
/** Share of the animation spent fading out the shelf; navigation starts after it. */
const NAVIGATE_AT = 0.35
const GIVE_UP_AFTER = 10_000

/** Puts a copy of the cover in the overlay and hides the real one on the shelf. */
function liftCover(cover: HTMLElement, into: HTMLElement) {
  const clone = cover.cloneNode(true) as HTMLElement
  clone.style.transition = 'none'
  clone.style.transform = 'none'
  // The original may already be hidden (effects can run twice in development).
  clone.style.visibility = 'visible'
  into.replaceChildren(clone)
  cover.style.visibility = 'hidden'
}

function putBack(cover: HTMLElement) {
  cover.style.visibility = ''
}

const arrivedAt = (pathname: string, href: string) => {
  const path = href.split('?')[0]
  return pathname === path || pathname.startsWith(`${path}/`)
}

/**
 * Plays the "lift the book off the shelf and open it" animation over any
 * route change. Lives in the root layout so it survives the navigation.
 */
export function BookOpenProvider({ children }: { children: ReactNode }) {
  const router = useRouter()
  const pathname = usePathname()
  const [opening, setOpening] = useState<Opening | null>(null)
  const [played, setPlayed] = useState(false)

  const open = useCallback<Open>(
    (cover, href, rect) => {
      const reduced = window.matchMedia('(prefers-reduced-motion: reduce)').matches
      router.prefetch(href)
      setPlayed(false)
      setOpening({ href, rect: rect ?? cover.getBoundingClientRect(), cover, reduced })
    },
    [router],
  )

  const done = useCallback(() => {
    setOpening((current) => {
      if (current) putBack(current.cover)
      return null
    })
  }, [])

  useEffect(() => {
    if (!opening) return
    const timer = window.setTimeout(done, GIVE_UP_AFTER)
    return () => window.clearTimeout(timer)
  }, [opening, done])

  const arrived = opening ? arrivedAt(pathname, opening.href) : false

  return (
    <OpenContext.Provider value={open}>
      {children}
      {opening && (
        <OpeningOverlay
          key={opening.href}
          opening={opening}
          leaving={played && arrived}
          onCovered={() => router.push(opening.href)}
          onPlayed={() => setPlayed(true)}
          onLeft={done}
        />
      )}
    </OpenContext.Provider>
  )
}

export function useBookOpen(): Open {
  const open = useContext(OpenContext)
  if (!open) throw new Error('useBookOpen needs BookOpenProvider')
  return open
}

type OverlayProps = {
  opening: Opening
  leaving: boolean
  /** The shelf is hidden: safe to swap the page underneath. */
  onCovered: () => void
  onPlayed: () => void
  onLeft: () => void
}

function OpeningOverlay({ opening, leaving, onCovered, onPlayed, onLeft }: OverlayProps) {
  const root = useRef<HTMLDivElement>(null)
  const backdrop = useRef<HTMLDivElement>(null)
  const paper = useRef<HTMLDivElement>(null)
  const coverWrap = useRef<HTMLDivElement>(null)
  const coverHinge = useRef<HTMLDivElement>(null)
  const coverFace = useRef<HTMLDivElement>(null)
  const callbacks = useRef({ onCovered, onPlayed, onLeft })
  useEffect(() => {
    callbacks.current = { onCovered, onPlayed, onLeft }
  })

  useLayoutEffect(() => {
    const { rect, cover, reduced } = opening
    if (reduced) {
      const fade = backdrop.current!.animate([{ opacity: 0 }, { opacity: 1 }], { duration: REDUCED_DURATION, fill: 'forwards' })
      fade.onfinish = () => {
        callbacks.current.onCovered()
        callbacks.current.onPlayed()
      }
      return () => fade.cancel()
    }

    liftCover(cover, coverFace.current!)

    const vw = window.innerWidth
    const vh = window.innerHeight
    const { left: x, top: y, width: w, height: h } = rect
    // Mid-air: centred, as large as fits comfortably.
    const s1 = Math.min((0.72 * vh) / h, (0.8 * vw) / w)
    const mid = `translate(${(vw - w * s1) / 2 - x}px, ${(vh - h * s1) / 2 - y}px) scale(${s1})`
    // Open: the page fills the screen, the cover swings away on the left edge.
    const s2 = vh / h
    const coverEnd = `translate(${-x}px, ${(vh - h * s2) / 2 - y}px) scale(${s2})`
    const pageEnd = `translate(${-x}px, ${-y}px) scale(${vw / w}, ${vh / h})`
    const lift = 'cubic-bezier(0.16, 1, 0.3, 1)'
    const swing = 'cubic-bezier(0.55, 0, 0.25, 1)'
    const timing: KeyframeAnimationOptions = { duration: DURATION, fill: 'forwards' }

    const animations = [
      backdrop.current!.animate([{ opacity: 0 }, { opacity: 1 }], { duration: DURATION * NAVIGATE_AT, fill: 'forwards' }),
      paper.current!.animate(
        [
          { transform: 'none', easing: lift },
          { transform: mid, offset: 0.45, easing: swing },
          { transform: pageEnd },
        ],
        timing,
      ),
      coverWrap.current!.animate(
        [
          { transform: 'none', easing: lift },
          { transform: mid, offset: 0.45, easing: swing },
          { transform: coverEnd },
        ],
        timing,
      ),
      coverHinge.current!.animate(
        [
          { transform: 'rotateY(0deg)' },
          { transform: 'rotateY(0deg)', offset: 0.4, easing: swing },
          { transform: 'rotateY(-180deg)' },
        ],
        timing,
      ),
    ]
    animations[0].onfinish = () => callbacks.current.onCovered()
    animations[1].onfinish = () => callbacks.current.onPlayed()
    return () => animations.forEach((a) => a.cancel())
  }, [opening])

  useEffect(() => {
    if (!leaving) return
    const fade = root.current!.animate([{ opacity: 1 }, { opacity: 0 }], { duration: 200, easing: 'ease-out', fill: 'forwards' })
    fade.onfinish = () => callbacks.current.onLeft()
    return () => fade.cancel()
  }, [leaving])

  const { rect, reduced } = opening
  const box = { left: rect.left, top: rect.top, width: rect.width, height: rect.height }

  return (
    <div ref={root} className="fixed inset-0 z-[60] overflow-hidden" aria-hidden>
      <div ref={backdrop} className="absolute inset-0 bg-canvas opacity-0" />
      {!reduced && (
        <>
          <div ref={paper} className="book-paper absolute origin-top-left" style={box} />
          <div ref={coverWrap} className="absolute origin-top-left" style={{ ...box, perspective: `${rect.width * 5}px` }}>
            <div ref={coverHinge} className="book-hinge relative h-full w-full">
              <div ref={coverFace} className="book-face absolute inset-0" />
              <div className="book-face book-endpaper absolute inset-0" />
            </div>
          </div>
        </>
      )}
    </div>
  )
}

type BookLinkProps = { href: string; label: string; children: ReactNode }

/** A book on the shelf: opens with the animation on a plain click. */
export function BookLink({ href, label, children }: BookLinkProps) {
  const open = useBookOpen()
  const ref = useRef<HTMLAnchorElement>(null)
  return (
    <Link
      ref={ref}
      href={href}
      aria-label={label}
      className="book-link block outline-none"
      onClick={(e) => {
        if (e.defaultPrevented || e.button !== 0 || e.metaKey || e.ctrlKey || e.shiftKey || e.altKey) return
        const cover = ref.current?.querySelector<HTMLElement>('.book-cover')
        if (!cover) return
        e.preventDefault()
        // The link's box is the cover without its hover tilt.
        open(cover, href, ref.current!.getBoundingClientRect())
      }}
    >
      {children}
    </Link>
  )
}
