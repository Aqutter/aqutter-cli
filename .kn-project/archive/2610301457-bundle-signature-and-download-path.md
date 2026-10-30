# 2610301457-bundle-signature-and-download-path

- Created: 2026-10-30 14:57 / Archived: 2026-10-30 15:25
- Issue: N/A（使用者決議不建 issue）
- Milestone: N/A / Base Branch: main

## Summary
CLI 新增 `aqutter bundle keygen` 與 `aqutter bundle sign`，讓開發者能產生網頁包簽署金鑰並對 `seed` 產出的 zip 簽章，供設了公鑰的 App 驗證。
目的：配合 `aqutter` 殼的網頁包簽章驗證，提供簽署端；影響 `aqutter-cli` 的指令、env 範本與 `dist/`。

## Cross-Repo Scope
- **共用計畫 ID**: `2610301457-bundle-signature-and-download-path`（無共用分支，直接 main）
- `aqutter` — 驗證端：下載檔名驗證、網頁包簽章驗證、文件與 wiki。契約正本 repo。
- `aqutter-cli` — 簽署端：`bundle keygen`／`bundle sign`、env 範本。
- 執行順序：契約凍結後兩邊平行；以共同的 RFC 8032 測試向量各自驗證，最後以 CLI 實際簽出的包交給殼驗證。

## 契約（只留引用）
`aqutter` repo 的 `docs/hot-update.md`「簽章」一節為正本；最終修訂號 rev 1（2026-10-30 凍結，之後無變更）。要點：Ed25519；簽章訊息 `aqutter-bundle-v1\n{version}\n{sha256 小寫}\n`；`version.json` 新增選填 `signature`；編譯期公鑰 `AQUTTER_UPDATE_PUBLIC_KEYS`（逗號分隔多把、網頁不可改）；設了公鑰才強制，缺任一項或驗證不過就拒絕並保留現行網頁包。

## Key Decisions
- **[範圍]** 本計畫只做簽署端；驗證端在 `aqutter` 的同名計畫 — 契約正本在 `aqutter`，兩邊各自完整。
- **[策略]** 設了公鑰才強制，未設維持現行（契約 §3、§4）。
- **[相依]** 只用 `node:crypto`（簽章）與既有的 `fflate`（讀 zip 內的版本），不新增 npm 套件。
- **[流程]** 直接 main、不建 issue；契約 rev 1 凍結；完成後只 commit，push 與 tag 依使用者要求。
- **[執行中]** `--key` 與 `--out` 兩種寫法（`--key=x`、`--key x`）都收，用本檔自己的小解析器，不改共用的 `parseArgs`（它不認長旗標的空白值寫法）。
- **[執行中]** `keygen`／`sign` 不需要專案設定檔，放在 `loadProject` 之前分派（如 `init`、`plugin`）。

## Deviations
- 整合驗證做了：用建置後的 `dist` 實際簽出的包，交給殼的 Dart 驗證通過；竄改一個位元組、改版本號皆被拒。實機（Android）驗證在 `aqutter` 計畫的 Deviations。
- `aqutter-nuxt-app` 鎖定的 CLI 版本尚未更新，沒有 `bundle` 指令；驗證時直接用此 repo 建置的 `dist`。

## Impact Files
- `src/commands/bundle.ts`（new）— `keygen`、`sign`、簽章訊息與金鑰處理
- `src/main.ts` — `bundle` 分派（`loadProject` 之前）與 `HELP`
- `template/env/.env.example` — 新增 `AQUTTER_UPDATE_PUBLIC_KEYS`（與 `aqutter` 的 `docs/env.example` 逐字相同）
- `test/bundle.test.ts`（new）— 共同測試向量、keygen 不覆蓋、sign 版本取自 zip
- `dist/aqutter.mjs` — 重新建置
- `README.md`、`.kn-project/project.md`、`.kn-project/wiki/platform/architecture.md` — 指令清單補上網頁包簽章

## Wiki Changes

| 頁面 | 日期 | 版本 | 變動 | Issue | PR |
|---|---|---|---|---|---|
| `platform/architecture.md` | 2026-10-30 | — | CLI 新增 bundle keygen 與 sign 供網頁包簽章 | — | — |
