import { mkdirSync, mkdtempSync, readdirSync, readFileSync, rmSync, statSync, writeFileSync } from 'node:fs'
import { tmpdir } from 'node:os'
import { join } from 'node:path'
import { describe, expect, it } from 'vitest'

import type { Project } from '../src/config.ts'
import { applyPubspecBlock, parseDescriptor, pluginFactoryName, pluginFileName, pluginFilePath, PUBSPEC_BEGIN, PUBSPEC_END, renderPluginFile, renderPluginsDart, renderPubspecBlock, syncPlugins } from '../src/plugins.ts'
import { pickInstalledName, toClassName, toSnake } from '../src/commands/plugin.ts'
import { detectFramework, toAppName, toCamel, toDisplayName, usePathDependency } from '../src/commands/init.ts'
import { substitute } from '../src/template.ts'
import { rangeToConstraint, satisfiesRange } from '../src/semverRange.ts'
import { findRequireProblems } from '../src/plugins.ts'

const entry = { id: 'haptics', npm: '@x/aqutter-plugin-haptics', dart: { package: 'aqutter_plugin_haptics', class: 'HapticsPlugin' } }

describe('plugin descriptor', () => {
  it('accepts a valid descriptor', () => {
    expect(parseDescriptor({ schema: 1, id: 'haptics', dart: { package: 'aqutter_plugin_haptics', class: 'HapticsPlugin' } }, 'x').id).toBe('haptics')
  })
  it('rejects bad ids, packages and classes', () => {
    const base = { schema: 1, id: 'ok', dart: { package: 'p', class: 'C' } }
    expect(() => parseDescriptor({ ...base, id: 'Bad.Id' }, 'x')).toThrow(/id/)
    expect(() => parseDescriptor({ ...base, dart: { package: 'P', class: 'C' } }, 'x')).toThrow(/dart.package/)
    expect(() => parseDescriptor({ ...base, dart: { package: 'p', class: 'c' } }, 'x')).toThrow(/dart.class/)
    expect(() => parseDescriptor({ ...base, schema: 2 }, 'x')).toThrow(/schema/)
    expect(() => parseDescriptor('nope', 'x')).toThrow(/JSON/)
  })
})

describe('plugin sync output', () => {
  it('renders an empty registry', () => {
    expect(renderPluginsDart([])).toContain('final List<AqutterPluginEntry> aqutterPlugins = <AqutterPluginEntry>[];')
  })
  it('renders builders and per-plugin imports', () => {
    const maps = { id: 'google-maps', npm: 'm', dart: { package: 'aqutter_plugin_google_maps', class: 'GoogleMapsPlugin' } }
    expect(renderPluginsDart([maps, entry])).toBe([
      '// 由 `aqutter plugin` 產生，請勿手改；要增減 plugin 請用 `aqutter plugin add/remove`，',
      '// 要給 plugin 帶參數請改 lib/plugins/ 內各 plugin 的檔案。',
      "import 'package:aqutter/aqutter.dart';",
      "import 'plugins/google_maps_plugin.dart';",
      "import 'plugins/haptics_plugin.dart';",
      '',
      '/// 傳給 `runAqutter(plugins: aqutterPlugins)`。',
      'final List<AqutterPluginEntry> aqutterPlugins = <AqutterPluginEntry>[',
      "  AqutterPluginBuilder('google-maps', buildGoogleMapsPlugin),",
      "  AqutterPluginBuilder('haptics', buildHapticsPlugin),",
      '];',
      '',
    ].join('\n'))
  })
  it('derives file and factory names', () => {
    expect(pluginFileName('google-maps')).toBe('google_maps_plugin.dart')
    expect(pluginFileName('battery')).toBe('battery_plugin.dart')
    expect(pluginFactoryName('GoogleMapsPlugin')).toBe('buildGoogleMapsPlugin')
  })
  it('renders the default user file', () => {
    expect(renderPluginFile(entry)).toBe([
      "import 'dart:async';",
      '',
      "import 'package:aqutter/aqutter.dart';",
      "import 'package:aqutter_plugin_haptics/aqutter_plugin_haptics.dart';",
      '',
      '/// 要給 plugin 帶參數就改這裡；aqutter CLI 之後不會覆蓋這個檔案。',
      'FutureOr<AqutterPlugin> buildHapticsPlugin(AqutterBootContext context) => HapticsPlugin();',
      '',
    ].join('\n'))
  })
  it('renders pubspec path dependencies relative to the app dir', () => {
    expect(renderPubspecBlock([entry], '/proj', '/proj/aqutter')).toEqual([
      '  aqutter_plugin_haptics:',
      '    path: ../node_modules/@x/aqutter-plugin-haptics',
    ])
  })
  it('replaces only the managed block and is idempotent', () => {
    const pubspec = `dependencies:\n  flutter:\n${PUBSPEC_BEGIN}\n  old:\n    path: x\n${PUBSPEC_END}\n\ndev:\n`
    const once = applyPubspecBlock(pubspec, ['  new:', '    path: y'])
    expect(once).toContain('  new:')
    expect(once).not.toContain('  old:')
    expect(applyPubspecBlock(once, ['  new:', '    path: y'])).toBe(once)
    expect(applyPubspecBlock(once, [])).not.toContain('  new:')
  })
  it('refuses a pubspec without markers', () => {
    expect(() => applyPubspecBlock('dependencies:\n', [])).toThrow(/標記/)
  })
})

describe('naming helpers', () => {
  it('derives class and snake names', () => {
    expect(toClassName('native-view')).toBe('NativeView')
    expect(toSnake('native-view')).toBe('native_view')
  })
  it('derives app names', () => {
    expect(toAppName('@scope/My-App')).toBe('my_app')
    expect(toAppName('123')).toBe('app_123')
    expect(toCamel('sample_web')).toBe('sampleWeb')
    expect(toDisplayName('sample_web')).toBe('Sample Web')
  })
  it('detects nothing in an empty directory', () => {
    expect(detectFramework('/nonexistent-dir')).toBeNull()
  })
  it('switches the shell dependency to a path', () => {
    const pubspec = '  aqutter:\n    git:\n      url: u\n      path: shell\n      ref: 0.1.0\n\n  other: 1\n'
    expect(usePathDependency(pubspec, '../shell')).toBe('  aqutter:\n    path: ../shell\n\n  other: 1\n')
  })
})

const listFiles = (dir: string): string[] => readdirSync(dir).flatMap((name) => {
  const full = join(dir, name)
  return statSync(full).isDirectory() ? listFiles(full) : [full]
})

describe('templates', () => {
  const root = join(import.meta.dirname, '..', 'template')
  const known = {
    app: ['appName', 'appNameCamel', 'orgId', 'orgPath', 'displayName', 'shellRef'],
    plugin: ['id', 'idSnake', 'className', 'dartPackage', 'npmName', 'shellRef', 'clientRef'],
  }
  for (const [kind, keys] of Object.entries(known)) {
    it(`${kind} template only uses known variables`, () => {
      const used = new Set<string>()
      for (const file of listFiles(join(root, kind))) {
        const text = readFileSync(file).toString('latin1') + file
        for (const match of text.matchAll(/\{\{(\w+)\}\}/g)) {
          used.add(match[1])
        }
      }
      // Windows runner 的 {{NO_DEPENDENCIES}} 是 Flutter 自己的標記，不是範本變數
      used.delete('NO_DEPENDENCIES')
      expect([...used].filter(name => !keys.includes(name))).toEqual([])
    })
    it(`${kind} template leaves no placeholder after substitution`, () => {
      const values = Object.fromEntries(keys.map(key => [key, 'x']))
      for (const file of listFiles(join(root, kind))) {
        const out = substitute(readFileSync(file).toString('latin1'), values)
        expect(out.replace('{{NO_DEPENDENCIES}}', '')).not.toMatch(/\{\{\w+\}\}/)
      }
    })
  }
})

describe('template packaging', () => {
  it('stores gitignore files under a name npm does not drop', () => {
    const root = join(import.meta.dirname, '..', 'template')
    const names = listFiles(root).map(file => file.slice(root.length + 1).replaceAll('\\', '/'))
    expect(names.filter(name => name.endsWith('/.gitignore'))).toEqual([])
    expect(names).toContain('app/_gitignore')
    expect(names).toContain('plugin/_gitignore')
    expect(names).toContain('app/android/_gitignore')
  })
})

describe('pickInstalledName', () => {
  const specs = (entries: Record<string, string>): ReadonlyMap<string, string> => new Map(Object.entries(entries))
  const FILE = 'file:C:/plugins/aqutter-plugin-maps'

  it('picks the dependency that was added', () => {
    expect(pickInstalledName(specs({ nuxt: '4.0.0' }), specs({ nuxt: '4.0.0', 'aqutter-plugin-maps': FILE }), FILE)).toBe('aqutter-plugin-maps')
  })

  it('picks the dependency whose source was replaced (already installed from somewhere else)', () => {
    const before = specs({ 'aqutter-plugin-maps': 'github:Aqutter/aqutter-plugin-google-maps', nuxt: '4.0.0' })
    const after = specs({ 'aqutter-plugin-maps': FILE, nuxt: '4.0.0' })
    expect(pickInstalledName(before, after, FILE)).toBe('aqutter-plugin-maps')
  })

  it('accepts the package name itself as the source', () => {
    const both = specs({ 'aqutter-plugin-maps': 'github:Aqutter/aqutter-plugin-google-maps' })
    expect(pickInstalledName(both, both, 'aqutter-plugin-maps')).toBe('aqutter-plugin-maps')
  })

  it('recognises a repeated run of the same command (the source equals an existing dependency spec)', () => {
    // Windows: the .bin .CMD shim is rewritten by `pnpm add` and cmd.exe runs the node line a second time.
    const both = specs({ 'aqutter-plugin-maps': FILE, nuxt: '4.0.0' })
    expect(pickInstalledName(both, both, FILE)).toBe('aqutter-plugin-maps')
  })

  it('returns undefined when nothing identifies the package', () => {
    const both = specs({ nuxt: '4.0.0' })
    expect(pickInstalledName(both, both, 'file:C:/unknown')).toBeUndefined()
  })
})

describe('syncPlugins', () => {
  const setup = (plugins: typeof entry[]): { project: Project, cleanup: () => void } => {
    const root = mkdtempSync(join(tmpdir(), 'aqutter-plugins-'))
    const appDir = join(root, 'app')
    mkdirSync(join(appDir, 'lib'), { recursive: true })
    writeFileSync(join(appDir, 'pubspec.yaml'), `dependencies:
${PUBSPEC_BEGIN}
${PUBSPEC_END}
`)
    const project = { root, appDir, config: { plugins } } as unknown as Project
    return { project, cleanup: () => rmSync(root, { recursive: true, force: true }) }
  }

  it('creates missing user files and rewrites the registry', () => {
    const { project, cleanup } = setup([entry])
    try {
      const created = syncPlugins(project)
      expect(created).toEqual([pluginFilePath(project, 'haptics')])
      expect(readFileSync(created[0], 'utf8')).toBe(renderPluginFile(entry))
      expect(readFileSync(join(project.appDir, 'lib', 'aqutter_plugins.dart'), 'utf8')).toBe(renderPluginsDart([entry]))
    }
    finally {
      cleanup()
    }
  })

  it('never overwrites an existing user file', () => {
    const { project, cleanup } = setup([entry])
    try {
      const file = pluginFilePath(project, 'haptics')
      mkdirSync(join(project.appDir, 'lib', 'plugins'))
      const custom = 'FutureOr<AqutterPlugin> buildHapticsPlugin(AqutterBootContext c) => HapticsPlugin(level: 3);\n'
      writeFileSync(file, custom)
      expect(syncPlugins(project)).toEqual([])
      expect(readFileSync(file, 'utf8')).toBe(custom)
      expect(syncPlugins(project)).toEqual([])
    }
    finally {
      cleanup()
    }
  })

  it('fails without writing anything when an existing file lacks the factory', () => {
    const maps = { id: 'google-maps', npm: 'm', dart: { package: 'aqutter_plugin_google_maps', class: 'GoogleMapsPlugin' } }
    const { project, cleanup } = setup([entry, maps])
    try {
      mkdirSync(join(project.appDir, 'lib', 'plugins'))
      writeFileSync(pluginFilePath(project, 'google-maps'), '// 空的\n')
      expect(() => syncPlugins(project)).toThrow(/buildGoogleMapsPlugin/)
      expect(readdirSync(join(project.appDir, 'lib', 'plugins'))).toEqual(['google_maps_plugin.dart'])
      expect(readdirSync(join(project.appDir, 'lib'))).toEqual(['plugins'])
      expect(readFileSync(join(project.appDir, 'pubspec.yaml'), 'utf8')).toBe(`dependencies:
${PUBSPEC_BEGIN}
${PUBSPEC_END}
`)
    }
    finally {
      cleanup()
    }
  })

  it('upgrades the old registry form and keeps the user file when a plugin is dropped', () => {
    const { project, cleanup } = setup([entry])
    try {
      writeFileSync(join(project.appDir, 'lib', 'aqutter_plugins.dart'), 'final List<AqutterPlugin> aqutterPlugins = <AqutterPlugin>[\n  HapticsPlugin(),\n];\n')
      syncPlugins(project)
      expect(readFileSync(join(project.appDir, 'lib', 'aqutter_plugins.dart'), 'utf8')).toContain("AqutterPluginBuilder('haptics', buildHapticsPlugin),")
      project.config.plugins = []
      syncPlugins(project)
      expect(readFileSync(join(project.appDir, 'lib', 'aqutter_plugins.dart'), 'utf8')).toContain('<AqutterPluginEntry>[];')
      expect(readdirSync(join(project.appDir, 'lib', 'plugins'))).toEqual(['haptics_plugin.dart'])
    }
    finally {
      cleanup()
    }
  })
})

describe('plugin requires', () => {
  const base = { schema: 1, id: 'map', dart: { package: 'aqutter_plugin_map', class: 'MapPlugin' } }

  it('is optional and passed through when valid', () => {
    expect(parseDescriptor(base, 'x').requires).toBeUndefined()
    expect(parseDescriptor({ ...base, requires: { 'aqutter-plugin-location': '^0.0.0' } }, 'x').requires).toEqual({ 'aqutter-plugin-location': '^0.0.0' })
  })
  it('rejects a non-object, an empty name and unsupported ranges', () => {
    expect(() => parseDescriptor({ ...base, requires: ['aqutter-plugin-location'] }, 'x')).toThrow(/requires/)
    expect(() => parseDescriptor({ ...base, requires: { '': '^1.0.0' } }, 'x')).toThrow(/requires/)
    for (const range of ['>=1.0.0', '*', '1.x', '^1.0', '1.0.0-beta', 3]) {
      expect(() => parseDescriptor({ ...base, requires: { b: range } }, 'x'), String(range)).toThrow(/requires\.b/)
    }
  })

  it('translates ^, ~ and exact versions into comparators', () => {
    expect(rangeToConstraint('^1.2.3')).toBe('>=1.2.3 <2.0.0')
    expect(rangeToConstraint('^0.2.3')).toBe('>=0.2.3 <0.3.0')
    expect(rangeToConstraint('^0.0.0')).toBe('>=0.0.0 <0.0.1')
    expect(rangeToConstraint('~1.2.3')).toBe('>=1.2.3 <1.3.0')
    expect(rangeToConstraint('1.2.3')).toBe('=1.2.3')
    expect(rangeToConstraint('>=1.0.0')).toBeNull()
  })
  it('checks a version against a range', () => {
    expect(satisfiesRange('0.0.0', '^0.0.0')).toBe(true)
    expect(satisfiesRange('0.0.1', '^0.0.0')).toBe(false)
    expect(satisfiesRange('1.4.0', '^1.2.3')).toBe(true)
    expect(satisfiesRange('2.0.0', '^1.2.3')).toBe(false)
    expect(satisfiesRange('1.2.9', '~1.2.3')).toBe(true)
    expect(satisfiesRange('1.3.0', '~1.2.3')).toBe(false)
    expect(satisfiesRange('x', '^1.0.0')).toBeNull()
  })

  describe('findRequireProblems', () => {
    const location = { id: 'location', npm: 'aqutter-plugin-location', dart: { package: 'aqutter_plugin_location', class: 'LocationPlugin' } }
    const owner = { ...parseDescriptor(base, 'x'), requires: { 'aqutter-plugin-location': '^1.0.0' } }

    it('is empty when every required plugin is registered at an accepted version', () => {
      expect(findRequireProblems('map', owner, [location], () => '1.2.0')).toEqual([])
      expect(findRequireProblems('map', parseDescriptor(base, 'x'), [], () => null)).toEqual([])
    })
    it('names the owner, the required plugin and the installed version on a conflict', () => {
      expect(findRequireProblems('map', owner, [location], () => '2.0.0')).toEqual(['map 要求 aqutter-plugin-location ^1.0.0，已安裝 2.0.0'])
    })
    it('reports a required plugin that is not registered or whose version is unreadable', () => {
      expect(findRequireProblems('map', owner, [], () => '1.0.0')[0]).toMatch(/還沒登記/)
      expect(findRequireProblems('map', owner, [location], () => null)[0]).toMatch(/讀不到/)
    })
  })
})
