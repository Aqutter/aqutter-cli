# Tasks for 2610211114

> 本檔只列 `Aqutter/aqutter-cli` 的工作項；他 repo 的工作以「需等待」引用。Open Questions 全部確認前不得開始 Phase 1。

## Phase 1 — 匯入程式碼與歷史
- [x] [aqutter-cli] 在 `Aqutter/aqutter` 的本機 clone（只讀，不改其內容）以 `git subtree split --prefix=cli` 從 `origin/main` 切出歷史到暫存分支
- [x] [aqutter-cli] 於工作分支以 `git merge --allow-unrelated-histories` 併入暫存分支，確認歷史完整（commit 數、抽查 `git log --follow`）
- [x] [aqutter-cli] 建立 `.gitignore`（new）與 `LICENSE`（new）
- [x] [aqutter-cli] `pnpm install`，跑 `pnpm typecheck`、`pnpm test`、`pnpm build`，確認匯入後與原本一致（已知基準：`template packaging` 有 1 項在 Windows 上既有失敗，與本計畫無關）

## Phase 2 — 自足與安裝
- [x] [aqutter-cli] 補 `package.json:2` 附近的 `repository`、`bugs`、`homepage`；建立 `README.md`（new），列出四種套件管理器的安裝指令
- [x] [aqutter-cli] 在臨時專案以本機 git 網址（指向工作分支）安裝並執行 `aqutter --version`：npm ✅、pnpm ✅；yarn 1.22 在本機 `git+file` 網址回報 `Couldn't find the binary git`（原因未查明），改於 Phase 5 以推送後的 GitHub 網址驗證；bun 見 Manual Follow-ups

## Phase 3 — 套件管理器偵測
- [x] [aqutter-cli] 把 `src/web.ts:68-72`、`src/commands/plugin.ts:39-48` 與 `src/commands/upgrade.ts:65-72` 的偵測合併成 `src/web.ts` 的 `detectPackageManager`，認 pnpm、yarn、bun（`bun.lock`／`bun.lockb`）、npm，並補測試，認 pnpm、yarn、bun（`bun.lock`／`bun.lockb`）、npm，並補測試

## Phase 4 — manifest 取得層與指令
- [x] [aqutter-cli] 實作 `src/manifest.ts`（new）與 `test/manifest.test.ts`（new）：取得、24 小時快取、逾時、`--offline`、`schema` 過新、格式錯誤、主機允許清單、退回內建快照（Contract §4）
- [x] [aqutter-cli] 建立 `src/manifestSnapshot.json`（new）與同步腳本 `scripts/syncManifest.mjs`（new）；`scripts/build.mjs:2` 確保快照打包進 `dist/`
- [x] [aqutter-cli] 改 `src/commands/init.ts:112`、`src/commands/plugin.ts:85-86` 取 manifest 的 `shell.ref`、`client.spec`
- [x] [aqutter-cli] 改 `src/commands/doctor.ts:46-52` 取 `flutter.baseline`、`dart`，lock 比對改用 sha
- [x] [aqutter-cli] 改 `src/commands/upgrade.ts`、`src/versioning.ts:209`、`:235`：目標取 manifest、舊依賴語法改寫為新語法，並補測試
- [x] [aqutter-cli] 更新 `src/main.ts:2-4` 的說明文字（`--offline`、`AQUTTER_MANIFEST_URL`）
- [x] [aqutter-cli] 端到端驗證：以 raw 網址取得 manifest，對真實專案跑 `doctor`、`upgrade --dry-run`　需等待 [aqutter]：manifest 合併到 `main`
  - 已完成（用內建快照）：對 `aqutter-nuxt-app` 跑 `doctor --offline` 與 `upgrade --dry-run --offline`，找出 3 項該遷移的依賴（殼 ref、client、CLI 舊語法），lock 與 manifest 的 sha 一致，dry-run 不改檔。
  - 已完成（raw 網址）：`aqutter` 的 PR 合併後，不加 `--offline` 對同一專案跑 `doctor`、`upgrade --dry-run`，manifest 來源為 `network`，第二次為 `cache`，結果與快照一致。

## Phase 5 — CI、wiki 與驗證
- [x] [aqutter-cli] 建立 `.github/workflows/ci.yml`（new）：型別檢查、測試、`dist/` 與原始碼同步、範本的 Flutter 約束與 manifest 的 `flutter.baseline` 一致
- [x] [aqutter-cli] 程式碼匯入後初始化 wiki（`kn-project-wikification`）
- [x] [aqutter-cli] 推送工作分支後，用 GitHub 網址（`github:Aqutter/aqutter-cli#<分支>`）以 npm、yarn、pnpm 各安裝一次並執行 `aqutter --version`（補驗 yarn）
- [x] [aqutter-cli] 全部驗證（本機）：`pnpm typecheck`、`pnpm test`、`pnpm build`、`dist/` 同步、`wiki-lint` 硬閘 0 項
- [x] [aqutter-cli] 產出下游交接：新安裝網址與 ref，供 `aqutter-nuxt-app` 的計畫使用　需等待 [aqutter-nuxt-app]：其計畫開始
  - 推送後驗證結果：以 `github:Aqutter/aqutter-cli#feature/2610211114-split-cli-to-aqutter-cli-repo` 安裝，npm、yarn、pnpm 都成功並能執行 `aqutter --version`（先前 yarn 的本機網址失敗只是 `git+file` 的限制）。bun 仍待人工驗證。
  - 交接給 `aqutter-nuxt-app` 的資訊：安裝字串 `github:Aqutter/aqutter-cli#0.0.0`（tag 於 Merge PR 併回 `main` 後建立，見 Manual Follow-ups）；`aqutter upgrade` 會把舊的 `&path:/cli` 依賴改寫為這個字串。
