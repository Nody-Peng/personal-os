// Page icons: an emoji, one of these Phosphor icons in a colour (Notion's
// "Icons" tab) stored as `ph:<name>:<colour>`, or an uploaded picture stored
// as its /api/media/file/… URL — all in the same text field.
// Shared by the picker, the renderer (components/notebooks/NoteIcon) and the
// server actions' validation.

export const NOTE_ICON_COLORS = [
  { value: 'default', label: '預設' },
  { value: 'gray', label: '灰' },
  { value: 'brown', label: '棕' },
  { value: 'orange', label: '橘' },
  { value: 'yellow', label: '黃' },
  { value: 'green', label: '綠' },
  { value: 'blue', label: '藍' },
  { value: 'purple', label: '紫' },
  { value: 'pink', label: '粉紅' },
  { value: 'red', label: '紅' },
] as const

export type NoteIconColor = (typeof NOTE_ICON_COLORS)[number]['value']

export const NOTE_ICON_GROUPS = ['筆記與學習', '工作與科技', '溝通與媒體', '生活', '自然與旅行', '符號'] as const

/** [name, group index, search words]. Names are Phosphor icons in kebab case. */
export const NOTE_ICONS = [
  ['file-text', 0, '文件 頁面 筆記 document page'],
  ['note-pencil', 0, '筆記 寫 note write'],
  ['notebook', 0, '筆記本 notebook'],
  ['book-open', 0, '書 閱讀 book read'],
  ['books', 0, '書 書架 圖書館 books library'],
  ['book-bookmark', 0, '書籤 書 bookmark'],
  ['bookmark-simple', 0, '書籤 收藏 bookmark'],
  ['graduation-cap', 0, '學習 畢業 學校 study school'],
  ['student', 0, '學生 student'],
  ['exam', 0, '考試 測驗 托福 exam test toefl'],
  ['certificate', 0, '證書 證照 certificate'],
  ['translate', 0, '翻譯 語言 英文 translate language english'],
  ['chalkboard-teacher', 0, '課程 老師 教學 class teacher'],
  ['lightbulb', 0, '想法 點子 靈感 idea'],
  ['brain', 0, '大腦 思考 記憶 brain think'],
  ['pencil-simple', 0, '鉛筆 寫 編輯 pencil edit'],
  ['pen-nib', 0, '鋼筆 寫作 pen writing'],
  ['pen', 0, '筆 寫 pen'],
  ['feather', 0, '羽毛 寫作 feather'],
  ['highlighter-circle', 0, '螢光筆 重點 highlighter'],
  ['paperclip', 0, '迴紋針 附件 paperclip attachment'],
  ['push-pin', 0, '圖釘 釘選 pin'],
  ['tag', 0, '標籤 tag'],
  ['archive', 0, '封存 檔案 archive'],
  ['folder', 0, '資料夾 folder'],
  ['clipboard-text', 0, '剪貼簿 清單 clipboard'],
  ['list-checks', 0, '清單 待辦 核對 checklist todo'],
  ['check-square', 0, '待辦 勾選 todo check'],
  ['calendar-blank', 0, '日曆 日期 行事曆 calendar date'],
  ['calendar-check', 0, '行程 完成 calendar done'],
  ['clock', 0, '時鐘 時間 clock time'],
  ['timer', 0, '計時器 番茄鐘 timer'],
  ['alarm', 0, '鬧鐘 提醒 alarm'],
  ['hourglass', 0, '沙漏 等待 hourglass'],

  ['briefcase', 1, '工作 公事包 work job'],
  ['buildings', 1, '大樓 公司 建築 building company'],
  ['house-line', 1, '房屋 不動產 house property'],
  ['storefront', 1, '店 商店 store shop'],
  ['bank', 1, '銀行 bank'],
  ['scales', 1, '天秤 法律 估價 law scale'],
  ['gavel', 1, '法槌 法院 拍賣 court auction'],
  ['calculator', 1, '計算機 計算 calculator'],
  ['chart-bar', 1, '圖表 統計 chart stats'],
  ['chart-line', 1, '趨勢 折線圖 trend chart'],
  ['chart-pie', 1, '圓餅圖 比例 pie chart'],
  ['presentation-chart', 1, '簡報 報告 presentation'],
  ['table', 1, '表格 試算表 table spreadsheet'],
  ['database', 1, '資料庫 database'],
  ['kanban', 1, '看板 待辦 kanban board'],
  ['tree-structure', 1, '架構 樹狀 structure tree'],
  ['flow-arrow', 1, '流程 flow'],
  ['code', 1, '程式 程式碼 code'],
  ['terminal-window', 1, '終端機 指令 terminal'],
  ['laptop', 1, '筆電 電腦 laptop'],
  ['desktop', 1, '電腦 桌機 desktop computer'],
  ['device-mobile', 1, '手機 mobile phone'],
  ['cpu', 1, '晶片 硬體 cpu hardware'],
  ['cloud', 1, '雲端 cloud'],
  ['globe', 1, '網路 世界 地球 web world'],
  ['link', 1, '連結 link'],
  ['gear', 1, '設定 齒輪 settings gear'],
  ['wrench', 1, '工具 修理 tool fix'],
  ['hammer', 1, '槌子 工具 hammer'],
  ['flask', 1, '實驗 化學 lab experiment'],
  ['atom', 1, '科學 原子 science atom'],
  ['robot', 1, '機器人 AI robot'],
  ['bug', 1, '蟲 除錯 bug debug'],
  ['key', 1, '鑰匙 密碼 key password'],
  ['lock', 1, '鎖 私密 lock private'],
  ['shield-check', 1, '安全 保護 security'],

  ['chat-circle', 2, '對話 聊天 chat'],
  ['chats', 2, '討論 會議 discussion'],
  ['envelope', 2, '信件 郵件 email mail'],
  ['phone', 2, '電話 phone call'],
  ['user', 2, '人 個人 user person'],
  ['users', 2, '人 團隊 朋友 team people'],
  ['microphone', 2, '麥克風 口說 錄音 speaking record'],
  ['headphones', 2, '耳機 聽力 podcast listening'],
  ['music-notes', 2, '音樂 歌 music'],
  ['camera', 2, '相機 照片 camera photo'],
  ['image', 2, '圖片 照片 image picture'],
  ['film-slate', 2, '電影 影片 movie film'],
  ['video-camera', 2, '影片 錄影 video'],
  ['newspaper', 2, '新聞 文章 news article'],
  ['megaphone', 2, '公告 宣傳 announce'],

  ['house', 3, '家 房子 home'],
  ['coffee', 3, '咖啡 早餐 coffee'],
  ['fork-knife', 3, '吃飯 餐廳 食物 food meal'],
  ['cooking-pot', 3, '料理 煮飯 食譜 cooking recipe'],
  ['carrot', 3, '蔬菜 飲食 vegetable diet'],
  ['barbell', 3, '健身 重訓 gym workout'],
  ['person-simple-run', 3, '跑步 運動 run exercise'],
  ['bicycle', 3, '腳踏車 騎車 bike'],
  ['heartbeat', 3, '健康 心跳 health'],
  ['pill', 3, '藥 健康 medicine'],
  ['drop', 3, '水 喝水 water'],
  ['bed', 3, '睡覺 休息 sleep rest'],
  ['game-controller', 3, '遊戲 game'],
  ['palette', 3, '調色盤 設計 畫畫 design art'],
  ['paint-brush', 3, '畫筆 藝術 paint art'],
  ['gift', 3, '禮物 gift'],
  ['shopping-cart', 3, '購物 買 shopping'],
  ['wallet', 3, '錢包 記帳 wallet'],
  ['money', 3, '錢 財務 money finance'],
  ['coins', 3, '硬幣 存錢 coins'],
  ['piggy-bank', 3, '存錢 儲蓄 saving'],
  ['receipt', 3, '收據 帳單 receipt bill'],
  ['credit-card', 3, '信用卡 付款 card payment'],
  ['umbrella', 3, '雨傘 保險 umbrella'],

  ['sun', 4, '太陽 早上 晴天 sun morning'],
  ['moon', 4, '月亮 晚上 睡眠 moon night'],
  ['cloud-sun', 4, '天氣 weather'],
  ['plant', 4, '植物 成長 plant grow'],
  ['leaf', 4, '葉子 自然 leaf nature'],
  ['tree', 4, '樹 自然 tree'],
  ['flower', 4, '花 flower'],
  ['mountains', 4, '山 登山 mountain hiking'],
  ['tent', 4, '露營 camping'],
  ['paw-print', 4, '寵物 動物 pet animal'],
  ['dog', 4, '狗 dog'],
  ['cat', 4, '貓 cat'],
  ['airplane', 4, '飛機 旅行 flight travel'],
  ['train', 4, '火車 交通 train'],
  ['car', 4, '汽車 交通 car'],
  ['suitcase', 4, '行李 旅行 travel luggage'],
  ['anchor', 4, '錨 海 anchor sea'],
  ['globe-hemisphere-east', 4, '亞洲 地球 asia globe'],
  ['map-trifold', 4, '地圖 map'],
  ['map-pin', 4, '地點 位置 location place'],
  ['compass', 4, '指南針 方向 compass'],
  ['binoculars', 4, '望遠鏡 探索 explore'],

  ['star', 5, '星星 重要 收藏 star favorite'],
  ['heart', 5, '愛心 喜歡 heart love'],
  ['hand-heart', 5, '感恩 關心 care thanks'],
  ['smiley', 5, '笑臉 心情 smile mood'],
  ['sparkle', 5, '閃亮 亮點 新 sparkle new'],
  ['magic-wand', 5, '魔法 自動 magic'],
  ['fire', 5, '火 熱門 fire hot'],
  ['lightning', 5, '閃電 快速 能量 fast energy'],
  ['rocket', 5, '火箭 啟動 專案 launch project'],
  ['target', 5, '目標 target goal'],
  ['flag', 5, '旗子 里程碑 flag milestone'],
  ['trophy', 5, '獎盃 成就 trophy'],
  ['medal', 5, '獎牌 medal'],
  ['crown', 5, '皇冠 crown'],
  ['diamond', 5, '鑽石 diamond'],
  ['puzzle-piece', 5, '拼圖 puzzle'],
  ['check-circle', 5, '完成 打勾 done check'],
  ['eye', 5, '眼睛 觀察 eye'],
  ['question', 5, '問題 疑問 question'],
  ['info', 5, '資訊 說明 info'],
  ['warning', 5, '警告 注意 warning'],
] as const satisfies readonly (readonly [string, number, string])[]

export type NoteIconName = (typeof NOTE_ICONS)[number][0]

const ICON_NAMES = new Set<string>(NOTE_ICONS.map(([name]) => name))
const COLOR_VALUES = new Set<string>(NOTE_ICON_COLORS.map((c) => c.value))

export type ParsedNoteIcon =
  | { kind: 'emoji'; emoji: string }
  | { kind: 'phosphor'; name: NoteIconName; color: NoteIconColor }
  | { kind: 'image'; url: string }

const UPLOAD_PREFIX = '/api/media/file/'
const MAX_UPLOAD_URL = 300
const isUploadUrl = (value: string) =>
  value.startsWith(UPLOAD_PREFIX) && value.length <= MAX_UPLOAD_URL && !value.includes('..') && !/[\s"'<>\\]/.test(value)

export const phosphorIcon = (name: NoteIconName, color: NoteIconColor) => `ph:${name}:${color}`

export function parseNoteIcon(icon: string | null | undefined): ParsedNoteIcon | null {
  if (!icon) return null
  if (icon.startsWith(UPLOAD_PREFIX)) return isUploadUrl(icon) ? { kind: 'image', url: icon } : null
  if (icon.startsWith('ph:')) {
    const [, name, color] = icon.split(':')
    if (!ICON_NAMES.has(name)) return null
    return { kind: 'phosphor', name: name as NoteIconName, color: (COLOR_VALUES.has(color) ? color : 'default') as NoteIconColor }
  }
  return { kind: 'emoji', emoji: icon }
}

/** The colour as a CSS value that follows the light/dark theme (tokens in styles.css). */
export const noteIconColor = (color: NoteIconColor) => `var(--color-icon-${COLOR_VALUES.has(color) ? color : 'default'})`

/** Server-side clean-up: a known `ph:` icon, an uploaded picture, or up to 8 characters of emoji. */
export function cleanNoteIcon(value: unknown): string {
  const raw = String(value ?? '').trim()
  if (raw.startsWith(UPLOAD_PREFIX)) return isUploadUrl(raw) ? raw : ''
  if (raw.startsWith('ph:')) {
    const parsed = parseNoteIcon(raw)
    return parsed?.kind === 'phosphor' ? phosphorIcon(parsed.name, parsed.color) : ''
  }
  return Array.from(raw).slice(0, 8).join('')
}
