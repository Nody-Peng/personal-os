'use client'

import { Books, ChartLineUp, GearSix, Lightbulb, SignOut, SunHorizon } from '@phosphor-icons/react'
import Link from 'next/link'
import { Logo } from '@/components/brand/Logo'
import { usePathname, useRouter } from 'next/navigation'

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

/** Top bar on desktop, bottom tab bar on phones. */
export function AppNav() {
  const pathname = usePathname()
  const router = useRouter()

  const logout = async () => {
    await fetch('/api/users/logout', { method: 'POST', credentials: 'include' }).catch(() => null)
    router.replace('/login')
    router.refresh()
  }

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
                  className={`flex items-center gap-2 rounded-md px-3 py-1.5 text-sm transition-colors ${
                    active
                      ? 'bg-surface font-medium text-ink-strong ring-1 ring-line'
                      : 'text-muted hover:text-ink-strong'
                  }`}
                >
                  <Icon size={18} weight={active ? 'fill' : 'regular'} />
                  {label}
                </Link>
              )
            })}
          </nav>
          <Link
            href="/admin"
            className="flex items-center gap-1.5 text-sm text-muted transition-colors hover:text-ink-strong"
          >
            <GearSix size={18} />
            後台
          </Link>
          <button
            type="button"
            onClick={logout}
            className="flex items-center gap-1.5 text-sm text-muted transition-colors hover:text-ink-strong"
          >
            <SignOut size={18} />
            登出
          </button>
        </div>
      </header>

      <nav
        aria-label="主要頁面"
        className="fixed inset-x-0 bottom-0 z-20 border-t border-line bg-surface/95 pb-[env(safe-area-inset-bottom)] backdrop-blur md:hidden"
      >
        <ul className="grid grid-cols-4">
          {ITEMS.map(({ href, label, Icon }) => {
            const active = isActive(pathname, href)
            return (
              <li key={href}>
                <Link
                  href={href}
                  aria-current={active ? 'page' : undefined}
                  className={`flex flex-col items-center gap-0.5 py-2.5 text-[11px] font-medium ${
                    active ? 'text-ink-strong' : 'text-muted'
                  }`}
                >
                  <Icon size={24} weight={active ? 'fill' : 'regular'} />
                  {label}
                </Link>
              </li>
            )
          })}
        </ul>
      </nav>
    </>
  )
}
