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
| `/` | 今天：IMPORTANT 1·2·3、早／午／晚（當天用的勾選清單，不列入統計）、本週待辦、追蹤（最多 4 項每日習慣、托福、本週主題、精力）、Note、週日才出現的週日統整、可展開的「安排明天」、本週統計 |
| `/journal` | 書架：上層是每年一本的日記本，下層是自己新增的筆記本（可選顏色和花紋）；點書本會放大並翻開 |
| `/journal/2026` | 年度：12 個月的縮圖 |
| `/journal/2026/10` | 大月曆：每天的 Important、跨日任務、到期日；點週數打開週筆記；下方是月統整 |
| `/journal/week/<週一日期>` | 週筆記：本週主題、本週待辦、每天的 Important、週日統整與下週主題 |
| `/journal/day/<日期>` | 任何一天的頁面 |
| `/notebooks/<id>` | 打開筆記本：回到上次編輯的那一頁 |
| `/notebooks/<id>/<頁面>` | 筆記頁面（Notion 式）：左側頁面樹（可拖曳排序、無限層子頁面）、圖示、封面圖、搜尋（Ctrl K，跨所有筆記本）、垃圾桶（30 天後自動刪除）。文中可用 `/` 插入：頁面（子頁面）、連結到頁面（跨筆記本）、待辦看板（看板／表格，每張卡片都是一頁，右側滑出編輯）、標註、目錄、兩欄／三欄、圖片、影片、檔案；`> ` 是可折疊列 |
| `/toefl` | 托福：新制 1–6 級分趨勢、每週練習時數、分數紀錄 |
| `/ideas` | 想學清單：快速記下、0–3 評分、設定本週主題 |
| `/admin` | Payload 後台：考試日期、每週科目、檢查點、日記本封面與花紋，以及所有資料 |

任何頁面網址加上 `?task=<id>` 會打開該任務的細項面板（Notion 式編輯器）。

所有頁面都要登入，未登入會被導到 `/login`。登入後 30 天內不用重新登入；密碼連續錯 5 次會鎖 10 分鐘。

## 部署到 Vercel + Supabase

1. **建立 Supabase 專案**，到 Project Settings → Database → Connection string，複製 **Transaction pooler**（port 6543）的連線字串。
2. **資料列層級安全（RLS）會自動開啟**：正式環境每次啟動、套用完 migration 之後，會對 `public` schema 裡還沒開 RLS 的資料表執行 `enable row level security`（不加任何 policy），之後 migration 新增的資料表也一樣。
   Payload 用資料表擁有者連線，不受 RLS 影響；持有 anon key 的人透過 Supabase Data API 則讀寫不到任何資料。若啟動紀錄出現「Row level security is still off」或「Could not enable row level security」，到 SQL Editor 手動補上。
   想多一層保護，可以再到 Project Settings → Data API 把 Data API 關掉（這個網站用不到它）。
3. **在 Vercel 匯入這個 repo**。伺服器端函式固定跑在東京（`vercel.json` 的 `hnd1`），和 Supabase 的東京區（`ap-northeast-1`）同區，查詢延遲最低。設定環境變數：
   - `DATABASE_URL`：步驟 1 的連線字串（填入密碼）
   - `PAYLOAD_SECRET`：一段夠長的隨機字串（例如 `openssl rand -hex 32` 產生）
   - `NEXT_PUBLIC_SERVER_URL`（選用，更嚴格的 CSRF 防護）：填入開網站會用到的每一個完整網址，多個用逗號分隔（例如 `https://journal.example.com,https://www.journal.example.com`）。填了之後，登入 cookie 只接受來自這些網址（加上 Vercel 自動提供的網址）的請求；從沒列到的網址打開時，頁面能看但所有儲存動作都會被當成未登入。不填則維持預設：cookie 的 SameSite=Lax 和 Next 對 server action 的來源檢查已經擋掉跨站寫入。
4. 部署後第一次啟動會自動執行 `src/migrations/` 建立資料表。
5. 開啟 `https://<你的網域>/admin/create-first-user` 建立帳號。之後只有已登入的人能新增帳號。
6. 到 `/admin/globals/settings` 填入**托福考試日期**。

### 圖片與檔案（Supabase Storage）

筆記裡的圖片、影片、檔案和封面放在 Supabase Storage 的**私人** bucket，只有登入後才看得到（每次顯示時產生短效簽名網址）。

1. Supabase → Storage → **New bucket**，名稱例如 `notes`，**不要**勾 Public。
2. Storage → Settings → **S3 Connection**：確認已啟用，記下 Endpoint 和 Region；在 **S3 Access Keys** 建立一組 key。
3. 在 Vercel 加環境變數（只勾 Production）：
   - `S3_BUCKET`：bucket 名稱（例如 `notes`）
   - `S3_ENDPOINT`：照 S3 Connection 頁面顯示的 Endpoint（形如 `https://<project-ref>.supabase.co/storage/v1/s3`）
   - `S3_REGION`：例如 `ap-northeast-1`
   - `S3_ACCESS_KEY_ID`、`S3_SECRET_ACCESS_KEY`：步驟 2 的 key
4. 重新部署。瀏覽器會直接把檔案傳到 bucket，所以可以超過 Vercel 4.5 MB 的限制（上限 50 MB）。

沒設定這些變數時，正式環境會顯示「還沒設定檔案儲存空間」；本機開發則存在專案的 `media/` 資料夾。

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
