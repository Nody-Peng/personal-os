import type { CollectionBeforeChangeHook, TextareaField } from 'payload'

/** A read-only plain-text copy of a record's rich text, for search (lib/searchText.ts). */
export const searchTextField: TextareaField = {
  name: 'plainText',
  label: '純文字（搜尋用）',
  type: 'textarea',
  admin: { readOnly: true, description: '儲存時自動產生' },
}

/** Recomputes `plainText` whenever one of `sources` is saved (autosaves send only what changed). */
export function searchTextHook(sources: string[], toText: (doc: Record<string, unknown>) => string): CollectionBeforeChangeHook {
  return ({ data, originalDoc }) => {
    if (sources.some((key) => key in data)) data.plainText = toText({ ...originalDoc, ...data })
    return data
  }
}
