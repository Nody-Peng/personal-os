// Numbers for the journal book's month openers and closing summary
// (components/journalPrint). Pure, so tests can check them.

/** What the stats need from a day (journalBook.ts fills it in). */
export type StatDay = {
  day: string
  recorded: boolean
  energy: number | null
  habits: number[]
  toeflMinutes: number
  themeMinutes: number
  /** IMPORTANT items of the day, migrated ones left out. */
  tasksDone: number
  tasksTotal: number
  words: number
  photos: number
}

export type PeriodStats = {
  days: number
  recorded: number
  /** Most recorded days in a row. */
  longestStreak: number
  importantDone: number
  importantTotal: number
  toeflMinutes: number
  themeMinutes: number
  /** Mean of the days that have an energy score; null when none do. */
  energyAvg: number | null
  energyDays: number
  /** Ticks per habit id. */
  habitTicks: Record<number, number>
  words: number
  photos: number
}

/** Days must be consecutive calendar days, in order. */
export function periodStats(days: StatDay[]): PeriodStats {
  const stats: PeriodStats = {
    days: days.length,
    recorded: 0,
    longestStreak: 0,
    importantDone: 0,
    importantTotal: 0,
    toeflMinutes: 0,
    themeMinutes: 0,
    energyAvg: null,
    energyDays: 0,
    habitTicks: {},
    words: 0,
    photos: 0,
  }
  let run = 0
  let energySum = 0
  for (const d of days) {
    if (d.recorded) {
      stats.recorded++
      run++
      stats.longestStreak = Math.max(stats.longestStreak, run)
    } else {
      run = 0
    }
    stats.importantDone += d.tasksDone
    stats.importantTotal += d.tasksTotal
    stats.toeflMinutes += d.toeflMinutes
    stats.themeMinutes += d.themeMinutes
    if (d.energy != null) {
      energySum += d.energy
      stats.energyDays++
    }
    for (const id of d.habits) stats.habitTicks[id] = (stats.habitTicks[id] ?? 0) + 1
    stats.words += d.words
    stats.photos += d.photos
  }
  if (stats.energyDays) stats.energyAvg = energySum / stats.energyDays
  return stats
}

/** "12.5 小時" or "45 分鐘". */
export function formatMinutes(minutes: number): string {
  if (minutes < 60) return `${minutes} 分鐘`
  const hours = Math.round((minutes / 60) * 10) / 10
  return `${hours} 小時`
}

export const percent = (part: number, whole: number) => (whole ? Math.round((part / whole) * 100) : 0)

type Loose = { type?: unknown; children?: unknown }

/** Picture blocks in a document, nested ones included. */
export function countImages(blocks: unknown): number {
  if (!Array.isArray(blocks)) return 0
  let n = 0
  for (const b of blocks) {
    if (!b || typeof b !== 'object') continue
    const block = b as Loose
    if (block.type === 'image') n++
    n += countImages(block.children)
  }
  return n
}
