# Tasks for 2611021026

## Phase 1 — 產生規則
- [x] [aqutter-cli] `pluginFileName`／`pluginFactoryName`／`renderPluginFile`（Contract §3）　可平行（對 aqutter）
- [x] [aqutter-cli] `renderPluginsDart` 新形態與 import
- [x] [aqutter-cli] `scaffoldPluginFiles`：只建立缺少的、缺函式報錯且不寫入任何檔案
- [x] [aqutter-cli] `syncPlugins` 串起檢查、建立、重寫

## Phase 2 — 指令與範本
- [x] [aqutter-cli] `plugin add`／`sync`／`remove`（預設保留、`--purge` 刪除）
- [x] [aqutter-cli] 範本 `aqutter_plugins.dart` 新形態

## Phase 3 — 驗證
- [x] [aqutter-cli] 測試（轉換規則、預設內容、不覆蓋、缺函式、remove／purge、空清單、舊形態升級）、型別檢查
- [x] [aqutter-cli] 重建 `dist/`
- [ ] [aqutter-cli] 產生的檔案可被新殼編譯　需等待 [aqutter]：`plugin_entry.dart` 完成
