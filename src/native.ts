// plugin 宣告的原生需求（權限、Info.plist 鍵）與使用者原生檔的比對。只讀，不修改任何原生檔。
import { existsSync, readFileSync } from 'node:fs'
import { join } from 'node:path'

import type { PluginDescriptor, Project } from './config.ts'

export interface NativeRequirements {
  /** 要在 AndroidManifest.xml 有的權限；同名合併，`maxSdkVersion` 取較寬鬆者（沒寫＝無上限）。 */
  permissions: { name: string, maxSdkVersion?: number }[]
  ios: Record<string, string>
  macos: Record<string, string>
  notes: string[]
}

export interface NativeGap {
  /** 給人看的一行描述。 */
  text: string
}

/** 回傳使用者選用的功能；省略代表全部。名稱不在描述檔內拋錯並列出可用名稱。 */
export const selectFeatures = (descriptor: PluginDescriptor, requested?: string[]): string[] => {
  const available = Object.keys(descriptor.native?.features ?? {})
  if (requested === undefined) {
    return available
  }
  if (available.length === 0) {
    throw new Error(`plugin「${descriptor.id}」沒有宣告任何原生功能，不能指定 --features。`)
  }
  const unknown = requested.filter(name => !available.includes(name))
  if (unknown.length > 0) {
    throw new Error(`plugin「${descriptor.id}」沒有功能：${unknown.join('、')}。可用的功能：${available.join('、')}。`)
  }
  return requested
}

export const collectRequirements = (descriptor: PluginDescriptor, features: string[]): NativeRequirements => {
  const result: NativeRequirements = { permissions: [], ios: {}, macos: {}, notes: [] }
  for (const name of features) {
    const feature = descriptor.native?.features[name]
    if (feature === undefined) {
      continue
    }
    for (const permission of feature.android?.permissions ?? []) {
      const existing = result.permissions.find(item => item.name === permission.name)
      if (existing === undefined) {
        result.permissions.push({ ...permission })
      }
      else if (permission.maxSdkVersion === undefined || existing.maxSdkVersion === undefined) {
        delete existing.maxSdkVersion
      }
      else {
        existing.maxSdkVersion = Math.max(existing.maxSdkVersion, permission.maxSdkVersion)
      }
    }
    Object.assign(result.ios, feature.ios?.infoPlist)
    Object.assign(result.macos, feature.macos?.infoPlist)
    if (feature.note !== undefined) {
      result.notes.push(feature.note)
    }
  }
  return result
}

const readIfExists = (file: string): string | null => existsSync(file) ? readFileSync(file, 'utf8') : null

const escapeRegExp = (text: string): string => text.replace(/[.*+?^${}()|[\]\\]/g, '\\$&')

/** plist 裡 `<key>NAME</key>` 後面接非空的 `<string>`。 */
export const plistHasKey = (plist: string, key: string): boolean => {
  return new RegExp(`<key>${escapeRegExp(key)}</key>\\s*<string>\\s*[^<\\s][^<]*</string>`).test(plist)
}

export const manifestHasPermission = (manifest: string, name: string): boolean => {
  return new RegExp(`<uses-permission[^>]*android:name\\s*=\\s*"${escapeRegExp(name)}"`).test(manifest)
}

/** 比對需求與使用者原生檔；專案沒有該平台的檔案就略過該平台。 */
export const findNativeGaps = (project: Project, requirements: NativeRequirements): NativeGap[] => {
  const gaps: NativeGap[] = []
  const manifest = readIfExists(join(project.appDir, 'android', 'app', 'src', 'main', 'AndroidManifest.xml'))
  if (manifest !== null) {
    for (const permission of requirements.permissions) {
      if (!manifestHasPermission(manifest, permission.name)) {
        const max = permission.maxSdkVersion === undefined ? '' : ` android:maxSdkVersion="${permission.maxSdkVersion}"`
        gaps.push({ text: `AndroidManifest.xml 缺 <uses-permission android:name="${permission.name}"${max} />` })
      }
    }
  }
  for (const platform of ['ios', 'macos'] as const) {
    const plist = readIfExists(join(project.appDir, platform, 'Runner', 'Info.plist'))
    if (plist === null) {
      continue
    }
    for (const [key, text] of Object.entries(requirements[platform])) {
      if (!plistHasKey(plist, key)) {
        gaps.push({ text: `${platform}/Runner/Info.plist 缺 ${key}（建議文字：${text}）` })
      }
    }
  }
  return gaps
}
