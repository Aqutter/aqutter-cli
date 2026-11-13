# 2611131616 - app-ready-auto-dismiss

- Created: 2026-11-13 16:16 / Archived: 2026-11-13 17:00
- Issue: Aqutter/aqutter-cli#24
- Milestone: N/A / Base Branch: main

## Summary
`aqutter init` 產生的專案的 env 範本新增 `AQUTTER_REQUIRE_APP_READY=` 與說明（空＝自動：有熱更新網址才必須呼叫 `app_ready`；`true`＝必須；`false`＝一律自動收起），並註明 `AQUTTER_WEB_READY_TIMEOUT_SECONDS` 只在嚴格模式生效。殼端行為由 Aqutter/aqutter#51 實作。
實跑 `aqutter init` 確認產出的 `.env/.env.example` 含新鍵。

## Cross-Repo Scope
與 Aqutter/aqutter#51 共用 ID 與分支名；契約正本在 aqutter（Contract rev 1，無端點、無錯誤碼，一個編譯期鍵）。本 repo 是消費方。

## Key Decisions
- **[Milestone]** 不指定，PR 併回 main — 理由：開發階段版本一律 0.0.0。
- **[設計]** 見 Aqutter/aqutter 的同名計畫：預設自動收起、有 OTA 網址則自動嚴格、三態旗標。
- **[契約]** rev 1 凍結（核准日 2026-11-13），執行中未變更。
- **[執行中]** 不重建 `dist/aqutter.mjs` — 理由：初版計畫誤認範本被打包進 dist；實測 `pnpm build` 後 dist 無差異，`package.json` 的 `files` 另列 `template`。

## Deviations
- 初版計畫列了「重建 dist」，實測不需要，已更正（見 Key Decisions）。
- 範本與 aqutter 的 `docs/env.example` 快照以逐位元組比對確認一致（`cmp`）。

## Impact Files
- `template/env/.env.example:51-58` — 新增 `AQUTTER_REQUIRE_APP_READY=` 與註解，更新 timeout 區塊說明

## Wiki Changes

| 頁面 | 日期 | 版本 | 變動 | Issue | PR |
|---|---|---|---|---|---|
