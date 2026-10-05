import 'server-only'
import type { CollectionSlug, DataFromCollectionSlug, RequiredDataFromCollectionSlug, Where } from 'payload'
import type { Session } from './session'

/**
 * Update the one document matching `where` (a unique key such as a day), or
 * create it. Two saves racing on a fresh key — the day's note autosave and a
 * habit tick just after 04:00 — both find nothing; the loser's create hits the
 * unique index, so it looks again and updates the row the winner made.
 */
export async function upsertOne<S extends CollectionSlug>(
  { payload, user }: Session,
  collection: S,
  where: Where,
  data: Partial<DataFromCollectionSlug<S>>,
  createData: RequiredDataFromCollectionSlug<S>,
): Promise<void> {
  const find = async () => (await payload.find({ collection, where, limit: 1, depth: 0, user, overrideAccess: false })).docs[0]
  const update = (id: number | string) =>
    payload.update({ collection, id, data: data as never, user, overrideAccess: false })

  const existing = await find()
  if (existing) {
    await update(existing.id)
    return
  }
  try {
    await payload.create({ collection, data: createData, user, overrideAccess: false })
  } catch (error) {
    const raced = await find()
    if (!raced) throw error
    await update(raced.id)
  }
}
