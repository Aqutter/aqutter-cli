<!-- REMINDER: Relative Paths Only! No file:///c:/... -->
# Plan: 2611131616 - app-ready-auto-dismiss
- Created: 2026-11-13
- Branch: feature/2611131616-app-ready-auto-dismiss
- Issue: Aqutter/aqutter-cli#24
- Milestone: N/A（未指定）
- Base Branch: main
- Status: Awaiting Archive
- Completed: [Wait for Finish]

## Goals
讓 `aqutter init` 產生的專案，其 env 範本帶有新的 `AQUTTER_REQUIRE_APP_READY` 鍵與說明，使用者一開始就知道：預設不必呼叫 `app_ready`、殼會自動收起過場，要嚴格檢查時如何開啟。殼端的行為由 `aqutter` repo 實作（同一組計畫）。

## Architecture
- 只改範本檔 `template/env/.env.example`：在 `AQUTTER_WEB_READY_TIMEOUT_SECONDS` 區塊旁新增 `AQUTTER_REQUIRE_APP_READY=`（留空＝自動）與註解，並說明 `AQUTTER_WEB_READY_TIMEOUT_SECONDS` 只在嚴格模式生效。
- 註解文字與 `aqutter` repo 的 `docs/env.example` 快照逐字一致（AGENTS.md 紅線 3 的快照規則）。
- 範本目錄 `template/` 與 `dist/` 是各自獨立的發佈內容（`package.json` 的 `files`），範本不打包進 `dist/aqutter.mjs`，所以不需要重建 dist。
- 不改 CLI 程式邏輯；`aqutter init` 是原樣複製範本。

## Cross-Repo Scope
- **本計畫所屬 repo**: `aqutter-cli`
- **共用計畫 ID**: `2611131616-app-ready-auto-dismiss`　**共用分支名**: `feature/2611131616-app-ready-auto-dismiss`
- **參與 repo 與職責**:
  - `aqutter` — 契約提供方：殼實作 `AQUTTER_REQUIRE_APP_READY`、文件與 env 快照　issue: `Aqutter/aqutter#51`
  - `aqutter-cli` — 契約消費方：env 範本提供該鍵　issue: `Aqutter/aqutter-cli#24`
- **執行順序相依**: 契約凍結後兩邊檔案不相交、可平行；建議合併順序 `aqutter` 先、`aqutter-cli` 後。
- **跨 repo 檔案指涉**: `aqutter` 的 `docs/env.example`（本 repo 範本的快照，註解須逐字一致）、`shell/lib/src/app.dart`（實作該鍵的行為）。

## Contract / 介面契約
- **契約正本 repo**: `aqutter`　**修訂號**: `rev 1`　**狀態**: `凍結（核准日 2026-11-13）`

### 1. 端點
無（不涉及 HTTP 端點）。介面是一個編譯期環境變數，由 `aqutter` 的殼讀取，由 `aqutter-cli` 的 env 範本提供給專案。

### 2. 環境變數 `AQUTTER_REQUIRE_APP_READY`
| 項目 | 內容 |
|---|---|
| 型別 | 字串，只接受 `true`、`false` 或空；其他值啟動即報錯（沿用 `BundleUpdateConfig.parseFlag` 的紀律） |
| 預設 | 空（＝自動） |
| 空（自動） | `AQUTTER_UPDATE_BASE_URL` 非空 → 嚴格；`AQUTTER_UPDATE_BASE_URL` 為空 → 自動收起 |
| `true`（嚴格） | 頁面載入完成後必須收到網頁的 `app_ready` 才收起過場；`AQUTTER_WEB_READY_TIMEOUT_SECONDS` 內未收到即視為網頁包壞掉並回滾（現行行為） |
| `false`（自動收起） | 不要求 `app_ready`；即使設了 `AQUTTER_UPDATE_BASE_URL` 也不做逾時回滾 |
| 自動收起的時機 | `onLoadStop` 之後等兩個 `requestAnimationFrame`，由殼端觸發就緒（與收到 `app_ready` 等效） |
| `app_ready` 本身 | 橋接名稱、行為不變；自動收起模式下網頁仍可呼叫，重複呼叫無副作用 |
| 編譯期設定 | 網頁無法更改；`aqutter dev` 注入的 `AQUTTER_DEV_URL` 不影響此鍵的判定 |
| 與 `AQUTTER_WEB_READY_TIMEOUT_SECONDS` | 只在嚴格模式生效；自動收起模式下忽略 |

### 3. 錯誤碼
無新增。`AQUTTER_REQUIRE_APP_READY` 值不合法時啟動拋 `ArgumentError`，訊息格式同其他旗標。

### 4. 狀態與規則
- 判定在啟動時做一次（編譯期常數），執行中不變。
- 嚴格模式與現行行為完全相同，包含逾時回滾與「沒有前一版時落到錯誤畫面」。
- 自動收起模式不啟動就緒判定窗，因此不會觸發 `_handleWebFailure` 的 ready 逾時路徑；載入錯誤、HTTP 錯誤的處理不變。

### 5. 相容性
- 已有的專案若設了 `AQUTTER_UPDATE_BASE_URL`，行為不變（自動 → 嚴格）。
- 沒設 OTA 網址且網頁有呼叫 `app_ready` 的專案：過場可能比以前稍早收起（最早在載入完成後兩個繪製幀），不再等網頁自己呼叫。
- `AQUTTER_REQUIRE_APP_READY` 是新增鍵，舊專案的 env 檔沒有它，等同空值。

### 6. 變更紀錄
- _(尚無)_

## Impact Files
- `template/env/.env.example:51-54` (`AQUTTER_WEB_READY_TIMEOUT_SECONDS` 區塊) — 新增 `AQUTTER_REQUIRE_APP_READY=` 與註解，並更新該區塊的說明

證據：`template/env/.env.example:54` 為現行 timeout 鍵；`test/` 內沒有檢查 env 範本內容的測試（Grep `env.example`、`READY_TIMEOUT` 只命中 `environments.test.ts` 的自建假檔與 `manifest.test.ts`），所以不需補測試；範本變更以 `pnpm test`（含範本變數檢查）與實跑 `aqutter init` 驗證。

## Open Questions / 待確認事項
無。設計取捨已於對話確認，見 Key Decisions。

## Manual Follow-ups / 人工收尾事項
- **[合併後]** 移動 `aqutter-cli` 的 `0.0.0` tag 到合併後的 main — 對我說「移動 tag」 — 移動遠端 tag 屬對外覆寫，由你下令才做
- **[合併後]** 在全新目錄 `aqutter init` 後確認 `.env/.env.example` 含新鍵 — 例如 `C:\aqt\web3` 類流程 — 要等 tag 移動後才有意義

## Key Decisions
- **[Milestone]** 不指定，base 為 `main` — 理由：開發階段版本一律 `0.0.0`；來源：Phase 0 詢問（本 repo 一題）
- **[設計]** 見 `aqutter` 的同名計畫：預設自動收起、有 OTA 網址則自動嚴格、鍵為三態 `AQUTTER_REQUIRE_APP_READY`
- **[契約]** rev 1 凍結（核准日 2026-11-13）
- **[執行中]** 不重建 `dist/aqutter.mjs` — 理由：初版計畫誤認範本被打包進 dist；實測 `pnpm build` 後 dist 無差異、`package.json` 的 `files` 另列 `template`。已於此更正，非設計變更
- **[完成後]** commit + 開 PR（預設）；歷史改寫（rebase、force-with-lease）將於核准時揭露

## Git Completion Policy
- PR 一律以 `--base main` 顯式指定 base (Rule 23)。
- 每個 commit 訊息與 PR body 都含 `Closes #${N}`（`${N}` 取自上方 `- Issue:`）。歸檔後於該 issue 張貼結案留言 (Rule 20)。
- Issue 的關閉發生在合併後清理 (Rule 21)。
- commit 一律自動（Rule 17）；完成時 `git fetch` 後 `git rebase origin/main` 並 `git push --force-with-lease --force-if-includes`。
- PR/archive order: Archive automatically triggered on PR request
- 跨 repo 時，本 repo 自己開自己的 PR (Rule 19)。

## References
- `aqutter` repo 的同名計畫（契約正本）
- `docs/getting-started.md:68`（aqutter repo）
