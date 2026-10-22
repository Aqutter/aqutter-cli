# 2610220907-dev-startup-race

- Created: 2026-10-22 09:07 / Archived: 2026-10-22 10:00
- Issue: Aqutter/aqutter-cli#6
- Milestone: N/A / Base Branch: main

## Summary
`aqutter dev` 先等網頁 dev server 就緒（任一回應非 5xx，最長 180 秒）才啟動 `flutter run`。起因：兩者同時啟動，殼先起來就拿到 dev server 還在編譯時的 503，顯示「啟動失敗」。

## Cross-Repo Scope
- `Aqutter/aqutter`（殼）— dev 模式載入 dev server 失敗時重試，issue `Aqutter/aqutter#9`。
- `Aqutter/aqutter-cli`（`aqutter dev`）— 等網頁 dev server 就緒再啟動 `flutter run`，issue `Aqutter/aqutter-cli#6`。
- 兩層互相補強：CLI 擋啟動時的競爭，殼擋執行中 dev server 重啟。契約：無（行為變更，不影響 manifest 結構）。

## Key Decisions
- **[Phase 0]** 整合主幹 `main`；milestone 不指定。完成後：commit + 開 PR。
- **[修法]** 兩層一起做（使用者選擇，建議是只做 CLI 這層）。
- **[CLI]** 探測 `http://localhost:<port>/` 與 `http://127.0.0.1:<port>/`，任一回應非 5xx 視為就緒；逾時 180 秒；每 5 秒印等待訊息。
- **[殼]** 只在 dev 模式（有 `AQUTTER_DEV_URL`）重試，每秒一次最多 60 次；release 與 OTA 的失敗處理與回滾不動。

## Details
- 驗證：`pnpm typecheck` 通過、`pnpm test` 153/153（新增 4 個 `waitForHttpReady` 測試）；實際對 `aqutter-nuxt-app` 跑 `aqutter dev windows`，等了約 1 分鐘後才啟動 Flutter，App 一次載入成功。
- 未驗證：行動裝置（Android／iOS）的 dev 流程。
