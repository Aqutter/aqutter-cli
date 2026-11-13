<!-- REMINDER: Relative Paths Only! No file:///c:/... -->
# Plan: 2611131548 - doctor-accept-framework-tag
- Created: 2026-11-13
- Branch: feature/2611131548-doctor-accept-framework-tag
- Issue: Aqutter/aqutter-cli#22
- Milestone: N/A（未指定）
- Base Branch: main
- Status: Awaiting Archive
- Completed: [Wait for Finish]

## Goals
照 README 以 `#0.0.0`（框架版本 tag）安裝的專案，`aqutter doctor` 目前一定有警告，且執行 `aqutter upgrade` 後換成另一個警告：
1. `@aqutter/aqutter 與框架版本 0.0.0 不一致：github:Aqutter/aqutter-js#0.0.0`（manifest 記的是 sha，專案寫的是 tag，字串必然不同）。
2. `aqutter 的 lock 與框架版本 0.0.0 不一致：鎖在 90c107b，框架記載 8207b10`（殼的 ref 用 tag 時，lock 記的是 tag 解析出的提交；tag 隨 main 移動，不可能等於「shell/ 最後變更的提交」）。

開發階段本來就允許殼 ref 寫框架版本 tag（`src/commands/doctor.ts:179`）。讓 doctor 對 client 依賴與殼 lock 也採同一個原則，不再對這兩種正常狀態發警告。

## Architecture
- `src/commands/doctor.ts` 檢查 4（npm 依賴）：`@aqutter/aqutter` 的字串等於 `expected.clientSpec`，或等於 `github:Aqutter/aqutter-js#${expected.version}`（框架版本 tag）時視為一致。
- `src/commands/doctor.ts` 檢查 5（lock）：殼的 pubspec ref 等於框架版本 tag 時，不比對殼的 lock 與 manifest sha（tag 會移動，比對無意義），改報 `ok`，並標明鎖在哪個提交。其餘情況（殼 ref 是 sha、或 aqutter_core）維持原比對。
- 不改 `aqutter upgrade`、`init`、manifest。`aqutter_core` 的 lock 檢查不變。
- 因為 `dist/aqutter.mjs` 是 tracked 建置產物，`src/` 有變更就要 `pnpm build` 並一併 commit。

## Cross-Repo Scope
無（單一 repo）。`aqutter` repo 的 `docs/cli.md` doctor 檢查表若需同步，另開計畫（見 Manual Follow-ups）。

## Contract / 介面契約
無（單一 repo）。doctor 的輸出文字與等級是既有行為，新增的只是少發兩種警告。

## Impact Files
- `src/commands/doctor.ts:224` (檢查 4，`clientSpec.spec === expected.clientSpec`) — 加入框架 tag 形式視為一致
- `src/commands/doctor.ts:238-260` (檢查 5，lock 比對迴圈) — 殼 ref 為框架 tag 時略過殼的 sha 比對
- `src/commands/doctor.ts:179` — 既有的「開發階段允許 tag」註解，新邏輯沿用同一原則（可能補一句註解）
- `test/versioning.test.ts:413` (`warns when a lock entry differs…` 附近) — 新增案例：client 用 tag 為一致；殼 ref 為 tag 時 lock 不比對；殼 ref 為 sha 時仍比對
- `dist/aqutter.mjs` — 重建（tracked 建置產物）
- `.kn-project/wiki/platform/manifest.md:34` — 若 `doctor.ts` 行號錨點位移則更新，並補一句 doctor 的規則（Phase 5 wikification 處理）

證據：警告的來源是 `doctor.ts:225-235` 與 `doctor.ts:249-257`；既有測試只覆蓋 lock 比對的 sha 情況（`test/versioning.test.ts:413-431`）；實測輸出取自 `C:\aqt\web2`。

## Open Questions / 待確認事項
> 無。milestone 與範圍已於對話中確認，見 Key Decisions。

## Manual Follow-ups / 人工收尾事項
- **[合併後]** 移動 `aqutter-cli` 的 `0.0.0` tag 到合併後的 main — 對我說「移動 tag」 — 移動遠端 tag 屬對外覆寫，由你下令才做
- **[合併後]** 在全新專案重跑 `pnpm add -D github:Aqutter/aqutter-cli#0.0.0` 後 `aqutter doctor`，確認 `#0.0.0` 安裝不再有這兩個警告 — 例如 `C:\aqt\web2` — 要等 tag 移動後才有意義
- **[合併後]** 視需要為 `aqutter` 的 `docs/cli.md` 開同步計畫 — 對我說「同步 docs」— 文件在另一個 repo，依治理規則另開計畫

## Key Decisions
- **[Milestone]** 不指定，base 為 `main` — 理由：開發階段版本一律 `0.0.0`；來源：Phase 0 詢問
- **[範圍]** client 依賴與殼 lock 兩個警告一起修 — 理由：同一個根因（tag 隨 main 移動，與 sha 比對不相容）；來源：Phase 0 提問
- **[完成後]** commit + 開 PR（預設）；歷史改寫（rebase、force-with-lease）已揭露

## Git Completion Policy
- PR 一律以 `--base main` 顯式指定 base (Rule 23)。
- 每個 commit 訊息與 PR body 都含 `Closes #${N}`（`${N}` 取自上方 `- Issue:`）。歸檔後於該 issue 張貼結案留言 (Rule 20)。
- Issue 的關閉發生在合併後清理 (Rule 21)。
- commit 一律自動（Rule 17）；完成時 `git fetch` 後 `git rebase origin/main` 並 `git push --force-with-lease --force-if-includes`。
- PR/archive order: Archive automatically triggered on PR request

## References
- `aqutter doctor` 實測輸出（`C:\aqt\web2`，tag 移到 `90c107b` 之後）
- Aqutter/aqutter#49、PR #50（manifest 同步；顯示光同步 manifest 無法消除這兩個警告）
