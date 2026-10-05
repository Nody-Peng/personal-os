'use client'

import { Eye, EyeSlash, SignIn } from '@phosphor-icons/react'
import { useRouter } from 'next/navigation'
import { useEffect, useRef, useState } from 'react'

const REMEMBER_KEY = 'personal-os:email'
const LOGIN_FAILED = '電子郵件或密碼不正確。連續輸入錯誤太多次時，請 10 分鐘後再試。'

/**
 * Logs in through Payload's REST endpoint (it sets the session cookie).
 * Real form fields with autocomplete hints let the browser or phone
 * password manager offer to save and fill the password; the app itself
 * only remembers the email, and only when asked.
 */
export function LoginForm({ redirectTo }: { redirectTo: string }) {
  const router = useRouter()
  const emailRef = useRef<HTMLInputElement>(null)
  const [password, setPassword] = useState('')
  const [remember, setRemember] = useState(true)
  const [showPassword, setShowPassword] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const [pending, setPending] = useState(false)

  useEffect(() => {
    try {
      const saved = localStorage.getItem(REMEMBER_KEY)
      // Fill only an empty field, so the browser's own autofill wins.
      if (saved && emailRef.current && !emailRef.current.value) emailRef.current.value = saved
    } catch {
      // Storage can be unavailable (private mode); the form still works.
    }
  }, [])

  const submit = async (e: React.FormEvent) => {
    e.preventDefault()
    const email = emailRef.current?.value.trim() ?? ''
    setPending(true)
    setError(null)
    try {
      const res = await fetch('/api/users/login', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        credentials: 'include',
        body: JSON.stringify({ email, password }),
      })
      if (!res.ok) {
        // A wrong password and a locked account get the same message, so the
        // form never reveals whether an email has an account.
        setError(res.status >= 500 ? '登入失敗，請稍後再試一次' : LOGIN_FAILED)
        setPending(false)
        return
      }
      try {
        if (remember) localStorage.setItem(REMEMBER_KEY, email)
        else localStorage.removeItem(REMEMBER_KEY)
      } catch {
        // Ignore storage errors.
      }
      router.replace(redirectTo)
      router.refresh()
    } catch {
      setError('連線失敗，請檢查網路')
      setPending(false)
    }
  }

  return (
    <form method="post" action="/api/users/login" onSubmit={submit} className="grid gap-5">
      <div className="flex flex-col gap-2">
        <label htmlFor="email" className="label">
          電子郵件
        </label>
        <input
          id="email"
          name="email"
          type="email"
          inputMode="email"
          autoComplete="username"
          required
          ref={emailRef}
          className="field"
        />
      </div>

      <div className="flex flex-col gap-2">
        <label htmlFor="password" className="label">
          密碼
        </label>
        <div className="relative">
          <input
            id="password"
            name="password"
            type={showPassword ? 'text' : 'password'}
            autoComplete="current-password"
            required
            value={password}
            onChange={(e) => setPassword(e.target.value)}
            className="field pr-11"
          />
          <button
            type="button"
            onClick={() => setShowPassword((s) => !s)}
            aria-label={showPassword ? '隱藏密碼' : '顯示密碼'}
            className="absolute inset-y-0 right-0 flex w-11 items-center justify-center text-muted hover:text-ink-strong"
          >
            {showPassword ? <EyeSlash size={18} /> : <Eye size={18} />}
          </button>
        </div>
      </div>

      <label className="flex items-center gap-2.5 text-sm text-ink">
        <input
          type="checkbox"
          checked={remember}
          onChange={(e) => setRemember(e.target.checked)}
          className="size-4 accent-[var(--color-ink-strong)]"
        />
        在這台裝置記住帳號
      </label>

      {error && (
        <p role="alert" className="rounded-lg bg-red-soft px-3 py-2.5 text-sm text-red-ink">
          {error}
        </p>
      )}

      <button type="submit" className="btn btn-primary h-12 text-base" disabled={pending}>
        <SignIn size={18} weight="bold" />
        {pending ? '登入中…' : '登入'}
      </button>

      <p className="text-center text-xs text-muted">登入後 30 天內不用重新登入。密碼可交給瀏覽器或手機的密碼管理員記住。</p>
    </form>
  )
}
