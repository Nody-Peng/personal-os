'use client'

// URL-driven panels (?task=, ?peek=) open with a history entry, so Back closes
// them. Closing a panel we opened steps back over that entry, so the next Back
// leaves the page instead of reopening or repeating it. A panel that arrived
// with the URL (a shared link, a reload) is closed by replacing the URL.

import type { useRouter } from 'next/navigation'

type Router = ReturnType<typeof useRouter>

let opened: string | null = null
const here = () => window.location.pathname + window.location.search

export function openPanel(router: Router, href: string) {
  opened = href
  router.push(href, { scroll: false })
}

/** `refresh`: re-render the page underneath (its lists may have changed). */
export function closePanel(router: Router, closedHref: string, { refresh = false } = {}) {
  const ours = opened === here()
  opened = null
  if (ours) {
    if (refresh) {
      const onPop = () => {
        window.removeEventListener('popstate', onPop)
        router.refresh()
      }
      window.addEventListener('popstate', onPop)
    }
    router.back()
    return
  }
  router.replace(closedHref, { scroll: false })
  if (refresh) router.refresh()
}
