'use client'

import {
  Barbell,
  BookOpen,
  CheckCircle,
  Drop,
  Headphones,
  Leaf,
  Moon,
  PencilSimple,
  Pill,
  PersonSimpleRun,
  type Icon,
} from '@phosphor-icons/react'
import type { HabitIconKey } from '@/lib/habits'

const ICONS: Record<HabitIconKey, Icon> = {
  headphones: Headphones,
  barbell: Barbell,
  drop: Drop,
  book: BookOpen,
  run: PersonSimpleRun,
  moon: Moon,
  leaf: Leaf,
  pill: Pill,
  pencil: PencilSimple,
  check: CheckCircle,
}

export function HabitIcon({ icon, size = 20, className }: { icon: HabitIconKey; size?: number; className?: string }) {
  const Glyph = ICONS[icon] ?? CheckCircle
  return <Glyph size={size} className={className} />
}

// Habits share one ink colour, so each one gets its own mark shape in
// charts (circle, square, diamond, triangle) instead of a colour.
const SHAPES = ['rounded-full', 'rounded-[2px]', 'rotate-45 rounded-[1px] scale-90', '[clip-path:polygon(50%_0,100%_100%,0_100%)]']

export function HabitMark({ index, on, size = 'size-2' }: { index: number; on: boolean; size?: string }) {
  const shape = SHAPES[index % SHAPES.length]
  return (
    <span
      className={`inline-block shrink-0 ${size} ${shape} ${on ? 'bg-ink-strong' : 'bg-line-strong'}`}
      aria-hidden
    />
  )
}
