# aqutter-cli

[Aqutter](https://github.com/Aqutter/aqutter) 框架的命令列工具（指令 `aqutter`）：把既有的網頁專案包成原生 App——網頁跑在 Flutter 殼的 WebView 裡。

提供 `init`、`dev`、`seed`、`build`、`env`、`flavor add`、`android gen-jks`、`plugin …`、`doctor`、`upgrade`。完整說明見 Aqutter 的[文件](https://github.com/Aqutter/aqutter/tree/main/docs)。

## 安裝

CLI 尚未發佈到 npm，從 GitHub 安裝，四種套件管理器都可以。需要 Node.js 20 以上。

### npm

```bash
npm install -D github:Aqutter/aqutter-cli#0.0.0
```

### pnpm

```bash
pnpm add -D github:Aqutter/aqutter-cli#0.0.0
```

### yarn

```bash
yarn add -D github:Aqutter/aqutter-cli#0.0.0
```

### bun

```bash
bun add -d github:Aqutter/aqutter-cli#0.0.0
```

安裝後確認版本：

```bash
npx aqutter --version
```

## 開始使用

在網頁專案的根目錄：

```bash
npx aqutter init
```

之後的步驟見 Aqutter 文件的「快速開始」。網頁端的 `@aqutter/aqutter`（client）在 [`Aqutter/aqutter-js`](https://github.com/Aqutter/aqutter-js)，安裝方式見該處說明。

## 開發本 repo

```bash
pnpm install
```

```bash
pnpm typecheck
```

```bash
pnpm test
```

```bash
pnpm build
```

`dist/` 是發佈產物並納入版控：使用者直接從 GitHub 安裝，沒有編譯步驟。改動 `src/` 或 `template/` 後必須重新 `pnpm build` 並一併提交。

## 授權

Apache-2.0，見 [LICENSE](LICENSE)。
