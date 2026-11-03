// aqutter plugin：第三方 plugin 的建立與安裝。
//
//   aqutter plugin create <id> [--npm-name=<名>] [--dir=<目錄>] [--shell-ref=<tag>] [--shell-path=<殼目錄>]
//       由範本產生 plugin 專案（同時是 npm 套件與 Dart 套件）。
//   aqutter plugin add <來源> [--no-install]
//       以套件管理器安裝 npm 套件（來源可為套件名、github:owner/repo、file:路徑），讀 aqutter-plugin.json，
//       登記到 aqutter.config.json，並同步 pubspec 依賴、重寫 lib/aqutter_plugins.dart，
//       描述檔有 requires 時，一併安裝並登記被需要的 plugin、檢查版本範圍，
//       且建立缺少的 lib/plugins/<id>_plugin.dart（使用者檔案，只建立、永不覆蓋）。
//   aqutter plugin remove <id> [--purge] [--force]
//       預設保留 lib/plugins/<id>_plugin.dart 並印出路徑；--purge 才刪除。仍被其他 plugin 的 requires 需要時拒絕，--force 才移除。
//   aqutter plugin sync        依 aqutter.config.json 重寫 pubspec 與註冊清單、建立缺少的使用者檔案。
//   aqutter plugin list

import { spawnSync } from 'node:child_process'
import { existsSync, readFileSync, rmSync, writeFileSync } from 'node:fs'
import { isAbsolute, join, relative, resolve } from 'node:path'

import { loadProject } from '../config.ts'
import type { PluginDescriptor, PluginEntry, Project } from '../config.ts'
import { collectRequirements, findNativeGaps, selectFeatures } from '../native.ts'
import { IS_WIN, parseArgs } from '../shared.ts'
import { findTemplateRoot, renderTree } from '../template.ts'
import type { TemplateVariables } from '../template.ts'
import { findRequireProblems, PLUGIN_ID_PATTERN, pluginFilePath, readInstalledDescriptor, readInstalledVersion, syncPlugins, updateConfigPlugins } from '../plugins.ts'
import { addArgs, detectPackageManager } from '../web.ts'
import { readManifestFlags } from '../manifest.ts'
import { loadExpectedProfile } from './doctor.ts'
import type { PackageManager } from '../web.ts'
import { usePathDependency } from './init.ts'

const TAG = 'plugin'

const fail = (message: string): never => {
  console.error(`[${TAG}] ${message}`)
  process.exit(1)
}

const capitalize = (word: string): string => word.charAt(0).toUpperCase() + word.slice(1)

/** `native-view` → `NativeView`。 */
export const toClassName = (id: string): string => id.split('-').map(capitalize).join('')

/** `native-view` → `native_view`。 */
export const toSnake = (id: string): string => id.replace(/-/g, '_')

const runPm = (pm: PackageManager, args: string[], cwd: string): void => {
  console.log(`[${TAG}] ${pm} ${args.join(' ')}`)
  const result = spawnSync(pm, args, { cwd, stdio: 'inherit', shell: IS_WIN })
  if (result.status !== 0) {
    fail(`${pm} ${args.join(' ')} 失敗（exit ${result.status ?? 'signal'}）。`)
  }
}

/** package.json 的 dependencies／devDependencies：名稱對應到它的安裝來源（版本或 `github:`、`file:` 等）。 */
export type DependencySpecs = ReadonlyMap<string, string>

const readDependencySpecs = (root: string): DependencySpecs => {
  const file = join(root, 'package.json')
  if (!existsSync(file)) {
    return new Map()
  }
  const json = JSON.parse(readFileSync(file, 'utf8')) as Record<string, Record<string, string> | undefined>
  return new Map(Object.entries({ ...json.devDependencies, ...json.dependencies }))
}

/**
 * 判斷 `plugin add <來源>` 裝的是哪個 npm 套件。依序：
 *   1. 安裝後新增的依賴；
 *   2. 同名但來源被換掉的依賴（例如已用 `github:` 裝過，這次改用 `file:`——名稱前後都在，不是「新增」）；
 *   3. 來源本身就是套件名；
 *   4. 來源與某個依賴的來源完全相同（重複執行同一個指令）。
 *
 * 第 4 點是必要的：Windows 上經 `pnpm exec aqutter …` 啟動時，`pnpm add` 會重寫 `.bin` 裡的 `.CMD` 批次檔，
 * cmd.exe 邊讀邊執行的檔案被換掉，會把尾端的 `node …` 再執行一次；第二次執行時依賴已經在 package.json 裡，
 * 前面三點都找不到，沒有這一點就會誤報「無法判斷安裝的 npm 套件名」。
 */
export const pickInstalledName = (before: DependencySpecs, after: DependencySpecs, source: string): string | undefined => {
  const added = [...after.keys()].find(name => !before.has(name))
  if (added !== undefined) {
    return added
  }
  const changed = [...after].find(([name, spec]) => before.has(name) && before.get(name) !== spec)
  if (changed !== undefined) {
    return changed[0]
  }
  if (after.has(source)) {
    return source
  }
  return [...after].find(([, spec]) => spec === source)?.[0]
}

/** client 依賴字串 `github:Aqutter/aqutter-js#<ref>` 裡的 ref。 */
const clientRefOf = (spec: string): string | null => /^github:Aqutter\/aqutter-js#([^&\s]+)$/.exec(spec)?.[1] ?? null

const create = async (cwd: string, argv: string[]): Promise<void> => {
  const { positional, flags } = parseArgs(argv.filter(arg => arg !== '--offline' && arg !== '--refresh'))
  const id = positional[0]
  if (!id || !PLUGIN_ID_PATTERN.test(id)) {
    return fail(`用法：aqutter plugin create <id>（id 為小寫字母開頭、僅含小寫字母 / 數字 / 連字號，例如 haptics）`)
  }
  const dirName = flags.dir ?? `aqutter-plugin-${id}`
  const target = resolve(cwd, dirName)
  if (existsSync(target)) {
    return fail(`${dirName} 已存在。`)
  }
  // 殼與 client 的 ref：明給 --shell-ref 就照用；否則取 release manifest 的 stable release
  let refs: { shellRef: string, clientRef: string }
  if (flags['shell-ref'] !== undefined) {
    refs = { shellRef: flags['shell-ref'], clientRef: flags['shell-ref'] }
  }
  else {
    const { expected } = await loadExpectedProfile(readManifestFlags(argv))
    const clientRef = clientRefOf(expected.clientSpec)
    if (clientRef === null) {
      return fail(`框架版本 ${expected.version} 的 client 不是 GitHub 依賴（${expected.clientSpec}），plugin create 還不支援；請用 --shell-ref 指定。`)
    }
    refs = { shellRef: expected.version, clientRef }
  }
  const variables: TemplateVariables = {
    id,
    idSnake: toSnake(id),
    className: toClassName(id),
    dartPackage: `aqutter_plugin_${toSnake(id)}`,
    npmName: flags['npm-name'] ?? `aqutter-plugin-${id}`,
    shellRef: refs.shellRef,
    clientRef: refs.clientRef,
  }
  const { written } = renderTree(join(findTemplateRoot(), 'plugin'), target, variables)
  if (flags['shell-path']) {
    const shellFlag = flags['shell-path']
    const rel = isAbsolute(shellFlag) ? shellFlag : relative(target, resolve(cwd, shellFlag)).split('\\').join('/')
    const pubspec = join(target, 'pubspec.yaml')
    writeFileSync(pubspec, usePathDependency(readFileSync(pubspec, 'utf8'), rel))
  }
  console.log(`[${TAG}] 已建立 ${dirName}/（${written.length} 個檔案）`)
  console.log('\n下一步：')
  console.log(`  cd ${dirName} && pnpm install && flutter pub get && flutter test`)
  console.log(`  之後在 App 專案：aqutter plugin add file:../${dirName}`)
}

/**
 * 登記 plugin 之前先處理它的 `requires`：已登記的只檢查版本；沒登記的取該 plugin 的 `package.json`
 * `dependencies` 裡的來源，走同一個 add 流程安裝並登記（pnpm 不會把間接依賴提升到根目錄，
 * 而 pubspec 用 `node_modules/<套件名>` 當路徑，所以被需要的 plugin 必須成為 App 的直接依賴）。
 */
const ensureRequires = (cwd: string, ownerNpm: string, descriptor: PluginDescriptor, seen: ReadonlySet<string>): void => {
  const project = loadProject(cwd)
  for (const [name, range] of Object.entries(descriptor.requires ?? {})) {
    if (seen.has(name)) {
      fail(`plugin 的 requires 形成循環：${[...seen, name].join(' → ')}`)
    }
    if (!project.config.plugins.some(entry => entry.npm === name)) {
      const source = readDependencySpecs(join(project.root, 'node_modules', ownerNpm)).get(name)
      if (source === undefined) {
        fail(`${ownerNpm} 的 requires 列了 ${name}，但它的 package.json dependencies 沒有，無法判斷要從哪裡安裝。`)
      }
      console.log(`[${TAG}] ${descriptor.id} 需要 ${name}（${range}），一併安裝。`)
      add(cwd, [source as string], new Set([...seen, name]))
    }
  }
  const after = loadProject(cwd)
  const problems = findRequireProblems(descriptor.id, descriptor, after.config.plugins, name => readInstalledVersion(after.root, name))
  if (problems.length > 0) {
    fail(`${problems.join('；')}。「${descriptor.id}」未登記；已一併安裝的 plugin 仍會保留，要還原請用 aqutter plugin remove。`)
  }
}

const add = (cwd: string, argv: string[], seen: ReadonlySet<string> = new Set()): void => {
  // 契約允許 `--features a,b`（空白寫法）：先併成 `--features=a,b`，才不會被當成位置參數。
  const merged: string[] = []
  for (let index = 0; index < argv.length; index++) {
    merged.push(argv[index] === '--features' && argv[index + 1] !== undefined ? `--features=${argv[++index]}` : argv[index])
  }
  const { positional, flags } = parseArgs(merged.filter(arg => arg !== '--no-install'))
  const source = positional[0]
  if (!source) {
    return fail('用法：aqutter plugin add <來源>（套件名、github:owner/repo 或 file:路徑）')
  }
  const project = loadProject(cwd)
  const pm = detectPackageManager(project.root)
  const before = readDependencySpecs(project.root)

  // 來源與既有依賴完全相同、且套件已經在 node_modules 裡：視為已安裝，不再呼叫套件管理器。
  // 套件管理器會重寫 `.bin` 的批次檔（Windows 上會害正在執行的 cmd.exe 把指令再跑一次），能不跑就不跑。
  const alreadyInstalled = [...before].some(([name, spec]) => spec === source && existsSync(join(project.root, 'node_modules', name, 'aqutter-plugin.json')))
  if (!argv.includes('--no-install') && !alreadyInstalled) {
    runPm(pm, addArgs(pm, source), project.root)
  }

  const after = readDependencySpecs(project.root)
  const npmName = pickInstalledName(before, after, source)
  if (!npmName) {
    return fail('無法判斷安裝的 npm 套件名；請確認安裝成功（或套件已存在時，用套件名當來源）。')
  }

  const descriptor = readInstalledDescriptor(project.root, npmName)
  if (project.config.plugins.some(entry => entry.id === descriptor.id && entry.npm !== npmName)) {
    return fail(`plugin id「${descriptor.id}」已被另一個套件使用。`)
  }
  ensureRequires(cwd, npmName, descriptor, new Set([...seen, npmName]))
  // ensureRequires 可能已經登記了別的 plugin：以最新的 config 為準
  const latest = loadProject(cwd)
  let features: string[] | undefined
  try {
    features = flags.features === undefined ? undefined : selectFeatures(descriptor, flags.features.split(',').map(name => name.trim()).filter(Boolean))
  }
  catch (error) {
    return fail((error as Error).message)
  }
  const created = updateConfigPlugins(latest, plugins => [
    ...plugins.filter(entry => entry.id !== descriptor.id),
    { id: descriptor.id, npm: npmName, dart: descriptor.dart, ...(features === undefined ? {} : { features }) },
  ].sort((a, b) => a.id.localeCompare(b.id)))
  console.log(`[${TAG}] 已加入 plugin「${descriptor.id}」（${npmName}）。請在 ${latest.config.appDir}/ 執行 flutter pub get。`)
  reportCreated(latest, created)
  reportNativeGaps(latest, descriptor, features)
}

/** 只讀使用者的原生檔，列出還要補的設定；CLI 不替使用者改。 */
const reportNativeGaps = (project: Project, descriptor: PluginDescriptor, features: string[] | undefined): void => {
  if (descriptor.native === undefined) {
    return
  }
  const requirements = collectRequirements(descriptor, selectFeatures(descriptor, features))
  const gaps = findNativeGaps(project, requirements)
  if (gaps.length === 0 && requirements.notes.length === 0) {
    return
  }
  console.log(`[${TAG}] 「${descriptor.id}」需要你在原生專案補的設定（CLI 不會替你改）：`)
  for (const gap of gaps) {
    console.log(`  - ${gap.text}`)
  }
  for (const note of requirements.notes) {
    console.log(`  - ${note}`)
  }
}

const reportCreated = (project: Project, created: string[]): void => {
  for (const file of created) {
    console.log(`[${TAG}] 已建立 ${relative(project.root, file).split('\\').join('/')}（要給 plugin 帶參數就改這個檔，之後不會被覆蓋）。`)
  }
}

/** 已登記的其他 plugin 中，`requires` 指向 [entry] 的 plugin id。 */
const findDependents = (project: Project, entry: PluginEntry): string[] => {
  const names: string[] = []
  for (const other of project.config.plugins) {
    if (other.id === entry.id) {
      continue
    }
    try {
      if (readInstalledDescriptor(project.root, other.npm).requires?.[entry.npm] !== undefined) {
        names.push(other.id)
      }
    }
    catch {
      // 套件沒裝或描述檔壞掉：無從得知它需要什麼，不阻擋移除
    }
  }
  return names
}

const remove = (cwd: string, argv: string[]): void => {
  const { positional } = parseArgs(argv.filter(arg => arg !== '--purge' && arg !== '--force'))
  const purge = argv.includes('--purge')
  const id = positional[0]
  if (!id) {
    return fail('用法：aqutter plugin remove <id> [--purge] [--force]')
  }
  const project = loadProject(cwd)
  const entry = project.config.plugins.find(plugin => plugin.id === id)
  if (!entry) {
    return fail(`專案內沒有 plugin「${id}」。`)
  }
  const dependents = findDependents(project, entry)
  if (dependents.length > 0 && !argv.includes('--force')) {
    return fail(`「${id}」仍被 ${dependents.map(name => `「${name}」`).join('、')} 的 requires 需要；先移除它們，或加 --force 強制移除。`)
  }
  updateConfigPlugins(project, plugins => plugins.filter(plugin => plugin.id !== id))
  const pm = detectPackageManager(project.root)
  runPm(pm, ['remove', entry.npm], project.root)
  console.log(`[${TAG}] 已移除 plugin「${id}」。`)
  const file = pluginFilePath(project, id)
  if (!existsSync(file)) {
    return
  }
  const shown = relative(project.root, file).split('\\').join('/')
  if (purge) {
    rmSync(file)
    console.log(`[${TAG}] 已刪除 ${shown}。`)
  }
  else {
    console.log(`[${TAG}] 已保留 ${shown}（內有你的客製）；不需要時請自行刪除，或改用 --purge。`)
  }
}

export const runPlugin = async (cwd: string, argv: string[]): Promise<void> => {
  const [sub, ...rest] = argv
  switch (sub) {
    case 'create':
      return await create(cwd, rest)
    case 'add':
      return add(cwd, rest)
    case 'remove':
      return remove(cwd, rest)
    case 'sync': {
      const project = loadProject(cwd)
      const created = syncPlugins(project)
      console.log(`[${TAG}] 已同步 ${project.config.plugins.length} 個 plugin。`)
      reportCreated(project, created)
      return
    }
    case 'list': {
      const project = loadProject(cwd)
      for (const entry of project.config.plugins) {
        console.log(`${entry.id}\t${entry.npm}\t${entry.dart.package}`)
      }
      return
    }
    default:
      return fail('用法：aqutter plugin <create|add|remove|sync|list>')
  }
}
