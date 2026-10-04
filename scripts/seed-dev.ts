// Development seed for the LOCAL database only (npm run db:local).
//   npx tsx scripts/seed-dev.ts          -> dev login account
//   npx tsx scripts/seed-dev.ts --demo   -> plus sample logs, scores and ideas
// Never point this at Supabase: it refuses unless DATABASE_URL is local.
import 'dotenv/config'
import { getPayload } from 'payload'
import config from '../src/payload.config'
import { addDays, logicalDay, weekStart } from '../src/lib/day'

export const DEV_USER = {
  email: 'dev@personal-os.test',
  password: 'local-dev-only-2026',
}

const url = process.env.DATABASE_URL ?? ''
if (!/@(127\.0\.0\.1|localhost):/.test(url)) {
  console.error('Refusing to seed: DATABASE_URL is not a local database.')
  process.exit(1)
}

const payload = await getPayload({ config: await config })

const existing = await payload.find({ collection: 'users', where: { email: { equals: DEV_USER.email } } })
if (!existing.docs.length) {
  await payload.create({ collection: 'users', data: DEV_USER })
  console.log(`Created dev user ${DEV_USER.email}`)
}

if (process.argv.includes('--demo')) {
  const today = logicalDay()
  const monday = weekStart(today)
  const days = [0, 1, 2, 3, 4, 5, 6].map((i) => addDays(monday, i)).filter((d) => d < today)
  const minutes = [60, 45, 60, 30, 75, 90]
  for (const [i, date] of days.entries()) {
    const found = await payload.find({ collection: 'daily-logs', where: { date: { equals: date } } })
    if (found.docs.length) continue
    await payload.create({
      collection: 'daily-logs',
      data: {
        date,
        morningListening: i % 3 !== 2,
        gym: i % 2 === 0,
        toeflMinutes: minutes[i % minutes.length],
        toeflSkills: [i % 2 ? 'writing' : 'speaking'],
        energy: 3 + (i % 3 === 0 ? 1 : 0),
        tomorrowTop1: i === days.length - 1 ? '做完 ETS 官方模擬考並記下分數' : '',
      },
    })
  }

  const scores = await payload.count({ collection: 'toefl-scores' })
  if (!scores.totalDocs) {
    const settings = await payload.findGlobal({ slug: 'settings' })
    const start = settings.planStart || '2026-10-05'
    const sample = [
      // Full mocks: overall is computed from the four sections.
      { date: addDays(start, -1), type: 'full' as const, source: 'ets' as const, reading: 4, listening: 4, speaking: 3, writing: 3 },
      { date: addDays(start, 26), type: 'full' as const, source: 'ets' as const, reading: 4.5, listening: 4.5, speaking: 3.5, writing: 3.5 },
      // Single-section practice.
      { date: addDays(start, 12), type: 'section' as const, source: 'ai' as const, speaking: 3.5 },
      { date: addDays(start, 19), type: 'mini' as const, source: 'ai' as const, writing: 3.5 },
    ]
    for (const s of sample) {
      await payload.create({ collection: 'toefl-scores', data: { ...s, notes: 'demo' } })
    }
  }

  const ideas = await payload.count({ collection: 'ideas' })
  if (!ideas.totalDocs) {
    const sample = [
      { title: '剪片：做一支 AI 學習分享影片', why: '想把學到的東西整理出來', scoreGoal: 1, scoreUrgency: 0, scorePassion: 3 },
      { title: 'LangGraph 做多步驟 agent', why: '工作上的 GIS 查詢流程可能用得到', scoreGoal: 3, scoreUrgency: 2, scorePassion: 2 },
      { title: 'Personal OS v2：週回顧頁', why: '下個里程碑', scoreGoal: 2, scoreUrgency: 2, scorePassion: 3, status: 'selected' as const },
    ]
    for (const idea of sample) await payload.create({ collection: 'ideas', data: { status: 'inbox', ...idea } })
  }
  console.log('Demo data ready')
}

process.exit(0)
