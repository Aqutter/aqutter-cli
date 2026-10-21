<!-- REMINDER: Relative Paths Only! No file:///c:/... -->
# Plan: 2610211114 - split-cli-to-aqutter-cli-repo
- Created: 2026-10-21
- Branch: feature/2610211114-split-cli-to-aqutter-cli-repo
- Issue: Aqutter/aqutter-cli#1
- Milestone: 0.0.0
- Base Branch: release/0.0.0
- Status: In Progress
- Completed: [Wait for Finish]

## Goals
1. 把 `Aqutter/aqutter` 的 `cli/` 連同 git 歷史匯入本 repo，讓本 repo 自足（`.gitignore`、`LICENSE`、`README`、套件的 repository 欄位）。
2. 讓 `github:Aqutter/aqutter-cli#<ref>` 在 npm、yarn、pnpm、bun 都能安裝並執行 `aqutter --version`（現在的 `&path:/cli` 只有 pnpm 能用）。
3. CLI 改讀 `Aqutter/aqutter` 發佈的 release manifest（契約見下方 Contract，正本在該 repo 的同名計畫）：`init`、`doctor`、`upgrade`、`plugin create` 不再把版本相容知識寫死在 CLI；`upgrade` 能把舊的 `&path:/cli` 依賴改寫為新語法。
4. 補上 bun 的偵測（`bun.lock`／`bun.lockb`），讓四種套件管理器的專案都能用 `aqutter` 的指令。
5. 建立本 repo 的 CI：型別檢查、測試、`dist/` 與原始碼同步、範本的 Flutter 約束與 manifest 的 `flutter.baseline` 一致。
6. 範本（`template/`）隨 CLI 一起搬入，維持內嵌；「建立新網頁專案」的範本是未來功能，不在本計畫。

## Architecture
匯入後的責任（路徑相對本 repo 根；匯入前這些檔案位於 `Aqutter/aqutter` 的 `cli/` 底下）：

| 項目 | 內容 |
|---|---|
| 指令 | `src/commands/`：`init`、`dev`、`seed`、`build`、`env`、`flavorAdd`、`genJks`、`plugin`、`doctor`、`upgrade` |
| 網頁框架轉接器 | `src/web.ts`（nuxt、vite、next、custom） |
| 版本檔解析與改寫 | `src/versioning.ts` |
| 範本 | `template/`（app、plugin、env），內嵌 |
| 打包 | `scripts/build.mjs`（esbuild）→ `dist/aqutter.mjs`，納入版控 |

新增的部分：

1. **manifest 取得層**（`src/manifest.ts`，new）：依 Contract §4 實作取得、24 小時快取、逾時 15 秒、`--offline`、`schema` 檢查、退回內建快照。
2. **內建快照**（`src/manifestSnapshot.json`，new）：manifest 的最後已知版本，打包進 `dist/`；以腳本從 `Aqutter/aqutter` 同步，不手改。
3. **指令改動**：Contract §5 的六項；另外 `upgrade` 新增「舊依賴語法 → 新語法」的改寫。
4. **套件管理器偵測**：集中成一處，認 pnpm、yarn、bun、npm（現在 `src/web.ts` 與 `src/commands/plugin.ts` 各寫一份、都沒有 bun）。

匯入方式：在 `Aqutter/aqutter` 以 `git subtree split --prefix=cli` 切出歷史，於工作分支以 `git merge --allow-unrelated-histories` 併入（本 repo 目前只有一個 bootstrap commit）。因此 **PR 必須用「Create a merge commit」合併，不可 squash**，否則歷史會被壓平。

程式碼將遵守 `kn-project-code-style`（TypeScript 規範）。

## Cross-Repo Scope
- **本計畫所屬 repo**: `Aqutter/aqutter-cli`
- **共用計畫 ID**: `2610211114-split-cli-to-aqutter-cli-repo`　**共用分支名**: `feature/2610211114-split-cli-to-aqutter-cli-repo`
- **參與 repo 與職責**:
  - `Aqutter/aqutter` — 契約提供方（manifest 與 schema 已在其分支完成，需合併到 `main` 才有 raw 網址）；最後移除舊 `cli/`。issue: `Aqutter/aqutter#2`
  - `Aqutter/aqutter-cli` — 契約消費方（本計畫）：匯入、自足、讀 manifest、四種套件管理器、CI。issue: `Aqutter/aqutter-cli#1`
  - `Aqutter/aqutter-nuxt-app` — 下游：改用新依賴語法並跑 `aqutter upgrade`。issue: `待建立`
- **執行順序相依**: `Aqutter/aqutter` 的 manifest 合併上線 → **本計畫** → `Aqutter/aqutter-nuxt-app` → `Aqutter/aqutter` 移除 `cli/`。本計畫開發 manifest 取得層時可用 `AQUTTER_MANIFEST_URL` 與單元測試的注入網路層，不必等 manifest 上線；但端到端驗證（Phase 4 結尾）需要它已在 `main`。
- **跨 repo 檔案指涉**:
  - `Aqutter/aqutter`：`manifest/releases.json`、`manifest/schema.json`（契約內容的正本）、`cli/`（匯入的來源，含 `cli/src/commands/init.ts:112`、`cli/src/commands/plugin.ts:85-86`、`cli/src/commands/doctor.ts:46-52`、`cli/src/versioning.ts:209`、`cli/src/versioning.ts:235`、`cli/src/main.ts:2-4`、`cli/src/web.ts:68-72`、`cli/scripts/build.mjs:2`）。
  - `Aqutter/aqutter`：`.kn-project/plans/2610211114-split-cli-to-aqutter-cli-repo/plan.md`（契約正本與整體脈絡）。

## Contract / 介面契約
- **契約正本 repo**: `Aqutter/aqutter`　**修訂號**: `rev 1`　**狀態**: `凍結（核准日 2026-10-21）`

> 本契約是 `aqutter`（提供方）與 `aqutter-cli`（消費方）之間唯一的介面：一份 JSON manifest。CLI 不得從 manifest 以外的地方推導版本相容性。

### 1. 取得位置
| # | 資源 | 位置 | 說明 |
|---|---|---|---|
| 1 | manifest | `https://raw.githubusercontent.com/Aqutter/aqutter/main/manifest/releases.json`（Q1 已確認） | HTTPS GET，回應為 UTF-8 JSON，無需驗證 |
| 2 | manifest schema | 本 repo 的 `manifest/schema.json`（JSON Schema 2020-12） | 提供方的 CI 以它驗證 `manifest/releases.json` |

CLI 內建預設的 manifest 網址，可被環境變數 `AQUTTER_MANIFEST_URL` 或 `aqutter.config.json` 的 `manifest.url` 覆寫（企業鏡像與測試用）。

### 2. manifest 欄位
頂層：

| 欄位 | 型別 | 必填 | 可空 | 說明與限制 |
|---|---|---|---|---|
| `schema` | integer | 是 | 否 | manifest 格式版本，目前為 `1`。CLI 遇到比自己支援更大的值必須中止並提示升級 CLI |
| `generatedAt` | string | 是 | 否 | ISO 8601 UTC，僅供顯示與診斷，不參與任何判斷 |
| `channels` | object | 是 | 否 | 鍵為頻道名，值為 `releases` 中存在的版本字串。必含 `stable`；可含 `dev` |
| `releases` | object | 是 | 否 | 鍵為版本字串（`X.Y.Z`，開發階段為 `0.0.0`），值為下表的 release 物件。至少一筆 |

`releases[<版本>]`：

| 欄位 | 型別 | 必填 | 可空 | 說明與限制 |
|---|---|---|---|---|
| `status` | string | 是 | 否 | `supported`／`deprecated`／`yanked`。`yanked` 的版本 CLI 一律拒絕使用；`deprecated` 只警告 |
| `flutter` | object | 是 | 否 | `{ "baseline": "X.Y.Z" }`。`baseline` 為框架建置與測試的 Flutter 確切版本；專案 `environment.flutter` 寫為 `>=<baseline>`（不設上限） |
| `dart` | string | 是 | 否 | `environment.sdk` 的約束字串，例如 `>=3.13.0 <4.0.0` |
| `shell` | object | 是 | 否 | `{ "url": "<git url>", "path": "shell", "ref": "<40 位小寫十六進位 commit sha>" }`（Q4：不得是 tag）；`url` 必須在 §4 的允許清單內 |
| `core` | object | 是 | 否 | `{ "url": "<git url>", "ref": "<40 位小寫十六進位 commit sha>" }`，規則同 `shell`；僅供 `doctor` 比對 lock，不寫入專案的 pubspec（由 shell 的 pubspec 帶入） |
| `client` | object | 是 | 否 | `{ "spec": "<npm 依賴字串>" }`。目前為 `github:Aqutter/aqutter#<commit sha>&path:/client`；之後 client 發佈到 npm 時改為 npm 版本字串 |
| `cli` | object | 是 | 否 | `{ "min": "X.Y.Z" }`：其內嵌範本與此 release 的 shell 相容的最低 CLI 版本。比 `min` 舊的 CLI 必須中止並提示升級 |
| `notes` | string | 否 | 是 | 升級說明的網址（HTTPS）；`deprecated`／`yanked` 時建議提供 |

序列化：所有物件鍵都必須輸出，`notes` 無值時省略該鍵（不輸出 `null`）。版本字串、sha 一律小寫。

向前相容：CLI **必須忽略**不認識的欄位（日後新增 `templates` 等欄位時，舊 CLI 不受影響）；`schema` 只在不相容變更時才加一。

### 3. 範本（本版不在契約內）
範本（App 與 plugin 的骨架、env 範例）維持內嵌在 CLI，不經由 manifest 散佈。CLI 內嵌的範本與 manifest 的相容性只用 `cli.min` 表達；範本的 `environment.flutter` 必須等於 `flutter.baseline`（由 `aqutter-cli` 的 CI 檢查）。

### 4. CLI 取得 manifest 的行為
| 情況 | 行為 |
|---|---|
| 一般 | 快取（使用者目錄的 aqutter 快取資料夾）有效期 24 小時內直接用；過期則重抓並覆寫快取 |
| 抓取失敗（無網路、HTTP 非 200、逾時 15 秒） | 退回快取（不論是否過期，並警告）；再退回 CLI 內建的最後已知 manifest；都沒有才失敗 |
| 加 `--offline` | 不連網：只用快取，再退回內建 |
| `schema` 大於 CLI 支援 | 中止，提示「請升級 aqutter-cli」 |
| JSON 不符 schema | 視為抓取失敗（走上面的退回路徑），並警告 |
| 網址 | 只接受 `https`；`shell.url`、`core.url` 的主機必須在允許清單：`github.com` |
| 安全 | manifest 只能影響「版本字串、ref、約束」這類宣告式欄位；CLI **不得**執行 manifest 中的任何指令或下載的腳本 |

`dev`、`build`、`seed` 不查 manifest（避免每次開發都連網）。`init`、`doctor`、`upgrade` 才查（`plugin create` 若需要殼 ref 也查）。

### 5. CLI 因此要做的改變（供 `aqutter-cli` 計畫使用，本計畫不實作）
| 現況（monorepo） | 改為 |
|---|---|
| `init.ts:112` 殼 ref 預設為 CLI 的 `pkg.version` | 取 `channels.stable` 對應 release 的 `shell.ref`（旗標 `--shell-ref` 可覆寫） |
| `init.ts:112`、`plugin.ts:85-86` 的殼 ref 與 client ref 取自 `pkg.version` | 取 release 的 `shell.ref` 與 `client.spec` |
| `doctor.ts:46-52` 以範本推導 Flutter 基準 | 取 release 的 `flutter.baseline`、`dart` |
| `doctor` 以 `git ls-remote` 查 lock 是否落後 | 比對 `pubspec.lock` 的 `resolved-ref` 與 release 的 `shell.ref`／`core.ref`（ref 為 tag 時才退回 `ls-remote`） |
| `versioning.ts:209`、`235` 只認 `github:Aqutter/aqutter#…&path:` | 同時認新語法 `github:Aqutter/aqutter-cli#…`，並由 `upgrade` 把舊語法改寫為新語法 |
| `upgrade` 以 CLI 版本為目標 | 以 manifest 的 `channels.stable`（或 `--to=<版本>`）為目標 |

### 6. 狀態與規則
- release 一旦發佈，既有版本的欄位不得改動（只可把 `status` 改為 `deprecated`／`yanked`）；要修正就新增版本。
- `channels.stable` 只能指向 `status` 為 `supported` 的 release。
- 開發階段的 `0.0.0`：git tag `0.0.0` 仍會隨 `main` 移動，但 manifest 的 `shell.ref`、`core.ref` 與 `client.spec` 一律寫 commit sha，不引用任何 tag（Q4）。

### 7. 相容性
- 本契約是新增，不改動現有 client、shell、aqutter_core 的任何介面。
- 現有專案的 `aqutter.config.json`、`pubspec.yaml`、`package.json` 不需要立刻改動；舊版 CLI 不認識 manifest，行為與現在相同。
- 舊的 `github:Aqutter/aqutter#…&path:/cli` 依賴在過渡期內仍可安裝（見 Q3）。

### 8. 變更紀錄
- _(尚無)_

## Impact Files
> 既有檔案的路徑與行號取自 `Aqutter/aqutter` 的 `cli/`（Code Evidence Scan，匯入前）；匯入後去掉 `cli/` 前綴即為本 repo 的路徑。

- `src/commands/init.ts:112`（`const shellRef = flags['shell-ref'] ?? pkg.version`）— 殼 ref 改取 manifest 的 `channels.stable` 對應 release 的 `shell.ref`。
- `src/commands/plugin.ts:85-86`（`shellRef`、`clientRef` 取 `pkg.version`）— 改取 manifest 的 `shell.ref` 與 `client.spec`。
- `src/commands/plugin.ts:39-48`（`type PackageManager`、lockfile 偵測）— 加入 bun，並與 `src/web.ts:68-72` 的偵測合併成一處。
- `src/commands/doctor.ts:46-52`（`expectedProfile`，以範本推導 Flutter 基準、`shellRef: pkg.version`）— 改取 manifest 的 `flutter.baseline`、`dart`；lock 落後的檢查改比對 `resolved-ref` 與 manifest 的 sha。
- `src/commands/upgrade.ts`（`planUpgrade`，以 CLI 版本為目標）— 目標改為 manifest 的 `channels.stable`（或 `--to=<版本>`），並加入舊語法改寫。
- `src/versioning.ts:209`（`NPM_SPEC`）、`src/versioning.ts:235`（`rewritePackageJson` 的 pattern）— 同時認 `github:Aqutter/aqutter-cli#…`，並能把 `github:Aqutter/aqutter#…&path:/cli` 改寫為新語法。
- `src/main.ts:2-4`（`HELP` 與 `pkg.version`）— 說明文字補 `--offline` 與 `AQUTTER_MANIFEST_URL`。
- `src/web.ts:68-72`（`pnpm exec` / `yarn` 的 runner 偵測）— 加入 bun（`bunx`）。
- `scripts/build.mjs:2`（註解寫著 `pnpm add -D github:Aqutter/aqutter#path:/cli`）— 改為新安裝語法，並確保內建快照進入 `dist/`。
- `package.json:2`（`@aqutter/aqutter-cli`）— 補 `repository`、`bugs`、`homepage` 指向本 repo；名稱不變。
- `test/plugins.test.ts:80`（範本測試）— 隨範本搬入，維持不變。
- `AGENTS.md` (new) — 本 repo 原本沒有；依治理範本建立（含「沒有該技能時的最低規則」），內容會進版控，隨本計畫的 commit 出現。
- `.gitignore` (new) — `node_modules/`、`*.log`、`.DS_Store` 等（`Aqutter/aqutter` 根目錄的 `.gitignore` 不在 `cli/` 底下，匯入時不會帶過來）。
- `LICENSE` (new) — Apache-2.0，與 `Aqutter/aqutter` 及 `package.json` 的 `license` 一致。
- `README.md` (new) — 用途、四種套件管理器的安裝指令、指向文件。
- `src/manifest.ts` (new) — manifest 取得層，Contract §4。
- `src/manifestSnapshot.json` (new) — 內建的最後已知 manifest。
- `scripts/syncManifest.mjs` (new) — 把 `Aqutter/aqutter` 的 `manifest/releases.json` 同步成內建快照（不手改快照）；`package.json` 的 `scripts` 補對應指令。
- `test/manifest.test.ts` (new) — 取得、快取、離線、schema 過新、格式錯誤、允許清單的測試（注入網路層）。
- `.github/workflows/ci.yml` (new) — 型別檢查、測試、`dist/` 同步、範本與 manifest 的 Flutter 基準一致。

## App-Flow Screens
- （本 repo 的 `project.md` 記錄 `appFlow: false`，刪除本節）

## Open Questions / 待確認事項
> 尚未確認、會影響實作方向的行為或決策。**全部釐清前不得進入 Phase 3。**

### Q1. 本 repo 的安裝網址用哪種 ref？ — 影響範圍：`README.md`、`Aqutter/aqutter-nuxt-app` 的依賴字串、`aqutter upgrade` 改寫舊語法時寫入的值
- [x] 選項 A：tag `0.0.0`（隨 `main`／版本分支前進，沿用框架的現行慣例），安裝字串為 `github:Aqutter/aqutter-cli#0.0.0`　(建議，理由：與現行工作流程一致、字串簡單；本 repo 的版本分支一律叫 `release/…`，不會與 tag 同名)
- [ ] 選項 B：commit sha，安裝字串為 `github:Aqutter/aqutter-cli#<sha>`　（固定不變，但每次更新都要改依賴字串）
- **決議**：選項 A　狀態：✅ 已確認

## Manual Follow-ups / 人工收尾事項
- **[合併前]** 在有 bun 的環境驗證 `github:Aqutter/aqutter-cli#<ref>` 可安裝並執行 `aqutter --version` — 在該環境執行 `bun add -d "github:Aqutter/aqutter-cli#<ref>"` 後 `bunx aqutter --version` — agent 的環境沒有 bun，無法代測
- **[合併時]** 合併本計畫的 PR 與之後的 Merge PR（`release/0.0.0` → `main`）時選「Create a merge commit」，不要 squash 或 rebase — 在 GitHub 的 PR 頁面選擇合併方式 — 匯入的歷史靠合併 commit 保留，squash 會壓平；合併方式是 PR 頁面上的人為選擇，agent 不代按

## Key Decisions
- **[Phase 0]** 目標 repo 為 `Aqutter/aqutter-cli`（依據：`Aqutter/aqutter` 同名計畫的 Cross-Repo Scope 宣告）。使用者核准建立此 repo（公開、空的、issues 啟用），並選擇「只建立空的 repo」，歷史匯入由本計畫執行。
- **[Phase 0]** 整合主幹為 `main` — 理由：新 repo 的第一個 commit（bootstrap `project.md`）建立了 `main`，無其他分支，不需詢問。
- **[Phase 0]** 治理初始化：是；wiki：使用者選擇建立，但 repo 目前沒有程式碼，建空殼頁面違反 wiki 規範，所以 wiki 初始化列為 Phase 5 的工作項（程式碼匯入後再建）；app-flow：否（已記錄 `appFlow: false`）。
- **[Phase 0]** Milestone：`0.0.0`（使用者選擇；四種版本來源皆無，起始版本）。已建立 milestone `#1`。
- **[Phase 0]** 版本分支命名為 `release/0.0.0`，不用標題原文 `0.0.0` — 理由：框架以 tag `0.0.0` 作為安裝網址的 ref，同名分支會造成 `refname is ambiguous` 與安裝歧義；使用者選擇此命名。
- **[Phase 0]** 版本檔：本 repo 尚無版本檔（空 repo），Version Snapshot 無可比對對象；匯入後 `package.json` 的 `version` 為 `0.0.0`，與 milestone 一致，不需同步。
- **[Q1]** 安裝網址用 tag `0.0.0`（`github:Aqutter/aqutter-cli#0.0.0`）— 理由：沿用框架現行慣例；版本分支叫 `release/…`，不與 tag 同名。
- **[執行模式]** 序列 — 依據：本 repo 是目前唯一有可執行工作的 repo（`aqutter` 的後續項被本計畫阻擋、`aqutter-nuxt-app` 被上游阻擋），相依鏈是一條線；環境也未確認可派出獨立子 agent。
- **[完成後]** commit + 開 PR（PR 併回 `release/0.0.0`，合併選 Create a merge commit）— 使用者於核准閘選擇；任務完成前會 `git rebase origin/release/0.0.0` 與 `git push --force-with-lease --force-if-includes`，匯入的不相關歷史若會被壓平則先停下請示。
- **[Rule 24]** Version Snapshot：本 repo 尚無版本檔，無可比對對象，不做版本檔同步；匯入後 `package.json` 的 `version` 為 `0.0.0`，與 milestone 一致。
- **[設計]** manifest 取得層與內建快照放在 CLI 內，而不是每次連網 — 理由：`dev`、`build`、`seed` 不查 manifest（Contract §4），離線仍要能 `init`／`doctor`。
- **[設計]** 套件管理器偵測集中一處並加入 bun — 理由：使用者要求 npm、pnpm、bun、yarn 都能好好使用；目前兩處各寫一份且都沒有 bun。
- **[設計]** 契約區塊由 `Aqutter/aqutter` 的同名計畫逐字複製，修改只走 Rule 29 — 理由：Rule 28。

## Git Completion Policy
- PR 一律以 `--base ${BASE_BRANCH}`（`release/0.0.0`）顯式指定 base，不依賴 `gh` 的預設值 (Rule 23)。該版本全部工作完成後，另開 Merge PR `release/0.0.0` → `main`（Rule 26）。
- Issue 綁定時，**每個 commit 訊息**與 PR body 都必須含 `Closes #${N}`（`${N}` 取自上方 `- Issue:`，**不是** `${ID}`）。歸檔完成後於該 issue 張貼由 archive 蒸餾的結案留言 (Rule 20)。
- Issue 的關閉發生在**合併後清理**（使用者回報已合併、內容驗證通過），不在歸檔當下 (Rule 21 步驟 6)。
- commit 一律自動（Rule 17）。完成時依核准閘的「完成後」選項：選 push 或 PR 才會 `git fetch` 後 `git rebase origin/release/0.0.0` 並更新遠端工作分支（`git push --force-with-lease --force-if-includes`）；選只 commit 則兩者都不做。**注意**：匯入的歷史是不相關歷史的合併，rebase 前須確認不會把合併 commit 壓平；若遇到此情形先停下請示。
- 合併 PR 時選「Create a merge commit」（見 Manual Follow-ups）。
- 跨 repo 時，本 repo 自己開自己的 PR；不存在橫跨多 repo 的單一 PR (Rule 19)。建議合併次序見 `## Cross-Repo Scope`。

## References
- `Aqutter/aqutter` 的同名計畫（契約正本與整體脈絡）。
- 實測：npm 與 yarn 無法安裝 `github:…#…&path:/cli`，這是整個拆分的動機。
