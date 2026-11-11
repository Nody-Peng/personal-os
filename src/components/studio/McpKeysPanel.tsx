'use client'

import { ArrowCounterClockwise, Check, Copy, Key, Plus, Trash, X } from '@phosphor-icons/react'
import Link from 'next/link'
import { useRouter } from 'next/navigation'
import { useState, useTransition } from 'react'
import { createMcpKey, deleteMcpKey, revokeMcpKey, setMcpKeyLevel, undoMcpActivity } from '@/app/(frontend)/studio-actions'
import { MCP_KEY_LEVELS, type McpKeyLevel } from '@/lib/options'

export type KeyRow = {
  id: number
  name: string
  prefix: string
  level: McpKeyLevel
  state: 'active' | 'revoked' | 'expired'
  created: string
  lastUsed: string | null
  expires: string | null
  revoked: string | null
}

export type ActivityRow = {
  id: number
  when: string
  keyName: string
  tool: string
  summary: string
  href: string | null
  pageTitle: string | null
  /** What 還原 does here: version = put the page back as it was, untrash, trash = take back a new page. */
  undo: 'version' | 'untrash' | 'trash' | null
  undone: string | null
}

const LIFETIMES = [
  { value: null, label: '不過期' },
  { value: 30, label: '30 天' },
  { value: 90, label: '90 天' },
  { value: 365, label: '1 年' },
] as const

const STATE_TAG: Record<KeyRow['state'], { label: string; className: string }> = {
  active: { label: '使用中', className: 'bg-green-soft text-green-ink' },
  expired: { label: '已過期', className: 'bg-yellow-soft text-yellow-ink' },
  revoked: { label: '已撤銷', className: 'bg-sunken text-muted' },
}

const UNDO_LABEL = { version: '還原到這次之前', untrash: '從垃圾桶救回', trash: '撤銷新增' } as const
const UNDO_CONFIRM = {
  version: '把這一頁換回這次改動之前的內容？之後的修改也會被換掉（現在的內容會留在版本紀錄）。',
  untrash: '把這一頁從垃圾桶救回？',
  trash: '把這次新增的頁面移到垃圾桶？',
} as const

const levelOf = (value: McpKeyLevel) => MCP_KEY_LEVELS.find((l) => l.value === value) ?? MCP_KEY_LEVELS[1]

function CopyButton({ text, label }: { text: string; label: string }) {
  const [copied, setCopied] = useState(false)
  return (
    <button
      type="button"
      className="btn btn-quiet min-h-10 shrink-0"
      onClick={() => {
        void navigator.clipboard?.writeText(text).then(() => {
          setCopied(true)
          setTimeout(() => setCopied(false), 1500)
        })
      }}
    >
      {copied ? <Check size={16} weight="bold" /> : <Copy size={16} />}
      {copied ? '已複製' : label}
    </button>
  )
}

/** A value to copy: monospace, wrapping anywhere so long keys never widen the page. */
function CopyLine({ label, value, copyLabel = '複製' }: { label: string; value: string; copyLabel?: string }) {
  return (
    <div className="grid gap-1.5">
      <p className="label">{label}</p>
      <div className="flex items-start gap-2">
        <code className="min-w-0 flex-1 rounded-lg border border-line bg-sunken px-3 py-2.5 font-mono text-sm break-all text-ink-strong">{value}</code>
        <CopyButton text={value} label={copyLabel} />
      </div>
    </div>
  )
}

export function McpKeysPanel({ initial, activity, endpoint, envToken }: { initial: KeyRow[]; activity: ActivityRow[]; endpoint: string; envToken: boolean }) {
  const [keys, setKeys] = useState(initial)
  const [name, setName] = useState('')
  const [lifetime, setLifetime] = useState<number | null>(null)
  const [level, setLevel] = useState<McpKeyLevel>('add')
  const [fresh, setFresh] = useState<{ name: string; key: string } | null>(null)
  const [error, setError] = useState<string | null>(null)
  const [notice, setNotice] = useState<string | null>(null)
  const [pending, startTransition] = useTransition()
  const router = useRouter()

  // Take fresh server data after a revalidation without an effect.
  const [lastInitial, setLastInitial] = useState(initial)
  if (initial !== lastInitial) {
    setLastInitial(initial)
    setKeys(initial)
  }

  const create = (e: React.FormEvent) => {
    e.preventDefault()
    const keyName = name.trim()
    if (!keyName) return
    startTransition(async () => {
      const result = await createMcpKey(keyName, lifetime, level)
      setError(result.ok ? null : result.error)
      if (result.ok && result.data) {
        setFresh({ name: keyName, key: result.data.key })
        setName('')
        router.refresh()
      }
    })
  }

  const act = (run: () => Promise<{ ok: boolean; error?: string; data?: unknown }>) =>
    startTransition(async () => {
      const result = await run()
      setError(result.ok ? null : (result.error ?? '發生錯誤，請再試一次'))
      setNotice(result.ok && typeof result.data === 'string' ? result.data : null)
      router.refresh()
    })

  const changeLevel = (id: number, value: McpKeyLevel) => {
    setKeys((prev) => prev.map((k) => (k.id === id ? { ...k, level: value } : k)))
    act(() => setMcpKeyLevel(id, value))
  }

  const active = keys.filter((k) => k.state === 'active').length

  return (
    <div className="grid gap-4">
      <section className="card rise grid gap-4 p-5 md:p-6" style={{ '--i': 1 } as React.CSSProperties}>
        <h2 className="text-lg font-semibold text-ink-strong">連線資訊</h2>
        <CopyLine label="MCP 端點（Streamable HTTP）" value={endpoint} />
        <p className="text-sm text-muted">
          請求要帶 <code className="font-mono whitespace-nowrap text-ink">Authorization: Bearer &lt;金鑰&gt;</code>。
          {envToken
            ? 'Vercel 上的 MCP_TOKEN 也還能用，權限是「完整」（目前的晨報排程用這把）；要停用就到 Vercel 刪掉那個環境變數。'
            : 'Vercel 上沒有設定 MCP_TOKEN，只有這裡發的金鑰能連線。'}
        </p>
      </section>

      <form onSubmit={create} className="card rise grid gap-3 p-5 md:p-6" style={{ '--i': 2 } as React.CSSProperties}>
        <div className="grid gap-3 md:grid-cols-[1fr_auto_auto_auto] md:items-end">
          <div className="flex flex-col gap-2">
            <label htmlFor="key-name" className="label">
              新金鑰的名稱（用在哪裡）
            </label>
            <input
              id="key-name"
              className="field"
              value={name}
              maxLength={60}
              placeholder="例如：每日晨報排程"
              onChange={(e) => setName(e.target.value)}
              autoComplete="off"
            />
          </div>
          <div className="flex flex-col gap-2">
            <label htmlFor="key-level" className="label">
              權限
            </label>
            <select id="key-level" className="field h-[46px]" value={level} onChange={(e) => setLevel(e.target.value as McpKeyLevel)}>
              {MCP_KEY_LEVELS.map((l) => (
                <option key={l.value} value={l.value}>
                  {l.label}
                </option>
              ))}
            </select>
          </div>
          <div className="flex flex-col gap-2">
            <label htmlFor="key-lifetime" className="label">
              期限
            </label>
            <select
              id="key-lifetime"
              className="field h-[46px]"
              value={lifetime ?? ''}
              onChange={(e) => setLifetime(e.target.value ? Number(e.target.value) : null)}
            >
              {LIFETIMES.map((l) => (
                <option key={l.label} value={l.value ?? ''}>
                  {l.label}
                </option>
              ))}
            </select>
          </div>
          <button type="submit" className="btn btn-primary h-[46px]" disabled={pending || !name.trim()}>
            <Plus size={16} weight="bold" />
            產生金鑰
          </button>
        </div>
        <p className="text-sm text-muted">
          <span className="font-medium text-ink">{levelOf(level).label}：</span>
          {levelOf(level).hint}
        </p>
      </form>

      {error && (
        <p role="alert" className="text-sm text-red-ink">
          {error}
        </p>
      )}
      {notice && (
        <p role="status" className="text-sm text-green-ink">
          {notice}
        </p>
      )}

      {fresh && (
        <section className="card pop-in grid gap-4 border-accent p-5 md:p-6" aria-live="polite">
          <div className="flex items-start justify-between gap-3">
            <div>
              <h2 className="text-lg font-semibold text-ink-strong">「{fresh.name}」的金鑰</h2>
              <p className="mt-1 text-sm text-red-ink">只會顯示這一次。現在複製保存；關掉這裡就再也看不到，忘了只能撤銷再發一把。</p>
            </div>
            <button type="button" aria-label="關閉" onClick={() => setFresh(null)} className="flex size-10 shrink-0 items-center justify-center rounded-md text-muted hover:bg-sunken">
              <X size={18} />
            </button>
          </div>
          <CopyLine label="金鑰" value={fresh.key} copyLabel="複製金鑰" />
          <CopyLine
            label="加進 Claude Code"
            value={`claude mcp add --transport http personal-os ${endpoint} --header "Authorization: Bearer ${fresh.key}"`}
          />
          <CopyLine label="雲端環境變數（給晨報排程）" value={`PERSONAL_OS_MCP_TOKEN=${fresh.key}`} />
        </section>
      )}

      <section className="card rise p-5 md:p-6" style={{ '--i': 3 } as React.CSSProperties}>
        <div className="flex items-baseline justify-between gap-3 border-b border-line pb-4">
          <h2 className="text-lg font-semibold text-ink-strong">金鑰</h2>
          <p className="text-sm tabular-nums text-muted">使用中 {active} 把</p>
        </div>
        {keys.length === 0 ? (
          <p className="py-8 text-center text-sm text-muted">還沒有金鑰。在上面取個名字，就能產生第一把。</p>
        ) : (
          <ul className="divide-y divide-line">
            {keys.map((k) => (
              <KeyItem
                key={k.id}
                item={k}
                busy={pending}
                onLevel={(value) => changeLevel(k.id, value)}
                onRevoke={() => act(() => revokeMcpKey(k.id))}
                onDelete={() => act(() => deleteMcpKey(k.id))}
              />
            ))}
          </ul>
        )}
      </section>

      <section className="card rise p-5 md:p-6" style={{ '--i': 4 } as React.CSSProperties}>
        <div className="border-b border-line pb-4">
          <h2 className="text-lg font-semibold text-ink-strong">最近動作</h2>
          <p className="mt-1 text-sm text-muted">Claude 透過 MCP 做的每一個改動。改內容之前都會先存一個版本，所以可以退回去；保留 90 天。</p>
        </div>
        {activity.length === 0 ? (
          <p className="py-8 text-center text-sm text-muted">還沒有任何改動。</p>
        ) : (
          <ul className="divide-y divide-line">
            {activity.map((a) => (
              <ActivityItem key={a.id} item={a} busy={pending} onUndo={() => act(() => undoMcpActivity(a.id))} />
            ))}
          </ul>
        )}
      </section>
    </div>
  )
}

function KeyItem({
  item,
  busy,
  onLevel,
  onRevoke,
  onDelete,
}: {
  item: KeyRow
  busy: boolean
  onLevel: (level: McpKeyLevel) => void
  onRevoke: () => void
  onDelete: () => void
}) {
  const [confirming, setConfirming] = useState(false)
  const tag = STATE_TAG[item.state]
  const meta = [
    `建立 ${item.created}`,
    item.lastUsed ? `最後使用 ${item.lastUsed}` : '還沒用過',
    item.revoked ? `撤銷 ${item.revoked}` : item.expires ? `${item.state === 'expired' ? '到期' : '到期日'} ${item.expires}` : '不過期',
  ]

  return (
    <li className="grid gap-3 py-4 md:grid-cols-[1fr_auto] md:items-center md:gap-6">
      <div className="flex min-w-0 items-start gap-3">
        <span className="mt-0.5 flex size-9 shrink-0 items-center justify-center rounded-lg bg-sunken text-muted">
          <Key size={18} />
        </span>
        <div className="min-w-0">
          <p className="flex flex-wrap items-center gap-2 font-medium text-ink-strong">
            {item.name}
            <span className={`tag ${tag.className}`}>{tag.label}</span>
          </p>
          <p className="font-mono text-sm break-all text-muted">{item.prefix}…</p>
          <p className="text-xs text-muted">{meta.join(' · ')}</p>
        </div>
      </div>
      <div className="flex flex-wrap items-center gap-2">
        {item.state === 'active' ? (
          <>
            <label className="sr-only" htmlFor={`level-${item.id}`}>
              {item.name} 的權限
            </label>
            <select
              id={`level-${item.id}`}
              className="field h-10 w-auto py-0"
              value={item.level}
              disabled={busy}
              title={levelOf(item.level).hint}
              onChange={(e) => onLevel(e.target.value as McpKeyLevel)}
            >
              {MCP_KEY_LEVELS.map((l) => (
                <option key={l.value} value={l.value}>
                  {l.label}
                </option>
              ))}
            </select>
            {confirming ? (
              <>
                <span className="text-sm text-ink">撤銷後立刻失效？</span>
                <button type="button" className="btn btn-primary min-h-10" disabled={busy} onClick={onRevoke}>
                  撤銷
                </button>
                <button type="button" className="btn btn-quiet min-h-10" onClick={() => setConfirming(false)}>
                  取消
                </button>
              </>
            ) : (
              <button type="button" className="btn btn-quiet min-h-10" onClick={() => setConfirming(true)}>
                撤銷
              </button>
            )}
          </>
        ) : (
          <>
            <span className="text-sm text-muted">{levelOf(item.level).label}</span>
            <button type="button" className="btn btn-quiet min-h-10" disabled={busy} onClick={onDelete}>
              <Trash size={16} />
              刪除
            </button>
          </>
        )}
      </div>
    </li>
  )
}

function ActivityItem({ item, busy, onUndo }: { item: ActivityRow; busy: boolean; onUndo: () => void }) {
  const [confirming, setConfirming] = useState(false)
  return (
    <li className="grid gap-2 py-4 md:grid-cols-[1fr_auto] md:items-center md:gap-6">
      <div className="min-w-0">
        <p className="text-xs text-muted">
          {item.when} · {item.keyName}
        </p>
        <p className="mt-0.5 flex flex-wrap items-center gap-x-2 text-ink-strong">
          <span className="font-medium">{item.tool}</span>
          {item.href ? (
            <Link href={item.href} className="min-w-0 break-all text-accent hover:underline">
              {item.pageTitle}
            </Link>
          ) : (
            item.pageTitle && <span className="min-w-0 break-all text-muted">{item.pageTitle}</span>
          )}
          {item.undone && <span className="tag bg-sunken text-muted">已還原 {item.undone}</span>}
        </p>
        <p className="text-sm break-all text-muted">{item.summary}</p>
      </div>
      {item.undo &&
        (confirming ? (
          <div className="grid gap-2">
            <p className="text-sm text-ink md:max-w-64">{UNDO_CONFIRM[item.undo]}</p>
            <div className="flex gap-2">
              <button
                type="button"
                className="btn btn-primary min-h-10"
                disabled={busy}
                onClick={() => {
                  setConfirming(false)
                  onUndo()
                }}
              >
                確定
              </button>
              <button type="button" className="btn btn-quiet min-h-10" onClick={() => setConfirming(false)}>
                取消
              </button>
            </div>
          </div>
        ) : (
          <button type="button" className="btn btn-quiet min-h-10 justify-self-start" onClick={() => setConfirming(true)}>
            <ArrowCounterClockwise size={16} />
            {UNDO_LABEL[item.undo]}
          </button>
        ))}
    </li>
  )
}
