# 2611021026 - plugin-factories-and-per-plugin-files

- Created: 2026-11-02 10:26 / Archived: 2026-11-02
- Issue: N/A（使用者決議不建 issue）
- Milestone: N/A / Base Branch: main

## Summary
`aqutter plugin add/sync` 改成產生新的 plugin 註冊形態：總清單由 CLI 每次重寫，每個 plugin 一個「只建立一次、永不覆蓋」的使用者檔案，客製寫在那個檔案裡。
目的是配合殼新增的 plugin 工廠（可帶參數、可非同步、能取得啟動 context），讓使用者不必再用濾掉再取代的寫法客製 plugin，也不會被 CLI 蓋掉；`main.dart` 不用改。影響 `aqutter-cli` 的 plugin 指令、範本與 `dist/`。

## Cross-Repo Scope
- **共用計畫 ID**: `2611021026-plugin-factories-and-per-plugin-files`；無共用分支，各 repo 直接 `main`。
- `aqutter` — 殼的介面、解析、文件、wiki（契約正本）。
- `aqutter-cli` — 產生總清單與每個 plugin 的使用者檔案（本 repo）。
- `aqutter-nuxt-app` — 範例 App 遷移與驗證。
- 順序：殼先於 CLI 發佈；新 CLI 產生的檔案需要新殼才能編譯，舊殼會編譯失敗。

## 契約（只留引用）
契約正本在 `aqutter` repo 的 `docs/plugins.md`，最終修訂號 rev 1（2026-11-02 凍結，無變更）。本 repo 負責的產生物：
- 總清單 `lib/aqutter_plugins.dart`：`List<AqutterPluginEntry>`，每個 plugin 一行 `AqutterPluginBuilder('<id>', build<Class>)`，變數名 `aqutterPlugins` 不變。
- 使用者檔案 `lib/plugins/<id 轉底線>_plugin.dart`：函式 `FutureOr<AqutterPlugin> build<Class>(AqutterBootContext context)`；只在不存在時建立；已存在但缺預期函式就報錯且不寫入任何檔案。
- `plugin remove <id>` 預設保留使用者檔案並印出路徑，`--purge` 才刪；`plugin sync` 補建缺少的檔案、不覆蓋既有。

## Key Decisions
- **[相容]** 清單變數名不變、型別放寬，既有 App 的 `main.dart` 不用改（使用者選擇）。
- **[流程]** 直接 main、不建 issue（使用者選擇）。
- **[使用者檔案]** 每個 plugin 一個檔案，CLI 只建立不覆蓋；`remove` 預設保留、`--purge` 才刪 — 裡面是使用者的設定，誤刪的代價高於留下一個檔案。
- **[函式與檔名]** 檔名由 plugin id 推導（連字號轉底線），函式名由 `aqutter-plugin.json` 的 `dart.class` 推導；兩者來源不同（例如 id `sqlite` 的檔案是 `sqlite_plugin.dart`、函式是 `buildSqliteDriftPlugin`）。
- **[先檢查再寫]** `syncPlugins` 先檢查所有既有使用者檔案，再建立缺少的，最後重寫總清單與 pubspec 區塊，避免寫到一半失敗。

## Deviations
- 無契約變更。
- 「產生的檔案可被新殼編譯」這項在實作當下無法驗證，之後由 `aqutter` 的計畫整合驗證：用新 CLI 在範例 App 產生五個 plugin 的檔案，以本機的新殼 `flutter analyze` 乾淨，並完成 Android 建置與實機啟動，五個 plugin 都能運作。

## Impact Files
- `src/plugins.ts:15`（`PLUGINS_DART_FILE`）、`:61`（`renderPluginsDart`）、`:99`（`syncPlugins`）— 新形態、檔名與函式名轉換、預設內容、`scaffoldPluginFiles`
- `src/commands/plugin.ts`（`add`、`remove`、`sync`）— 呼叫新流程、`--purge`
- `template/app/lib/aqutter_plugins.dart` — 新形態的空清單
- `test/plugins.test.ts` — 轉換規則、預設內容、不覆蓋、缺函式、remove／purge、空清單、舊形態升級
- `dist/aqutter.mjs` — 重新建置
