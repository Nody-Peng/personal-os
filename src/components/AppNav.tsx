'use client'

import { Books, ChartLineUp, DotsThreeCircle, GearSix, Lightbulb, SignOut, SunHorizon, X } from '@phosphor-icons/react'
import Link from 'next/link'
import { usePathname, useRouter } from 'next/navigation'
import { useEffect, useState } from 'react'
import { Logo } from '@/components/brand/Logo'
import { ThemeCycleButton, ThemeSwitch } from '@/components/ThemeSwitch'

const ITEMS = [
  { href: '/', label: '今天', Icon: SunHorizon },
  { href: '/journal', label: '書架', Icon: Books },
  { href: '/toefl', label: '托福', Icon: ChartLineUp },
  { href: '/ideas', label: '想學', Icon: Lightbulb },
] as const

function isActive(pathname: string, href: string) {
  if (href === '/') return pathname === '/'
  return pathname.startsWith(href)
}

/** Top bar on desktop, bottom tab bar (with a 更多 sheet) on phones. */
export function AppNav() {
  const pathname = usePathname()
  const router = useRouter()
  const [moreAt, setMoreAt] = useState<string | null>(null)
  // The sheet belongs to the page it was opened on, so navigating closes it.
  const more = moreAt === pathname

  const logout = async () => {
    await fetch('/api/users/logout', { method: 'POST', credentials: 'include' }).catch(() => null)
    router.replace('/login')
    router.refresh()
  }

  useEffect(() => {
    if (!more) return
    const onKey = (e: KeyboardEvent) => e.key === 'Escape' && setMoreAt(null)
    document.addEventListener('keydown', onKey)
    return () => document.removeEventListener('keydown', onKey)
  }, [more])

  return (
    <>
      <header className="sticky top-0 z-20 hidden border-b border-line bg-canvas/85 backdrop-blur md:block">
        <div className="mx-auto flex h-16 max-w-5xl items-center gap-8 px-6">
          <Link href="/" className="flex items-center gap-2.5 font-mono text-sm font-semibold tracking-tight text-ink-strong">
            <Logo size={28} />
            Personal OS
          </Link>
          <nav className="flex flex-1 items-center gap-1">
            {ITEMS.map(({ href, label, Icon }) => {
              const active = isActive(pathname, href)
              return (
                <Link
                  key={href}
                  href={href}
                  aria-current={active ? 'page' : undefined}
                  className={`flex items-center gap-2 rounded-md px-3 py-1.5 text-sm transition-colors duration-200 ${
                    active ? 'bg-surface font-medium text-ink-strong ring-1 ring-line' : 'text-muted hover:bg-sunken/70 hover:text-ink-strong'
                  }`}
                >
                  <Icon size={18} weight={active ? 'fill' : 'regular'} />
                  {label}
                </Link>
              )
            })}
          </nav>
          <div className="flex items-center gap-5">
            <ThemeCycleButton className="size-8 text-muted" />
            <Link href="/admin" className="flex items-center gap-1.5 text-sm text-muted transition-colors hover:text-ink-strong">
              <GearSix size={18} />
              後台
            </Link>
            <button type="button" onClick={logout} className="flex items-center gap-1.5 text-sm text-muted transition-colors hover:text-ink-strong">
              <SignOut size={18} />
              登出
            </button>
          </div>
        </div>
      </header>

      <nav
        aria-label="主要頁面"
        className="fixed inset-x-0 bottom-0 z-30 border-t border-line bg-surface/90 pb-[env(safe-area-inset-bottom)] backdrop-blur-md md:hidden"
      >
        <ul className="grid grid-cols-5">
          {ITEMS.map(({ href, label, Icon }) => {
            const active = isActive(pathname, href)
            return (
              <li key={href}>
                <Link
                  href={href}
                  aria-current={active ? 'page' : undefined}
                  className={`tab-press flex flex-col items-center gap-0.5 py-2.5 text-[11px] font-medium transition-colors ${active ? 'text-ink-strong' : 'text-muted'}`}
                >
                  <Icon size={24} weight={active ? 'fill' : 'regular'} />
                  {label}
                </Link>
              </li>
            )
          })}
          <li>
            <button
              type="button"
              onClick={() => setMoreAt(more ? null : pathname)}
              aria-expanded={more}
              className={`tab-press flex w-full flex-col items-center gap-0.5 py-2.5 text-[11px] font-medium transition-colors ${more ? 'text-ink-strong' : 'text-muted'}`}
            >
              <DotsThreeCircle size={24} weight={more ? 'fill' : 'regular'} />
              更多
            </button>
          </li>
        </ul>
      </nav>

      {more && (
        <div className="fixed inset-0 z-20 md:hidden" role="dialog" aria-modal="true" aria-label="更多">
          <button type="button" aria-label="關閉" onClick={() => setMoreAt(null)} className="modal-scrim absolute inset-0 bg-scrim" />
          <div className="sheet-in absolute inset-x-0 bottom-0 rounded-t-2xl border-t border-line bg-surface px-4 pt-3 pb-[calc(env(safe-area-inset-bottom)+5rem)]">
            <div className="mx-auto mb-3 h-1 w-10 rounded-full bg-line-strong" aria-hidden />
            <div className="mb-4 flex items-center justify-between">
              <span className="flex items-center gap-2 font-mono text-sm font-semibold text-ink-strong">
                <Logo size={22} />
                Personal OS
              </span>
              <button type="button" onClick={() => setMoreAt(null)} aria-label="關閉" className="rounded-md p-1.5 text-muted hover:bg-sunken">
                <X size={18} />
              </button>
            </div>
            <p className="label mb-2">外觀</p>
            <ThemeSwitch className="w-full" />
            <div className="mt-5 grid gap-1 border-t border-line pt-3">
              <Link href="/admin" className="flex h-11 items-center gap-3 rounded-lg px-2 text-ink hover:bg-sunken">
                <GearSix size={20} className="text-muted" />
                後台
              </Link>
              <button type="button" onClick={logout} className="flex h-11 items-center gap-3 rounded-lg px-2 text-left text-ink hover:bg-sunken">
                <SignOut size={20} className="text-muted" />
                登出
              </button>
            </div>
          </div>
        </div>
      )}
    </>
  )
}
