import type { CollectionConfig, NumberField } from 'payload'
import { authenticated } from '@/access/authenticated'
import { dayField } from '@/fields/dayField'
import { SCORE_SOURCES, SCORE_TYPES } from '@/lib/options'
import { BAND_MAX, BAND_MIN, SECTIONS, isBand, overallBand } from '@/lib/toefl'

const bandField = (name: string, label: string): NumberField => ({
  name,
  label,
  type: 'number',
  min: BAND_MIN,
  max: BAND_MAX,
  admin: { step: 0.5, width: '25%' },
  validate: (value: number | null | undefined) => value == null || isBand(value) || '級分是 1–6，以 0.5 為單位',
})

// One row per test sitting. Fill the sections that were tested; the overall
// band is computed only when all four are present (new TOEFL, Jan 2026+).
export const ToeflScores: CollectionConfig = {
  slug: 'toefl-scores',
  labels: { singular: '托福分數', plural: '托福分數' },
  admin: {
    useAsTitle: 'date',
    defaultColumns: ['date', 'type', 'overall', 'reading', 'listening', 'speaking', 'writing', 'source'],
  },
  defaultSort: '-date',
  access: {
    read: authenticated,
    create: authenticated,
    update: authenticated,
    delete: authenticated,
  },
  fields: [
    {
      type: 'row',
      fields: [
        dayField({ name: 'date', label: '日期' }),
        { name: 'type', label: '類型', type: 'select', required: true, options: [...SCORE_TYPES] },
        { name: 'source', label: '來源', type: 'select', defaultValue: 'ets', options: [...SCORE_SOURCES] },
      ],
    },
    {
      type: 'row',
      fields: SECTIONS.map(({ value, label }) => bandField(value, label)),
    },
    {
      name: 'overall',
      label: '總分（四科平均，四捨五入到 0.5）',
      type: 'number',
      index: true,
      admin: { readOnly: true, description: '四科都有級分時自動計算' },
    },
    { name: 'notes', label: '備註', type: 'textarea' },
  ],
  hooks: {
    beforeValidate: [
      ({ data, originalDoc }) => {
        if (!data) return data
        const merged = { ...originalDoc, ...data }
        if (!SECTIONS.some(({ value }) => merged[value] != null)) {
          throw new Error('至少要填一科的級分')
        }
        return data
      },
    ],
    beforeChange: [
      ({ data, originalDoc }) => {
        data.overall = overallBand({ ...originalDoc, ...data })
        return data
      },
    ],
  },
}
