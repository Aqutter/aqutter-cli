# 2610211114 - split-cli-to-aqutter-cli-repo

- Created: 2026-10-21 11:14 / Archived: 2026-10-21 14:35
- Issue: Aqutter/aqutter-cli#1
- Milestone: 0.0.0 / Base Branch: release/0.0.0

## Summary
接手 `Aqutter/aqutter` 的 `cli/`：匯入程式碼與完整 git 歷史，讓本 repo 自足，使 `github:Aqutter/aqutter-cli#<ref>` 能用 npm、yarn、pnpm 安裝（bun 待人工驗證），並讓 CLI 改讀框架發佈的 release manifest。

具體包含：套件管理器偵測合併成一處並加入 bun；新增 manifest 取得層（24 小時快取、逾時、`--offline`、格式過新中止、退回內建快照）；`init`、`plugin create`、`doctor`、`upgrade` 取用 manifest，`upgrade` 能把舊的子目錄依賴語法改寫為新語法；新增 CI 與 wiki。契約 rev 1 的正本在 `Aqutter/aqutter#2`。

## Cross-Repo Scope
- 共用計畫 ID `2610211114-split-cli-to-aqutter-cli-repo`、共用分支名 `feature/2610211114-split-cli-to-aqutter-cli-repo`。
- `Aqutter/aqutter`（issue `Aqutter/aqutter#2`）— 契約提供方，manifest 已合併上線；其後續計畫負責文件改寫與最後移除舊 `cli/`。
- `Aqutter/aqutter-cli`（本 repo，issue `Aqutter/aqutter-cli#1`）— 契約消費方。
- `Aqutter/aqutter-nuxt-app`（issue 待建立，計畫仍為 Planning）— 下游：改用新依賴語法並跑 `aqutter upgrade`。
- 執行順序：`aqutter` 的 manifest 合併上線 → 本計畫 → `aqutter-nuxt-app` → `aqutter` 移除 `cli/`。

## Key Decisions
- **[Phase 0]** 目標 repo `Aqutter/aqutter-cli`：使用者核准建立（公開、空的、issues 啟用），歷史匯入由本計畫執行；整合主幹 `main`（新 repo 的第一個 commit 建立）。
- **[Phase 0]** 治理初始化：是；wiki：使用者選擇建立，因 repo 當時沒有程式碼而延到程式碼匯入後；app-flow：否（`appFlow: false`）。
- **[Phase 0]** Milestone `0.0.0`（使用者選擇，起始版本）；版本分支命名為 `release/0.0.0`，不用標題原文 — 理由：框架以 tag `0.0.0` 當安裝網址的 ref，同名分支會造成 `refname is ambiguous` 與安裝歧義。
- **[Q1]** 安裝網址用 tag `0.0.0`（`github:Aqutter/aqutter-cli#0.0.0`）— 理由：沿用框架現行慣例。
- **[執行模式]** 序列；**[完成後]** commit + 開 PR（併回 `release/0.0.0`，合併選 Create a merge commit）。
- **[Rule 24]** 本 repo 當時沒有版本檔可比對；匯入後 `package.json` 的 `version` 為 `0.0.0`，與 milestone 一致。
- **[設計]** manifest 取得層與內建快照放在 CLI 內，不是每次連網 — 理由：`dev`、`build`、`seed` 不查 manifest，離線仍要能 `init`／`doctor`。
- **[設計]** 套件管理器偵測集中一處並加入 bun — 理由：npm、pnpm、bun、yarn 都要能用；原本三處各寫一份且都沒有 bun。
- **[設計]** 契約區塊由 `Aqutter/aqutter` 的同名計畫逐字複製，修改只走 Rule 29（已程式比對相同）。
- **[執行中]** 發現第三份偵測（`upgrade.ts`），共用偵測放進計畫已列的 `src/web.ts`；補列 `test/packageManager.test.ts`（new）與 `test/versioning.test.ts`（既有），已請使用者重新核准。

## Deviations
- 計畫原本只列兩處套件管理器偵測，實作時發現第三處（`src/commands/upgrade.ts`），一併收進共用偵測；並因此補列兩個測試檔（已重新核准）。
- 契約中 `manifest.url` 的專案設定覆寫，因 `src/config.ts` 不在 Impact Files，改在 `src/manifest.ts` 內自行讀取並驗證（只接受 https），沒有改動設定檔型別。
- 契約凍結後沒有任何變更。
- 在本機用 `git+file` 網址測 yarn 失敗（`Couldn't find the binary git`，原因未查明），改於推送後用 GitHub 網址驗證通過。

## Impact Files
- `src/web.ts:67-90`（`detectPackageManager`、`execPrefixOf`、`installCommandOf`、`addArgs`）— 套件管理器偵測的共用處，加入 bun。
- `src/commands/plugin.ts`（`create`）— 殼 ref、client ref 取 manifest；偵測改用共用處。
- `src/commands/upgrade.ts`（`planUpgrade`、`runUpgrade`）— 目標取 manifest（`--to`、`--offline`）、舊語法改寫、`bun install`。
- `src/commands/init.ts:112-118` — 殼 ref 取 manifest。
- `src/commands/doctor.ts` — 期望值取 manifest、lock 比對 commit、檢查 CLI 夠新與舊依賴語法。
- `src/versioning.ts` — npm 依賴模型（`classifyCliSpec`、`readNpmSpecs`、`rewritePackageJson`、`cliInstallSpec`）。
- `src/main.ts` — 說明文字補 `--offline` 與 `AQUTTER_MANIFEST_URL`。
- `src/manifest.ts` (new)、`src/manifestSnapshot.json` (new)、`scripts/syncManifest.mjs` (new) — manifest 取得層、內建快照與同步腳本。
- `scripts/build.mjs`、`package.json`（repository、bugs、homepage、`manifest:sync`）— 註解與 metadata。
- `test/manifest.test.ts` (new)、`test/packageManager.test.ts` (new)、`test/versioning.test.ts` — 測試（共 146 項通過，1 項為既有的 Windows 失敗）。
- `.gitignore` (new)、`LICENSE` (new)、`README.md` (new)、`AGENTS.md` (new)、`.github/workflows/ci.yml` (new)。
- `.kn-project/wiki/`（new）、`.kn-project/project.md`（現況敘述）。

## Details
- 驗證：型別檢查通過；測試 146 項通過；`dist/` 重建後沒有差異；CI 的範本與 manifest 基準檢查在本機通過（含故意改壞）。以 `github:Aqutter/aqutter-cli#<分支>` 安裝，npm、yarn、pnpm 都成功並能執行 `aqutter --version`。`doctor`／`upgrade --dry-run` 用 raw 網址的 manifest 對真實專案驗證通過（`network` 然後 `cache`）。
- 未驗證：bun（這台機器沒有）；`ci` workflow 在 GitHub 上的實際執行結果（含 Linux 上 `template packaging` 測試的預期通過）。

## Wiki Changes

| 頁面 | 日期 | 版本 | 變動 | Issue | PR |
|---|---|---|---|---|---|
| `dev/verification.md` | 2026-10-21 | 0.0.0 | 建立 | [#1](https://github.com/Aqutter/aqutter-cli/issues/1) | — |
| `platform/architecture.md` | 2026-10-21 | 0.0.0 | 建立 | [#1](https://github.com/Aqutter/aqutter-cli/issues/1) | — |
| `platform/manifest.md` | 2026-10-21 | 0.0.0 | 建立 | [#1](https://github.com/Aqutter/aqutter-cli/issues/1) | — |
