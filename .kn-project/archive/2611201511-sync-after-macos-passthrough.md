# 2611201511-sync-after-macos-passthrough

- Created: 2026-11-20 15:11 / Archived: 2026-11-20 15:14
- Issue: Aqutter/aqutter-cli#50
- Milestone: N/A / Base Branch: main

## Summary
以 `pnpm manifest:sync` 把內建快照 `src/manifestSnapshot.json` 更新為與 `aqutter` 的 `releases.json` 逐字相同（`core.ref` → `89ef85e`），並重建受版控的 `dist/aqutter.mjs`；`pnpm test`（225 項）與 typecheck 通過。

## Cross-Repo Scope
- 計畫共用 ID `2611201511-sync-after-macos-passthrough`、共用分支名 `feature/2611201511-sync-after-macos-passthrough`；參與：`aqutter`（`Aqutter/aqutter#82`，manifest 與文件，契約正本）、`aqutter-cli`（`Aqutter/aqutter-cli#50`，內建快照）、`aqutter-nuxt-app`（鎖定前進，不開 PR）；上游 `aqutter_core` 只移動 `0.0.0` tag。
- 執行順序：上游 tag → `aqutter` 合併 → `aqutter` tag → `aqutter-cli` 合併 → `aqutter-cli` tag → `aqutter-nuxt-app` 鎖定與 tag。契約：正本 `aqutter`（`manifest/releases.json` schema 1，rev 1），快照須與它逐字相同。

## Key Decisions
- **[Phase 0]** 目標 repo：`aqutter`、`aqutter-cli`、`aqutter-nuxt-app`；來源是 `aqutter_core` 計畫 `2611201345-macos-passthrough` 留下的人工收尾事項，使用者回覆「都做」。
- **[Milestone]** 不指定，base `main`。
- **[tag]** `0.0.0` 是浮動 tag，使用者核准移動並要求記舊值：`aqutter_core` `671bef98…` → `89ef85e3…`；`aqutter` `e4f7d91f…` → `de36fa6b…`；`aqutter-cli` 舊值 `09b8657`、`aqutter-nuxt-app` 舊值 `02234a3`，各自合併或推送後移動。
- **[完成後]** commit + 開 PR。

## Deviations
無偏離計畫。wiki 沒有寫死 ref 或快照內容，不需修改。

## Impact Files
- `src/manifestSnapshot.json` — 由 `pnpm manifest:sync` 產生，與正本逐字相同
- `dist/aqutter.mjs` — 重新打包
