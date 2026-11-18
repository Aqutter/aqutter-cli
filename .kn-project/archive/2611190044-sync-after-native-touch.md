# 2611190044-sync-after-native-touch

- Created: 2026-11-19 00:44 / Archived: 2026-11-19 00:46
- Issue: Aqutter/aqutter-cli#48
- Milestone: N/A / Base Branch: main

## Summary
以 `pnpm manifest:sync` 把內建快照 `src/manifestSnapshot.json` 更新為與 `aqutter` 的 `releases.json` 逐字相同，並重建受版控的 `dist/aqutter.mjs`；`pnpm test`（225 項）與 typecheck 通過。

## Cross-Repo Scope
- 計畫共用 ID `2611190044-sync-after-native-touch`、共用分支名 `feature/2611190044-sync-after-native-touch`；參與：`aqutter`（`Aqutter/aqutter#80`，manifest 與文件，契約正本）、`aqutter-cli`（`Aqutter/aqutter-cli#48`，內建快照）、`aqutter-nuxt-app`（鎖定前進，不開 PR）；上游 `aqutter_core`、`aqutter-js` 只移動 `0.0.0` tag。
- 執行順序：上游 tag → `aqutter` 合併 → `aqutter` tag → `aqutter-cli` 合併 → `aqutter-cli` tag → `aqutter-nuxt-app` 鎖定。契約：正本 `aqutter`（`manifest/releases.json` schema 1，rev 1），快照須與它逐字相同。

## Key Decisions
- **[Phase 0]** 目標 repo：`aqutter`、`aqutter-cli`、`aqutter-nuxt-app`；來源是前一份計畫 `2611172358-ios-passthrough-drag-jitter` 留下的人工收尾事項，使用者回覆「都做」。
- **[Milestone]** 不指定，base `main`。
- **[tag]** `0.0.0` 是浮動 tag；使用者明確核准移動，並要求記下舊值：`aqutter_core` `84d9174…`、`aqutter-js` `3f250d6…`、`aqutter` `bab2f0b…`、`aqutter-cli` `2710dce…`。
- **[完成後]** `aqutter`、`aqutter-cli` commit + 開 PR；`aqutter-nuxt-app` 依其 `project.md` 直接推 `main`。

## Deviations
無偏離計畫。wiki 已檢視（`platform/manifest.md`、`platform/architecture.md`、`dev/verification.md`），沒有寫死 ref 或快照內容，未發現過時說法，不需修改。

## Impact Files
- `src/manifestSnapshot.json` — 由 `pnpm manifest:sync` 產生，與正本 `cmp` 逐字相同
- `dist/aqutter.mjs` — 重新打包
