import { addDays, daysBetween } from './day'

export type Span = { id: number; startDate: string; endDate: string }
export type PlacedBar<T extends Span> = {
  item: T
  startCol: number // 0 = Monday
  endCol: number // inclusive
  lane: number
  continuesBefore: boolean
  continuesAfter: boolean
}

/**
 * Lays multi-day items out as bars across one calendar week, like a wall
 * calendar: each bar gets the lowest lane that is free for all its days.
 */
export function layoutWeekBars<T extends Span>(monday: string, items: T[]): PlacedBar<T>[] {
  const sunday = addDays(monday, 6)
  const inWeek = items
    .filter((i) => i.startDate <= sunday && i.endDate >= monday)
    .sort((a, b) => a.startDate.localeCompare(b.startDate) || b.endDate.localeCompare(a.endDate) || a.id - b.id)

  const lanes: boolean[][] = []
  const placed: PlacedBar<T>[] = []
  for (const item of inWeek) {
    const startCol = Math.max(0, daysBetween(monday, item.startDate))
    const endCol = Math.min(6, daysBetween(monday, item.endDate))
    let lane = lanes.findIndex((cols) => cols.slice(startCol, endCol + 1).every((taken) => !taken))
    if (lane === -1) {
      lane = lanes.length
      lanes.push(Array(7).fill(false))
    }
    for (let c = startCol; c <= endCol; c++) lanes[lane][c] = true
    placed.push({
      item,
      startCol,
      endCol,
      lane,
      continuesBefore: item.startDate < monday,
      continuesAfter: item.endDate > sunday,
    })
  }
  return placed
}
