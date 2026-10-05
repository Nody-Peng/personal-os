'use client'

// Light / dark / follow the system. The choice is per device (localStorage);
// <html data-theme> always holds the resolved theme. The inline script in the
// frontend layout (THEME_SCRIPT) sets it before the first paint, so pages never
// flash light first; ThemeSync keeps it following the system afterwards.
// (lib/themeScript.ts holds what the server layout needs.)

import { useEffect, useSyncExternalStore } from 'react'
import { DARK_QUERY, THEME_KEY as KEY } from './themeScript'

export type ThemePreference = 'system' | 'light' | 'dark'
export type ResolvedTheme = 'light' | 'dark'

/** The canvas colours, for the browser's own UI (address bar, PWA status bar). */
const THEME_COLORS: Record<ResolvedTheme, string> = { light: '#f7f6f3', dark: '#191918' }

function readPreference(): ThemePreference {
  try {
    const value = localStorage.getItem(KEY)
    return value === 'light' || value === 'dark' ? value : 'system'
  } catch {
    return 'system'
  }
}

function resolve(preference: ThemePreference): ResolvedTheme {
  if (preference !== 'system') return preference
  return window.matchMedia(DARK_QUERY).matches ? 'dark' : 'light'
}

function apply(theme: ResolvedTheme) {
  const root = document.documentElement
  if (root.dataset.theme === theme) return
  // Switch without every element animating its colours at once.
  root.classList.add('theme-switching')
  root.dataset.theme = theme
  root.style.colorScheme = theme
  document.querySelectorAll('meta[name="theme-color"]').forEach((m) => m.setAttribute('content', THEME_COLORS[theme]))
  requestAnimationFrame(() => requestAnimationFrame(() => root.classList.remove('theme-switching')))
}

const listeners = new Set<() => void>()
const notify = () => listeners.forEach((l) => l())

export function setThemePreference(preference: ThemePreference) {
  try {
    if (preference === 'system') localStorage.removeItem(KEY)
    else localStorage.setItem(KEY, preference)
  } catch {
    // Storage off: the choice lasts until the page is reloaded.
  }
  apply(resolve(preference))
  notify()
}

export function useThemePreference(): ThemePreference {
  return useSyncExternalStore(
    (onChange) => {
      listeners.add(onChange)
      return () => listeners.delete(onChange)
    },
    readPreference,
    () => 'system',
  )
}

/** The theme on screen right now (for parts that need it in JS, like the editor). */
export function useResolvedTheme(): ResolvedTheme {
  return useSyncExternalStore(
    (onChange) => {
      const observer = new MutationObserver(onChange)
      observer.observe(document.documentElement, { attributes: true, attributeFilter: ['data-theme'] })
      return () => observer.disconnect()
    },
    () => (document.documentElement.dataset.theme === 'dark' ? 'dark' : 'light'),
    () => 'light',
  )
}

/** Mounted once: follows the system while the preference is "system". */
export function ThemeSync() {
  useEffect(() => {
    const media = window.matchMedia(DARK_QUERY)
    const onChange = () => {
      if (readPreference() === 'system') apply(resolve('system'))
    }
    media.addEventListener('change', onChange)
    // Another tab changed the preference.
    const onStorage = (e: StorageEvent) => {
      if (e.key === KEY) {
        apply(resolve(readPreference()))
        notify()
      }
    }
    window.addEventListener('storage', onStorage)
    return () => {
      media.removeEventListener('change', onChange)
      window.removeEventListener('storage', onStorage)
    }
  }, [])
  return null
}
