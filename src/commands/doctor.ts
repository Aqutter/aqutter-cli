// aqutter doctor：唯讀檢查專案與框架 release manifest 所描述的版本是否一致，並指出怎麼修。
//
// 檢查項目：
//   0. 這支 CLI 是否夠新（release 的 cli.min）
//   1. 本機 Flutter 版本是否符合框架要求
//   2. <appDir>/pubspec.yaml 的 environment（sdk / flutter）與殼依賴 ref
//   3. <appDir>/.fvmrc 的 Flutter 版本（只在檔案已存在時檢查；FVM 是選配，框架不要求）
//   4. package.json 裡 @aqutter/aqutter-cli 的安裝語法、@aqutter/aqutter（github:Aqutter/aqutter-js#<ref>）的 ref
//   5. <appDir>/pubspec.lock 鎖的 commit 是否與 release 記載的 commit 一致
// 「框架版本」取自 release manifest 的 channels.stable（見 expectedProfile、src/manifest.ts）。
//
// 用法：aqutter doctor [--offline]
//   --offline : 不連網，manifest 只用本機快取，再退回內建快照
// 結束碼：有「錯誤」才為 1；只有「警告」仍為 0。

import { spawnSync } from 'node:child_process'
import { existsSync, readFileSync } from 'node:fs'
import { join } from 'node:path'

import pkg from '../../package.json'
import type { Project } from '../config.ts'
import { assertCliSupports, compareVersions, loadConfiguredManifest, resolveRelease } from '../manifest.ts'
import type { ManifestRelease } from '../manifest.ts'
import { IS_WIN } from '../shared.ts'
import {
  LOCKED_PACKAGES,
  SHELL_PACKAGE,
  classifyCliSpec,
  isClientGithubSpec,
  parseFvmrc,
  parseLock,
  parsePubspec,
  readNpmSpecs,
  satisfies,
} from '../versioning.ts'
import type { LockGitPackage, NpmSpec, PubspecInfo } from '../versioning.ts'

const TAG = 'doctor'

/** 框架某個 release 對專案的期望（取自 manifest）。 */
export interface ExpectedProfile {
  /** 框架 release 版本，例如 `0.0.0`。 */
  version: string
  sdk: string
  flutter: string
  /** 框架基準的確切 Flutter 版本（`flutter.baseline`）。 */
  flutterVersion: string
  shellRef: string
  coreRef: string
  clientSpec: string
  /** 能正確處理此 release 的最低 CLI 版本。 */
  cliMin: string
}

export const expectedProfile = (version: string, release: ManifestRelease): ExpectedProfile => ({
  version,
  sdk: release.dart,
  flutter: `>=${release.flutter.baseline}`,
  flutterVersion: release.flutter.baseline,
  shellRef: release.shell.ref,
  coreRef: release.core.ref,
  clientSpec: release.client.spec,
  cliMin: release.cli.min,
})

export type Level = 'ok' | 'warn' | 'error'

export interface Finding {
  level: Level
  title: string
  detail?: string
  /** 建議的修法。 */
  fix?: string
}

/** 蒐集到的事實；`null` 表示該檔案不存在或無法取得。 */
export interface Facts {
  expected: ExpectedProfile
  /** 正在執行的 CLI 版本。 */
  cliVersion: string
  installedFlutter: string | null
  pubspec: PubspecInfo | null
  /** `.fvmrc`（FVM 使用者自己放的選配檔）；沒有這個檔案為 null，此時不檢查。`version` 為 null 表示內容無法解析。 */
  fvmrc: { version: string | null } | null
  npmSpecs: NpmSpec[]
  lock: Record<string, LockGitPackage> | null
}

const UPGRADE_HINT = '執行 `aqutter upgrade`'
const short = (sha: string): string => sha.slice(0, 7)

export const diagnose = (facts: Facts): Finding[] => {
  const { expected } = facts
  const findings: Finding[] = []
  const add = (finding: Finding): void => {
    findings.push(finding)
  }

  // 0. CLI 本身
  if (compareVersions(facts.cliVersion, expected.cliMin) < 0) {
    add({
      level: 'error',
      title: `aqutter-cli ${facts.cliVersion} 太舊：框架版本 ${expected.version} 需要 ${expected.cliMin} 以上`,
      fix: '升級 aqutter-cli（改 package.json 的依賴並重新安裝）。',
    })
  }

  // 1. 本機 Flutter
  if (facts.installedFlutter === null) {
    add({ level: 'error', title: '找不到 flutter 指令', fix: `安裝 Flutter ${expected.flutterVersion}，並確認 flutter 在 PATH 上。` })
  }
  else {
    const within = satisfies(facts.installedFlutter, expected.flutter)
    if (within === false) {
      add({
        level: 'error',
        title: `Flutter 版本不符：已安裝 ${facts.installedFlutter}，框架要求 ${expected.flutter}`,
        fix: `改用 Flutter ${expected.flutterVersion}（用哪種工具切換版本由你決定，FVM 只是選項之一）。`,
      })
    }
    else if (facts.installedFlutter !== expected.flutterVersion) {
      // pubspec 只有下限、沒有上限：比基準新的版本不會被 pub 擋下，由這裡提醒
      add({
        level: 'warn',
        title: `Flutter ${facts.installedFlutter} 比框架驗證過的版本（${expected.flutterVersion}）新`,
        detail: '框架尚未在此版本上驗證，可以嘗試；遇到編譯錯誤時，先改回基準版本確認是否為版本差異造成。',
      })
    }
    else {
      add({ level: 'ok', title: `Flutter ${facts.installedFlutter}` })
    }
  }

  // 2. pubspec
  if (facts.pubspec === null) {
    add({ level: 'error', title: '找不到 App 的 pubspec.yaml', fix: '確認 aqutter.config.json 的 appDir，或執行 `aqutter init`。' })
  }
  else {
    const { pubspec } = facts
    if (pubspec.flutter === expected.flutter && pubspec.sdk === expected.sdk) {
      add({ level: 'ok', title: `pubspec environment（flutter ${pubspec.flutter}）` })
    }
    else {
      add({
        level: 'warn',
        title: `pubspec environment 與框架不一致：flutter ${pubspec.flutter ?? '（未設定）'}、sdk ${pubspec.sdk ?? '（未設定）'}`,
        detail: `框架要求 flutter ${expected.flutter}、sdk ${expected.sdk}`,
        fix: UPGRADE_HINT,
      })
    }
    if (pubspec.shell === null) {
      add({ level: 'warn', title: `pubspec 沒有 ${SHELL_PACKAGE} 依賴`, fix: '確認這是 aqutter 產生的 App 目錄。' })
    }
    else if (pubspec.shell.kind === 'path') {
      add({ level: 'ok', title: `殼依賴指向本機路徑（${pubspec.shell.path}），略過 ref 檢查` })
    }
    else if (pubspec.shell.ref === expected.shellRef) {
      add({ level: 'ok', title: `殼 ref ${short(pubspec.shell.ref)}` })
    }
    // 開發階段允許寫框架版本的 tag（例如 0.0.0）：tag 會隨 main 移動，App 與 plugin 的殼 ref 字串必須完全相同
    else if (pubspec.shell.ref === expected.version) {
      add({ level: 'ok', title: `殼 ref ${pubspec.shell.ref}（框架版本 tag）` })
    }
    else {
      add({
        level: 'warn',
        title: `殼 ref 是 ${pubspec.shell.ref ?? '（未設定）'}，框架版本 ${expected.version} 對應 ${short(expected.shellRef)}`,
        fix: UPGRADE_HINT,
      })
    }
  }

  // 3. .fvmrc：選配。專案沒有就完全不檢查，不要求任何人使用 FVM。
  if (facts.fvmrc !== null) {
    if (facts.fvmrc.version === null) {
      add({ level: 'warn', title: '.fvmrc 不是合法的 JSON 或缺少 flutter 欄位', fix: `改為 { "flutter": "${expected.flutterVersion}" }，或刪除該檔。` })
    }
    else if (facts.fvmrc.version === expected.flutterVersion) {
      add({ level: 'ok', title: `.fvmrc ${facts.fvmrc.version}` })
    }
    else {
      add({ level: 'warn', title: `.fvmrc 是 ${facts.fvmrc.version}，框架基準是 ${expected.flutterVersion}`, fix: UPGRADE_HINT })
    }
  }

  // 4. npm 依賴
  const cliSpec = facts.npmSpecs.find(entry => entry.name === '@aqutter/aqutter-cli')
  const clientSpec = facts.npmSpecs.find(entry => entry.name === '@aqutter/aqutter')
  if (cliSpec === undefined && clientSpec === undefined) {
    add({ level: 'ok', title: 'package.json 沒有 Aqutter 的依賴，略過' })
  }
  if (cliSpec !== undefined) {
    if (classifyCliSpec(cliSpec.spec) === 'legacy') {
      add({
        level: 'warn',
        title: `@aqutter/aqutter-cli 仍用舊的子目錄安裝語法（${cliSpec.spec}）`,
        detail: '這個語法只有 pnpm 能安裝，npm、yarn、bun 都會失敗。',
        fix: `${UPGRADE_HINT}，再重新安裝依賴。`,
      })
    }
    else {
      add({ level: 'ok', title: `@aqutter/aqutter-cli 依賴 ${cliSpec.spec}` })
    }
  }
  if (clientSpec !== undefined && isClientGithubSpec(clientSpec.spec)) {
    if (clientSpec.spec === expected.clientSpec) {
      add({ level: 'ok', title: '@aqutter/aqutter 與框架版本一致' })
    }
    else {
      add({
        level: 'warn',
        title: `@aqutter/aqutter 與框架版本 ${expected.version} 不一致：${clientSpec.spec}`,
        detail: `框架版本要求 ${expected.clientSpec}`,
        fix: `${UPGRADE_HINT}，再重新安裝依賴。`,
      })
    }
  }

  // 5. lock 是否與 release 記載的 commit 一致
  if (facts.lock === null) {
    add({ level: 'warn', title: '沒有 pubspec.lock', fix: '在 App 目錄執行 `flutter pub get`。' })
  }
  else {
    const wanted: Record<string, string> = { [SHELL_PACKAGE]: expected.shellRef, aqutter_core: expected.coreRef }
    for (const name of LOCKED_PACKAGES) {
      const entry = facts.lock[name]
      if (!entry) {
        continue
      }
      if (entry.resolvedRef === wanted[name]) {
        add({ level: 'ok', title: `${name} lock 與框架版本一致（${short(entry.resolvedRef)}）` })
      }
      else {
        add({
          level: 'warn',
          title: `${name} 的 lock 與框架版本 ${expected.version} 不一致：鎖在 ${short(entry.resolvedRef)}，框架記載 ${short(wanted[name])}`,
          fix: '在 App 目錄執行 `flutter pub upgrade aqutter aqutter_core`（`aqutter upgrade` 也會做）。',
        })
      }
    }
  }
  return findings
}

// ---- 蒐集事實 ----

const readIfExists = (file: string): string | null => (existsSync(file) ? readFileSync(file, 'utf8') : null)

/** `flutter --version --machine` → frameworkVersion；失敗回 null。 */
export const detectFlutterVersion = (cwd: string): string | null => {
  const result = spawnSync('flutter', ['--version', '--machine'], { cwd, encoding: 'utf8', shell: IS_WIN })
  const out = result.stdout ?? ''
  const start = out.indexOf('{')
  const end = out.lastIndexOf('}')
  if (start === -1 || end <= start) {
    return null
  }
  try {
    const version = (JSON.parse(out.slice(start, end + 1)) as { frameworkVersion?: string }).frameworkVersion
    return typeof version === 'string' ? version : null
  }
  catch {
    return null
  }
}

export const gatherFacts = (project: Project, expected: ExpectedProfile): Facts => {
  const pubspecText = readIfExists(join(project.appDir, 'pubspec.yaml'))
  const fvmrcText = readIfExists(join(project.appDir, '.fvmrc'))
  const packageText = readIfExists(join(project.root, 'package.json'))
  const lockText = readIfExists(join(project.appDir, 'pubspec.lock'))
  return {
    expected,
    cliVersion: pkg.version,
    installedFlutter: detectFlutterVersion(project.appDir),
    pubspec: pubspecText === null ? null : parsePubspec(pubspecText),
    fvmrc: fvmrcText === null ? null : { version: parseFvmrc(fvmrcText) },
    npmSpecs: packageText === null ? [] : readNpmSpecs(packageText),
    lock: lockText === null ? null : parseLock(lockText),
  }
}

const LABEL: Record<Level, string> = { ok: '[ok]  ', warn: '[警告]', error: '[錯誤]' }

export const runDoctor = async (project: Project, argv: string[]): Promise<void> => {
  const offline = argv.includes('--offline')
  console.log(`[${TAG}] 專案：${project.root}（CLI ${pkg.version}）`)
  const loaded = await loadConfiguredManifest({ offline, projectConfig: project.config })
  const { version, release } = resolveRelease(loaded.manifest)
  console.log(`[${TAG}] 框架版本：${version}（manifest 來源：${loaded.source}）`)
  const findings = diagnose(gatherFacts(project, expectedProfile(version, release)))
  for (const finding of findings) {
    console.log(`${LABEL[finding.level]} ${finding.title}`)
    if (finding.detail) {
      console.log(`         ${finding.detail}`)
    }
    if (finding.fix && finding.level !== 'ok') {
      console.log(`         → ${finding.fix}`)
    }
  }
  const errors = findings.filter(f => f.level === 'error').length
  const warnings = findings.filter(f => f.level === 'warn').length
  console.log(`\n[${TAG}] ${errors} 個錯誤、${warnings} 個警告。`)
  if (errors > 0) {
    process.exit(1)
  }
}

// 供 upgrade 共用：載入 manifest、挑 release 並檢查 CLI 夠新。
export const loadExpectedProfile = async (options: { offline: boolean, projectConfig?: unknown, requested?: string }): Promise<{ expected: ExpectedProfile, release: ManifestRelease, source: string }> => {
  const loaded = await loadConfiguredManifest({ offline: options.offline, projectConfig: options.projectConfig })
  const { version, release } = resolveRelease(loaded.manifest, options.requested)
  assertCliSupports(release, pkg.version)
  return { expected: expectedProfile(version, release), release, source: loaded.source }
}
