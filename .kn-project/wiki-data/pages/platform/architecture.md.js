WIKI_PAGE("platform/architecture.md",{
"title":"架構總覽",
"summary":"aqutter-cli 是 Aqutter 框架的命令列工具，指令為 aqutter：把既有的網頁專案接上 Flutter 殼，並提供開發、打包、環境與 plugin 管理，以及檢查與升級專案版本的指令。它以單一打包檔發佈，專案範本內嵌其中；版本相容性的知識不寫在這裡，而是讀框架發佈的 release manifest。",
"svgs":{},
"seq":{},
"ext":["archive/2610211114-split-cli-to-aqutter-cli-repo.md", "project.md"],
"changelog":[{"plan": "2610211114-split-cli-to-aqutter-cli-repo", "date": "2026-10-21", "version": "0.0.0", "note": "建立", "issue": "[#1](https://github.com/Aqutter/aqutter-cli/issues/1)", "pr": "—"}],
"md":"# 架構總覽\n\n## Summary\naqutter-cli 是 Aqutter 框架的命令列工具，指令為 aqutter：把既有的網頁專案接上 Flutter 殼，並提供開發、打包、環境與 plugin 管理，以及檢查與升級專案版本的指令。它以單一打包檔發佈，專案範本內嵌其中；版本相容性的知識不寫在這裡，而是讀框架發佈的 release manifest。\n\n## 組成\n| 部分 | 角色 |\n|---|---|\n| 指令 | 初始化、開發、種子網頁包、打包、環境、flavor、keystore、plugin、doctor、upgrade |\n| 網頁框架轉接器 | 把 nuxt、vite、next 與自訂框架的差異收攏成一處，其餘指令只認設定檔 |\n| 版本清單層 | 取得並驗證 release manifest，決定框架版本與相容資訊 |\n| 版本檔解析 | 讀寫 pubspec、固定 Flutter 版本的檔案、package.json 與 lock |\n| 專案範本 | Flutter App、plugin 與 env 範例的骨架，隨 CLI 一起發佈 |\n| 打包 | 以 esbuild 打成單一檔案，連同打包後的產物一起納入版控 |\n\n來源：1. [main.ts](../../../src/main.ts)　2. [web.ts](../../../src/web.ts)　3. [manifest.ts](../../../src/manifest.ts)　4. [versioning.ts](../../../src/versioning.ts)　5. [build.mjs](../../../scripts/build.mjs)\n\n## 規則\n| 規則 | 說明 |\n|---|---|\n| 框架中立 | 不寫死任何網頁框架，差異只在轉接器 |\n| 發佈方式 | 使用者直接從 GitHub 安裝，沒有編譯步驟，所以打包產物必須與原始碼同步提交 |\n| 套件管理器 | pnpm、yarn、bun、npm 都支援，依專案的 lockfile 判斷 |\n| 版本知識 | 取自 release manifest，不在程式裡寫死 |\n\n來源：1. [project.md](../../project.md#L22-L30)　2. [web.ts](../../../src/web.ts#L67-L90)\n\n---\n[🏠 Wiki](../index.md)\n"
});
