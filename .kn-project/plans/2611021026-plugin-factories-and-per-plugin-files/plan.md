<!-- REMINDER: Relative Paths Only! No file:///c:/... -->
# Plan: 2611021026 - plugin-factories-and-per-plugin-files
- Created: 2026-11-02
- Branch: N/A（project.md：開發階段直接推 main）
- Issue: N/A（不建 issue）
- Milestone: N/A（未指定）
- Base Branch: main
- Status: In Progress
- Completed: [Wait for Finish]

## Goals
讓 `aqutter plugin` 產生新的註冊形態：總清單由 CLI 重寫，每個 plugin 一個「只建立一次、永不覆蓋」的使用者檔案，客製寫在那個檔案裡；殼端的介面由 `aqutter` 的同名計畫提供。

## Architecture
1. `src/plugins.ts`：`renderPluginsDart` 改產生 `AqutterPluginBuilder` 清單與對應的 import；新增 `pluginFileName(id)`（id 轉底線加 `_plugin.dart`）、`pluginFactoryName(class)`（`build` 加類別名）、`renderPluginFile(entry)`（預設內容）、`scaffoldPluginFiles(project)`（只建立缺少的檔案；檔案已存在但缺預期函式則報錯、不寫入任何檔案）。
2. `syncPlugins` 先檢查所有既有使用者檔案、再建立缺少的、最後重寫總清單與 pubspec 受管區塊。
3. `src/commands/plugin.ts`：`add`、`sync` 走上述流程；`remove` 預設保留使用者檔案並印出路徑，`--purge` 才刪除。
4. 範本 `template/app/lib/aqutter_plugins.dart` 改為新形態的空清單；`template/app/lib/main.dart` 不變。
5. 測試涵蓋：檔名與函式名轉換、預設內容、不覆蓋、缺函式報錯、`remove`／`--purge`、空清單、與舊形態的升級。
6. `dist/` 與 `src/`、`template/` 一起提交；`docs` 在 `aqutter` repo 的同名計畫更新。

遵守 `kn-project-code-style`（TypeScript 慣例沿用既有檔案）。

## Cross-Repo Scope
- **共用計畫 ID**: `2611021026-plugin-factories-and-per-plugin-files`　**共用分支名**: `N/A（直接 main）`
- **本計畫所屬 repo**: `aqutter-cli`
- **參與 repo 與職責**:
  - `aqutter` — 殼的介面、解析、文件、wiki（契約正本）　issue: `N/A`
  - `aqutter-cli` — 產生總清單與每個 plugin 的使用者檔案　issue: `N/A`
  - `aqutter-nuxt-app` — 範例 App 遷移到新寫法並驗證　issue: `N/A`
- **執行順序相依**: 契約凍結後與 `aqutter` 可平行；新 CLI 產生的檔案需要新殼才能編譯，所以發佈順序是殼先、CLI 後。
- **跨 repo 檔案指涉**: `aqutter`：`shell/lib/src/plugin/plugin_entry.dart`（`AqutterPluginBuilder` 等的定義）。

## Contract / 介面契約
- **契約正本 repo**: `aqutter`　**修訂號**: `rev 1`　**狀態**: `凍結（核准日 2026-11-02）`

### 1. 殼的 Dart 介面（`aqutter` 提供，`package:aqutter/aqutter.dart` 匯出）
| 名稱 | 形態 | 說明 |
|---|---|---|
| `AqutterPluginEntry` | `abstract interface class` | 「可以放進 plugin 清單的東西」的共同超型別；沒有成員 |
| `AqutterPlugin` | 既有類別，宣告改為 `implements AqutterPluginEntry` | 既有的 plugin（`extends AqutterPlugin`）完全不用改 |
| `AqutterPluginFactory` | `typedef FutureOr<AqutterPlugin> Function(AqutterBootContext context)` | 建立 plugin 的工廠，可同步或非同步 |
| `AqutterPluginBuilder` | `class implements AqutterPluginEntry`，`const AqutterPluginBuilder(String name, AqutterPluginFactory build)` | `name` 是 plugin id，只用來在失敗時指出是哪一個 |
| `AqutterBootContext` | `class`，由殼建立 | 啟動期間可安全取得的資源（見下表） |
| `runAqutter({ List<AqutterPluginEntry> plugins = const [] , … })` | 參數型別由 `List<AqutterPlugin>` 放寬 | 傳 `List<AqutterPlugin>` 照常可編譯（Dart 的泛型清單是協變） |

`AqutterBootContext` 的成員（rev 1 只提供這三個；日後新增成員是相容的）：
| 成員 | 型別 | 說明 |
|---|---|---|
| `preferences` | `Future<SharedPreferences>` | App 的偏好設定（與殼自己用的是同一份） |
| `supportDirectory` | `Future<Directory>` | App 的支援目錄 |
| `platform` | `TargetPlatform` | 目前平台 |

編譯期的環境值（`--dart-define-from-file` 帶進來的 env）**不經由 context**：工廠內直接用 `const String.fromEnvironment('KEY')`。

### 2. 解析規則（殼）
1. 在殼的啟動流程內、建立 bridge 之前解析，**不在 `runApp` 之前**：失敗才能顯示在既有的錯誤畫面。
2. 依清單順序**逐一**處理：`AqutterPlugin` 實例直接採用；`AqutterPluginBuilder` 以 `await build(context)` 取得實例。
3. 每個工廠最長 30 秒；逾時或丟例外 → 整個啟動失敗，錯誤畫面顯示 `plugin '<name>' 初始化失敗：<原因>`；**不會略過該 plugin 繼續啟動**。
4. 解析完成後才做既有的檢查（id 格式、保留字、與內建同名、重複 id）與註冊；內建 plugin 的順序與規則不變。
5. 會畫在畫面上的 plugin（`buildUnderlay`、`buildOverlay`）在解析完成後才掛上（啟動過場仍蓋著）。

### 3. CLI 產生物（`aqutter-cli` 提供）
**總清單** `<appDir>/lib/aqutter_plugins.dart`：整個檔案由帳本產生，每次重寫，檔頭註明請勿手改。形態固定為：
```dart
import 'package:aqutter/aqutter.dart';
import 'plugins/battery_plugin.dart';
import 'plugins/google_maps_plugin.dart';

final List<AqutterPluginEntry> aqutterPlugins = <AqutterPluginEntry>[
  AqutterPluginBuilder('battery', buildBatteryPlugin),
  AqutterPluginBuilder('google-maps', buildGoogleMapsPlugin),
];
```
（沒有 plugin 時是空清單；變數名稱 `aqutterPlugins` 不變，所以既有的 `main.dart` 一行都不用改。）

**每個 plugin 一個使用者檔案** `<appDir>/lib/plugins/<id 轉底線>_plugin.dart`，例如 id `google-maps` → `google_maps_plugin.dart`；工廠函式名稱為 `build` 加上 `aqutter-plugin.json` 的 `dart.class`（`GoogleMapsPlugin` → `buildGoogleMapsPlugin`）。**CLI 只在檔案不存在時建立，永遠不覆蓋**。預設內容：
```dart
import 'package:aqutter/aqutter.dart';
import 'package:aqutter_plugin_google_maps/aqutter_plugin_google_maps.dart';

/// 要給 plugin 帶參數就改這裡；aqutter CLI 之後不會覆蓋這個檔案。
FutureOr<AqutterPlugin> buildGoogleMapsPlugin(AqutterBootContext context) => GoogleMapsPlugin();
```
（檔頭另有 `import 'dart:async';`。）

| 指令 | 行為 |
|---|---|
| `plugin add <來源>` | 既有行為（安裝、帳本、pubspec 受管區塊）加：建立缺少的 `plugins/*.dart`、重寫總清單 |
| `plugin sync` | 建立帳本中所有 plugin 缺少的 `plugins/*.dart`、重寫總清單與 pubspec 區塊；不覆蓋任何既有的使用者檔案 |
| `plugin remove <id>` | 從帳本、pubspec、總清單移除；**預設保留** `plugins/<id>_plugin.dart` 並印出路徑提醒；加 `--purge` 才刪除 |
| 檔案已存在但沒有預期的工廠函式 | 報錯並指出檔案與缺少的函式名稱，不寫入任何檔案 |

### 4. 錯誤與提示
| 情境 | 回應 |
|---|---|
| 工廠丟例外或逾時（30 秒） | 殼的啟動錯誤畫面顯示 `plugin '<name>' 初始化失敗：<原因>`，App 不繼續啟動 |
| 解析後 id 重複、與內建同名、格式不合法 | 沿用既有的 `ArgumentError`（訊息不變） |
| `plugins/<檔>.dart` 缺少預期函式 | CLI 報錯並中止，不改動任何檔案 |

### 5. 相容性
- 既有 App 的 `main.dart`（`plugins: aqutterPlugins` 或 `plugins: [BatteryPlugin()]`）不用改，也不會因升級而編譯失敗。
- 既有 App 升級殼後不做任何事，行為完全相同；要使用新寫法才執行 `aqutter plugin sync`。
- 順序：殼必須先於 CLI 發佈；新 CLI 產生的檔案需要新殼（`AqutterPluginBuilder` 等），舊殼會編譯失敗。
- 第三方 plugin 的 `aqutter-plugin.json` 與 Dart 套件不需要任何變更。

### 6. 變更紀錄
- _(尚無)_

## Impact Files
- `src/plugins.ts:15`（`PLUGINS_DART_FILE`）、`:61`（`renderPluginsDart`）、`:99`（`syncPlugins`）— 新形態與檔案建立
- `src/commands/plugin.ts`（`add`、`remove`、`sync`、`list`）— 呼叫新流程、`--purge`
- `template/app/lib/aqutter_plugins.dart` — 新形態的空清單
- `test/plugins.test.ts` — 新增與調整測試
- `README.md`／`.kn-project/project.md` — 指令說明（若有列出行為）
- `dist/aqutter.mjs` — 重新建置

## App-Flow Screens
- （無 app-flow.json，刪除本節）

## Open Questions / 待確認事項
### Q1. 相容方式 — 影響範圍：`runAqutter` 的 `plugins` 型別
- [x] 共用超型別，舊寫法不用改　(建議)
- [ ] 另加 `pluginBuilders` 參數，既有 App 要改 main.dart
- **決議**：共用超型別，舊寫法不用改　狀態：✅ 已確認

### Q2. 作業流程 — 影響範圍：分支與 issue
- [x] 直接 main、不建 issue　(建議，理由：各 repo 的 `project.md` 規定開發階段直接推 main)
- **決議**：直接 main、不建 issue　狀態：✅ 已確認

## Manual Follow-ups / 人工收尾事項
- **[合併後]** 要使用新寫法的既有 App 執行 `aqutter plugin sync`（選用）— 只有使用者知道要不要客製 — agent 不代為決定

## Key Decisions
- **[相容]** `AqutterPlugin` 與 `AqutterPluginBuilder` 共用超型別 `AqutterPluginEntry`，`plugins` 參數放寬 — 使用者選擇；既有 App 的 `main.dart` 不用改。
- **[流程]** 直接 main、不建 issue — 使用者選擇。
- **[啟動 context]** 只提供 `preferences`、`supportDirectory`、`platform`；env 用 `const String.fromEnvironment` — 理由：編譯期常數不需要 context；其他資源等有實際需求再加（新增成員是相容的）。
- **[失敗政策]** 工廠丟例外或逾時（30 秒）整個啟動失敗並顯示是哪個 plugin — 理由：靜默略過會讓人以為功能壞了；失敗顯示在既有的錯誤畫面。
- **[解析時機]** 在 `_bootstrap` 內（有錯誤畫面）而不是 `runApp` 之前 — 理由：runApp 之前失敗沒有畫面可顯示。
- **[使用者檔案]** 每個 plugin 一個檔案，CLI 只建立不覆蓋；`remove` 預設保留、`--purge` 才刪 — 理由：裡面是使用者的設定，誤刪的代價高於留下一個檔案。
- **[不做]** widget 樹的 `BuildContext`、全域註冊器 — 理由：建構時沒有 widget 樹；全域可變狀態不易測試且順序不確定。
- **[契約]** rev 1 凍結（2026-11-02 核准）。
- **[完成後]** 預設只 commit，push 與移動 tag 依使用者之後的明確要求。

## Git Completion Policy
- 直接 main：commit 自動；push 與移動 tag `0.0.0` 依使用者明確要求。
- 跨 repo 各自 commit；發佈順序：`aqutter` 先（含 manifest），`aqutter-cli` 其次，`aqutter-nuxt-app` 最後。

## References
- 本次對話：plugin 清單無法帶參數、希望每個 plugin 有自己的建立函式並能取得啟動資源
