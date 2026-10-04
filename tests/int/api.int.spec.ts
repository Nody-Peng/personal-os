import { getPayload, Payload } from 'payload'
import config from '@/payload.config'

import { afterAll, beforeAll, describe, expect, it } from 'vitest'

// Runs against the database in DATABASE_URL (npm run db:local for development).
let payload: Payload
const created: number[] = []

describe('ideas', () => {
  beforeAll(async () => {
    payload = await getPayload({ config: await config })
  })

  afterAll(async () => {
    for (const id of created) await payload.delete({ collection: 'ideas', id })
  })

  const make = async (title: string) => {
    const doc = await payload.create({
      collection: 'ideas',
      data: { title, status: 'inbox', scoreGoal: 2, scoreUrgency: 1, scorePassion: 3 },
    })
    created.push(doc.id)
    return doc
  }

  it('computes the total score', async () => {
    const idea = await make('test: total')
    expect(idea.total).toBe(6)

    const updated = await payload.update({ collection: 'ideas', id: idea.id, data: { scoreGoal: 0 } })
    expect(updated.total).toBe(4)
  })

  it('keeps only one weekly theme selected', async () => {
    const a = await make('test: theme A')
    const b = await make('test: theme B')

    await payload.update({ collection: 'ideas', id: a.id, data: { status: 'selected' } })
    await payload.update({ collection: 'ideas', id: b.id, data: { status: 'selected' } })

    const { docs } = await payload.find({
      collection: 'ideas',
      where: { status: { equals: 'selected' } },
    })
    expect(docs.map((d) => d.id)).toEqual([b.id])
  })

  it('computes the overall TOEFL band from four sections, and only then', async () => {
    const score = await payload.create({
      collection: 'toefl-scores',
      data: { date: '2026-10-10', type: 'full', reading: 5, listening: 5.5, speaking: 4.5, writing: 4 },
    })
    try {
      expect(score.overall).toBe(5) // 4.75 → 5

      const partial = await payload.update({ collection: 'toefl-scores', id: score.id, data: { writing: null } })
      expect(partial.overall).toBeNull()

      const fixed = await payload.update({ collection: 'toefl-scores', id: score.id, data: { writing: 3 } })
      expect(fixed.overall).toBe(4.5) // 4.5
    } finally {
      await payload.delete({ collection: 'toefl-scores', id: score.id })
    }
  })

  it('allows at most three IMPORTANT items per day, not counting migrated ones', async () => {
    const day = '2031-01-01'
    const ids: number[] = []
    try {
      for (const title of ['A', 'B', 'C']) {
        ids.push((await payload.create({ collection: 'tasks', data: { kind: 'important', day, title, status: 'todo' } })).id)
      }
      await expect(
        payload.create({ collection: 'tasks', data: { kind: 'important', day, title: 'D', status: 'todo' } }),
      ).rejects.toThrow(/3 件 Important/)

      // A migrated item frees its slot.
      await payload.update({ collection: 'tasks', id: ids[0], data: { status: 'migrated' } })
      ids.push((await payload.create({ collection: 'tasks', data: { kind: 'important', day, title: 'D', status: 'todo' } })).id)
    } finally {
      for (const id of ids) await payload.delete({ collection: 'tasks', id })
    }
  })

  it('requires a complete, ordered period on tasks', async () => {
    const base = { kind: 'weekly' as const, weekStart: '2031-01-06', title: 'period', status: 'todo' as const }
    await expect(payload.create({ collection: 'tasks', data: { ...base, startDate: '2031-01-07' } })).rejects.toThrow(/同時設定/)
    await expect(
      payload.create({ collection: 'tasks', data: { ...base, startDate: '2031-01-09', endDate: '2031-01-07' } }),
    ).rejects.toThrow(/不能晚於/)
  })

  it('blocks anonymous access when access control is enforced', async () => {
    await expect(
      payload.find({ collection: 'daily-logs', overrideAccess: false }),
    ).rejects.toThrow()
  })
})
