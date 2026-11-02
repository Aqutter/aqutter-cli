import { mkdirSync, mkdtempSync, rmSync, writeFileSync } from 'node:fs'
import { tmpdir } from 'node:os'
import { join } from 'node:path'
import { afterEach, describe, expect, it } from 'vitest'

import type { PluginDescriptor, Project } from '../src/config.ts'
import { collectRequirements, findNativeGaps, manifestHasPermission, plistHasKey, selectFeatures } from '../src/native.ts'
import { parseDescriptor } from '../src/plugins.ts'

const base = { schema: 1, id: 'biometrics', dart: { package: 'aqutter_plugin_biometrics', class: 'BiometricsPlugin' } }

const saver: PluginDescriptor = parseDescriptor({
  schema: 1,
  id: 'save',
  dart: { package: 'aqutter_plugin_save', class: 'SavePlugin' },
  native: {
    features: {
      gallery: {
        android: { permissions: [{ name: 'android.permission.WRITE_EXTERNAL_STORAGE', maxSdkVersion: 28 }] },
        ios: { infoPlist: { NSPhotoLibraryAddUsageDescription: 'Save images' } },
      },
      file: {
        android: { permissions: [{ name: 'android.permission.WRITE_EXTERNAL_STORAGE', maxSdkVersion: 29 }] },
        note: 'iOS 的檔案會由系統的文件選擇器匯出',
      },
    },
  },
}, 'x')

describe('native declaration parsing', () => {
  it('a descriptor without native stays valid and has no native block', () => {
    expect(parseDescriptor(base, 'x').native).toBeUndefined()
  })

  it('keeps the declared features', () => {
    expect(Object.keys(saver.native!.features)).toEqual(['gallery', 'file'])
  })

  it('ignores unknown sub-fields', () => {
    const parsed = parseDescriptor({ ...base, native: { features: { unlock: { future: true, ios: { infoPlist: { K: 'v' }, other: 1 } } } } }, 'x')
    expect(parsed.native!.features.unlock.ios!.infoPlist).toEqual({ K: 'v' })
  })

  it('rejects malformed declarations and says where', () => {
    const feature = (value: unknown) => ({ ...base, native: { features: { unlock: value } } })
    expect(() => parseDescriptor({ ...base, native: {} }, 'x')).toThrow(/native.features/)
    expect(() => parseDescriptor({ ...base, native: { features: {} } }, 'x')).toThrow(/native.features/)
    expect(() => parseDescriptor({ ...base, native: { features: { 'Bad Name': {} } } }, 'x')).toThrow(/功能名/)
    expect(() => parseDescriptor(feature({ android: { permissions: [{ name: 'nodot' }] } }), 'x')).toThrow(/permissions\[0\]\.name/)
    expect(() => parseDescriptor(feature({ android: { permissions: [{ name: 'a.b', maxSdkVersion: 1.5 }] } }), 'x')).toThrow(/maxSdkVersion/)
    expect(() => parseDescriptor(feature({ ios: { infoPlist: { K: 1 } } }), 'x')).toThrow(/infoPlist\.K/)
    expect(() => parseDescriptor(feature({ note: 5 }), 'x')).toThrow(/note/)
  })
})

describe('feature selection and requirements', () => {
  it('omitting the selection means every declared feature', () => {
    expect(selectFeatures(saver)).toEqual(['gallery', 'file'])
  })

  it('an unknown feature is rejected with the available names', () => {
    expect(() => selectFeatures(saver, ['gallery', 'video'])).toThrow(/video.*gallery、file/)
  })

  it('picking features on a plugin without native declarations is rejected', () => {
    expect(() => selectFeatures(parseDescriptor(base, 'x'), ['a'])).toThrow(/沒有宣告/)
  })

  it('only the selected features contribute requirements', () => {
    const gallery = collectRequirements(saver, ['gallery'])
    expect(gallery.ios).toEqual({ NSPhotoLibraryAddUsageDescription: 'Save images' })
    expect(gallery.notes).toEqual([])

    const file = collectRequirements(saver, ['file'])
    expect(file.ios).toEqual({})
    expect(file.notes).toHaveLength(1)
  })

  it('the same permission from two features merges and keeps the looser maxSdkVersion', () => {
    expect(collectRequirements(saver, ['gallery', 'file']).permissions).toEqual([
      { name: 'android.permission.WRITE_EXTERNAL_STORAGE', maxSdkVersion: 29 },
    ])
  })

  it('a permission without a limit wins over one with a limit', () => {
    const merged = collectRequirements(parseDescriptor({
      ...base,
      native: { features: { a: { android: { permissions: [{ name: 'p.q', maxSdkVersion: 28 }] } }, b: { android: { permissions: [{ name: 'p.q' }] } } } },
    }, 'x'), ['a', 'b'])
    expect(merged.permissions).toEqual([{ name: 'p.q' }])
  })
})

describe('matching against the native files', () => {
  it('finds a permission only when it is declared as uses-permission', () => {
    const manifest = '<manifest><uses-permission android:name="android.permission.USE_BIOMETRIC"/><!-- <uses-permission android:name="x.y"/> --></manifest>'
    expect(manifestHasPermission(manifest, 'android.permission.USE_BIOMETRIC')).toBe(true)
    expect(manifestHasPermission(manifest, 'android.permission.CAMERA')).toBe(false)
  })

  it('a plist key counts only with a non-empty string value', () => {
    const plist = '<dict><key>NSFaceIDUsageDescription</key>\n  <string>Unlock</string><key>Empty</key><string> </string></dict>'
    expect(plistHasKey(plist, 'NSFaceIDUsageDescription')).toBe(true)
    expect(plistHasKey(plist, 'Empty')).toBe(false)
    expect(plistHasKey(plist, 'Missing')).toBe(false)
  })

  describe('against a project directory', () => {
    const roots: string[] = []
    afterEach(() => {
      for (const root of roots.splice(0)) {
        rmSync(root, { recursive: true, force: true })
      }
    })

    const makeProject = (files: Record<string, string>): Project => {
      const root = mkdtempSync(join(tmpdir(), 'aqutter-native-'))
      roots.push(root)
      for (const [name, text] of Object.entries(files)) {
        mkdirSync(join(root, 'app', name, '..'), { recursive: true })
        writeFileSync(join(root, 'app', name), text)
      }
      return { root, appDir: join(root, 'app') } as unknown as Project
    }

    it('reports each missing item and nothing for what is present', () => {
      const project = makeProject({
        'android/app/src/main/AndroidManifest.xml': '<manifest><uses-permission android:name="android.permission.USE_BIOMETRIC"/></manifest>',
        'ios/Runner/Info.plist': '<dict></dict>',
      })
      const requirements = collectRequirements(parseDescriptor({
        ...base,
        native: { features: { unlock: {
          android: { permissions: [{ name: 'android.permission.USE_BIOMETRIC' }, { name: 'android.permission.CAMERA' }] },
          ios: { infoPlist: { NSFaceIDUsageDescription: 'Unlock' } },
        } } },
      }, 'x'), ['unlock'])

      const gaps = findNativeGaps(project, requirements).map(gap => gap.text)

      expect(gaps).toHaveLength(2)
      expect(gaps[0]).toContain('android.permission.CAMERA')
      expect(gaps[1]).toContain('NSFaceIDUsageDescription')
    })

    it('skips a platform the project does not have', () => {
      const project = makeProject({})
      const requirements = collectRequirements(saver, ['gallery'])

      expect(findNativeGaps(project, requirements)).toEqual([])
    })
  })
})
