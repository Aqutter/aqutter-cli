# Tasks for 2610211529-move-client-to-aqutter-js

## Phase 1 — 辨識與改寫
- [ ] `versioning.ts` 的正規式與 `rewritePackageJson` 針對新格式；舊格式的案例改為「不處理」
- [ ] `plugin.ts` 的 `clientRefOf` 與錯誤訊息
- [ ] 範本 `template/plugin/package.json`

## Phase 2 — 同步與文件
- [ ] `node scripts/syncManifest.mjs` 同步快照
- [ ] 註解、README

## Phase 3 — 驗證
- [ ] `pnpm typecheck && pnpm test && pnpm build`
- [ ] 以暫存專案跑 `aqutter upgrade --dry-run` 與 `plugin create`，確認 package.json 的 client 依賴變成新格式
- [ ] 以 npm、yarn 各安裝一次 `github:Aqutter/aqutter-js#<sha>` 確認可裝
- [ ] 移動 tag `0.0.0`（開發階段慣例，需另行核准）
