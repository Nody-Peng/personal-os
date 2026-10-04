import 'server-only'
import { logicalDay, weekStart } from './day'
import type { Idea } from '@/payload-types'
import { getSelectedIdea, getWeekTheme } from './queries'
import type { Session } from './session'

// Each week stores its own theme on its week note. The idea status
// "selected" mirrors the *current* week's theme so the ideas page and the
// week note always agree.

export function currentMonday(): string {
  return weekStart(logicalDay())
}

async function findReview({ payload, user }: Session, monday: string) {
  const { docs } = await payload.find({
    collection: 'weekly-reviews',
    where: { weekStart: { equals: monday } },
    limit: 1,
    depth: 0,
    user,
    overrideAccess: false,
  })
  return docs[0] ?? null
}

/** Store a week's theme on its week note (creating the note if needed). */
export async function writeWeekTheme(session: Session, monday: string, themeId: number | null): Promise<void> {
  const { payload, user } = session
  const review = await findReview(session, monday)
  if (review) {
    await payload.update({ collection: 'weekly-reviews', id: review.id, data: { theme: themeId }, user, overrideAccess: false })
  } else if (themeId !== null) {
    await payload.create({ collection: 'weekly-reviews', data: { weekStart: monday, theme: themeId }, user, overrideAccess: false })
  }
}

/** The current week's theme id as stored on its week note, if any. */
export async function storedWeekThemeId(session: Session, monday: string): Promise<number | null> {
  const theme = (await findReview(session, monday))?.theme
  return typeof theme === 'number' ? theme : (theme?.id ?? null)
}

/**
 * This week's theme. A theme chosen in advance ("next week") lives on its
 * week note; the first read in that week promotes it to the active idea so
 * the ideas page agrees. Weeks without a stored theme keep the active idea.
 */
export async function getCurrentTheme(session: Session): Promise<Idea | null> {
  const { payload, user } = session
  const stored = await getWeekTheme(session, currentMonday())
  if (stored) {
    if (stored.status !== 'selected' && stored.status !== 'done' && stored.status !== 'dropped') {
      await payload.update({ collection: 'ideas', id: stored.id, data: { status: 'selected' }, user, overrideAccess: false })
    }
    return stored
  }
  return getSelectedIdea(session)
}
