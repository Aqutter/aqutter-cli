# 2611161111 - resync-manifest-core

- Created: 2026-11-16 11:11 / Archived: 2026-11-16 11:50
- Issue: Aqutter/aqutter-cli#38
- Milestone: N/A / Base Branch: main

## Summary
CLI 內建快照同步成 aqutter 新的 manifest（`core.ref` → `522669e`，逐字一致）並重打包 dist/。

驗證：`pnpm typecheck` 通過、`pnpm test` 225 項通過、快照與 aqutter 的 `releases.json` 以 `cmp` 逐字一致。

## Cross-Repo Scope
參與：aqutter（manifest，契約提供方，issue aqutter#65、PR aqutter#66）、aqutter-cli（快照，消費方）。共用 ID `2611161111-resync-manifest-core`、共用分支 `feature/2611161111-resync-manifest-core`。順序：aqutter 先合併，aqutter-cli 後合併。契約 rev 1，無變更。

## Key Decisions
- **[Phase 0]** 目標 repo `aqutter` 與 `aqutter-cli`；起因：`aqutter-nuxt-app` 鎖到 `522669e` 後 doctor 警告「框架記載 6aa0947」，快照來源 `src/manifestSnapshot.json:21`。
- **[Phase 0]** Milestone：不指定（使用者回答）；Base Branch = `main`。
- **[範圍]** 只由 `pnpm manifest:sync` 覆寫快照，不手改；`dist/` 由 `pnpm build` 重產。
- **[契約]** rev 1 凍結；**[順序]** aqutter 先、aqutter-cli 後；**[完成後]** commit + 開 PR。
- **[依據]** 同步來源是 aqutter 工作分支的 `releases.json`（PR #66 尚未合併，內容不會再變）。
- **[未驗證]** 全新專案的 doctor 端到端（需合併後）；tag `0.0.0` 的移動待使用者明說。

## Deviations
無。

## Impact Files
- `src/manifestSnapshot.json:3,21` — 由 `pnpm manifest:sync` 覆寫
- `dist/aqutter.mjs` — 由 `pnpm build` 重新產生（內嵌快照）
