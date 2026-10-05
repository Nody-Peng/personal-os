'use client'

import type { ReactNode } from 'react'
import { noteIconColor, parseNoteIcon } from '@/lib/noteIcons'
import { NOTE_ICON_COMPONENTS } from './noteIconSet'

/**
 * A page icon at the surrounding font size: an emoji drawn with the shared
 * emoji font (so every device shows the same set), a coloured Phosphor icon,
 * or an uploaded picture.
 */
export function NoteIcon({ icon, fallback = null, className = '' }: { icon: string | null | undefined; fallback?: ReactNode; className?: string }) {
  const parsed = parseNoteIcon(icon)
  if (!parsed) return <>{fallback}</>
  if (parsed.kind === 'emoji') return <span className={`note-emoji ${className}`}>{parsed.emoji}</span>
  if (parsed.kind === 'image') {
    // eslint-disable-next-line @next/next/no-img-element -- private upload behind the login check
    return <img src={parsed.url} alt="" draggable={false} className={`inline-block size-[1em] shrink-0 rounded-[0.18em] object-cover ${className}`} />
  }
  const Icon = NOTE_ICON_COMPONENTS[parsed.name]
  return <Icon size="1em" weight="fill" color={noteIconColor(parsed.color)} className={`shrink-0 ${className}`} aria-hidden />
}
