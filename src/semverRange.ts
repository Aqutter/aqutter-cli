// plugin `requires` 用的最小 semver 範圍：只支援 `^x.y.z`、`~x.y.z` 與精確的 `x.y.z`。
// 其他語法（`>=`、`||`、`*`、預發佈標籤…）一律視為不合法，避免默默放行不懂的範圍。
import { satisfies } from './versioning.ts'

const RANGE = /^([\^~])?(\d+)\.(\d+)\.(\d+)$/

/**
 * 把範圍轉成 `satisfies` 看得懂的比較式（`>=a.b.c <d.e.f` 或 `=a.b.c`）；不支援的語法回 null。
 *
 * `^` 鎖住最左邊不為 0 的位數（`^1.2.3` → `<2.0.0`、`^0.2.3` → `<0.3.0`、`^0.0.3` → `<0.0.4`），
 * `~` 鎖住次版號（`~1.2.3` → `<1.3.0`）。
 */
export const rangeToConstraint = (range: string): string | null => {
  const match = RANGE.exec(range.trim())
  if (!match) {
    return null
  }
  const [, op, major, minor, patch] = match
  const [a, b, c] = [Number(major), Number(minor), Number(patch)]
  const base = `${a}.${b}.${c}`
  if (op === undefined) {
    return `=${base}`
  }
  if (op === '~') {
    return `>=${base} <${a}.${b + 1}.0`
  }
  if (a > 0) {
    return `>=${base} <${a + 1}.0.0`
  }
  return b > 0 ? `>=${base} <0.${b + 1}.0` : `>=${base} <0.0.${c + 1}`
}

/** `version` 是否落在 `range` 內；範圍或版本無法判讀回 null。 */
export const satisfiesRange = (version: string, range: string): boolean | null => {
  const constraint = rangeToConstraint(range)
  return constraint === null ? null : satisfies(version, constraint)
}
