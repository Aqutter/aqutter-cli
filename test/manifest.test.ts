import { describe, expect, it } from 'vitest'

import snapshot from '../src/manifestSnapshot.json'
import {
  DEFAULT_MANIFEST_URL,
  ManifestError,
  ManifestTooNewError,
  assertCliSupports,
  compareVersions,
  defaultCacheDir,
  describeSource,
  formatAge,
  loadManifest,
  manifestUrl,
  parseManifest,
  parseManifestFlags,
  resolveRelease,
} from '../src/manifest.ts'
import type { ManifestIo } from '../src/manifest.ts'

const SHA = 'a'.repeat(40)

const release = (overrides: Record<string, unknown> = {}): Record<string, unknown> => ({
  status: 'supported',
  flutter: { baseline: '3.47.4' },
  dart: '>=3.13.0 <4.0.0',
  shell: { url: 'https://github.com/Aqutter/aqutter.git', path: 'shell', ref: SHA },
  core: { url: 'https://github.com/Aqutter/aqutter_core.git', ref: SHA },
  client: { spec: `github:Aqutter/aqutter-js#${SHA}` },
  cli: { min: '0.0.0' },
  ...overrides,
})

const manifest = (overrides: Record<string, unknown> = {}): Record<string, unknown> => ({
  schema: 1,
  generatedAt: '2026-10-21T04:00:00Z',
  channels: { stable: '0.0.0' },
  releases: { '0.0.0': release() },
  ...overrides,
})

describe('parseManifest', () => {
  it('accepts a valid manifest and the built-in snapshot', () => {
    expect(parseManifest(manifest()).channels.stable).toBe('0.0.0')
    expect(parseManifest(snapshot).releases[snapshot.channels.stable].status).toBe('supported')
  })

  it('ignores unknown fields (forward compatibility)', () => {
    const parsed = parseManifest(manifest({ future: { a: 1 }, releases: { '0.0.0': release({ templates: ['x'] }) } }))
    expect(parsed.releases['0.0.0'].flutter.baseline).toBe('3.47.4')
  })

  it('refuses a schema newer than supported, before looking at anything else', () => {
    expect(() => parseManifest({ schema: 2, anything: 'else' })).toThrow(ManifestTooNewError)
  })

  it('rejects problems and lists them', () => {
    const bad = manifest({
      releases: {
        '0.0.0': release({
          shell: { url: 'https://example.com/x.git', path: 'shell', ref: '0.0.0' },
          dart: 'any',
          notes: null,
        }),
      },
    })
    expect(() => parseManifest(bad)).toThrow(/shell\.url.*shell\.ref.*dart|notes/s)
  })

  it('refuses tags as refs, even though they look like versions', () => {
    const bad = manifest({ releases: { '0.0.0': release({ core: { url: 'https://github.com/Aqutter/aqutter_core.git', ref: '0.0.0' } }) } })
    expect(() => parseManifest(bad)).toThrow(/core\.ref/)
  })

  it('requires stable, an existing target, and stable to be supported', () => {
    expect(() => parseManifest(manifest({ channels: {} }))).toThrow(/stable/)
    expect(() => parseManifest(manifest({ channels: { stable: '9.9.9' } }))).toThrow(/不存在/)
    expect(() => parseManifest(manifest({ releases: { '0.0.0': release({ status: 'deprecated' }) } }))).toThrow(/supported/)
  })

  it('rejects non-objects and invalid status', () => {
    expect(() => parseManifest(null)).toThrow(ManifestError)
    expect(() => parseManifest(manifest({ releases: { '0.0.0': release({ status: 'weird' }) } }))).toThrow(/status/)
  })
})

describe('compareVersions', () => {
  it('orders versions numerically', () => {
    expect(compareVersions('0.0.9', '0.0.10')).toBeLessThan(0)
    expect(compareVersions('1.2.3', '1.2.3')).toBe(0)
    expect(compareVersions('2.0.0', '1.9.9')).toBeGreaterThan(0)
    expect(compareVersions('x', '1.0.0')).toBeNaN()
  })
})

interface FakeState {
  cache: { text: string, mtimeMs: number } | null
  now: number
  fetchResult: string | Error
  fetched: string[]
  written: string[]
}

const fake = (state: FakeState): ManifestIo => ({
  now: () => state.now,
  fetchText: async (url) => {
    state.fetched.push(url)
    if (state.fetchResult instanceof Error) {
      throw state.fetchResult
    }
    return state.fetchResult
  },
  readCache: () => state.cache,
  writeCache: (text) => {
    state.written.push(text)
    state.cache = { text, mtimeMs: state.now }
  },
})

const HOUR = 60 * 60 * 1000
const NEW_TEXT = JSON.stringify(manifest({ generatedAt: '2026-10-22T00:00:00Z' }))
const OLD_TEXT = JSON.stringify(manifest({ generatedAt: '2026-10-01T00:00:00Z' }))

const state = (overrides: Partial<FakeState> = {}): FakeState => ({
  cache: null,
  now: 100 * HOUR,
  fetchResult: NEW_TEXT,
  fetched: [],
  written: [],
  ...overrides,
})

const load = (s: FakeState, options: { offline?: boolean, refresh?: boolean, snapshot?: unknown } = {}) => loadManifest({
  url: 'https://example.com/releases.json',
  offline: options.offline ?? false,
  refresh: options.refresh,
  snapshot: options.snapshot ?? snapshot,
  io: fake(s),
})

describe('loadManifest', () => {
  it('uses a fresh cache without touching the network', async () => {
    const s = state({ cache: { text: OLD_TEXT, mtimeMs: 100 * HOUR - HOUR } })
    const result = await load(s)
    expect(result.source).toBe('cache')
    expect(s.fetched).toEqual([])
    expect(result.manifest.generatedAt).toBe('2026-10-01T00:00:00Z')
  })

  it('fetches when the cache is older than 24 hours and rewrites the cache', async () => {
    const s = state({ cache: { text: OLD_TEXT, mtimeMs: 100 * HOUR - 25 * HOUR } })
    const result = await load(s)
    expect(result.source).toBe('network')
    expect(s.fetched).toEqual(['https://example.com/releases.json'])
    expect(s.written).toEqual([NEW_TEXT])
    expect(result.manifest.generatedAt).toBe('2026-10-22T00:00:00Z')
  })

  it('fetches when there is no cache', async () => {
    const s = state()
    expect((await load(s)).source).toBe('network')
    expect(s.written).toHaveLength(1)
  })

  it('falls back to a stale cache, with a warning, when the fetch fails', async () => {
    const s = state({ cache: { text: OLD_TEXT, mtimeMs: 0 }, fetchResult: new Error('逾時') })
    const result = await load(s)
    expect(result.source).toBe('stale-cache')
    expect(result.warnings[0]).toMatch(/逾時.*過期/)
  })

  it('falls back to the built-in snapshot when there is no cache and the fetch fails', async () => {
    const result = await load(state({ fetchResult: new Error('HTTP 404') }))
    expect(result.source).toBe('snapshot')
    expect(result.warnings[0]).toMatch(/HTTP 404.*快照/)
  })

  it('treats an invalid fetched manifest like a failed fetch and keeps the cache untouched', async () => {
    const s = state({ fetchResult: '{"schema":1}' })
    const result = await load(s)
    expect(result.source).toBe('snapshot')
    expect(s.written).toEqual([])
  })

  it('aborts when the fetched manifest is newer than supported, even with a usable cache', async () => {
    const s = state({ cache: { text: OLD_TEXT, mtimeMs: 0 }, fetchResult: JSON.stringify({ schema: 9 }) })
    await expect(load(s)).rejects.toBeInstanceOf(ManifestTooNewError)
  })

  it('aborts when the cached manifest is newer than supported', async () => {
    const s = state({ cache: { text: JSON.stringify({ schema: 9 }), mtimeMs: 100 * HOUR } })
    await expect(load(s)).rejects.toBeInstanceOf(ManifestTooNewError)
  })

  it('ignores an unreadable cache', async () => {
    const s = state({ cache: { text: 'not json', mtimeMs: 100 * HOUR } })
    expect((await load(s)).source).toBe('network')
  })

  it('offline: uses any cache (even stale) and never fetches', async () => {
    const s = state({ cache: { text: OLD_TEXT, mtimeMs: 0 } })
    const result = await load(s, { offline: true })
    expect(result.source).toBe('cache')
    expect(s.fetched).toEqual([])
  })

  it('offline without a cache: uses the snapshot', async () => {
    const s = state()
    const result = await load(s, { offline: true })
    expect(result.source).toBe('snapshot')
    expect(s.fetched).toEqual([])
  })

  it('fails when nothing usable is left', async () => {
    const s = state({ fetchResult: new Error('x') })
    await expect(load(s, { snapshot: { broken: true } })).rejects.toThrow(/內建快照也不可用/)
  })
})

describe('loadManifest with --refresh', () => {
  it('skips a fresh cache and fetches', async () => {
    const s = state({ cache: { text: OLD_TEXT, mtimeMs: 100 * HOUR - HOUR } })
    const result = await load(s, { refresh: true })
    expect(result.source).toBe('network')
    expect(s.fetched).toEqual(['https://example.com/releases.json'])
    expect(s.written).toEqual([NEW_TEXT])
    expect(result.manifest.generatedAt).toBe('2026-10-22T00:00:00Z')
    expect(result.ageMs).toBeUndefined()
  })

  it('falls back to the cache (even a fresh one) with a warning when the fetch fails', async () => {
    const s = state({ cache: { text: OLD_TEXT, mtimeMs: 100 * HOUR - HOUR }, fetchResult: new Error('offline') })
    const result = await load(s, { refresh: true })
    expect(result.source).toBe('stale-cache')
    expect(result.warnings.join('\n')).toMatch(/過期的本機快取/)
    expect(result.ageMs).toBe(HOUR)
  })

  it('falls back to the snapshot when there is no cache and the fetch fails', async () => {
    const s = state({ fetchResult: new Error('offline') })
    expect((await load(s, { refresh: true })).source).toBe('snapshot')
  })

  it('without --refresh a fresh cache still wins', async () => {
    const s = state({ cache: { text: OLD_TEXT, mtimeMs: 100 * HOUR - HOUR } })
    expect((await load(s)).source).toBe('cache')
    expect(s.fetched).toEqual([])
  })
})

describe('cache age', () => {
  it('reports how old a fresh cache is', async () => {
    const s = state({ cache: { text: OLD_TEXT, mtimeMs: 100 * HOUR - 3 * HOUR } })
    const result = await load(s)
    expect(result.source).toBe('cache')
    expect(result.ageMs).toBe(3 * HOUR)
  })

  it('reports the age of a stale cache used after a failed fetch', async () => {
    const s = state({ cache: { text: OLD_TEXT, mtimeMs: 100 * HOUR - 30 * HOUR }, fetchResult: new Error('x') })
    const result = await load(s)
    expect(result.source).toBe('stale-cache')
    expect(result.ageMs).toBe(30 * HOUR)
  })

  it('offline reports the age of the cache it used', async () => {
    const s = state({ cache: { text: OLD_TEXT, mtimeMs: 100 * HOUR - 2 * HOUR } })
    expect((await load(s, { offline: true })).ageMs).toBe(2 * HOUR)
  })

  it('formats ages: under a minute, minutes, hours below 48, then days', () => {
    expect(formatAge(0)).toBe('不到 1 分鐘')
    expect(formatAge(59_000)).toBe('不到 1 分鐘')
    expect(formatAge(5 * 60_000)).toBe('5 分鐘')
    expect(formatAge(59 * 60_000)).toBe('59 分鐘')
    expect(formatAge(60 * 60_000)).toBe('1 小時')
    expect(formatAge(47 * HOUR + 59 * 60_000)).toBe('47 小時')
    expect(formatAge(48 * HOUR)).toBe('2 天')
    expect(formatAge(100 * HOUR)).toBe('4 天')
  })

  it('describes a cache source with its age and the --refresh hint, other sources unchanged', () => {
    expect(describeSource({ source: 'cache', ageMs: 3 * HOUR })).toBe('cache（約 3 小時前取得；--refresh 可強制重新取得）')
    expect(describeSource({ source: 'stale-cache', ageMs: 2 * 24 * HOUR })).toBe('stale-cache（約 2 天前取得）')
    expect(describeSource({ source: 'cache', ageMs: 5_000 })).toBe('cache（不到 1 分鐘前取得；--refresh 可強制重新取得）')
    expect(describeSource({ source: 'network' })).toBe('network')
    expect(describeSource({ source: 'snapshot' })).toBe('snapshot')
  })
})

describe('parseManifestFlags', () => {
  it('reads --offline and --refresh', () => {
    expect(parseManifestFlags([])).toEqual({ offline: false, refresh: false, conflict: false })
    expect(parseManifestFlags(['--offline'])).toEqual({ offline: true, refresh: false, conflict: false })
    expect(parseManifestFlags(['--refresh', '--dry-run'])).toEqual({ offline: false, refresh: true, conflict: false })
  })

  it('flags --offline together with --refresh as a conflict', () => {
    expect(parseManifestFlags(['--offline', '--refresh']).conflict).toBe(true)
    expect(parseManifestFlags(['--refresh', 'x', '--offline']).conflict).toBe(true)
  })
})

describe('resolveRelease', () => {
  const parsed = parseManifest(manifest({
    channels: { stable: '0.0.0', dev: '0.0.1' },
    releases: {
      '0.0.0': release(),
      '0.0.1': release(),
      '0.0.2': release({ status: 'yanked', notes: 'https://example.com/n' }),
    },
  }))

  it('defaults to the stable channel', () => {
    expect(resolveRelease(parsed).version).toBe('0.0.0')
  })

  it('picks a requested version', () => {
    expect(resolveRelease(parsed, '0.0.1').version).toBe('0.0.1')
  })

  it('lists the available versions when it is missing', () => {
    expect(() => resolveRelease(parsed, '9.9.9')).toThrow(/可用版本：0\.0\.0、0\.0\.1、0\.0\.2/)
  })

  it('refuses a yanked release', () => {
    expect(() => resolveRelease(parsed, '0.0.2')).toThrow(/已撤回/)
  })
})

describe('assertCliSupports', () => {
  const needs = parseManifest(manifest({ releases: { '0.0.0': release({ cli: { min: '0.2.0' } }) } })).releases['0.0.0']

  it('passes when the CLI is new enough', () => {
    expect(() => assertCliSupports(needs, '0.2.0')).not.toThrow()
    expect(() => assertCliSupports(needs, '1.0.0')).not.toThrow()
  })

  it('asks the user to upgrade an older CLI', () => {
    expect(() => assertCliSupports(needs, '0.1.9')).toThrow(/需要 aqutter-cli 0\.2\.0 以上/)
  })
})

describe('manifestUrl', () => {
  it('prefers the environment variable, then the project config, then the default', () => {
    const config = { manifest: { url: 'https://config.example/releases.json' } }
    expect(manifestUrl({ AQUTTER_MANIFEST_URL: 'https://env.example/r.json' }, config)).toBe('https://env.example/r.json')
    expect(manifestUrl({}, config)).toBe('https://config.example/releases.json')
    expect(manifestUrl({})).toBe(DEFAULT_MANIFEST_URL)
  })

  it('ignores anything that is not https', () => {
    expect(manifestUrl({ AQUTTER_MANIFEST_URL: 'http://insecure.example/r.json' }, { manifest: { url: 'file:///x' } })).toBe(DEFAULT_MANIFEST_URL)
    expect(manifestUrl({}, { manifest: { url: 5 } })).toBe(DEFAULT_MANIFEST_URL)
  })
})

describe('defaultCacheDir', () => {
  it('uses LOCALAPPDATA on Windows and XDG or ~/.cache elsewhere', () => {
    expect(defaultCacheDir({ LOCALAPPDATA: 'C:\\Users\\a\\AppData\\Local' }, 'win32')).toMatch(/aqutter$/)
    expect(defaultCacheDir({ XDG_CACHE_HOME: '/x/cache' }, 'linux').replace(/\\/g, '/')).toBe('/x/cache/aqutter')
    expect(defaultCacheDir({}, 'linux').replace(/\\/g, '/')).toMatch(/\.cache\/aqutter$/)
  })
})
