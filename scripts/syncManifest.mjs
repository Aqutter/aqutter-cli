// 把 Aqutter 的 release manifest 同步成 CLI 內建的快照（src/manifestSnapshot.json）。快照不手改。
//
// 用法：
//   node scripts/syncManifest.mjs                 從預設網址（main 上的 raw 網址）下載
//   node scripts/syncManifest.mjs <本機檔案路徑>   從本機檔案複製（例如 ../aqutter/manifest/releases.json）
//   node scripts/syncManifest.mjs <https 網址>     從指定網址下載
//
// 這裡只確認內容是 JSON 物件並寫成排版一致的檔案；完整的格式驗證由 test/manifest.test.ts 對快照執行。

import { readFileSync, writeFileSync } from 'node:fs'

const DEFAULT_URL = 'https://raw.githubusercontent.com/Aqutter/aqutter/main/manifest/releases.json'
const target = new URL('../src/manifestSnapshot.json', import.meta.url)

const source = process.argv[2] ?? DEFAULT_URL
let text
if (source.startsWith('https://')) {
  const response = await fetch(source)
  if (!response.ok) {
    console.error(`下載失敗：${source} -> HTTP ${response.status}`)
    process.exit(1)
  }
  text = await response.text()
}
else if (source.startsWith('http://')) {
  console.error('只接受 https 網址')
  process.exit(1)
}
else {
  text = readFileSync(source, 'utf8')
}

const parsed = JSON.parse(text)
if (typeof parsed !== 'object' || parsed === null || Array.isArray(parsed)) {
  console.error('manifest 必須是 JSON 物件')
  process.exit(1)
}
writeFileSync(target, `${JSON.stringify(parsed, null, 2)}\n`)
console.log(`已同步 ${source} -> src/manifestSnapshot.json`)
