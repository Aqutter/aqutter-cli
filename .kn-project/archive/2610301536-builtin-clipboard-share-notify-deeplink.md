# 2610301536 - builtin-clipboard-share-notify-deeplink

- Created: 2026-10-30 15:36 / Archived: 2026-10-31
- Issue: N/A（使用者決議不建 issue）
- Milestone: N/A / Base Branch: main

## Summary
本計畫最終沒有改變範本：為本機通知先加入的 Android 核心函式庫去糖與 iOS 通知代理設定，在 Iteration 1 全數還原，本機通知改由 `aqutter` 殼自己實作，`aqutter-cli` 的範本不需任何配合。
原本目的是讓新 App 範本具備殼內建本機通知所需的原生設定；殼改為自行持有接收器與通知代理後，這兩項設定成為多餘，為避免之後的人誤以為範本需要它們而以新 commit 還原。最終影響僅有一組「加入再還原」的 commit，`template/` 與 `dist/` 淨差異為空。

## Cross-Repo Scope
- 共用計畫 ID `2610301536-builtin-clipboard-share-notify-deeplink`，無共用分支（各 repo 直接 main）。
- `aqutter` — 殼端實作與契約正本（剪貼簿、分享、本機通知、深層連結）。
- `aqutter-js` — 契約型別與名稱。
- `aqutter-cli` — 範本設定（本 repo；最終無淨變更）。
- 執行順序：三者平行；原定範本完成後 `aqutter-nuxt-app` 才能套用，Iteration 1 後不再需要。

## 契約（只留引用）
`aqutter` repo 的 `docs/native-features.md` 為正本；最終修訂號 rev 3（2026-10-30 凍結）。涵蓋 `clipboard_read`／`clipboard_write`／`clipboard_read_image`／`clipboard_write_image`、`share_open`、`notify_show`／`notify_schedule`／`notify_cancel`／`notify_initial`、`deeplink_initial` 與事件 `notify_tapped`／`deep_link`。rev 2 加入分享檔案與圖片剪貼簿，rev 3 補 Android 重開機後重排通知；兩次對 `aqutter-cli` 皆無範本變更。

## Key Decisions
- **[範圍]** 剪貼簿、分享、本機通知、深層連結；推播、生物辨識、安全儲存、分享檔案不做 — 先做不需要外部服務的常用能力（使用者決議）。
- **[位置]** 內建在殼的 bridge，不做成 plugin — 使用者決議；代價是每個 App 都帶這些依賴，殼變大。
- **[分享範圍]** rev 1 只分享文字與網址，不含檔案 — 檔案牽涉暫存與檔案權限，另案（rev 2 後來加入）。
- **[排程]** 非精確排程、以絕對時間點 — 避免精確鬧鐘權限與時區相依；需要準時另案。
- **[權限]** 通知 handler 不自動跳授權 — 權限一律經殼既有的權限 handler，行為一致。
- **[啟動連結]** 啟動 App 的連結只由 `deeplink_initial` 取得，不走事件 — 事件在網頁未連線時會被丟棄，冷啟必須有可重複讀取的來源。
- **[流程]** 直接 main、不建 issue；契約 rev 1 凍結（2026-10-30 核准）。
- **[完成後]** 預設只 commit，push 與移動 tag 依使用者之後的明確要求。
- **[契約]** rev 2 凍結：分享檔案、圖片剪貼簿、錯誤碼 `too_large`。
- **[套件]** 圖片剪貼簿由框架自己實作、不引入外部套件（使用者決議）；含 Android、iOS、macOS、Windows，Linux 不做；iOS、macOS 沒有裝置可編譯驗證（使用者已知並同意）。
- **[還原]** 以新的 commit 還原兩項範本變更，不改寫歷史 — 避免之後的人以為範本需要這兩項（Iteration 1）。

## Deviations
- **中途先加後還原（Iteration 1）**：原計畫在範本啟用 Android 核心函式庫去糖並設定 iOS 通知代理（commit `7ceacc4`）；之後 `aqutter` 的同名計畫決定本機通知由框架自己實作（契約 rev 3 不變動 handler），故以 commit `3e7dc7a` 還原該兩個檔案。最終結果是範本設定被還原，本機通知改由殼自行實作。
- `dist/` 未重建：兩個 commit 的淨差異為空，範本與 `dist/` 保持一致。
- 原定的範本測試補斷言與 `dist/` 同步因還原而無實質變更。

## Impact Files
- `template/app/android/app/build.gradle.kts:17` — 先加入 `isCoreLibraryDesugaringEnabled` 與 `coreLibraryDesugaring` 相依，Iteration 1 還原；淨變更為無。
- `template/app/ios/Runner/AppDelegate.swift:9` — 先加入 `UserNotifications` 匯入與通知代理設定，Iteration 1 還原；淨變更為無。
