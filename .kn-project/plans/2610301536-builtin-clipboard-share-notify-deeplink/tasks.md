# Tasks for 2610301536

## Phase 1 — 範本
- [x] [aqutter-cli] 確認範本檔案位置、版本與是否內嵌於 dist　可平行（對 aqutter）
- [x] [aqutter-cli] Android：啟用核心函式庫去糖並加入相依
- [x] [aqutter-cli] iOS：通知代理

## Phase 2 — 驗證
- [x] [aqutter-cli] 以範本產生的 App 能通過 `flutter analyze` 與 Android 建置（Phase 3 確認可行的驗證方式）
- [x] [aqutter-cli] 重建 `dist/`；既有測試與型別檢查通過

## Phase 3 — Iteration 1：還原範本
- [x] [aqutter-cli] 還原去糖與通知代理兩項範本設定，重建 `dist/`（若內嵌）
