# 2611141720-sync-manifest-flutter-3-50

- Created: 2026-11-14 17:20 / Archived: 2026-11-14 17:45
- Issue: Aqutter/aqutter-cli#28
- Milestone: N/A / Base Branch: main

## Summary
把 CLI 內建 manifest 快照同步成 aqutter 的新 manifest（逐字一致）並重打包 dist/，離線與快取情境的 doctor／upgrade 也以 Flutter 3.50.0 為基準。

驗證：pnpm typecheck 通過、pnpm test 225 項通過、快照與 aqutter 的 releases.json 以 cmp 逐字一致。

## Cross-Repo Scope
參與：aqutter（manifest，契約提供方）、aqutter-cli（快照，消費方）。共用 ID `2611141720-sync-manifest-flutter-3-50`、共用分支 `feature/2611141720-sync-manifest-flutter-3-50`。順序：aqutter 先合併，aqutter-cli 後合併。承接已合併的 `2611141530-upgrade-flutter-3-50` 的 Q1 決議。

## Key Decisions
- **[核准]** 使用者全部核准；完成後採預設 commit + 開 PR；Issue 已建立並回填（aqutter#55、aqutter-cli#28）。
- **[Phase 0]** Milestone：不指定（使用者回答）；Base Branch = `main`；兩個 repo 皆已 sync 至 `origin/main` 且工作區乾淨。
- **[Phase 0]** 整合主幹：遠端無 dev／develop 類分支，採 `origin/HEAD`＝`main`，不詢問、不記錄。
- **[Phase 0]** 本計畫承接已合併的「升級 Flutter 至 3.50」（`2611141530-upgrade-flutter-3-50`）的 Q1 決議：manifest 的 baseline 與 ref 於各 PR 合併後另走同步。
- **[ref]** `core.ref` 取 `aqutter_core` 目前 main 的 `aa44625f6d68daa4a1e2c1d6d4633a8b460b4669`（比照前一次同步取 HEAD）；`shell.ref` 取 `git log -1 --format=%H -- shell` ＝ `ef94f7376ce4d771494a3e090f3dbcfd5fac5272`（`docs/releases.md` 規定）；`client.spec` 不變（aqutter-js main 與 tag 0.0.0 仍在 `6a71990`）。
- **[執行模式]** 序列（先 `aqutter`，再 `aqutter-cli`；快照由 manifest 產生）。
- **[順序]** `aqutter-cli` 的 PR 等 `aqutter` 的 manifest PR 合併後再合併 — 理由：快照內容取自 manifest，避免快照領先清單。

## Deviations
快照是整份覆寫，因此也補上了先前落後的 client.spec（`bc84de7` → `6a71990`）與舊的 shell／core ref，不只 3.50 相關欄位；兩者本來就是 aqutter manifest 已有的內容。

## Impact Files
- `src/manifestSnapshot.json:3,11,13,17,21,23` — 由 `pnpm manifest:sync` 覆寫
- `dist/aqutter.mjs:491-493` 附近 — 由 `pnpm build` 重新產生
