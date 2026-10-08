'use client'

import { ArrowBendUpLeft, FileText } from '@phosphor-icons/react'
import Link from 'next/link'
import { useEffect, useState } from 'react'
import { getBacklinks, type BacklinkInfo } from '@/app/(frontend)/notebook-actions'
import { UNTITLED } from '@/lib/notes'
import { NoteIcon } from './NoteIcon'

/** 連到這一頁: the pages whose text links here (a 連結到頁面 block). Nothing shows when none do. */
export function Backlinks({ pageId }: { pageId: number }) {
  const [links, setLinks] = useState<BacklinkInfo[]>([])

  useEffect(() => {
    let alive = true
    void getBacklinks(pageId).then((result) => alive && result.ok && setLinks(result.data ?? []))
    return () => {
      alive = false
    }
  }, [pageId])

  if (!links.length) return null
  return (
    <section aria-label="連到這一頁" className="mt-10 border-t border-line pt-4 print:hidden">
      <h2 className="mb-1 flex items-center gap-1.5 text-xs font-semibold tracking-[0.06em] text-faint">
        <ArrowBendUpLeft size={14} />
        連到這一頁（{links.length}）
      </h2>
      <ul>
        {links.map((l) => (
          <li key={l.id}>
            <Link href={`/notebooks/${l.notebookId}/${l.id}`} className="-mx-2 flex items-center gap-2 rounded-md px-2 py-1.5 text-ink hover:bg-sunken">
              <span className="grid size-5 place-items-center text-base leading-none text-muted">
                <NoteIcon icon={l.icon} fallback={<FileText size={18} />} />
              </span>
              <span className={`truncate underline decoration-line-strong underline-offset-4 ${l.title ? '' : 'text-muted'}`}>{l.title || UNTITLED}</span>
            </Link>
          </li>
        ))}
      </ul>
    </section>
  )
}
