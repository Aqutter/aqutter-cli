# 2611031330 - plugin-requires-and-internal-call

- Created: 2026-11-03 13:30 / Archived: 2026-11-03
- Issue: N/A（本專案開發階段不建 issue）
- Milestone: N/A / Base Branch: main

## Summary
`aqutter-plugin.json` 新增選填的 `requires`（npm 套件名 → `^`、`~` 或精確版本）。`aqutter plugin add A` 會依 A 的 `package.json` `dependencies` 連帶安裝並登記 B 並檢查版本；`plugin remove B` 在仍被需要時拒絕（`--force` 例外）；`aqutter doctor` 把未滿足的 `requires` 列為錯誤。

## Cross-Repo Scope
- 共用計畫 ID `2611031330-plugin-requires-and-internal-call`；各 repo 直接 `main`，兩者彼此獨立。
- `aqutter`（殼與文件，契約正本）、`aqutter-cli`（`requires` 的解析、連帶登記、版本檢查、`doctor`）。
- 收尾：`aqutter-plugins` 的 `location` 測試 fake 補 `callPlugin`（另 repo，未另開計畫，依使用者指示直接修）。

## Key Decisions
- **[隱藏 B]** Dart 端 A 呼叫 B，B 標 `internal` — A 的網頁端程式碼也經同一條 bridge 呼叫 B，在 bridge 層擋會連 A 一起擋掉。
- **[requires]** 套件名加 semver 範圍 — 一個 App 每個 plugin 只能有一個版本，需要範圍才能檢查相容。
- **[來源]** 連帶安裝取 A 的 `package.json` `dependencies[B]`，B 成為 App 直接依賴 — pnpm 不提升間接依賴，pubspec 用 `node_modules/<套件名>` 路徑。
- **[semver]** 自寫最小解析（`^`、`~`、精確版本），重用 `versioning.ts` 的 `satisfies` — 使用者選擇，不增加依賴。
- **[循環]** 不防護，文件禁止 — 開發階段無實例。
- **[宣告位置]** `internal` 只由 Dart 的 `AqutterPlugin.internal` 宣告，不放進描述檔 — CLI 不需要，單一來源。
- **[對齊]** shell `0.0.0` tag 移到功能提交 `b5f60fd`（與 manifest 記載一致）；`aqutter-cli` 的 tag 移到 `main` 最新。

## Deviations
- 無契約偏離。
- 驗證：`pnpm typecheck`、216 個測試全過；臨時專案實測連帶安裝、`remove` 拒絕、版本衝突時 `add` 失敗、`doctor` 報錯皆符合預期。
- 已知行為：版本衝突使 `add` 失敗時，A 不登記，但已一併裝好的 B 會保留（錯誤訊息有提示，用 `plugin remove` 還原）。
- 未驗證：沒有用真實的官方 plugin（含 pnpm 的 `github:...#path:` 來源）跑過連帶安裝。

## Impact Files
- `src/semverRange.ts` (new) — 最小 semver 範圍
- `src/config.ts`、`src/plugins.ts` — `requires` 型別、解析、`findRequireProblems`、`readInstalledVersion`
- `src/commands/plugin.ts` — `add` 連帶安裝、`remove` 拒絕
- `src/commands/doctor.ts` — `requires` 檢查
- `test/plugins.test.ts`、`test/versioning.test.ts` — 測試
- `src/manifestSnapshot.json`、`dist/aqutter.mjs` — 重新產生
