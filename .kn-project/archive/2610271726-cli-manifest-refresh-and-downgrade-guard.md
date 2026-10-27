# 2610271726 - cli-manifest-refresh-and-downgrade-guard

- Created: 2026-10-27 17:26 / Archived: 2026-10-27 19:00
- Issue: Aqutter/aqutter-cli#16
- Milestone: N/A / Base Branch: main

## Summary
CLI 新增 `--refresh`（`init`、`plugin create`、`doctor`、`upgrade`）：略過 24 小時快取有效期強制連網，與 `--offline` 互斥；清單來自快取時，輸出標出它多舊並提示 `--refresh`；`upgrade` 偵測到目標比現況舊（`environment.flutter` 或 `environment.sdk` 的下限、`.fvmrc` 的 `flutter` 變低）時預設拒絕（不寫檔、不跑 pub、exit 1），`--allow-downgrade` 才放行。事故重現：用舊快取執行 `upgrade` 現在被擋下。

## Cross-Repo Scope
- 共用計畫 ID `2610271726-cli-manifest-refresh-and-downgrade-guard`、共用分支名 `feature/2610271726-cli-manifest-refresh-and-downgrade-guard`。
- `Aqutter/aqutter-cli`（契約正本）：`--refresh`、快取年齡顯示、`upgrade` 降級保護。
- `Aqutter/aqutter`：只改 `docs/cli.md`。
- 順序：`aqutter-cli` 先，文件在其後。

## Key Decisions
- **[Phase 0]** 整合主幹 `main`；兩個 repo milestone 皆不指定，base 為 `main`。
- **[原因]** 範本專案的 `aqutter upgrade` 用了前一天的本機快取（24 小時內視為有效），無聲降級（Flutter 3.47.8 → 3.47.4、client 退回舊版）。
- **[Q1]** 降級預設拒絕，`--allow-downgrade` 才放行（不只警告）。
- **[範圍]** 快取有效期維持 24 小時，不縮短；只新增 `--refresh`、輸出顯示快取年齡、降級保護。
- **[契約]** rev 1 凍結（2026-10-27）。
- **[完成後]** commit + 開 PR（併回 `main`）。

## Deviations
- 無契約變更。
- 實作時修正輸出文字：快取年齡不足 1 分鐘時顯示「不到 1 分鐘前取得」（契約寫成「約 N 分鐘／小時前」，不足 1 分鐘的措辭在實作時補齊，沒有改變行為）。

## Impact Files
- `src/manifest.ts`（`LoadOptions.refresh`、`LoadedManifest.ageMs`、`loadManifest`、`formatAge`、`describeSource`、`parseManifestFlags`、`readManifestFlags`、`loadConfiguredManifest`）— 強制連網、快取年齡、旗標互斥。
- `src/versioning.ts`（`Downgrade`、`detectDowngrades`）— 降級偵測。
- `src/commands/doctor.ts`、`src/commands/upgrade.ts`、`src/commands/init.ts`、`src/commands/plugin.ts`、`src/main.ts` — 讀旗標、輸出、說明；`upgrade` 在寫檔前拒絕降級。
- `test/manifest.test.ts`、`test/versioning.test.ts` — 新增 16 個測試（共 174 個）。
- `dist/aqutter.mjs` — 重新產生。
- `.kn-project/project.md` — 保留鐵則補「manifest 快取與降級保護」。

## Details
- 驗證：`tsc` 乾淨、`vitest` 174 個全過；用範本專案實測：舊快取下 `upgrade` 被拒絕（exit 1）、`--refresh` 後正常、`--allow-downgrade` 放行並警告、`--offline --refresh` 報錯、`doctor` 顯示快取年齡。
