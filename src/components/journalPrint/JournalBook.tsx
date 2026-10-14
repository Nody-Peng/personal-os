import type { CSSProperties, ReactNode } from 'react'
import { daysInMonth, formatWeekRange, isoWeek, weekdayLabel, addDays, weekStart } from '@/lib/day'
import type { HabitItem } from '@/lib/habits'
import type { BookDay, BookWeek, JournalBookData } from '@/lib/journalBook'
import { formatMinutes, percent, periodStats } from '@/lib/journalStats'
import { TOEFL_SKILLS, labelOf } from '@/lib/options'
import { BarChart, DayGrid, LineChart, ShareBars } from './BookCharts'
import { Blocks, CheckBox, type BlockContext } from './BookBlocks'
import { coverHex, sizeOf } from './bookCss'

// The printed journal, as one long document that Paged.js cuts into pages:
//   cover · title page · contents
//   each month: opener (calendar, numbers) · habits and energy · its days,
//               a week page after each Sunday · the month's review
//   summary · back cover
// Pages are named (`page:` in bookCss) for their margins and running heads.

const CN_MONTHS = ['一月', '二月', '三月', '四月', '五月', '六月', '七月', '八月', '九月', '十月', '十一月', '十二月']
const EN_MONTHS = ['January', 'February', 'March', 'April', 'May', 'June', 'July', 'August', 'September', 'October', 'November', 'December']
const WEEKDAYS = ['一', '二', '三', '四', '五', '六', '日']

const monthNo = (month: string) => Number(month.slice(5)) - 1
const dotted = (day: string) => day.replaceAll('-', '.')
const dayNo = (day: string) => Number(day.slice(8))

/** Something to print besides the date: a recorded day, its IMPORTANT items, 早/午/晚 lists or a note. */
const hasContent = (d: BookDay) => d.recorded || d.tasks.length > 0 || d.parts.length > 0 || d.note != null

type Shared = { ctx: BlockContext; habits: HabitItem[]; width: number; dayOf: Map<string, BookDay> }

export function JournalBook({ data }: { data: JournalBookData }) {
  const { options, cover, days, weeks, months, habits } = data
  const size = sizeOf(options)
  const shared: Shared = {
    ctx: { pageTitles: data.pageTitles },
    habits,
    width: size.width - size.inner - size.outer,
    dayOf: new Map(days.map((d) => [d.day, d])),
  }
  // A week's page follows its last day in the book (its Sunday, or the last day printed).
  const weekAfter = new Map<string, BookWeek>()
  if (options.weekPages) for (const w of weeks) weekAfter.set(addDays(w.monday, 6) < options.to ? addDays(w.monday, 6) : options.to, w)
  const stats = periodStats(days)
  // The year (or years) is printed large on the cover; the title doesn't repeat it.
  const title =
    cover.years
      .split('–')
      .reduce((t, y) => t.replace(y, ''), cover.title)
      .trim() || '日記本'

  return (
    <div className="bk">
      <Cover cover={cover} title={title} from={options.from} to={options.to} />

      <section className="bk-front bk-title-page">
        <p className="title">{cover.title}</p>
        {cover.subtitle && <p className="subtitle">{cover.subtitle}</p>}
        <div className="owner">
          <p>這本日記屬於</p>
          <div className="write" />
        </div>
        <p className="facts">
          {dotted(options.from)} — {dotted(options.to)}
          <br />
          {stats.days} 天 · 記錄了 {stats.recorded} 天
        </p>
      </section>

      <section className="bk-front" id="contents">
        <h2 className="bk-heading">
          目錄<span className="latin">Contents</span>
        </h2>
        <div className="bk-toc">
          {months.map(({ month }) => {
            const inMonth = [...weekAfter.entries()].filter(([day]) => day.startsWith(month)).map(([, w]) => w)
            return (
              <div key={month} className="month-row">
                <p className="row">
                  <a className="name" href={`#m-${month}`}>
                    {months.length > 12 || month.slice(0, 4) !== options.from.slice(0, 4) ? `${month.slice(0, 4)} ` : ''}
                    {CN_MONTHS[monthNo(month)]}
                    <span className="latin">{EN_MONTHS[monthNo(month)]}</span>
                  </a>
                  <span className="leader" />
                  <a className="page" href={`#m-${month}`} />
                </p>
                {inMonth.length > 0 && (
                  <p className="weeks">
                    {inMonth.map((w) => (
                      <a key={w.monday} href={`#w-${w.monday}`}>
                        第{isoWeek(w.monday)}週
                      </a>
                    ))}
                  </p>
                )}
              </div>
            )
          })}
          <div className="month-row">
            <p className="row">
              <a className="name" href="#summary">
                這段日子<span className="latin">Summary</span>
              </a>
              <span className="leader" />
              <a className="page" href="#summary" />
            </p>
          </div>
        </div>
      </section>

      {months.map(({ month, review }) => {
        const monthDays = days.filter((d) => d.day.startsWith(month))
        return (
          <div key={month}>
            <MonthOpener month={month} monthDays={monthDays} shared={shared} />
            <MonthCharts month={month} monthDays={monthDays} shared={shared} />
            {monthDays.map((d) => {
              const week = weekAfter.get(d.day)
              return (
                <div key={d.day}>
                  {(options.blankDays || hasContent(d)) && <DayPage d={d} shared={shared} />}
                  {week && <WeekPage week={week} shared={shared} />}
                </div>
              )
            })}
            <section className="bk-monthend">
              <h2 className="bk-heading">
                {CN_MONTHS[monthNo(month)]}回顧
                <span className="latin">{EN_MONTHS[monthNo(month)]}</span>
              </h2>
              {review ? (
                <div className="bk-note">
                  <Blocks blocks={review} ctx={shared.ctx} />
                </div>
              ) : (
                <Prompts items={['這個月最開心的事', '學到了什麼', '下個月想要…']} />
              )}
            </section>
          </div>
        )
      })}

      <Summary data={data} shared={shared} />
      <Cover cover={cover} title={title} from={options.from} to={options.to} back />
    </div>
  )
}

function Cover({ cover, title, from, to, back = false }: { cover: JournalBookData['cover']; title: string; from: string; to: string; back?: boolean }) {
  return (
    <section className={`bk-cover cover-cloth${back ? ' back' : ''}`} data-pattern={cover.pattern} style={{ '--cover': coverHex(cover.coverColor) } as CSSProperties}>
      <div className="spine" />
      <div className="crease" />
      <div className="foil">
        {back ? (
          <span className="brand">PERSONAL OS</span>
        ) : (
          <>
            <span className="brand">PERSONAL OS</span>
            <div>
              <div className="year">{cover.years}</div>
              <div className="rule" />
              <div className="title">{title}</div>
              {cover.subtitle && <div className="subtitle">{cover.subtitle}</div>}
            </div>
            <span className="range">
              {dotted(from)} — {dotted(to)}
            </span>
          </>
        )}
      </div>
    </section>
  )
}

function Prompts({ items, short = false }: { items: string[]; short?: boolean }) {
  return (
    <>
      {items.map((p) => (
        <div key={p} className={short ? 'short' : undefined}>
          <p className="prompt">{p}</p>
          <div className="write" />
        </div>
      ))}
    </>
  )
}

/** A chart with its heading, kept on one page. */
function Fig({ title, children }: { title: string; children: ReactNode }) {
  return (
    <div className="fig">
      <p className="label">{title}</p>
      {children}
    </div>
  )
}

function MonthOpener({ month, monthDays, shared }: { month: string; monthDays: BookDay[]; shared: Shared }) {
  const s = periodStats(monthDays)
  const first = `${month}-01`
  const lead = (new Date(`${first}T00:00:00Z`).getUTCDay() + 6) % 7
  const all = Array.from({ length: daysInMonth(month) }, (_, i) => addDays(first, i))
  return (
    <section className="bk-month" id={`m-${month}`}>
      <span className="run-month">
        {month.slice(0, 4)} · {CN_MONTHS[monthNo(month)]}
      </span>
      <p className="year">{month.slice(0, 4)}</p>
      <h2 className="month-name">{CN_MONTHS[monthNo(month)]}</h2>
      <p className="latin-name">{EN_MONTHS[monthNo(month)]}</p>
      <div className="rule" />
      <div className="cal">
        {WEEKDAYS.map((w) => (
          <span key={w} className="wd">
            {w}
          </span>
        ))}
        {Array.from({ length: lead }, (_, i) => (
          <span key={`lead-${i}`} />
        ))}
        {all.map((day) => {
          const d = shared.dayOf.get(day)
          const cls = !d ? 'out' : d.recorded ? (d.tasksTotal > 0 && d.tasksDone === d.tasksTotal ? 'rec all' : 'rec') : ''
          return (
            <span key={day} className={`d ${cls}`}>
              {dayNo(day)}
            </span>
          )
        })}
      </div>
      <p className="facts-line">圈起來的是有紀錄的日子，塗滿的是 Important 全部完成</p>
      <div className="tiles four">
        <Tile k="記錄" v={String(s.recorded)} unit={`/ ${s.days} 天`} />
        <Tile k="Important" v={s.importantTotal ? `${percent(s.importantDone, s.importantTotal)}%` : '—'} unit={s.importantTotal ? `${s.importantDone}/${s.importantTotal}` : ''} />
        <Tile k="托福" v={s.toeflMinutes ? formatMinutes(s.toeflMinutes).split(' ')[0] : '—'} unit={s.toeflMinutes ? formatMinutes(s.toeflMinutes).split(' ')[1] : ''} />
        <Tile k="平均精力" v={s.energyAvg != null ? s.energyAvg.toFixed(1) : '—'} unit={s.energyAvg != null ? '/ 5' : ''} />
      </div>
      <p className="facts-line">
        {[
          s.longestStreak > 1 ? `最長連續記錄 ${s.longestStreak} 天` : '',
          s.words ? `寫下 ${s.words.toLocaleString('zh-TW')} 字` : '',
          s.photos ? `${s.photos} 張照片` : '',
          s.themeMinutes ? `主題時間 ${formatMinutes(s.themeMinutes)}` : '',
        ]
          .filter(Boolean)
          .join(' · ')}
      </p>
    </section>
  )
}

function Tile({ k, v, unit }: { k: string; v: string; unit?: string }) {
  return (
    <div className="tile">
      <p className="k">{k}</p>
      <p className="v num">
        {v}
        {unit && <small>{unit}</small>}
      </p>
    </div>
  )
}

function MonthCharts({ month, monthDays, shared }: { month: string; monthDays: BookDay[]; shared: Shared }) {
  const first = `${month}-01`
  const all = Array.from({ length: daysInMonth(month) }, (_, i) => addDays(first, i))
  const anyToefl = monthDays.some((d) => d.toeflMinutes > 0)
  const nameWidth = shared.width > 140 ? 30 : 20
  return (
    <section className="bk-month">
      <Fig title="習慣追蹤">
        {shared.habits.length ? (
          <table className="tracker">
            <colgroup>
              <col style={{ width: `${nameWidth}mm` }} />
              {all.map((day) => (
                <col key={day} />
              ))}
              <col style={{ width: '7mm' }} />
            </colgroup>
            <thead>
              <tr>
                <th />
                {all.map((day) => (
                  <th key={day}>{dayNo(day)}</th>
                ))}
                <th />
              </tr>
            </thead>
            <tbody>
              {shared.habits.map((h) => (
                <tr key={h.id}>
                  <td className="name">{h.name}</td>
                  {all.map((day) => {
                    const d = shared.dayOf.get(day)
                    return (
                      <td key={day}>
                        <span className={`c${!d ? ' out' : d.habits.includes(h.id) ? ' on' : ''}`} />
                      </td>
                    )
                  })}
                  <td className="total num">{monthDays.filter((d) => d.habits.includes(h.id)).length}</td>
                </tr>
              ))}
            </tbody>
          </table>
        ) : (
          <p className="faint">還沒有設定習慣。</p>
        )}
      </Fig>

      <Fig title="精力曲線">
        <LineChart
          width={shared.width}
          empty="這個月還沒有精力紀錄"
          points={all.map((day) => ({
            label: [1, 8, 15, 22, 29].includes(dayNo(day)) ? String(dayNo(day)) : undefined,
            value: shared.dayOf.get(day)?.energy ?? null,
          }))}
        />
      </Fig>

      {anyToefl && (
        <Fig title="托福（分鐘）">
          <BarChart
            width={shared.width}
            values={false}
            empty=""
            items={all.map((day) => ({
              label: [1, 8, 15, 22, 29].includes(dayNo(day)) ? String(dayNo(day)) : '',
              value: shared.dayOf.get(day)?.toeflMinutes ?? 0,
            }))}
          />
        </Fig>
      )}
    </section>
  )
}

function DayPage({ d, shared }: { d: BookDay; shared: Shared }) {
  const blank = !hasContent(d)
  const skills = d.toeflSkills.map((s) => labelOf(TOEFL_SKILLS, s)).filter(Boolean)
  return (
    <section className="bk-day" id={`d-${d.day}`}>
      <div className="head">
        <span className="date num">{dayNo(d.day)}</span>
        <span className="md">
          {Number(d.day.slice(5, 7))}月<span className="wd">{weekdayLabel(d.day)}</span>
        </span>
        <span className="energy">
          <span className="k">精力</span>
          {[1, 2, 3, 4, 5].map((n) => (
            <span key={n} className={`dot${d.energy != null && n <= d.energy ? ' on' : ''}`} />
          ))}
        </span>
      </div>

      {shared.habits.length > 0 && (
        <p className="row habits">
          <span className="k">習慣</span>
          {shared.habits.map((h) => (
            <span key={h.id} className="h">
              <CheckBox done={d.habits.includes(h.id)} />
              {h.name}
            </span>
          ))}
        </p>
      )}

      <p className="row">
        <span className="k">IMPORTANT</span>
        {d.tasksTotal > 0 && (
          <span className="soft">
            {d.tasksDone}/{d.tasksTotal}
          </span>
        )}
      </p>
      {d.tasks.map((t) => (
        <div key={t.id}>
          <p className="row">
            <CheckBox done={t.status === 'done'} moved={t.status === 'migrated'} />
            <span className={t.status === 'migrated' ? 'moved-text' : undefined}>{t.title}</span>
            {t.status === 'migrated' && <span className="faint"> → 移到隔天</span>}
          </p>
          {t.body && (
            <div className="task-body">
              <Blocks blocks={t.body} ctx={shared.ctx} />
            </div>
          )}
        </div>
      ))}
      {/* Room for three, the most a day holds, on an empty page. */}
      {blank &&
        [0, 1, 2].map((i) => (
          <p key={i} className="row">
            <CheckBox done={false} />
          </p>
        ))}

      {d.parts.map((p) => (
        <p key={p.label} className="row part">
          <span className="k">{p.label}</span>
          <span className="items">
            {p.items.map((item) => (
              <span key={item.id} className="item">
                <CheckBox done={item.done} />
                {item.text}
              </span>
            ))}
          </span>
        </p>
      ))}

      {(d.toeflMinutes > 0 || skills.length > 0 || d.themeMinutes > 0) && (
        <p className="row">
          {(d.toeflMinutes > 0 || skills.length > 0) && (
            <>
              <span className="k">托福</span>
              {d.toeflMinutes > 0 && `${d.toeflMinutes} 分鐘`}
              {skills.length > 0 && <span className="soft"> · {skills.join('、')}</span>}
              {d.themeMinutes > 0 && '　'}
            </>
          )}
          {d.themeMinutes > 0 && (
            <>
              <span className="k">主題</span>
              {d.themeMinutes} 分鐘
            </>
          )}
        </p>
      )}

      {d.note && (
        <div className="bk-note">
          <Blocks blocks={d.note} ctx={shared.ctx} />
        </div>
      )}
    </section>
  )
}

function WeekPage({ week, shared }: { week: BookWeek; shared: Shared }) {
  const no = isoWeek(week.monday)
  const dates = Array.from({ length: 7 }, (_, i) => addDays(week.monday, i))
  const weekDays = dates.map((day) => shared.dayOf.get(day))
  return (
    <section className="bk-week" id={`w-${week.monday}`}>
      <div className="head">
        <span className="wk">Week {no}</span>
        <span className="range">
          第 {no} 週 · {formatWeekRange(week.monday)}
        </span>
      </div>

      {week.theme && (
        <div className="theme">
          <p>
            <span className="label">本週主題　</span>
            {week.theme}
          </p>
          {week.themeReason && <p className="reason">{week.themeReason}</p>}
        </div>
      )}

      {week.todos.length > 0 && (
        <>
          <p className="label">本週待辦</p>
          {week.todos.map((t) => (
            <p key={t.id}>
              <CheckBox done={t.status === 'done'} />
              {t.title}
            </p>
          ))}
        </>
      )}

      {shared.habits.length > 0 && (
        <Fig title="習慣">
          <table className="tracker">
            <colgroup>
              <col style={{ width: '40%' }} />
              {dates.map((day) => (
                <col key={day} />
              ))}
              <col style={{ width: '12mm' }} />
            </colgroup>
            <thead>
              <tr>
                <th />
                {WEEKDAYS.map((w) => (
                  <th key={w}>{w}</th>
                ))}
                <th />
              </tr>
            </thead>
            <tbody>
              {shared.habits.map((h) => {
                const ticks = weekDays.filter((d) => d?.habits.includes(h.id)).length
                return (
                  <tr key={h.id} className="week-row">
                    <td className="name">{h.name}</td>
                    {weekDays.map((d, i) => (
                      <td key={dates[i]}>
                        <span className={`c${!d ? ' out' : d.habits.includes(h.id) ? ' on' : ''}`} />
                      </td>
                    ))}
                    <td className="total num">
                      {ticks}/{h.weeklyTarget}
                    </td>
                  </tr>
                )
              })}
            </tbody>
          </table>
        </Fig>
      )}

      <Fig title="精力">
        <LineChart width={shared.width} height={24} empty="這週還沒有精力紀錄" points={weekDays.map((d, i) => ({ label: WEEKDAYS[i], value: d?.energy ?? null }))} />
      </Fig>

      {week.review ? (
        <div className="bk-note">
          <p className="label">回顧</p>
          <Blocks blocks={week.review} ctx={shared.ctx} />
        </div>
      ) : (
        <Prompts items={['這週做得好的事', '可以更好的地方', '下週想試試']} short />
      )}
    </section>
  )
}

function Summary({ data, shared }: { data: JournalBookData; shared: Shared }) {
  const { days, months, options } = data
  const s = periodStats(days)
  const byMonth = months.map(({ month }) => ({
    month,
    stats: periodStats(days.filter((d) => d.day.startsWith(month))),
  }))
  const short = (month: string) => `${Number(month.slice(5))}月`
  // The day grid starts on a Monday and ends on a Sunday.
  const gridStart = weekStart(options.from)
  const gridEnd = addDays(weekStart(options.to), 6)
  const grid: Parameters<typeof DayGrid>[0]['days'] = []
  for (let day = gridStart, i = 0; day <= gridEnd; day = addDays(day, 1), i++) {
    const d = shared.dayOf.get(day)
    // Label a week column with its month when the month starts in it.
    const monday = i % 7 === 0
    const monthStart = monday && Array.from({ length: 7 }, (_, k) => addDays(day, k)).find((x) => x.endsWith('-01') && shared.dayOf.has(x))
    grid.push({
      day,
      recorded: d?.recorded ?? false,
      energy: d?.energy ?? null,
      inRange: Boolean(d),
      monthLabel: monthStart ? short(monthStart.slice(0, 7)) : monday && day <= options.from && addDays(day, 6) >= options.from ? short(options.from.slice(0, 7)) : undefined,
    })
  }
  const weeksInRange = s.days / 7
  return (
    <section className="bk-summary" id="summary">
      <h2 className="bk-heading">
        這段日子<span className="latin">Summary</span>
      </h2>
      <p className="soft">
        {dotted(options.from)} — {dotted(options.to)} · {s.days} 天
      </p>
      <div className="tiles four">
        <Tile k="記錄天數" v={String(s.recorded)} unit={`/ ${s.days} 天`} />
        <Tile k="最長連續" v={String(s.longestStreak)} unit="天" />
        <Tile
          k="Important 完成"
          v={s.importantTotal ? `${percent(s.importantDone, s.importantTotal)}%` : '—'}
          unit={s.importantTotal ? `${s.importantDone}/${s.importantTotal}` : ''}
        />
        <Tile k="平均精力" v={s.energyAvg != null ? s.energyAvg.toFixed(1) : '—'} unit={s.energyAvg != null ? '/ 5' : ''} />
        <Tile k="托福" v={s.toeflMinutes ? formatMinutes(s.toeflMinutes).split(' ')[0] : '—'} unit={s.toeflMinutes ? formatMinutes(s.toeflMinutes).split(' ')[1] : ''} />
        <Tile k="主題時間" v={s.themeMinutes ? formatMinutes(s.themeMinutes).split(' ')[0] : '—'} unit={s.themeMinutes ? formatMinutes(s.themeMinutes).split(' ')[1] : ''} />
        <Tile k="寫下" v={s.words.toLocaleString('zh-TW')} unit="字" />
        <Tile k="照片" v={String(s.photos)} unit="張" />
      </div>

      <Fig title="每一天">
        <DayGrid days={grid} width={shared.width} />
      </Fig>

      <Fig title="每月記錄天數">
        <BarChart width={shared.width} empty="還沒有紀錄" items={byMonth.map((m) => ({ label: short(m.month), value: m.stats.recorded }))} />
      </Fig>

      {shared.habits.length > 0 && (
        <Fig title="習慣達成率（對照每週目標）">
          <ShareBars
            width={shared.width}
            items={shared.habits.map((h) => {
              const ticks = s.habitTicks[h.id] ?? 0
              return {
                label: h.name,
                share: ticks / Math.max(1, weeksInRange * h.weeklyTarget),
                note: `${ticks} 次`,
              }
            })}
          />
        </Fig>
      )}

      <Fig title="每月平均精力">
        <LineChart width={shared.width} empty="還沒有精力紀錄" points={byMonth.map((m) => ({ label: short(m.month), value: m.stats.energyAvg }))} />
      </Fig>

      {s.toeflMinutes > 0 && (
        <Fig title="每月托福（小時）">
          <BarChart
            width={shared.width}
            empty=""
            format={(v) => String(Math.round(v * 10) / 10)}
            items={byMonth.map((m) => ({
              label: short(m.month),
              value: m.stats.toeflMinutes / 60,
            }))}
          />
        </Fig>
      )}

      <div className="letter">
        <h2 className="bk-heading">
          寫給這段日子的自己<span className="latin">Dear me</span>
        </h2>
        <div className="write" />
      </div>
    </section>
  )
}
