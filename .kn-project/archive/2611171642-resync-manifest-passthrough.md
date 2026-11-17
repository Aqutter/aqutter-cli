# 2611171642-resync-manifest-passthrough

- Created: 2026-11-17 / Archived: 2026-11-17
- Issue: Aqutter/aqutter-cli#40
- Milestone: N/A / Base Branch: main

## Summary
以 `pnpm manifest:sync` 把 `src/manifestSnapshot.json` 更新為與 aqutter 的 `releases.json` 逐字相同，並重建受版控的 `dist/aqutter.mjs`；225 個測試與 typecheck 通過。

## Cross-Repo Scope
- **本計畫所屬 repo**: `aqutter-cli`
- **共用計畫 ID**: `2611171642-resync-manifest-passthrough`　**共用分支名**: `feature/2611171642-resync-manifest-passthrough`
- **參與 repo 與職責**:
  - `aqutter` — 更新 `manifest/releases.json` 的三個 ref 與 `generatedAt`（契約正本）　issue: `Aqutter/aqutter#70`
  - `aqutter-cli` — 以 `pnpm manifest:sync` 同步內建快照並重打包 `dist/`　issue: `Aqutter/aqutter-cli#40`
- **執行順序相依**: `aqutter` 先；`aqutter-cli` 以 aqutter 工作分支的 `releases.json`（內容已定，不再變）為來源同步，兩者各自開 PR，建議合併次序 aqutter → aqutter-cli。
- **跨 repo 檔案指涉**: 無。
- **契約**：正本 `aqutter`（`manifest/releases.json` schema 1），rev 1；快照須與它逐字相同。

## Key Decisions
- **[Phase 0]** 目標 repo：`aqutter`、`aqutter-cli`（見 aqutter 那份計畫）。
- **[Milestone]** 不指定，以 `main` 為 base（使用者於 Phase 0 選擇）。
- **[範圍]** 只由 `pnpm manifest:sync` 覆寫快照，`dist/` 由 `pnpm build` 重產。
- **[契約]** rev 1 凍結（核准日 2026-11-17）。
- **[完成後]** commit + 開 PR（Rule 12 非互動鏈；完成前自動 fetch 後 rebase origin/main 並 push --force-with-lease --force-if-includes）。
- **[執行模式]** 序列（單一 agent）：aqutter 先、aqutter-cli 後。

## Deviations
無偏離計畫。

## Impact Files
- `src/manifestSnapshot.json:3,17,21,24` — 由 `pnpm manifest:sync` 覆寫（`generatedAt`、`shell.ref`、`core.ref`、`client.spec`）。
- `dist/aqutter.mjs` — 由 `pnpm build` 重新產生（內嵌快照）。
