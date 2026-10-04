import type { GlobalConfig, NumberField } from 'payload'
import { authenticated } from '@/access/authenticated'
import { dayField } from '@/fields/dayField'
import { PLAN_SLOTS } from '@/lib/options'
import { BAND_MAX, BAND_MIN, isBand } from '@/lib/toefl'

const bandSetting = (name: string, label: string, defaultValue: number): NumberField => ({
  name,
  label,
  type: 'number',
  min: BAND_MIN,
  max: BAND_MAX,
  defaultValue,
  admin: { step: 0.5 },
  validate: (value: number | null | undefined) => value == null || isBand(value) || '級分是 1–6，以 0.5 為單位',
})

const planDay = (name: string, label: string, defaultValue: string) => ({
  name,
  label,
  type: 'select' as const,
  required: true,
  defaultValue,
  options: [...PLAN_SLOTS],
})

export const Settings: GlobalConfig = {
  slug: 'settings',
  label: '設定',
  access: {
    read: authenticated,
    update: authenticated,
  },
  fields: [
    {
      type: 'row',
      fields: [
        dayField({
          name: 'planStart',
          label: '計畫第 1 週的週一',
          defaultValue: '2026-10-05',
          index: false,
        }),
        dayField({
          name: 'examDate',
          label: '托福考試日期',
          required: false,
          index: false,
          validate: (value: string | null | undefined) =>
            !value || /^\d{4}-\d{2}-\d{2}$/.test(value) || '請用 YYYY-MM-DD 格式',
        }),
      ],
    },
    {
      type: 'row',
      fields: [
        bandSetting('baselineBand', '起始總分（1–6）', 3.5),
        bandSetting('targetBand', '目標總分（1–6）', 5),
      ],
    },
    {
      name: 'checkpoints',
      label: '檢查點（總分）',
      type: 'array',
      defaultValue: [
        { week: 4, target: 4 },
        { week: 8, target: 4.5 },
        { week: 12, target: 5 },
      ],
      fields: [
        {
          type: 'row',
          fields: [
            { name: 'week', label: '第幾週', type: 'number', required: true, min: 1 },
            { ...bandSetting('target', '目標總分', 4), required: true },
          ],
        },
      ],
    },
    {
      name: 'weeklyTargets',
      label: '每週目標',
      type: 'group',
      fields: [
        {
          type: 'row',
          fields: [
            { name: 'toeflHours', label: '托福小時數', type: 'number', defaultValue: 8 },
          ],
        },
      ],
    },
    {
      name: 'weekPlan',
      label: '22:00 托福時段的每日科目',
      type: 'group',
      fields: [
        planDay('mon', '週一', 'speaking'),
        planDay('tue', '週二', 'writing'),
        planDay('wed', '週三', 'reading'),
        planDay('thu', '週四', 'speaking'),
        planDay('fri', '週五', 'writing'),
        planDay('sat', '週六', 'practice'),
        planDay('sun', '週日', 'rest'),
      ],
    },
  ],
}
