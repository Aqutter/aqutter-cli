# Tasks for 2610211529-move-client-to-aqutter-js

## Phase 1 — 辨識與改寫
- [x] `versioning.ts` 的正規式與 `rewritePackageJson` 針對新格式；舊格式的案例改為「不處理」
- [x] `plugin.ts` 的 `clientRefOf` 與錯誤訊息
- [x] 範本 `template/plugin/package.json`

## Phase 2 — 同步與文件
- [x] `node scripts/syncManifest.mjs` 同步快照
- [x] 註解、README

## Phase 3 — 驗證
- [x] `pnpm typecheck && pnpm test && pnpm build`
- [x] 以暫存專案跑 `aqutter upgrade --dry-run` 與 `plugin create`，確認 package.json 的 client 依賴變成新格式
- [x] 以 npm、yarn 各安裝一次 `github:Aqutter/aqutter-js#<sha>` 確認可裝
- [ ] 移動 tag `0.0.0`（開發階段慣例，需另行核准）
