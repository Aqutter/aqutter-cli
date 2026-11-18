# 2611181800-resync-manifest-auto-hole

- Created: 2026-11-17 / Archived: 2026-11-17
- Issue: Aqutter/aqutter-cli#42
- Milestone: N/A / Base Branch: main

## Summary
以 `pnpm manifest:sync` 把 `src/manifestSnapshot.json` 更新為與 aqutter 的 `releases.json` 逐字相同，並重建受版控的 `dist/aqutter.mjs`；測試與 typecheck 通過。

## Cross-Repo Scope
- **本計畫所屬 repo**: `aqutter-cli`
- **共用計畫 ID**: `2611181800-resync-manifest-auto-hole`　**共用分支名**: `feature/2611181800-resync-manifest-auto-hole`
- **參與 repo 與職責**:
  - `aqutter` — 更新 `manifest/releases.json`（契約正本），並修剪 `docs/nativeview.md` 與 wiki 的過時說法　issue: `Aqutter/aqutter#72`
  - `aqutter-cli` — 以 `pnpm manifest:sync` 同步內建快照並重打包 `dist/`　issue: `Aqutter/aqutter-cli#42`
- **執行順序相依**: `aqutter` 先；`aqutter-cli` 以 aqutter 工作分支的 `releases.json`（內容已定，不再變）為來源同步，兩者各自開 PR，建議合併次序 aqutter → aqutter-cli。
- **跨 repo 檔案指涉**: 無。
- **後續（各自另案）**: `aqutter-nuxt-app` 前進鎖定、移除展示頁補的 CSS、推上 main、歸檔展示頁計畫。
- **契約**：正本 `aqutter`（`manifest/releases.json` schema 1），rev 1；快照須與它逐字相同。

## Key Decisions
- **[Phase 0]** 目標 repo：`aqutter`、`aqutter-cli`。依據：`manifest/releases.json` 的 `core.ref`（`d1c9062…`）與 `client.spec`（`#171a95a…`）落後於 `aqutter_core`／`aqutter-js` 的 `main`；CLI 快照為其副本。
- **[Milestone]** 兩個 repo 皆不指定，以 `main` 為 base（使用者核准）。
- **[範圍]** `shell.ref` 不變（本計畫不動 `shell/`，`docs/` 與 wiki 的修改不影響 `git log -1 -- shell`）。
- **[契約]** rev 1 凍結（核准日 2026-11-18）。
- **[完成後]** commit + 開 PR（push 前 fetch 並 rebase origin/main）— 使用者核准。
- **[執行模式]** 序列（單一 agent）：aqutter 先、aqutter-cli 後。

## Deviations
無偏離計畫。

## Impact Files
- `src/manifestSnapshot.json` — 由 `pnpm manifest:sync ../aqutter/manifest/releases.json` 重產，須與來源逐字相同。
- `dist/aqutter.mjs` — `pnpm build` 重打包（受版控）。
