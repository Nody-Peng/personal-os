'use client'

// Under an empty note: 從範本開始 — the notebook pages marked as templates for
// this kind of note (a page's ••• → 用作範本). Picking one copies its content in.

import { FileText } from '@phosphor-icons/react'
import { useEffect, useState } from 'react'
import { getTemplateContent, listTemplates, type TemplateInfo } from '@/app/(frontend)/notebook-actions'
import { NoteIcon } from '@/components/notebooks/NoteIcon'
import type { TemplateKind } from '@/lib/options'
import { UNTITLED } from '@/lib/notes'
import { reportNoteError } from '@/lib/uploadMedia'

// One request per kind while the app is open (forgetTemplates after marking a page).
const lists = new Map<TemplateKind, Promise<TemplateInfo[]>>()
function templatesFor(kind: TemplateKind): Promise<TemplateInfo[]> {
  let list = lists.get(kind)
  if (!list) {
    list = listTemplates(kind).then((r) => (r.ok ? (r.data ?? []) : []))
    lists.set(kind, list)
  }
  return list
}

/** A page was marked or unmarked as a template: read the lists again. */
export function forgetTemplates() {
  lists.clear()
}

type Loose = { id?: string; type?: string; props?: Record<string, unknown>; children?: Loose[] }

/**
 * A copy for another note: new block ids, and a template's sub-pages become
 * plain links (the pages themselves stay with the template).
 */
function copyOf(blocks: Loose[]): Loose[] {
  return blocks.map((b) => ({
    ...b,
    id: undefined,
    props: b.type === 'pageLink' ? { ...b.props, mode: 'link' } : b.props,
    children: copyOf(b.children ?? []),
  }))
}

export function TemplateBar({ kind, onPick }: { kind: TemplateKind; onPick: (blocks: unknown[]) => void }) {
  const [templates, setTemplates] = useState<TemplateInfo[]>([])
  const [busy, setBusy] = useState(false)

  useEffect(() => {
    let alive = true
    void templatesFor(kind).then((list) => alive && setTemplates(list))
    return () => {
      alive = false
    }
  }, [kind])

  if (!templates.length) return null
  return (
    // Indented like the text (the editor's left gutter holds the block handles).
    <div className="mb-1 flex flex-wrap items-center gap-1 pr-1 pl-6 text-sm text-muted md:pl-10">
      <span className="mr-1 text-xs text-faint">從範本開始</span>
      {templates.map((t) => (
        <button
          key={t.id}
          type="button"
          disabled={busy}
          onClick={async () => {
            setBusy(true)
            const result = await getTemplateContent(t.id)
            setBusy(false)
            if (!result.ok) return reportNoteError(result.error)
            onPick(copyOf((result.data ?? []) as Loose[]))
          }}
          className="flex items-center gap-1.5 rounded-md px-2 py-1 transition-colors hover:bg-sunken hover:text-ink-strong disabled:opacity-50"
        >
          <span className="grid size-4 place-items-center text-sm leading-none">
            <NoteIcon icon={t.icon} fallback={<FileText size={14} />} />
          </span>
          {t.title || UNTITLED}
        </button>
      ))}
    </div>
  )
}
