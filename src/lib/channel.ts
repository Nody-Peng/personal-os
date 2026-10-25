// The channel's weekly checklist, stored as JSON on the week note
// (`weekly-reviews.channel`): per slot a tick and a line of text.

import { CHANNEL_SLOTS, isChannelSlot, type ChannelSlot } from './options'

export type ChannelEntry = { done: boolean; note: string }
export type ChannelWeek = Partial<Record<ChannelSlot, ChannelEntry>>

export const MAX_CHANNEL_NOTE = 200

/** Keeps known slots only, with a boolean tick and a short single-line note; drops empty entries. */
export function cleanChannel(value: unknown): ChannelWeek {
  const week: ChannelWeek = {}
  if (!value || typeof value !== 'object' || Array.isArray(value)) return week
  for (const [slot, raw] of Object.entries(value)) {
    if (!isChannelSlot(slot) || !raw || typeof raw !== 'object') continue
    const entry = raw as Record<string, unknown>
    const done = entry.done === true
    const note = String(entry.note ?? '')
      .replace(/\s+/g, ' ')
      .trim()
      .slice(0, MAX_CHANNEL_NOTE)
    if (done || note) week[slot] = { done, note }
  }
  return week
}

export function doneCount(week: ChannelWeek): number {
  return CHANNEL_SLOTS.filter((s) => week[s.value]?.done).length
}

/** The notes as search text, each after its slot's name. */
export function channelText(value: unknown): string {
  const week = cleanChannel(value)
  return CHANNEL_SLOTS.filter((s) => week[s.value]?.note)
    .map((s) => `${s.label}：${week[s.value]!.note}`)
    .join('\n')
}
