import type { Metadata } from 'next'
import { redirect } from 'next/navigation'
import { logicalDay } from '@/lib/day'
import { getSession, safeRedirect } from '@/lib/session'
import { LoginForm } from './LoginForm'

export const metadata: Metadata = { title: '登入' }
export const dynamic = 'force-dynamic'

type Props = { searchParams: Promise<{ redirect?: string }> }

export default async function LoginPage({ searchParams }: Props) {
  const redirectTo = safeRedirect((await searchParams).redirect)
  if (await getSession()) redirect(redirectTo)
  const year = logicalDay().slice(0, 4)

  return (
    <main className="grid min-h-[100dvh] md:grid-cols-[minmax(0,1fr)_minmax(0,1fr)]">
      {/* Cloth-bound cover, matching the journal books. */}
      <section
        className="book-cover relative flex min-h-[38dvh] flex-col justify-between overflow-hidden rounded-none p-8 md:min-h-[100dvh] md:p-14"
        style={{ '--cover': '#1d2840', transform: 'none' } as React.CSSProperties}
        aria-hidden
      >
        <div className="book-spine absolute inset-y-0 left-0 w-3 md:w-5" />
        <div className="book-foil pointer-events-none absolute inset-5 border border-[color:var(--gold)]/35 md:inset-10" />
        <p className="book-foil relative font-mono text-xs tracking-[0.35em]">PERSONAL OS</p>
        <div className="book-foil relative">
          <p className="text-6xl font-semibold tracking-[0.12em] md:text-8xl">{year}</p>
          <div className="my-4 h-px w-20 bg-[color:var(--gold)]/60" />
          <p className="text-lg tracking-[0.5em] md:text-xl">日 記 本</p>
        </div>
        <p className="book-foil relative hidden text-sm opacity-80 md:block">每天一頁，慢慢寫成一本書。</p>
      </section>

      <section className="flex items-center justify-center px-6 py-10 md:px-12">
        <div className="rise w-full max-w-sm">
          <h1 className="text-3xl font-semibold tracking-tight text-ink-strong">歡迎回來</h1>
          <p className="mt-2 text-muted">登入後繼續寫今天的那一頁。</p>
          <div className="mt-8">
            <LoginForm redirectTo={redirectTo} />
          </div>
        </div>
      </section>
    </main>
  )
}
