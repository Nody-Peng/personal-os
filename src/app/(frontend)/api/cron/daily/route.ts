import config from '@payload-config'
import { getPayload } from 'payload'
import { runDailyJobs } from '@/lib/dailyJobs'

// Called once a day by Vercel Cron (vercel.json). Vercel sends the project's
// CRON_SECRET as a bearer token; without that variable nobody can run it.
export const dynamic = 'force-dynamic'
export const maxDuration = 60

export async function GET(request: Request) {
  const secret = process.env.CRON_SECRET
  if (!secret || request.headers.get('authorization') !== `Bearer ${secret}`) {
    return Response.json({ ok: false, error: 'unauthorized' }, { status: 401 })
  }
  const payload = await getPayload({ config })
  const report = await runDailyJobs(payload)
  payload.logger.info({ msg: 'daily jobs', ...report })
  return Response.json({ ok: true, ...report })
}
