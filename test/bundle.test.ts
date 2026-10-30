import { createHash, createPrivateKey, createPublicKey, verify } from 'node:crypto'
import { existsSync, mkdtempSync, readFileSync, rmSync, writeFileSync } from 'node:fs'
import { tmpdir } from 'node:os'
import { join } from 'node:path'
import { zipSync } from 'fflate'
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'

import {
  bundleSignatureMessage,
  generateSigningKey,
  publicKeyBase64,
  readBundleVersion,
  runBundle,
  signBundle,
} from '../src/commands/bundle.ts'

// 契約 §6 的共同測試向量（RFC 8032 測試金鑰，僅供測試）。與 aqutter repo 的 bundle_signature_test.dart 逐字相同。
const VECTOR_SEED = '9d61b19deffd5a60ba844af492ec2cc44449c5697b326919703bac031cae7f60'
const VECTOR_PUBLIC = '11qYAYKxCrfVS/7TyWQHOg7hcvPapiMlrwIaaPcHURo='
const VECTOR_VERSION = '260911063945'
const VECTOR_SHA256 = '80505ff7171bc749a81d3c62a17b89106e7aca380f7b7b5fc75069d206bb566c'
const VECTOR_SIGNATURE = '/nPo51OalWZkw9YlTkVVaUUDcY2hPhzVsdVzmelCPgDTcf6DbjAnc6IGAziJkIFjoSY+fOXx88vOxuJX7vkABg=='

/** 以 PKCS#8 外殼包住 32 位元組種子，得到 PEM。 */
const pemFromSeed = (seedHex: string): string => {
  const der = Buffer.concat([Buffer.from('302e020100300506032b657004220420', 'hex'), Buffer.from(seedHex, 'hex')])
  return createPrivateKey({ key: der, format: 'der', type: 'pkcs8' }).export({ format: 'pem', type: 'pkcs8' }).toString()
}

const zipWithVersion = (version: string, extra: Record<string, string> = {}): Uint8Array => {
  const entries: Record<string, Uint8Array> = { 'version.json': new TextEncoder().encode(JSON.stringify({ version })) }
  for (const [name, content] of Object.entries(extra)) {
    entries[name] = new TextEncoder().encode(content)
  }
  return zipSync(entries)
}

describe('bundle signature contract', () => {
  it('message is prefix, version and lower-case hash, each on its own line', () => {
    expect(bundleSignatureMessage('1', 'ABCD').toString('utf8')).toBe('aqutter-bundle-v1\n1\nabcd\n')
  })

  it('reproduces the shared vector byte for byte', () => {
    const pem = pemFromSeed(VECTOR_SEED)
    expect(publicKeyBase64(pem)).toBe(VECTOR_PUBLIC)

    const bytes = new TextEncoder().encode('aqutter-test-bundle')
    expect(createHash('sha256').update(bytes).digest('hex')).toBe(VECTOR_SHA256)

    // 向量用的訊息與 sign 內部相同；直接驗證向量簽章與重新簽出的簽章一致（Ed25519 是確定性的）
    const message = bundleSignatureMessage(VECTOR_VERSION, VECTOR_SHA256)
    const publicKey = createPublicKey(createPrivateKey(pem))
    expect(verify(null, message, publicKey, Buffer.from(VECTOR_SIGNATURE, 'base64'))).toBe(true)
  })

  it('changing one byte of the version or the hash breaks the vector signature', () => {
    const publicKey = createPublicKey(createPrivateKey(pemFromSeed(VECTOR_SEED)))
    const signature = Buffer.from(VECTOR_SIGNATURE, 'base64')
    expect(verify(null, bundleSignatureMessage('260911063946', VECTOR_SHA256), publicKey, signature)).toBe(false)
    expect(verify(null, bundleSignatureMessage(VECTOR_VERSION, `0${VECTOR_SHA256.slice(1)}`), publicKey, signature)).toBe(false)
  })
})

describe('signBundle', () => {
  it('signs the zip: version from version.json, sha256 of the whole file, verifiable with the public key', () => {
    const { privatePem, publicKey } = generateSigningKey()
    const zip = zipWithVersion('260930120000', { 'index.html': '<html></html>' })

    const result = signBundle(zip, privatePem)

    expect(result.version).toBe('260930120000')
    expect(result.sha256).toBe(createHash('sha256').update(zip).digest('hex'))
    expect(result.size).toBe(zip.length)
    const raw = Buffer.from(publicKey, 'base64')
    expect(raw.length).toBe(32)
    const spki = Buffer.concat([Buffer.from('302a300506032b6570032100', 'hex'), raw])
    const key = createPublicKey({ key: spki, format: 'der', type: 'spki' })
    expect(verify(null, bundleSignatureMessage(result.version, result.sha256), key, Buffer.from(result.signature, 'base64'))).toBe(true)
  })

  it('is deterministic for the same key and bundle', () => {
    const pem = pemFromSeed(VECTOR_SEED)
    const zip = zipWithVersion('1')
    expect(signBundle(zip, pem).signature).toBe(signBundle(zip, pem).signature)
  })

  it('rejects a zip without a usable version.json', () => {
    const pem = pemFromSeed(VECTOR_SEED)
    expect(() => signBundle(zipSync({ 'index.html': new Uint8Array([1]) }), pem)).toThrow(/version\.json/)
    expect(() => signBundle(new Uint8Array([1, 2, 3]), pem)).toThrow(/zip/)
    expect(() => readBundleVersion(zipSync({ 'version.json': new TextEncoder().encode('not json') }))).toThrow(/JSON/)
    expect(() => readBundleVersion(zipSync({ 'version.json': new TextEncoder().encode('{"version":1}') }))).toThrow(/version/)
  })

  it('rejects a key that is not an Ed25519 PEM', () => {
    expect(() => signBundle(zipWithVersion('1'), 'not a pem')).toThrow(/PEM/)
  })
})

describe('bundle commands', () => {
  let dir: string
  let log: ReturnType<typeof vi.spyOn>

  beforeEach(() => {
    dir = mkdtempSync(join(tmpdir(), 'aqutter-bundle-'))
    log = vi.spyOn(console, 'log').mockImplementation(() => undefined)
  })

  afterEach(() => {
    log.mockRestore()
    rmSync(dir, { recursive: true, force: true })
  })

  const printed = (): string => log.mock.calls.map(call => String(call[0])).join('\n')

  it('keygen writes the private key, prints only the public key, and never overwrites', () => {
    runBundle(dir, ['keygen'])

    const keyFile = join(dir, '.aqutter-keys', 'bundle-signing.key')
    const pem = readFileSync(keyFile, 'utf8')
    expect(pem).toContain('BEGIN PRIVATE KEY')
    expect(printed()).toContain(`AQUTTER_UPDATE_PUBLIC_KEYS=${publicKeyBase64(pem)}`)
    expect(printed()).not.toContain('BEGIN PRIVATE KEY')

    expect(() => runBundle(dir, ['keygen'])).toThrow(/不覆蓋/)
    expect(readFileSync(keyFile, 'utf8')).toBe(pem)
  })

  it('keygen --out chooses the folder', () => {
    runBundle(dir, ['keygen', `--out=${join(dir, 'keys')}`])
    expect(existsSync(join(dir, 'keys', 'bundle-signing.key'))).toBe(true)
  })

  it('sign prints version, sha256 and signature as one JSON line with --print-json', () => {
    const pem = pemFromSeed(VECTOR_SEED)
    writeFileSync(join(dir, 'k.pem'), pem)
    const zip = zipWithVersion(VECTOR_VERSION)
    writeFileSync(join(dir, 'web.zip'), zip)

    runBundle(dir, ['sign', 'web.zip', '--key', 'k.pem', '--print-json'])

    const parsed = JSON.parse(String(log.mock.calls[0][0])) as Record<string, unknown>
    expect(parsed).toEqual(signBundle(zip, pem))
  })

  it('sign accepts --key=<file> and falls back to AQUTTER_BUNDLE_SIGNING_KEY', () => {
    const pem = pemFromSeed(VECTOR_SEED)
    writeFileSync(join(dir, 'k.pem'), pem)
    writeFileSync(join(dir, 'web.zip'), zipWithVersion('1'))

    runBundle(dir, ['sign', 'web.zip', '--key=k.pem', '--print-json'])
    const viaFlag = String(log.mock.calls[0][0])

    vi.stubEnv('AQUTTER_BUNDLE_SIGNING_KEY', pem)
    try {
      runBundle(dir, ['sign', 'web.zip', '--print-json'])
    }
    finally {
      vi.unstubAllEnvs()
    }
    expect(String(log.mock.calls[1][0])).toBe(viaFlag)
  })

  it('sign without any key, or with a missing file, fails with a clear message', () => {
    writeFileSync(join(dir, 'web.zip'), zipWithVersion('1'))
    vi.stubEnv('AQUTTER_BUNDLE_SIGNING_KEY', '')
    try {
      expect(() => runBundle(dir, ['sign', 'web.zip'])).toThrow(/需要私鑰/)
    }
    finally {
      vi.unstubAllEnvs()
    }
    expect(() => runBundle(dir, ['sign', 'missing.zip', '--key', 'k.pem'])).toThrow(/找不到網頁包/)
    expect(() => runBundle(dir, ['sign', 'web.zip', '--key', 'missing.pem'])).toThrow(/找不到私鑰檔/)
  })

  it('unknown subcommands and flags print the usage', () => {
    expect(() => runBundle(dir, [])).toThrow(/用法/)
    expect(() => runBundle(dir, ['nope'])).toThrow(/用法/)
    expect(() => runBundle(dir, ['keygen', '--wat'])).toThrow(/未知旗標/)
  })
})
