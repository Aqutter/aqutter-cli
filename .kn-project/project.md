<!-- REMINDER: Relative Paths Only! No file:///c:/... -->
# aqutter-cli

Aqutter 框架的命令列工具：npm 套件 `@aqutter/aqutter-cli`，指令為 `aqutter`。把既有的網頁專案接上 Aqutter 的 Flutter 殼，提供 `init`、`dev`、`seed`、`build`、`flavor add`、`android gen-jks`、`plugin …`、`doctor`、`upgrade`。

本 repo 是從 `Aqutter/aqutter` 的 `cli/` 拆出來的；拆分的來龍去脈與決策記在該 repo 的 `.kn-project/archive/2610211114-split-cli-to-aqutter-cli-repo.md`；契約（release manifest）的格式以該 repo 的 `manifest/schema.json` 與 `docs/releases.md` 為準。

## 目前狀態

已從 `Aqutter/aqutter` 的 `cli/` 匯入程式碼與歷史（有程式碼的 `main` 須等版本分支併回；見版本紀錄）。CLI 改讀框架的 release manifest；說明見 wiki 的[版本清單](wiki/platform/manifest.md)與[架構總覽](wiki/platform/architecture.md)。

## 組成

| 目錄 | 內容 |
| :--- | :--- |
| `src/` | CLI 原始碼（指令在 `src/commands/`，網頁框架轉接器在 `src/web.ts`） |
| `template/` | `aqutter init` 與 `aqutter plugin create` 用的專案範本（Flutter App、plugin、env 範例） |
| `test/` | 單元測試 |
| `scripts/` | 打包腳本（esbuild） |
| `dist/` | 打包產物，納入版控 |

## 保留鐵則

- **安裝方式**：以 `github:Aqutter/aqutter-cli#<ref>` 安裝，必須在 npm、yarn、bun、pnpm 都能用——這是拆分的主因；不得再使用只有 pnpm 支援的子目錄語法。
- **manifest 快取與降級保護**：發佈清單快取 24 小時；`--refresh` 略過有效期強制連網（與 `--offline` 互斥），輸出標出快取年齡。`upgrade` 目標比現況舊（`environment.flutter`／`environment.sdk` 下限、`.fvmrc` 變低）時預設拒絕，`--allow-downgrade` 才放行——這是為了擋住「過期快取造成無聲降級」。
- **`dist/` 必須與 `src/`、`template/` 同步提交**：使用者直接從 GitHub 安裝，沒有編譯步驟。
- **設定驅動、框架中立**：CLI 不寫死任何網頁框架，框架差異只在網頁框架轉接器；其餘指令只認 `aqutter.config.json`。
- **版本相容知識以 `Aqutter/aqutter` 的 release manifest 為準**（`manifest/releases.json`，契約 rev 1），CLI 不從其他地方推導；manifest 只能影響宣告式欄位，CLI 不得執行其中的任何指令。
- **範本與 shell 的相容性**由 manifest 的 `cli.min` 表達；範本的 `environment.flutter` 必須等於 manifest 的 `flutter.baseline`，由本 repo 的 CI 檢查。
- **版本分支不得與 tag 同名**：tag `<版本>` 會用在安裝網址（`#<版本>`），版本分支一律用 `release/<版本>`。

## 工作流程

- 工作分支 `feature/<ID>-<描述>`，PR 併回版本分支 `release/<版本>`（milestone 標題即版本號）。
- 該版本全部工作完成後，開 Merge PR 把 `release/<版本>` 併回 `main`。
- 每份計畫綁定一張 GitHub Issue。

## 驗證

CLI 程式碼匯入後適用：

```bash
pnpm typecheck && pnpm test && pnpm build
```

## 全域規則

appFlow: false

## 版本紀錄

只記併回主幹，發佈狀態以 GitHub Release 為準。

0.0.0 — 併回主幹 2026-10-21（接手 `Aqutter/aqutter` 的 `cli/`：匯入程式碼與歷史、npm／yarn／pnpm 皆可安裝、改讀 release manifest）
