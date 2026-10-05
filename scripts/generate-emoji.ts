// Builds the icon picker's emoji list from emojibase-data: Traditional Chinese
// names, Chinese + English search words and skin-tone variants, grouped like
// the system emoji keyboards.
//   npm run emoji
import { writeFileSync } from 'node:fs'
import { createRequire } from 'node:module'

type Emoji = {
  hexcode: string
  unicode?: string
  emoji?: string
  label: string
  tags?: string[]
  group?: number
  order?: number
  version?: number
  skins?: { unicode?: string; emoji?: string; tone?: number | number[] }[]
}

const require = createRequire(import.meta.url)
const zh: Emoji[] = require('emojibase-data/zh-hant/data.json')
const en: Emoji[] = require('emojibase-data/en/compact.json')
const messages: { groups: { message: string; order: number }[] } = require('emojibase-data/zh-hant/messages.json')

/** Newest emoji version the page fonts (Noto Color Emoji, Apple, Segoe UI) all draw. */
const MAX_VERSION = 16
const COMPONENT_GROUP = 2

const english = new Map(en.map((e) => [e.hexcode, [e.label, ...(e.tags ?? [])]]))
const char = (e: { unicode?: string; emoji?: string }) => e.unicode ?? e.emoji ?? ''

const groups = messages.groups
  .filter((g) => g.order !== COMPONENT_GROUP)
  .map((g) => ({
    name: g.message,
    emoji: zh
      .filter((e) => e.group === g.order && (e.version ?? 0) <= MAX_VERSION)
      .sort((a, b) => (a.order ?? 0) - (b.order ?? 0))
      .map((e) => {
        const words = [...new Set([e.label, ...(e.tags ?? []), ...(english.get(e.hexcode) ?? [])].map((w) => w.toLowerCase()))]
        // Only single-person variants line up with one chosen skin tone.
        const tones = (e.skins ?? []).filter((s) => typeof s.tone === 'number').sort((a, b) => Number(a.tone) - Number(b.tone))
        const entry: [string, string, string, string[]?] = [char(e), e.label, words.join(' ')]
        if (tones.length === 5) entry.push(tones.map(char))
        return entry
      }),
  }))

writeFileSync('src/components/notebooks/emojiData.json', JSON.stringify({ groups }) + '\n')
console.log(groups.map((g) => `${g.name} ${g.emoji.length}`).join('\n'))
