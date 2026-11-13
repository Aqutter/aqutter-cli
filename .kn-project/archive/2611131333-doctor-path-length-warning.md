# 2611131333 - doctor-path-length-warning

- Created: 2026-11-13 13:33 / Archived: 2026-11-13 14:10
- Issue: Aqutter/aqutter-cli#20
- Milestone: N/A / Base Branch: main

## Summary
`aqutter doctor` 在 Windows 上，App 目錄（appDir）絕對路徑超過 100 字元時會給警告（非錯誤，結束碼不變）。
起因是實測 123 字元的 appDir 讓 `flutter build windows` 在約 40 分鐘後失敗，同專案搬到 18 字元路徑就成功；本機已開 LongPathsEnabled 仍失敗。根因（MAX_PATH 260）是推論、未做單變因驗證，警告文字因此用「可能」。影響 `doctor` 指令與其單元測試。

## Cross-Repo Scope
無（單一 repo）。

## Key Decisions
- **[Phase 0]** Milestone 不指定，PR 併回 main — 理由：AGENTS.md 寫明開發階段直接推 main、版本一律 0.0.0。
- **[Q1]** 閾值 100 字元（> 100 警告）— 理由：使用者選定，貼近理論邊界 98（260 − 最深 162）；已知可能漏報極長 plugin 名稱。
- **[Q2]** 只檢查 appDir — 理由：建置產物都在其下，是使用者唯一能搬動的變數。
- **[執行中]** `dist/aqutter.mjs` 補入 Impact Files 並重建 — 理由：repo 規定 dist 與 src 同步提交；經使用者重新核准。
- **[Phase 0]** 先前所稱「`aqutter build` exit code 0」經驗證為管線吃掉 exit code 的誤判，不屬本計畫。

## Deviations
- 初版計畫漏列 `dist/aqutter.mjs`，執行中補列並重新核准。
- `goodFacts` 未修改：新欄位為選填，既有案例不受影響。
- 文件：本 repo 無列出 doctor 檢查項目的文件，未改；`aqutter` repo 的 `docs/cli.md` 留待人工同步。
- 驗證：實跑 doctor 於 18 字元路徑（ok）與 111 字元路徑（警告）；**未**在 123 字元實際目錄重跑，也未實驗證明 MAX_PATH 為唯一原因。

## Impact Files
- `src/commands/doctor.ts:80` (`Facts`) — 新增 `appDirPath`、`platform`，並匯出 `WINDOWS_APP_DIR_MAX_LENGTH`
- `src/commands/doctor.ts:99` (`diagnose`) — 新增 5b 路徑長度檢查
- `src/commands/doctor.ts:294` (`gatherFacts`) — 填入兩個新欄位
- `test/versioning.test.ts:297` (`describe('diagnose')`) — 新增 5 個案例
- `dist/aqutter.mjs` — 重新 `pnpm build` 的產物
- `.kn-project/wiki/platform/manifest.md:34` — 來源行錨點 doctor.ts 隨檔頭多一行位移 L50-L65 → L51-L66

## Wiki Changes

## Wiki Changes

| 頁面 | 日期 | 版本 | 變動 | Issue | PR |
|---|---|---|---|---|---|
| `platform/manifest.md` | 2026-11-13 | — | doctor 新增 Windows 路徑長度警告，來源錨點隨之位移 | [#20](https://github.com/Aqutter/aqutter-cli/issues/20) | [PR #21](https://github.com/Aqutter/aqutter-cli/pull/21) |
