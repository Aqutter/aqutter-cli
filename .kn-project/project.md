<!-- REMINDER: Relative Paths Only! No file:///c:/... -->
# aqutter-cli

Aqutter 框架的命令列工具：npm 套件 `@aqutter/aqutter-cli`，指令為 `aqutter`。把既有的網頁專案接上 Aqutter 的 Flutter 殼，提供 `init`、`dev`、`seed`、`build`、`flavor add`、`android gen-jks`、`plugin …`、`doctor`、`upgrade`。

本 repo 是從 `Aqutter/aqutter` 的 `cli/` 拆出來的；拆分的完整計畫與契約在該 repo 的 `.kn-project/plans/2610211114-split-cli-to-aqutter-cli-repo/`（契約正本）。

## 目前狀態

空 repo：CLI 的程式碼與 git 歷史尚未匯入，由本 repo 的第一份計畫執行。

## 預定的組成

| 目錄 | 內容 |
| :--- | :--- |
| `src/` | CLI 原始碼（指令在 `src/commands/`，網頁框架轉接器在 `src/web.ts`） |
| `template/` | `aqutter init` 與 `aqutter plugin create` 用的專案範本（Flutter App、plugin、env 範例） |
| `test/` | 單元測試 |
| `scripts/` | 打包腳本（esbuild） |
| `dist/` | 打包產物，納入版控 |

## 保留鐵則

- **安裝方式**：以 `github:Aqutter/aqutter-cli#<ref>` 安裝，必須在 npm、yarn、bun、pnpm 都能用——這是拆分的主因；不得再使用只有 pnpm 支援的子目錄語法。
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

（尚無）
