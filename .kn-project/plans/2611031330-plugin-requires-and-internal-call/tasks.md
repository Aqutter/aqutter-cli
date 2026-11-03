# Tasks for 2611031330

## Phase 1 — 描述檔與連帶登記
- [x] [aqutter-cli] `src/semverRange.ts`：最小 semver 範圍解析（Q4）
- [x] [aqutter-cli] `PluginDescriptor.requires` 與 `parseDescriptor` 驗證（Contract §1 #1）　可平行
- [x] [aqutter-cli] `plugin add` 連帶安裝並登記 B、版本不符時失敗且不寫入
- [x] [aqutter-cli] `plugin remove` 仍被需要時拒絕，`--force` 例外

## Phase 2 — doctor 與測試
- [x] [aqutter-cli] `doctor` 檢查已登記 plugin 的 `requires`
- [x] [aqutter-cli] `test/plugins.test.ts` 補測試

## Phase 3 — 建置與版本
- [x] [aqutter-cli] `pnpm typecheck && pnpm test`
- [ ] [aqutter-cli] `pnpm manifest:sync && pnpm build`，提交 `dist/`
- [ ] [aqutter-cli] 移動 `0.0.0` tag（需使用者同意後強推）
