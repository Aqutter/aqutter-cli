import { describe, expect, it } from 'vitest'

import { waitForHttpReady } from '../src/shared.ts'

const clock = (): { now: () => number, sleep: (ms: number) => Promise<void> } => {
  let time = 0
  return { now: () => time, sleep: async (ms) => { time += ms } }
}

describe('waitForHttpReady', () => {
  it('returns true as soon as a url answers with a non-5xx status', async () => {
    const { now, sleep } = clock()
    const answers = [503, 503, 404]
    const ok = await waitForHttpReady(['http://x/'], {
      timeoutMs: 60_000,
      intervalMs: 500,
      fetchFn: async () => ({ status: answers.shift() ?? 200 }),
      sleepFn: sleep,
      now,
    })
    expect(ok).toBe(true)
    expect(answers).toEqual([])
  })

  it('keeps waiting through connection errors, then succeeds', async () => {
    const { now, sleep } = clock()
    let calls = 0
    const ok = await waitForHttpReady(['http://x/'], {
      timeoutMs: 60_000,
      intervalMs: 500,
      fetchFn: async () => {
        calls += 1
        if (calls < 4) {
          throw new Error('ECONNREFUSED')
        }
        return { status: 200 }
      },
      sleepFn: sleep,
      now,
    })
    expect(ok).toBe(true)
    expect(calls).toBe(4)
  })

  it('treats any url answering as ready (IPv4 or IPv6)', async () => {
    const { now, sleep } = clock()
    const ok = await waitForHttpReady(['http://a/', 'http://b/'], {
      timeoutMs: 10_000,
      intervalMs: 500,
      fetchFn: async (url) => {
        if (url === 'http://a/') {
          throw new Error('ECONNREFUSED')
        }
        return { status: 200 }
      },
      sleepFn: sleep,
      now,
    })
    expect(ok).toBe(true)
  })

  it('gives up with false after the timeout when the server never recovers', async () => {
    const { now, sleep } = clock()
    const waits: number[] = []
    const ok = await waitForHttpReady(['http://x/'], {
      timeoutMs: 2000,
      intervalMs: 500,
      fetchFn: async () => ({ status: 503 }),
      sleepFn: sleep,
      now,
      onWait: waited => waits.push(waited),
    })
    expect(ok).toBe(false)
    expect(waits.length).toBeGreaterThan(0)
  })
})
