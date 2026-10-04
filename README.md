# Personal OS

以我為中心的個人平台：每日打卡、托福進度追蹤、想學清單。規格書在 [docs/SPEC.md](docs/SPEC.md)。

技術：Next.js 16 + Payload 3（內嵌）+ PostgreSQL（本機用 embedded Postgres，正式環境用 Supabase）+ Tailwind v4，部署到 Vercel。

## 本機開發

```bash
npm install
npm run db:local      # 終端機 1：啟動本機 Postgres（port 54322，資料在 .local-db/）
npm run dev           # 終端機 2：http://localhost:3000
```

第一次開啟時：

- 到 `http://localhost:3000/admin/create-first-user` 建立自己的帳號，或
- 執行 `npm run seed:dev` 建立本機測試帳號（帳密寫在 `scripts/seed-dev.ts`）；加上 `-- --demo` 會再放入範例資料

`.env` 的 `DATABASE_URL` 要指向本機資料庫（參考 `.env.example`）。

## 頁面

| 路徑 | 用途 |
| --- | --- |
| `/` | 今天：IMPORTANT 1·2·3、早／午／晚、本週待辦、追蹤（聽力、健身、托福、主題、精力）、Note、可展開的「安排明天」、本週統計 |
| `/journal` | 書架：每年一本精裝日記本 |
| `/journal/2026` | 年度：12 個月的縮圖 |
| `/journal/2026/10` | 大月曆：每天的 Important、跨日任務、到期日；點週數打開週筆記；下方是月統整 |
| `/journal/week/<週一日期>` | 週筆記：本週待辦、每天的 Important、週日統整與下週主題 |
| `/journal/day/<日期>` | 任何一天的頁面 |
| `/toefl` | 托福：新制 1–6 級分趨勢、每週練習時數、分數紀錄 |
| `/ideas` | 想學清單：快速記下、0–3 評分、設定本週主題 |
| `/admin` | Payload 後台：考試日期、每週科目、檢查點、日記本封面，以及所有資料 |

任何頁面網址加上 `?task=<id>` 會打開該任務的細項面板（Notion 式編輯器）。

所有頁面都要登入。未登入會被導到 `/admin/login`。

## 部署到 Vercel + Supabase

1. **建立 Supabase 專案**，到 Project Settings → Database → Connection string，複製 **Transaction pooler**（port 6543）的連線字串。
2. **關閉 Supabase Data API**（Project Settings → Data API），或在 SQL Editor 對所有資料表執行 `alter table ... enable row level security;`。
   Payload 用資料庫擁有者連線，不受影響；但若不關閉，持有 anon key 的人可能透過 Supabase API 讀到資料。
3. **在 Vercel 匯入這個 repo**。伺服器端函式固定跑在東京（`vercel.json` 的 `hnd1`），和 Supabase 的東京區（`ap-northeast-1`）同區，查詢延遲最低。設定環境變數：
   - `DATABASE_URL`：步驟 1 的連線字串（填入密碼）
   - `PAYLOAD_SECRET`：一段夠長的隨機字串（例如 `openssl rand -hex 32` 產生）
4. 部署後第一次啟動會自動執行 `src/migrations/` 建立資料表。
5. 開啟 `https://<你的網域>/admin/create-first-user` 建立帳號。之後只有已登入的人能新增帳號。
6. 到 `/admin/globals/settings` 填入**托福考試日期**。

### 修改資料結構之後

本機開發時 Payload 會直接同步資料表；正式環境只透過 migration 變更：

```bash
npm run payload migrate:create <描述>
```

把產生的 `src/migrations/*` 一起 commit，部署時會自動套用。

## 加到手機主畫面（主手機、Flip5）

用 Chrome 開啟網站 → 選單 →「加到主畫面」。會以獨立 App 的方式開啟，主畫面長按圖示可以直接跳到「想學」或「托福」。

## 指令

| 指令 | 說明 |
| --- | --- |
| `npm run dev` | 開發伺服器 |
| `npm run db:local` | 本機 Postgres |
| `npm run seed:dev` | 本機測試帳號（`-- --demo` 加範例資料；只會在本機資料庫執行） |
| `npm run build` | 正式版建置 |
| `npm run lint` | ESLint |
| `npm run test:int` | 單元與整合測試（需要 `db:local` 在跑） |
| `npm run generate:types` | 修改 collections 後重新產生型別 |
