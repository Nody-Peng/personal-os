'use client'

import type { BlockNoteEditor } from '@blocknote/core'
import type { DefaultReactGridSuggestionItem } from '@blocknote/react'
import { loadEmoji, readTone, searchEmoji, withTone } from '@/lib/emoji'

const MAX_ITEMS = 300

/**
 * The ":" emoji menu, on the same Chinese/English emoji list as the icon
 * picker (":咖啡", ":coffee"). One Latin letter isn't enough to open it, so
 * "a:b" in ordinary text stays text.
 */
export async function emojiItems(editor: unknown, query: string): Promise<DefaultReactGridSuggestionItem[]> {
  if (/^[\x20-\x7e]$/.test(query)) return []
  const data = await loadEmoji()
  const tone = readTone()
  const found = searchEmoji(
    data.groups.flatMap((g) => g.emoji),
    query,
  ).slice(0, MAX_ITEMS)
  const target = editor as BlockNoteEditor
  return found.map((e) => {
    const char = withTone(e, tone)
    return {
      id: char,
      onItemClick: () => target.insertInlineContent(`${char} `),
      icon: (
        <span className="note-emoji" title={e[1]}>
          {char}
        </span>
      ),
    }
  })
}
