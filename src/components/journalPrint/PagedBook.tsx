'use client'

import { ArrowLeft, Printer } from '@phosphor-icons/react'
import { useEffect, useRef, useState, type ReactNode } from 'react'

// The print page's client side: Paged.js cuts the book (rendered on the server
// into a hidden copy) into pages, then the browser prints them — "Save as PDF"
// makes the file. Fonts and pictures load first, because each page is laid
// out once and a late font would leave text spilling off it. Google's CJK
// fonts come in slices by character range: only the ones this text uses load.

/** Loaded (or failed), but not longer than a while: a stuck picture shouldn't hold the book. (decode() never settles in a hidden copy.) */
const settled = (img: HTMLImageElement) =>
  img.complete
    ? Promise.resolve()
    : new Promise<void>((resolve) => {
        img.addEventListener('load', () => resolve(), { once: true })
        img.addEventListener('error', () => resolve(), { once: true })
        setTimeout(resolve, 20_000)
      })

type Phase = { kind: 'preparing' } | { kind: 'layout'; pages: number } | { kind: 'ready'; pages: number } | { kind: 'error' }

type Props = {
  css: string
  /** CSS font shorthands to load before laying out, e.g. `400 16px "Iansui"`. */
  fonts: string[]
  backHref: string
  children: ReactNode
}

export function PagedBook({ css, fonts, backHref, children }: Props) {
  const source = useRef<HTMLDivElement>(null)
  const target = useRef<HTMLDivElement>(null)
  const started = useRef(false)
  const [phase, setPhase] = useState<Phase>({ kind: 'preparing' })

  useEffect(() => {
    // Once, also under Strict Mode's second run: the pages are built into the DOM.
    if (started.current) return
    started.current = true
    ;(async () => {
      const src = source.current
      const out = target.current
      if (!src || !out) return
      const text = src.textContent ?? ''
      await Promise.all(fonts.map((font) => document.fonts.load(font, text).catch(() => [])))
      await document.fonts.ready
      await Promise.all(Array.from(src.querySelectorAll('img'), settled))
      const { Previewer } = await import('pagedjs')
      const previewer = new Previewer()
      let pages = 0
      previewer.on('page', () => {
        pages++
        if (pages % 4 === 0) setPhase({ kind: 'layout', pages })
      })
      const content = document.createDocumentFragment()
      for (const child of Array.from(src.childNodes)) content.append(child.cloneNode(true))
      const flow = await previewer.preview(content, [{ [window.location.href]: css }], out)
      setPhase({ kind: 'ready', pages: flow.total })
    })().catch((error) => {
      console.error('Journal book layout failed', error)
      setPhase({ kind: 'error' })
    })
  }, [css, fonts])

  // A page wider than a phone is shown smaller (printing resets it, styles.css).
  useEffect(() => {
    if (phase.kind !== 'ready') return
    const fit = () => {
      const out = target.current
      const page = out?.querySelector<HTMLElement>('.pagedjs_page')
      if (!out || !page) return
      out.style.zoom = ''
      out.style.zoom = String(Math.min(1, (document.documentElement.clientWidth - 24) / page.offsetWidth))
    }
    fit()
    window.addEventListener('resize', fit)
    return () => window.removeEventListener('resize', fit)
  }, [phase.kind])

  const status =
    phase.kind === 'preparing'
      ? '準備字型與照片…'
      : phase.kind === 'layout'
        ? `排版中… 第 ${phase.pages} 頁（請留在這個分頁）`
        : phase.kind === 'ready'
          ? `共 ${phase.pages} 頁`
          : '排版失敗，請重新整理再試一次'

  return (
    <div className="journal-print min-h-[100dvh] bg-sunken">
      <header className="sticky top-0 z-10 flex items-center gap-2 border-b border-line bg-surface/90 px-3 py-2 backdrop-blur print:hidden md:px-5">
        {/* A full page load on the way out: Paged.js leaves its styles in <head>. */}
        <a href={backHref} className="flex items-center gap-1.5 rounded-md p-2 text-sm text-muted hover:bg-sunken hover:text-ink-strong">
          <ArrowLeft size={16} />
          <span className="hidden sm:inline">日記本</span>
        </a>
        <p className="min-w-0 flex-1 truncate text-sm text-muted" role="status">
          {status}
        </p>
        <button
          type="button"
          onClick={() => window.print()}
          disabled={phase.kind !== 'ready'}
          className="flex min-h-10 items-center gap-1.5 rounded-lg bg-ink-strong px-3.5 text-sm font-medium text-on-ink disabled:opacity-40"
        >
          <Printer size={16} />
          列印／存成 PDF
        </button>
      </header>
      {phase.kind === 'ready' && (
        <p className="mx-auto max-w-xl px-4 pt-4 text-center text-xs leading-relaxed text-muted print:hidden">
          在列印視窗把「目的地」選成「另存為 PDF」。如果封面或格線沒有印出來，到「更多設定」勾選「背景圖形」。
        </p>
      )}

      <div ref={target} className="paged-preview" />
      {phase.kind !== 'ready' && phase.kind !== 'error' && (
        <div className="mx-auto mt-16 h-2 w-48 overflow-hidden rounded-full bg-line print:hidden" aria-hidden>
          <div className="h-full w-1/3 animate-pulse rounded-full bg-accent" />
        </div>
      )}
      {/* The book as rendered on the server, copied into pages. */}
      <div ref={source} hidden>
        {children}
      </div>
    </div>
  )
}
