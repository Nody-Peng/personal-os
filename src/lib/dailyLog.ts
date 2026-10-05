// Rules about a day's log shared by pages, stats and tests.

import type { DailyLog } from '@/payload-types'
import { blocksHaveText } from './blocks'

/**
 * Whether a day counts as recorded: a habit, TOEFL or theme time, energy or a
 * note. 早/午/晚 checklists never count (they are often written ahead for
 * tomorrow from 安排明天).
 */
export function isRecordedLog(log: Pick<DailyLog, 'habitsDone' | 'toeflMinutes' | 'themeMinutes' | 'toeflSkills' | 'energy' | 'note'>): boolean {
  return (
    (log.habitsDone?.length ?? 0) > 0 ||
    (log.toeflMinutes ?? 0) > 0 ||
    (log.themeMinutes ?? 0) > 0 ||
    (log.toeflSkills?.length ?? 0) > 0 ||
    log.energy != null ||
    blocksHaveText(log.note)
  )
}
