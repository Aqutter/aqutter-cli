// 以 esbuild 把 CLI 打成單一 ESM 檔（dist/aqutter.mjs）。dist 納入版控，
// 讓使用者可直接從 GitHub 安裝（例如 npm install -D github:Aqutter/aqutter-cli#0.0.0）而不必在本機編譯。
// src/manifestSnapshot.json 是 import 進來的，會一併打包進 dist；它由 scripts/syncManifest.mjs 同步，不手改。
import { build } from 'esbuild'
import { chmodSync } from 'node:fs'

await build({
  entryPoints: ['src/main.ts'],
  outfile: 'dist/aqutter.mjs',
  bundle: true,
  platform: 'node',
  format: 'esm',
  target: 'node20',
  banner: { js: '#!/usr/bin/env node' },
  legalComments: 'none',
})
chmodSync('dist/aqutter.mjs', 0o755)
console.log('built dist/aqutter.mjs')
