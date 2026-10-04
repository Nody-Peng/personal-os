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
        morningPlan: '07:20 聽英文 podcast',
        noonPlan: '12:30 通話、Anki 15 分鐘',
        eveningPlan: i % 2 === 0 ? '健身 → 22:00 托福口說' : '22:00 托福寫作',
        note: [{ type: 'paragraph', content: '示範筆記：今天口說卡在第二題，明天先練回答架構。' }],
      },
    })
  }

  const tasks = await payload.count({ collection: 'tasks' })
  if (!tasks.totalDocs) {
    const important = (day: string, title: string, position: number, extra: Record<string, unknown> = {}) =>
      payload.create({ collection: 'tasks', data: { kind: 'important', day, title, position, status: 'todo', ...extra } })
    for (const [i, date] of days.entries()) {
      await important(date, i % 2 ? '寫作練習一篇 Email' : '口說 Interview 三題', 0, { status: 'done' })
      if (i % 3 === 0) await important(date, '整理錯誤紀錄', 1, { status: i === 0 ? 'done' : 'todo' })
    }
    await important(today, '做完 ETS 官方模擬考並記下分數', 0, {
      body: [
        { type: 'heading', content: '模擬考流程' },
        { type: 'checkListItem', content: '閱讀、聽力一次考完' },
        { type: 'checkListItem', content: '口說錄音給 AI 打分' },
      ],
    })
    await important(today, '報名托福考試', 1, { dueDate: addDays(today, 3) })
    await important(addDays(today, 1), '口說 Listen and Repeat 7 句', 0)
    await payload.create({
      collection: 'tasks',
      data: {
        kind: 'important',
        day: addDays(today, 2),
        title: '托福口說衝刺週',
        position: 0,
        status: 'todo',
        startDate: addDays(today, 2),
        endDate: addDays(today, 8),
      },
    })
    const weekly = ['建立 Supabase 備份', '關閉 Supabase Data API', '週日統整：選下週主題']
    for (const [position, title] of weekly.entries()) {
      await payload.create({
        collection: 'tasks',
        data: { kind: 'weekly', weekStart: monday, title, position, status: position === 1 ? 'done' : 'todo', dueDate: position === 2 ? addDays(monday, 6) : undefined },
      })
    }
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
