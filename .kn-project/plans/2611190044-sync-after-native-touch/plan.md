<!-- REMINDER: Relative Paths Only! No file:///c:/... -->
# Plan: 2611190044 - sync-after-native-touch
- Created: 2026-11-19
- Branch: feature/2611190044-sync-after-native-touch
- Issue: Aqutter/aqutter-cli#48
- Milestone: N/A（未指定）
- Base Branch: main
- Status: In Progress
- Completed: [Wait for Finish]

## Goals
以 `pnpm manifest:sync` 把內建快照 `src/manifestSnapshot.json` 更新為與 `aqutter` 的 `releases.json` 逐字相同，並重建受版控的 `dist/aqutter.mjs`。

## Architecture
- 以 `aqutter` 工作分支的 `manifest/releases.json` 為來源，跑 `pnpm manifest:sync`，再跑測試與 typecheck。
- 實作遵守 `kn-project-code-style`。

## Cross-Repo Scope
- **本計畫所屬 repo**: `aqutter-cli`
- **參與 repo 與職責**: `aqutter`（契約正本，manifest 與文件）、`aqutter-cli`（本 repo，快照）、`aqutter-nuxt-app`（鎖定前進）。
- **共用計畫 ID**: `2611190044-sync-after-native-touch`　**共用分支名**: `feature/2611190044-sync-after-native-touch`（`aqutter-nuxt-app` 不開分支，見其計畫）
- **執行順序相依**: 上游 tag 先移動（`aqutter_core`、`aqutter-js` 的 `0.0.0` → 各自 main）→ `aqutter`（manifest、文件）合併 → `aqutter` 的 `0.0.0` tag 移動 → `aqutter-cli` 快照合併 → `aqutter-cli` 的 `0.0.0` tag 移動 → `aqutter-nuxt-app` 鎖定前進。
- **合併後的連動**: 合併後移動 `aqutter-cli` 的 `0.0.0` tag。

## Contract / 介面契約
- **契約正本 repo**: `aqutter`（`manifest/releases.json`，schema 1）　**修訂號**: `rev 1`　**狀態**: `草擬`
- 沒有 HTTP 端點。介面是 manifest 檔本身：`aqutter-cli` 的 `src/manifestSnapshot.json` 必須與 `aqutter/manifest/releases.json` 逐字相同（由 `pnpm manifest:sync` 產生）。
- 欄位與限制：`shell.ref` 必須等於 `git log -1 -- shell` 的 commit（CI manifest-check 檢查）；`core.ref`、`client.spec` 的 commit 必須存在於各自 repo；`flutter.baseline`、`dart` 不變；`generatedAt` 為更新時間（UTC，ISO 8601）。
- 本次新值：`shell.ref` = `e39621f6692c8b56e1102618ddebd6f5379dbfba`、`core.ref` = `671bef98208069983843c2f9517b8e3098b9b4cc`、`client.spec` = `github:Aqutter/aqutter-js#a4ad50629db4ae1eaa42f6c5862ae827d2919477`。
- 相容性：只改三個 ref 與 `generatedAt`，不改 schema 與其他欄位。

### 6. 變更紀錄
- _(尚無)_

## Impact Files
- `src/manifestSnapshot.json` — 由 `pnpm manifest:sync` 產生
- `dist/aqutter.mjs` — 重新打包
- `.kn-project/archive/2611190044-sync-after-native-touch.md` (new) — 歸檔

## App-Flow Screens
（無 `.kn-project/app-flow.json`，不適用。）

## Open Questions / 待確認事項
無。

## Manual Follow-ups / 人工收尾事項
無。

## Key Decisions
- **[Phase 0]** 目標 repo 含 `aqutter-cli`：快照是 `releases.json` 的副本。
- **[Milestone]** 不指定，base `main`。
- **[完成後]** commit + 開 PR（base main）；合併後移動 `0.0.0` tag（使用者要求）。

## Git Completion Policy
- PR 一律以 `--base main`；每個 commit 與 PR body 含 `Closes #<issue>`；歸檔後在 issue 張貼結案留言。

## References
- `.kn-project/archive/2611182330-resync-manifest-windows-passthrough.md`（前一次同樣流程）
