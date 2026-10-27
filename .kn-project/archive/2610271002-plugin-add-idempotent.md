# 2610271002-plugin-add-idempotent

- Created: 2026-10-27 10:02 / Archived: 2026-10-27 11:00
- Issue: Aqutter/aqutter-cli#9
- Milestone: N/A / Base Branch: main

## Summary
`aqutter plugin add` 在 Windows 用 `pnpm exec aqutter plugin add file:…` 執行時誤報「無法判斷安裝的 npm 套件名」，現在可重複執行：來源與既有依賴完全相同且套件已在 `node_modules` 時直接視為已安裝、不再呼叫套件管理器；判斷套件名時涵蓋「同名依賴被換成別的來源」與「重複執行同一個指令」。

## Key Decisions
- **[根因]** 不是 `file:` 路徑格式的問題（乾淨專案下正常）。`pnpm exec aqutter` 經 `node_modules/.bin/aqutter.CMD` 啟動 CLI，CLI 執行 `pnpm add` 時 pnpm 會重寫這個批次檔；cmd.exe 邊讀邊執行的檔案被換掉，就把尾端的 `node …aqutter.mjs %*` 再執行一次（log 有 cmd 的亂碼錯誤 `'THEXT:'`；以追蹤 pid／ppid 證實是同一個父行程、相隔 8 秒啟動兩個 CLI 行程，第二個的路徑指向重寫後的 `.pnpm/…`）。第二次執行時依賴已在 package.json，舊邏輯（只看「安裝後新增的依賴」）找不到而誤報。
- **[修法]** CLI 無法阻止批次檔被重寫，所以讓它經得起重複執行並減少觸發：(1) `pickInstalledName`：新增的依賴 → 來源被換掉的同名依賴 → 來源即套件名 → 來源與某依賴的來源相同；(2) 來源已安裝（spec 相同且 node_modules 有 aqutter-plugin.json）就不再呼叫套件管理器。
- **[流程]** 單一 repo 小修，沒有寫計畫檔，直接 issue＋分支＋PR（歸檔隨 PR）。

## Details
- 驗證：`tsc --noEmit` 通過、`pnpm test` 158 個全過（新增 5 個 `pickInstalledName` 測試）；在範本專案複本以 `pnpm exec aqutter plugin add file:…` 重現：原本已用 `github:` 裝過的 mirror-demo 換成 `file:` 來源 → 成功、只執行一次、無誤報；同一個指令再跑一次 → 成功且不再呼叫 `pnpm add`。
- 未驗證：npm、yarn 在 Windows 的批次檔行為（只在 pnpm 重現與驗證）；是否還有別的指令也會在執行中重寫自己的 `.bin` 批次檔（例如 `aqutter upgrade` 會 `pnpm install`）。
