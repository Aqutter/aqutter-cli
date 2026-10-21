// release manifest：框架「哪些版本是一組」的唯一來源（契約 rev 1，正本在 Aqutter/aqutter 的
// manifest/releases.json 與 manifest/schema.json）。這裡負責取得、驗證與挑選 release：
//   - 取得（Contract §4）：24 小時快取 → 連網（逾時 15 秒）→ 退回過期快取 → 退回內建快照
//   - 驗證（Contract §2）：型別、格式、網址主機允許清單；`schema` 比自己支援的新就中止
//   - 只讀「宣告式欄位」：清單永遠不會被當成指令或腳本執行（Contract §4 安全）
// 網路與檔案 I/O 都由呼叫端注入（ManifestIo），單元測試不碰真實網路。

import { mkdirSync, readFileSync, statSync, writeFileSync } from 'node:fs'
import { homedir } from 'node:os'
import { join } from 'node:path'

import snapshot from './manifestSnapshot.json'

export const DEFAULT_MANIFEST_URL = 'https://raw.githubusercontent.com/Aqutter/aqutter/main/manifest/releases.json'
export const MANIFEST_URL_ENV = 'AQUTTER_MANIFEST_URL'

/** 本 CLI 看得懂的最大 `schema`。 */
export const SUPPORTED_SCHEMA = 1

const DEFAULT_TTL_MS = 24 * 60 * 60 * 1000
const DEFAULT_TIMEOUT_MS = 15_000
const MAX_BYTES = 1024 * 1024

export type ReleaseStatus = 'supported' | 'deprecated' | 'yanked'

export interface ManifestRelease {
  status: ReleaseStatus
  flutter: { baseline: string }
  dart: string
  shell: { url: string, path: string, ref: string }
  core: { url: string, ref: string }
  client: { spec: string }
  cli: { min: string }
  notes?: string
}

export interface ReleaseManifest {
  schema: number
  generatedAt: string
  channels: Record<string, string>
  releases: Record<string, ManifestRelease>
}

/** 清單不合格式（可退回其他來源）。 */
export class ManifestError extends Error {
  constructor(message: string) {
    super(message)
    this.name = 'ManifestError'
  }
}

/** 清單的 `schema` 比本 CLI 支援的新：必須中止並請使用者升級 CLI，不能退回其他來源。 */
export class ManifestTooNewError extends Error {
  constructor(schema: number) {
    super(`release manifest 的格式版本是 ${schema}，這支 aqutter-cli 只支援到 ${SUPPORTED_SCHEMA}。請升級 aqutter-cli。`)
    this.name = 'ManifestTooNewError'
  }
}

const VERSION = /^\d+\.\d+\.\d+$/
const SHA = /^[0-9a-f]{40}$/
const GITHUB_GIT_URL = /^https:\/\/github\.com\/[A-Za-z0-9_.-]+\/[A-Za-z0-9_.-]+\.git$/
const DART_CONSTRAINT = /^(>=|<=|>|<)?\d+\.\d+\.\d+( (>=|<=|>|<)\d+\.\d+\.\d+)*$/
const STATUSES: readonly string[] = ['supported', 'deprecated', 'yanked']

const isRecord = (value: unknown): value is Record<string, unknown> => typeof value === 'object' && value !== null && !Array.isArray(value)

/** 把 `X.Y.Z` 拆成三個數字；格式不符回 null。 */
const triple = (version: string): [number, number, number] | null => {
  const match = /^(\d+)\.(\d+)\.(\d+)/.exec(version)
  return match ? [Number(match[1]), Number(match[2]), Number(match[3])] : null
}

/** 版本比較：a 小於 b 回負數、相等回 0、大於回正數；任一邊格式不符回 NaN。 */
export const compareVersions = (a: string, b: string): number => {
  const left = triple(a)
  const right = triple(b)
  if (!left || !right) {
    return Number.NaN
  }
  for (let i = 0; i < 3; i += 1) {
    if (left[i] !== right[i]) {
      return left[i] - right[i]
    }
  }
  return 0
}

/**
 * 驗證並轉成 ReleaseManifest。`schema` 過新拋 ManifestTooNewError（在檢查其餘欄位之前，
 * 因為新格式的其餘欄位本來就可能不同）；其餘不合格式一律拋 ManifestError，列出全部問題。
 * 不認識的欄位會被忽略（向前相容）。
 */
export const parseManifest = (raw: unknown): ReleaseManifest => {
  if (!isRecord(raw)) {
    throw new ManifestError('manifest 必須是 JSON 物件')
  }
  if (typeof raw.schema !== 'number' || !Number.isInteger(raw.schema) || raw.schema < 1) {
    throw new ManifestError('schema 必須是正整數')
  }
  if (raw.schema > SUPPORTED_SCHEMA) {
    throw new ManifestTooNewError(raw.schema)
  }

  const problems: string[] = []
  const text = (value: unknown, pattern: RegExp, where: string): string => {
    if (typeof value !== 'string' || !pattern.test(value)) {
      problems.push(`${where} 格式不符`)
      return ''
    }
    return value
  }

  if (typeof raw.generatedAt !== 'string') {
    problems.push('generatedAt 必須是字串')
  }

  const channels: Record<string, string> = {}
  if (!isRecord(raw.channels)) {
    problems.push('channels 必須是物件')
  }
  else {
    for (const [name, version] of Object.entries(raw.channels)) {
      channels[name] = text(version, VERSION, `channels.${name}`)
    }
    if (channels.stable === undefined) {
      problems.push('channels 必須含 stable')
    }
  }

  const releases: Record<string, ManifestRelease> = {}
  if (!isRecord(raw.releases) || Object.keys(raw.releases).length === 0) {
    problems.push('releases 必須是至少一筆的物件')
  }
  else {
    for (const [version, entry] of Object.entries(raw.releases)) {
      const where = `releases.${version}`
      if (!VERSION.test(version)) {
        problems.push(`${where} 的鍵不是 X.Y.Z`)
        continue
      }
      if (!isRecord(entry)) {
        problems.push(`${where} 必須是物件`)
        continue
      }
      const flutter = isRecord(entry.flutter) ? entry.flutter : {}
      const shell = isRecord(entry.shell) ? entry.shell : {}
      const core = isRecord(entry.core) ? entry.core : {}
      const client = isRecord(entry.client) ? entry.client : {}
      const cli = isRecord(entry.cli) ? entry.cli : {}
      if (!STATUSES.includes(entry.status as string)) {
        problems.push(`${where}.status 必須是 ${STATUSES.join('／')}`)
      }
      if (entry.notes !== undefined && (typeof entry.notes !== 'string' || !/^https:\/\/.+/.test(entry.notes))) {
        problems.push(`${where}.notes 必須是 https 網址（沒有就省略該鍵）`)
      }
      if (typeof client.spec !== 'string' || client.spec === '') {
        problems.push(`${where}.client.spec 必須是非空字串`)
      }
      if (shell.path !== 'shell') {
        problems.push(`${where}.shell.path 必須是 shell`)
      }
      releases[version] = {
        status: entry.status as ReleaseStatus,
        flutter: { baseline: text(flutter.baseline, VERSION, `${where}.flutter.baseline`) },
        dart: text(entry.dart, DART_CONSTRAINT, `${where}.dart`),
        shell: {
          url: text(shell.url, GITHUB_GIT_URL, `${where}.shell.url`),
          path: 'shell',
          ref: text(shell.ref, SHA, `${where}.shell.ref`),
        },
        core: {
          url: text(core.url, GITHUB_GIT_URL, `${where}.core.url`),
          ref: text(core.ref, SHA, `${where}.core.ref`),
        },
        client: { spec: typeof client.spec === 'string' ? client.spec : '' },
        cli: { min: text(cli.min, VERSION, `${where}.cli.min`) },
        ...(typeof entry.notes === 'string' ? { notes: entry.notes } : {}),
      }
    }
  }

  // 頻道必須指向存在的 release；stable 必須是 supported
  for (const [name, version] of Object.entries(channels)) {
    if (version !== '' && releases[version] === undefined) {
      problems.push(`channels.${name} 指向不存在的 release ${version}`)
    }
  }
  if (channels.stable && releases[channels.stable] && releases[channels.stable].status !== 'supported') {
    problems.push('channels.stable 必須指向 status 為 supported 的 release')
  }

  if (problems.length > 0) {
    throw new ManifestError(problems.join('；'))
  }
  return {
    schema: raw.schema,
    generatedAt: raw.generatedAt as string,
    channels,
    releases,
  }
}

const parseText = (text: string): ReleaseManifest => {
  let raw: unknown
  try {
    raw = JSON.parse(text)
  }
  catch {
    throw new ManifestError('manifest 不是合法的 JSON')
  }
  return parseManifest(raw)
}

/** 取得 manifest 所需的外部能力；測試以假的取代。 */
export interface ManifestIo {
  now: () => number
  fetchText: (url: string, timeoutMs: number) => Promise<string>
  readCache: () => { text: string, mtimeMs: number } | null
  writeCache: (text: string) => void
}

export interface LoadOptions {
  url: string
  /** 不連網：只用快取，再退回內建快照。 */
  offline: boolean
  /** 內建的最後已知 manifest（已解析的 JSON 內容）。 */
  snapshot: unknown
  io: ManifestIo
  ttlMs?: number
  timeoutMs?: number
}

export type ManifestSource = 'network' | 'cache' | 'stale-cache' | 'snapshot'

export interface LoadedManifest {
  manifest: ReleaseManifest
  source: ManifestSource
  /** 需要讓使用者知道的事（例如退回了過期快取）。 */
  warnings: string[]
}

/** 依 Contract §4 取得 manifest。 */
export const loadManifest = async (options: LoadOptions): Promise<LoadedManifest> => {
  const ttlMs = options.ttlMs ?? DEFAULT_TTL_MS
  const timeoutMs = options.timeoutMs ?? DEFAULT_TIMEOUT_MS
  const warnings: string[] = []

  /** 讀快取；內容不合格式視為沒有快取。schema 過新照樣拋出（不能退回別處）。 */
  const cached = (): { manifest: ReleaseManifest, mtimeMs: number } | null => {
    const entry = options.io.readCache()
    if (!entry) {
      return null
    }
    try {
      return { manifest: parseText(entry.text), mtimeMs: entry.mtimeMs }
    }
    catch (error) {
      if (error instanceof ManifestTooNewError) {
        throw error
      }
      return null
    }
  }

  const fromSnapshot = (reason: string): LoadedManifest => {
    try {
      const manifest = parseManifest(options.snapshot)
      return { manifest, source: 'snapshot', warnings: [...warnings, `${reason}，改用內建的 release manifest 快照（可能不是最新）。`] }
    }
    catch (error) {
      if (error instanceof ManifestTooNewError) {
        throw error
      }
      throw new ManifestError(`${reason}，而且內建快照也不可用：${(error as Error).message}`)
    }
  }

  const cache = cached()

  if (options.offline) {
    if (cache) {
      return { manifest: cache.manifest, source: 'cache', warnings }
    }
    return fromSnapshot('離線且沒有快取')
  }

  if (cache && options.io.now() - cache.mtimeMs < ttlMs) {
    return { manifest: cache.manifest, source: 'cache', warnings }
  }

  let failure: string
  try {
    const text = await options.io.fetchText(options.url, timeoutMs)
    const manifest = parseText(text)
    options.io.writeCache(text)
    return { manifest, source: 'network', warnings }
  }
  catch (error) {
    if (error instanceof ManifestTooNewError) {
      throw error
    }
    failure = `無法取得 release manifest（${(error as Error).message}）`
  }

  if (cache) {
    warnings.push(`${failure}，改用過期的本機快取。`)
    return { manifest: cache.manifest, source: 'stale-cache', warnings }
  }
  return fromSnapshot(failure)
}

/** 挑選要用的 release：未指定時取 `channels.stable`；不存在或已撤回（yanked）拋錯。 */
export const resolveRelease = (manifest: ReleaseManifest, requested?: string): { version: string, release: ManifestRelease } => {
  const version = requested ?? manifest.channels.stable
  const release = manifest.releases[version]
  if (!release) {
    throw new ManifestError(`找不到版本 ${version}。可用版本：${Object.keys(manifest.releases).join('、')}`)
  }
  if (release.status === 'yanked') {
    throw new ManifestError(`版本 ${version} 已撤回（yanked），不能使用。${release.notes ? `說明：${release.notes}` : ''}`.trim())
  }
  return { version, release }
}

/** 本 CLI 比 release 要求的最低版本舊時拋錯，請使用者升級。 */
export const assertCliSupports = (release: ManifestRelease, cliVersion: string): void => {
  if (compareVersions(cliVersion, release.cli.min) < 0) {
    throw new ManifestError(`這個框架版本需要 aqutter-cli ${release.cli.min} 以上（目前 ${cliVersion}）。請升級 aqutter-cli。`)
  }
}

// ---- 預設的實際 I/O ----

/** 快取目錄：Windows 為 %LOCALAPPDATA%\aqutter，其餘為 $XDG_CACHE_HOME/aqutter 或 ~/.cache/aqutter。 */
export const defaultCacheDir = (env: NodeJS.ProcessEnv = process.env, platform: string = process.platform): string => {
  if (platform === 'win32') {
    return join(env.LOCALAPPDATA ?? join(homedir(), 'AppData', 'Local'), 'aqutter')
  }
  return join(env.XDG_CACHE_HOME ?? join(homedir(), '.cache'), 'aqutter')
}

export const createFileIo = (cacheDir: string = defaultCacheDir()): ManifestIo => {
  const file = join(cacheDir, 'releases.json')
  return {
    now: () => Date.now(),
    fetchText: async (url, timeoutMs) => {
      if (!url.startsWith('https://')) {
        throw new Error('只接受 https 網址')
      }
      const controller = new AbortController()
      const timer = setTimeout(() => controller.abort(), timeoutMs)
      try {
        const response = await fetch(url, { signal: controller.signal, headers: { accept: 'application/json' } })
        if (!response.ok) {
          throw new Error(`HTTP ${response.status}`)
        }
        const text = await response.text()
        if (text.length > MAX_BYTES) {
          throw new Error('內容過大')
        }
        return text
      }
      catch (error) {
        if (controller.signal.aborted) {
          throw new Error(`逾時（${timeoutMs / 1000} 秒）`)
        }
        throw error
      }
      finally {
        clearTimeout(timer)
      }
    },
    readCache: () => {
      try {
        return { text: readFileSync(file, 'utf8'), mtimeMs: statSync(file).mtimeMs }
      }
      catch {
        return null
      }
    },
    writeCache: (text) => {
      try {
        mkdirSync(cacheDir, { recursive: true })
        writeFileSync(file, text)
      }
      catch {
        // 快取寫不進去不影響這次執行
      }
    },
  }
}

/** manifest 網址：環境變數優先，其次專案設定的 `manifest.url`，最後是內建預設。非 https 的值一律忽略。 */
export const manifestUrl = (env: NodeJS.ProcessEnv = process.env, projectConfig?: unknown): string => {
  const candidates: unknown[] = [env[MANIFEST_URL_ENV]]
  if (isRecord(projectConfig) && isRecord(projectConfig.manifest)) {
    candidates.push(projectConfig.manifest.url)
  }
  const found = candidates.find((value): value is string => typeof value === 'string' && value.startsWith('https://'))
  return found ?? DEFAULT_MANIFEST_URL
}

/** 指令用的入口：依環境變數、專案設定與 `--offline` 取得 manifest，並把警告印到 stderr。 */
export const loadConfiguredManifest = async (options: { offline: boolean, projectConfig?: unknown }): Promise<LoadedManifest> => {
  const loaded = await loadManifest({
    url: manifestUrl(process.env, options.projectConfig),
    offline: options.offline,
    snapshot,
    io: createFileIo(),
  })
  for (const warning of loaded.warnings) {
    console.warn(`[manifest] ${warning}`)
  }
  return loaded
}
