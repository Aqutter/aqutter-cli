// plugin 的專案端整合：把 aqutter.config.json 的 plugins 同步成 App 的 pubspec 依賴與 Dart 註冊清單。
import { existsSync, mkdirSync, readFileSync, writeFileSync } from 'node:fs'
import { join, relative } from 'node:path'

import { CONFIG_FILE } from './config.ts'
import type { PluginDescriptor, PluginEntry, Project } from './config.ts'

export const PLUGIN_DESCRIPTOR_FILE = 'aqutter-plugin.json'

/** 與 Dart 端 `aqutterPluginIdPattern` 同一條規則。 */
export const PLUGIN_ID_PATTERN = /^[a-z][a-z0-9-]*$/

export const PUBSPEC_BEGIN = '  # aqutter-plugins:begin（由 `aqutter plugin` 維護，請勿手改）'
export const PUBSPEC_END = '  # aqutter-plugins:end'
export const PLUGINS_DART_FILE = 'aqutter_plugins.dart'

const DART_PACKAGE_PATTERN = /^[a-z][a-z0-9_]*$/
const DART_CLASS_PATTERN = /^[A-Z][A-Za-z0-9_]*$/

/** 驗證並回傳 plugin 描述檔；不合法拋錯並指出欄位。 */
export const parseDescriptor = (raw: unknown, source: string): PluginDescriptor => {
  const fail = (reason: string): never => {
    throw new Error(`${source} 不合法：${reason}`)
  }
  if (typeof raw !== 'object' || raw === null) {
    return fail('必須是 JSON 物件')
  }
  const value = raw as Record<string, unknown>
  if (value.schema !== 1) {
    fail('schema 必須為 1')
  }
  if (typeof value.id !== 'string' || !PLUGIN_ID_PATTERN.test(value.id)) {
    fail(`id 必須符合 ${PLUGIN_ID_PATTERN}`)
  }
  const dart = value.dart as Record<string, unknown> | undefined
  if (typeof dart !== 'object' || dart === null) {
    return fail('缺少 dart 區塊')
  }
  if (typeof dart.package !== 'string' || !DART_PACKAGE_PATTERN.test(dart.package)) {
    fail('dart.package 必須是 Dart 套件名（小寫 snake_case）')
  }
  if (typeof dart.class !== 'string' || !DART_CLASS_PATTERN.test(dart.class)) {
    fail('dart.class 必須是 Dart 類別名')
  }
  if (dart.import !== undefined && typeof dart.import !== 'string') {
    fail('dart.import 必須是字串')
  }
  return {
    schema: 1,
    id: value.id as string,
    dart: {
      package: dart.package as string,
      class: dart.class as string,
      ...(dart.import === undefined ? {} : { import: dart.import as string }),
    },
  }
}

const importOf = (entry: PluginEntry): string => entry.dart.import ?? `package:${entry.dart.package}/${entry.dart.package}.dart`

/** `google-maps` → `google_maps_plugin.dart`（放在 `lib/plugins/`）。 */
export const pluginFileName = (id: string): string => `${id.replace(/-/g, '_')}_plugin.dart`

/** `GoogleMapsPlugin` → `buildGoogleMapsPlugin`。 */
export const pluginFactoryName = (dartClass: string): string => `build${dartClass}`

/** 使用者檔案的預設內容；CLI 只在檔案不存在時寫入。 */
export const renderPluginFile = (entry: PluginEntry): string => {
  return [
    "import 'dart:async';",
    '',
    "import 'package:aqutter/aqutter.dart';",
    `import '${importOf(entry)}';`,
    '',
    '/// 要給 plugin 帶參數就改這裡；aqutter CLI 之後不會覆蓋這個檔案。',
    `FutureOr<AqutterPlugin> ${pluginFactoryName(entry.dart.class)}(AqutterBootContext context) => ${entry.dart.class}();`,
    '',
  ].join('\n')
}

/** 產生 `lib/aqutter_plugins.dart`（每次整檔重寫）。 */
export const renderPluginsDart = (plugins: PluginEntry[]): string => {
  const imports = plugins.map(entry => `plugins/${pluginFileName(entry.id)}`).sort()
  const lines = [
    '// 由 `aqutter plugin` 產生，請勿手改；要增減 plugin 請用 `aqutter plugin add/remove`，',
    '// 要給 plugin 帶參數請改 lib/plugins/ 內各 plugin 的檔案。',
    "import 'package:aqutter/aqutter.dart';",
    ...imports.map(path => `import '${path}';`),
    '',
    '/// 傳給 `runAqutter(plugins: aqutterPlugins)`。',
    plugins.length === 0
      ? 'final List<AqutterPluginEntry> aqutterPlugins = <AqutterPluginEntry>[];'
      : `final List<AqutterPluginEntry> aqutterPlugins = <AqutterPluginEntry>[\n${plugins.map(entry => `  AqutterPluginBuilder('${entry.id}', ${pluginFactoryName(entry.dart.class)}),`).join('\n')}\n];`,
    '',
  ]
  return lines.join('\n')
}

const pluginsDir = (project: Project): string => join(project.appDir, 'lib', 'plugins')

/** 使用者檔案的路徑。 */
export const pluginFilePath = (project: Project, id: string): string => join(pluginsDir(project), pluginFileName(id))

/**
 * 建立缺少的使用者檔案，絕不覆蓋既有的。先檢查所有既有檔案都有預期的工廠函式，
 * 任何一個不合就拋錯且不寫入任何檔案。回傳新建立的檔案路徑。
 */
export const scaffoldPluginFiles = (project: Project, plugins: PluginEntry[]): string[] => {
  const missing: PluginEntry[] = []
  for (const entry of plugins) {
    const file = pluginFilePath(project, entry.id)
    if (!existsSync(file)) {
      missing.push(entry)
      continue
    }
    const factory = pluginFactoryName(entry.dart.class)
    if (!new RegExp(`\\b${factory}\\s*\\(`).test(readFileSync(file, 'utf8'))) {
      throw new Error(`${file} 已存在但沒有預期的函式 ${factory}；請補上 ${factory}(AqutterBootContext context)，或刪除該檔後重新執行 aqutter plugin sync。`)
    }
  }
  return missing.map((entry) => {
    const file = pluginFilePath(project, entry.id)
    mkdirSync(pluginsDir(project), { recursive: true })
    writeFileSync(file, renderPluginFile(entry))
    return file
  })
}

/** pubspec 的受管區塊內容（不含標記行）。 */
export const renderPubspecBlock = (plugins: PluginEntry[], projectRoot: string, appDir: string): string[] => {
  return plugins.flatMap((entry) => {
    const path = relative(appDir, join(projectRoot, 'node_modules', entry.npm)).split('\\').join('/')
    return [`  ${entry.dart.package}:`, `    path: ${path}`]
  })
}

/** 把受管區塊寫回 pubspec；沒有標記時拋錯（範本以外的 pubspec 需手動補標記）。 */
export const applyPubspecBlock = (pubspec: string, block: string[]): string => {
  const begin = pubspec.indexOf(PUBSPEC_BEGIN)
  const end = pubspec.indexOf(PUBSPEC_END)
  if (begin === -1 || end === -1 || end < begin) {
    throw new Error(`pubspec.yaml 缺少 plugin 受管區塊標記（${PUBSPEC_BEGIN.trim()} … ${PUBSPEC_END.trim()}），請在 dependencies: 內補上這兩行。`)
  }
  const middle = block.length === 0 ? '' : `${block.join('\n')}\n`
  return `${pubspec.slice(0, begin)}${PUBSPEC_BEGIN}\n${middle}${pubspec.slice(end)}`
}

/**
 * 依 config 的 plugins 建立缺少的使用者檔案，並重寫 pubspec 與 `lib/aqutter_plugins.dart`。
 * 檢查（pubspec 標記、既有使用者檔案）都在寫入之前；回傳新建立的使用者檔案。
 */
export const syncPlugins = (project: Project): string[] => {
  const plugins = project.config.plugins
  const pubspecPath = join(project.appDir, 'pubspec.yaml')
  const original = readFileSync(pubspecPath, 'utf8')
  const next = applyPubspecBlock(original, renderPubspecBlock(plugins, project.root, project.appDir))
  const created = scaffoldPluginFiles(project, plugins)
  if (next !== original) {
    writeFileSync(pubspecPath, next)
  }
  writeFileSync(join(project.appDir, 'lib', PLUGINS_DART_FILE), renderPluginsDart(plugins))
  return created
}

/**
 * 套用新的 plugin 清單：先同步 pubspec 與註冊清單，成功後才寫回 aqutter.config.json，
 * 避免同步失敗時留下「config 說有、pubspec 沒有」的半套狀態。其餘設定內容原樣保留。
 */
export const updateConfigPlugins = (project: Project, update: (plugins: PluginEntry[]) => PluginEntry[]): string[] => {
  const previous = project.config.plugins
  const next = update([...previous])
  project.config.plugins = next
  let created: string[]
  try {
    created = syncPlugins(project)
  }
  catch (error) {
    project.config.plugins = previous
    throw error
  }
  const file = join(project.root, CONFIG_FILE)
  const raw = JSON.parse(readFileSync(file, 'utf8')) as Record<string, unknown>
  if (next.length === 0) {
    delete raw.plugins
  }
  else {
    raw.plugins = next
  }
  writeFileSync(file, `${JSON.stringify(raw, null, 2)}\n`)
  return created
}

/** 讀已安裝 npm 套件內的描述檔。 */
export const readInstalledDescriptor = (projectRoot: string, npmName: string): PluginDescriptor => {
  const file = join(projectRoot, 'node_modules', npmName, PLUGIN_DESCRIPTOR_FILE)
  if (!existsSync(file)) {
    throw new Error(`${npmName} 內找不到 ${PLUGIN_DESCRIPTOR_FILE}，它不是 Aqutter plugin。`)
  }
  return parseDescriptor(JSON.parse(readFileSync(file, 'utf8')), `${npmName}/${PLUGIN_DESCRIPTOR_FILE}`)
}
