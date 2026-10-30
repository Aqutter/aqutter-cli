// 網頁包簽章（簽署端）。殼端的驗證在 aqutter repo 的 `shell/lib/src/server/bundle_signature.dart`，
// 兩邊的契約見該 repo 的 docs/hot-update.md「簽章」一節：Ed25519、訊息固定格式、公鑰為 Base64 的 32 位元組。
//
// 用法：
//   aqutter bundle keygen [--out=<資料夾>]
//   aqutter bundle sign <bundle.zip> --key=<私鑰.pem> [--print-json]
//
// 私鑰只存在簽署端，不進 App、不進編譯期 env、不進版控。

import { createHash, createPrivateKey, createPublicKey, generateKeyPairSync, sign } from 'node:crypto'
import { existsSync, mkdirSync, readFileSync, writeFileSync } from 'node:fs'
import { join, resolve } from 'node:path'
import { unzipSync } from 'fflate'

import { ConfigError } from '../config.ts'

/** 簽章訊息的固定前綴；與殼的 `bundleSignaturePrefix` 成對。 */
export const BUNDLE_SIGNATURE_PREFIX = 'aqutter-bundle-v1'

/** keygen 預設輸出的資料夾（相對目前目錄）。 */
export const DEFAULT_KEY_DIR = '.aqutter-keys'

/** 私鑰檔名。 */
export const PRIVATE_KEY_FILE = 'bundle-signing.key'

/** 環境變數：直接提供私鑰 PEM 內容（CI 用）；旗標優先。 */
export const SIGNING_KEY_ENV = 'AQUTTER_BUNDLE_SIGNING_KEY'

const VERSION_ENTRY = 'version.json'

/** 簽章訊息：`aqutter-bundle-v1\n{version}\n{sha256 小寫十六進位}\n`（UTF-8）。 */
export const bundleSignatureMessage = (version: string, sha256Hex: string): Buffer => {
  return Buffer.from(`${BUNDLE_SIGNATURE_PREFIX}\n${version}\n${sha256Hex.toLowerCase()}\n`, 'utf8')
}

/** 由私鑰取出 Base64 的 32 位元組原始公鑰（SPKI DER 的最後 32 位元組）。 */
export const publicKeyBase64 = (privateKeyPem: string): string => {
  const spki = createPublicKey(createPrivateKey(privateKeyPem)).export({ format: 'der', type: 'spki' })
  return spki.subarray(spki.length - 32).toString('base64')
}

export interface GeneratedKey {
  privatePem: string
  publicKey: string
}

/** 產生 Ed25519 金鑰對：私鑰為 PKCS#8 PEM，公鑰為 Base64 的原始 32 位元組。 */
export const generateSigningKey = (): GeneratedKey => {
  const { privateKey } = generateKeyPairSync('ed25519')
  const privatePem = privateKey.export({ format: 'pem', type: 'pkcs8' }).toString()
  return { privatePem, publicKey: publicKeyBase64(privatePem) }
}

export interface BundleSignature {
  version: string
  sha256: string
  size: number
  signature: string
}

/** 讀出 zip 內 `version.json` 的 `version`；找不到或格式不對就拋 [ConfigError]。 */
export const readBundleVersion = (zip: Uint8Array): string => {
  let entries: Record<string, Uint8Array>
  try {
    entries = unzipSync(zip, { filter: file => file.name === VERSION_ENTRY })
  }
  catch {
    throw new ConfigError('不是合法的 zip 檔')
  }
  const raw = entries[VERSION_ENTRY]
  if (raw === undefined) {
    throw new ConfigError(`網頁包內沒有 ${VERSION_ENTRY}`)
  }
  let parsed: unknown
  try {
    parsed = JSON.parse(new TextDecoder().decode(raw))
  }
  catch {
    throw new ConfigError(`網頁包內的 ${VERSION_ENTRY} 不是合法的 JSON`)
  }
  const version = (parsed as { version?: unknown } | null)?.version
  if (typeof version !== 'string' || version === '') {
    throw new ConfigError(`網頁包內的 ${VERSION_ENTRY} 缺少字串的 version`)
  }
  return version
}

/** 對整包 zip 簽章：版本取自包內 `version.json`，雜湊為整個檔案的 SHA-256。 */
export const signBundle = (zip: Uint8Array, privateKeyPem: string): BundleSignature => {
  const version = readBundleVersion(zip)
  const sha256 = createHash('sha256').update(zip).digest('hex')
  let key
  try {
    key = createPrivateKey(privateKeyPem)
  }
  catch {
    throw new ConfigError('私鑰不是合法的 PEM')
  }
  if (key.asymmetricKeyType !== 'ed25519') {
    throw new ConfigError('私鑰必須是 Ed25519')
  }
  const signature = sign(null, bundleSignatureMessage(version, sha256), key).toString('base64')
  return { version, sha256, size: zip.length, signature }
}

interface BundleArgs {
  positional: string[]
  flags: Record<string, string>
  printJson: boolean
}

/** 這個指令的旗標很少，`--key=…` 與 `--key …` 兩種寫法都收，不依賴共用的 parseArgs。 */
const parseBundleArgs = (argv: string[]): BundleArgs => {
  const positional: string[] = []
  const flags: Record<string, string> = {}
  let printJson = false
  for (let index = 0; index < argv.length; index++) {
    const arg = argv[index]
    if (arg === '--print-json') {
      printJson = true
      continue
    }
    const withValue = /^--(key|out)(?:=(.*))?$/.exec(arg)
    if (withValue) {
      const next = argv[index + 1]
      if (withValue[2] !== undefined) {
        flags[withValue[1]] = withValue[2]
      }
      else if (next !== undefined && !next.startsWith('--')) {
        flags[withValue[1]] = next
        index += 1
      }
      else {
        throw new ConfigError(`--${withValue[1]} 需要值`)
      }
      continue
    }
    if (arg.startsWith('--')) {
      throw new ConfigError(`未知旗標「${arg}」`)
    }
    positional.push(arg)
  }
  return { positional, flags, printJson }
}

const USAGE = `用法：
  aqutter bundle keygen [--out=<資料夾>]
  aqutter bundle sign <bundle.zip> --key=<私鑰.pem> [--print-json]`

export const runKeygen = (cwd: string, args: BundleArgs): void => {
  if (args.positional.length > 0) {
    throw new ConfigError(USAGE)
  }
  const dir = resolve(cwd, args.flags.out ?? DEFAULT_KEY_DIR)
  const keyFile = join(dir, PRIVATE_KEY_FILE)
  if (existsSync(keyFile)) {
    throw new ConfigError(`${keyFile} 已存在，不覆蓋。要產生新的金鑰請換一個資料夾（--out）或先自行處理舊檔。`)
  }
  const { privatePem, publicKey } = generateSigningKey()
  mkdirSync(dir, { recursive: true })
  // wx：萬一在檢查與寫入之間檔案出現，寧可失敗也不覆蓋私鑰；權限只給本人（Windows 會忽略）
  writeFileSync(keyFile, privatePem, { flag: 'wx', mode: 0o600 })
  console.log(`已產生私鑰：${keyFile}`)
  console.log('私鑰只留在簽署端：不要提交進版控、不要放進 App 或編譯期 env。建議把資料夾加入 .gitignore，並另外備份到密碼管理器。')
  console.log('')
  console.log('公鑰（不是機密），填進各環境 env 檔後重編 App：')
  console.log(`AQUTTER_UPDATE_PUBLIC_KEYS=${publicKey}`)
}

const loadPrivateKey = (cwd: string, keyFlag: string | undefined): string => {
  if (keyFlag !== undefined) {
    const file = resolve(cwd, keyFlag)
    if (!existsSync(file)) {
      throw new ConfigError(`找不到私鑰檔：${file}`)
    }
    return readFileSync(file, 'utf8')
  }
  const fromEnv = process.env[SIGNING_KEY_ENV]
  if (fromEnv !== undefined && fromEnv.trim() !== '') {
    return fromEnv
  }
  throw new ConfigError(`需要私鑰：用 --key=<私鑰.pem>，或設定環境變數 ${SIGNING_KEY_ENV}（PEM 內容）。`)
}

export const runSign = (cwd: string, args: BundleArgs): void => {
  if (args.positional.length !== 1) {
    throw new ConfigError(USAGE)
  }
  const zipFile = resolve(cwd, args.positional[0])
  if (!existsSync(zipFile)) {
    throw new ConfigError(`找不到網頁包：${zipFile}`)
  }
  const result = signBundle(new Uint8Array(readFileSync(zipFile)), loadPrivateKey(cwd, args.flags.key))
  const fields = { version: result.version, sha256: result.sha256, signature: result.signature, size: result.size }
  if (args.printJson) {
    console.log(JSON.stringify(fields))
    return
  }
  console.log('把下面的欄位放進更新伺服器的 version.json（與 url 並列）：')
  console.log(JSON.stringify(fields, null, 2))
}

export const runBundle = (cwd: string, argv: string[]): void => {
  const [sub, ...rest] = argv
  if (sub === 'keygen') {
    runKeygen(cwd, parseBundleArgs(rest))
    return
  }
  if (sub === 'sign') {
    runSign(cwd, parseBundleArgs(rest))
    return
  }
  throw new ConfigError(USAGE)
}
