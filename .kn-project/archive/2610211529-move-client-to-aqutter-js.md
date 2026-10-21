# 2610211529-move-client-to-aqutter-js

- Created: 2026-10-21 15:29 / Archived: 2026-10-21 16:30
- Issue: Aqutter/aqutter-cli#4
- Milestone: N/A / Base Branch: main

## Summary
CLI 辨識並改寫 `github:Aqutter/aqutter-js#<ref>` 的 client 依賴，`plugin create` 與 plugin 範本改用新格式，內建 manifest 快照同步，`dist/` 重新打包；舊的 `&path:/client` 不再處理。

契約 rev 1（正本 `Aqutter/aqutter`，核准日 2026-10-21）：安裝字串為 `github:Aqutter/aqutter-js#<ref>`；manifest `client.spec` 的值改格式、結構不變；舊格式不再支援。PR：https://github.com/Aqutter/aqutter-cli/pull/5

## Cross-Repo Scope
- **共用計畫 ID**: `2610211529-move-client-to-aqutter-js`　**共用分支名**: `feature/2610211529-move-client-to-aqutter-js`
- **參與 repo 與職責**（一 repo 一 issue，尚未建立者寫 `待建立`）:
  - `Aqutter/aqutter`（契約正本；本計畫）— manifest `client.spec` 改新位置、`manifest-check` 改檢查、文件與治理檔改寫、最後移除 `client/`。issue: 待建立
  - `Aqutter/aqutter-js`（新 repo）— 承接 `client/` 內容與 tag `0.0.0`；建立後另有自己的計畫與 issue。issue: 待建立
  - `Aqutter/aqutter-cli`（消費方）— 辨識新格式、`upgrade` 改寫、`plugin create` 與範本、內建 manifest 快照。issue: 待建立
  - `Aqutter/aqutter-nuxt-app`（下游）— `package.json` 的 client 依賴與 lock。issue: 待建立
  - `Aqutter/aqutter-plugin-battery`、`aqutter-plugin-haptics`、`aqutter-plugin-mirror-demo`、`aqutter-plugin-google-maps`（下游，各自一份計畫）— `package.json` 的 client 依賴與 lock。issue: 待建立
- **執行順序相依**: ① 建立 `aqutter-js` 並匯入內容、打 tag → ② `aqutter`（取得 aqutter-js 的 sha 後改 manifest、文件，並移除 `client/`）合併 → ③ `aqutter-cli`（從合併後的 manifest 同步快照）→ ④ `aqutter-nuxt-app` 與四個 plugin（用新 CLI 的 `upgrade` 或手改依賴，重產 lock）。契約提供方先、消費方後。
- **範圍外**: 不改 npm 套件名；不新增 npm 發佈；bun 驗證；跨 repo CI 比對。

- **本計畫所屬 repo**: `Aqutter/aqutter-cli`
- **本 repo 的前置**: `Aqutter/aqutter` 的 manifest 已合併，快照才有新值。

## Key Decisions
- **[Phase 0]** 目標 repo 清單見 Cross-Repo Scope；整合主幹 `main`；milestone 不指定，base 為 `main`（逐 repo 詢問，皆選不指定）。
- **[路線]** client 拆成獨立 repo `Aqutter/aqutter-js`（使用者選擇，取代「發佈 npm」與「CI 鏡像分支」）— 理由：不需 npm 帳號與憑證，四種套件管理器都能以根目錄安裝，同 `aqutter-cli` 流程。
- **[命名]** repo 名 `aqutter-js`（連字號，對齊 `aqutter-cli`）；npm 套件名 `@aqutter/aqutter` 不改 — 理由：已寫入紅線 1、範本、manifest，改名是破壞性變更，等確定發佈 npm 時再議。
- **[歷史]** aqutter-js 不保留 `client/` 的 git 歷史，全新起點 — 來源：使用者選擇。
- **[manifest]** 原地修改 release `0.0.0` 的 `client.spec`，不新增版本 — 來源：使用者選擇；已知例外於 `docs/releases.md`「已發佈版本不改欄位」規則，開發階段 `0.0.0` 本就隨 `main` 移動。
- **[破壞式移動]** 開發階段不考慮既有程式、不留過渡相容層，改完同步修改 `aqutter-nuxt-app` 與四個 plugin repo — 來源：使用者指示（2026-10-21）。
- **[契約]** rev 1 凍結（核准日 2026-10-21）。
- **[完成後]** commit + 開 PR（併回 `main`）。
- **[執行模式]** 序列（相依鏈是一條線）；**[完成後]** 待核准閘決定。

## Deviations
- `dist/aqutter.mjs` 已重新打包並提交（本 repo 的使用者直接從 GitHub 安裝）。
- `test/plugins.test.ts` 的「template packaging」在 Windows 上因路徑分隔符失敗，改動前就存在（`main` 上同樣失敗），與本計畫無關，未處理。
- 安裝實測（npm／yarn／pnpm 對 `github:Aqutter/aqutter-js#<sha>`）已在建立 aqutter-js 時於暫存目錄完成。
- tag `0.0.0` 的移動留到合併後，另行核准。

## Impact Files
- `src/versioning.ts:213,226`（`CLIENT_GITHUB_SPEC`、`isClientGithubSpec`）— 正規式改為 `^github:Aqutter\/aqutter-js#[^&\s]+$`；`:225` 註解與 `:261,278` 的說明同步。
- `src/commands/plugin.ts:58-59,79-83`（`clientRefOf`）— 取 `github:Aqutter/aqutter-js#<ref>` 的 `<ref>`；錯誤訊息文字。
- `template/plugin/package.json:29` — `github:Aqutter/aqutter#{{clientRef}}&path:/client` 改為 `github:Aqutter/aqutter-js#{{clientRef}}`。
- `src/commands/doctor.ts:8,201-216`、`src/commands/upgrade.ts:6` — 註解與提示文字；邏輯隨正規式變。
- `src/manifestSnapshot.json:24` — 由 `scripts/syncManifest.mjs` 從已合併的 aqutter manifest 同步。
- `test/versioning.test.ts:31`、`test/manifest.test.ts:26`、`test/plugins.test.ts:83` — 測試資料與案例改新格式。
- `README.md:49` — client 的說明改為在 `Aqutter/aqutter-js`。
- `dist/`（重新打包並一併提交，若 repo 的 CI 檢查產物）。

## Details
- 驗證與未驗證項目見 PR：https://github.com/Aqutter/aqutter-cli/pull/5
- 整批工作的合併順序：`Aqutter/aqutter`（#8）→ `Aqutter/aqutter-cli`（#5）→ 範本專案與四個 plugin。
