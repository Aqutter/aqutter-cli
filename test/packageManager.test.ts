import { mkdtempSync, rmSync, writeFileSync } from 'node:fs'
import { tmpdir } from 'node:os'
import { join } from 'node:path'
import { afterEach, beforeEach, describe, expect, it } from 'vitest'

import { addArgs, detectPackageManager, execPrefixOf, installCommandOf } from '../src/web.ts'

let root: string

const touch = (...files: string[]): void => {
  for (const file of files) {
    writeFileSync(join(root, file), '')
  }
}

beforeEach(() => {
  root = mkdtempSync(join(tmpdir(), 'aqutter-pm-'))
})
afterEach(() => {
  rmSync(root, { recursive: true, force: true })
})

describe('detectPackageManager', () => {
  it('recognises each lockfile', () => {
    touch('pnpm-lock.yaml')
    expect(detectPackageManager(root)).toBe('pnpm')
  })

  it('recognises yarn', () => {
    touch('yarn.lock')
    expect(detectPackageManager(root)).toBe('yarn')
  })

  it('recognises bun from either bun.lock or bun.lockb', () => {
    touch('bun.lock')
    expect(detectPackageManager(root)).toBe('bun')
    rmSync(join(root, 'bun.lock'))
    touch('bun.lockb')
    expect(detectPackageManager(root)).toBe('bun')
  })

  it('falls back to npm with package-lock.json or with no lockfile at all', () => {
    expect(detectPackageManager(root)).toBe('npm')
    touch('package-lock.json')
    expect(detectPackageManager(root)).toBe('npm')
  })

  it('prefers pnpm, then yarn, then bun when several lockfiles exist', () => {
    touch('bun.lock', 'yarn.lock', 'pnpm-lock.yaml')
    expect(detectPackageManager(root)).toBe('pnpm')
    rmSync(join(root, 'pnpm-lock.yaml'))
    expect(detectPackageManager(root)).toBe('yarn')
    rmSync(join(root, 'yarn.lock'))
    expect(detectPackageManager(root)).toBe('bun')
  })
})

describe('per-manager commands', () => {
  it('uses the right prefix for running a local bin', () => {
    expect(execPrefixOf('pnpm')).toEqual({ command: 'pnpm', args: ['exec'] })
    expect(execPrefixOf('yarn')).toEqual({ command: 'yarn', args: [] })
    expect(execPrefixOf('bun')).toEqual({ command: 'bunx', args: [] })
    expect(execPrefixOf('npm')).toEqual({ command: 'npx', args: ['--no-install'] })
  })

  it('uses install for npm and add for the others when adding a package', () => {
    expect(addArgs('npm', 'x')).toEqual(['install', 'x'])
    expect(addArgs('pnpm', 'x')).toEqual(['add', 'x'])
    expect(addArgs('yarn', 'x')).toEqual(['add', 'x'])
    expect(addArgs('bun', 'x')).toEqual(['add', 'x'])
  })

  it('names the reinstall command after the manager', () => {
    expect(installCommandOf('bun')).toBe('bun install')
    expect(installCommandOf('npm')).toBe('npm install')
  })
})
