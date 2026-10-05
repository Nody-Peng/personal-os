'use client'

import { Desktop, Moon, Sun, type Icon } from '@phosphor-icons/react'
import { setThemePreference, useThemePreference, type ThemePreference } from '@/lib/theme'

const OPTIONS: { value: ThemePreference; label: string; Icon: Icon }[] = [
  { value: 'system', label: '跟隨系統', Icon: Desktop },
  { value: 'light', label: '淺色', Icon: Sun },
  { value: 'dark', label: '深色', Icon: Moon },
]

/** 外觀: follow the system, or always light / dark (remembered per device). */
export function ThemeSwitch({ className = '' }: { className?: string }) {
  const preference = useThemePreference()
  return (
    <div role="radiogroup" aria-label="外觀" className={`inline-flex rounded-lg border border-line bg-sunken p-0.5 ${className}`}>
      {OPTIONS.map(({ value, label, Icon }) => {
        const on = preference === value
        return (
          <button
            key={value}
            type="button"
            role="radio"
            aria-checked={on}
            title={label}
            onClick={() => setThemePreference(value)}
            className={`flex flex-1 items-center justify-center gap-1.5 rounded-md px-2.5 py-1.5 text-xs transition-colors duration-200 ${
              on ? 'bg-surface font-medium text-ink-strong shadow-[0_1px_2px_rgb(17_17_17/0.08)]' : 'text-muted hover:text-ink-strong'
            }`}
          >
            <Icon size={14} weight={on ? 'fill' : 'regular'} />
            {label}
          </button>
        )
      })}
    </div>
  )
}

/** One button that steps 系統 → 淺色 → 深色 (for tight headers). */
export function ThemeCycleButton({ className = '' }: { className?: string }) {
  const preference = useThemePreference()
  const index = OPTIONS.findIndex((o) => o.value === preference)
  const current = OPTIONS[index]
  const next = OPTIONS[(index + 1) % OPTIONS.length]
  return (
    <button
      type="button"
      onClick={() => setThemePreference(next.value)}
      aria-label={`外觀：${current.label}（點一下換成${next.label}）`}
      title={`外觀：${current.label}`}
      className={`grid place-items-center rounded-md transition-colors hover:bg-sunken hover:text-ink-strong ${className}`}
    >
      <current.Icon size={18} className="theme-icon" key={current.value} />
    </button>
  )
}
