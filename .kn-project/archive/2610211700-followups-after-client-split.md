# 2610211700-followups-after-client-split

- Created: 2026-10-21 17:00 / Archived: 2026-10-21 17:30
- Issue: N/A
- Milestone: N/A / Base Branch: main

## Summary
修正 `test/plugins.test.ts` 的 template packaging 在 Windows 失敗：路徑分隔符正規化為 `/` 再比對。

## Key Decisions
- **[送出方式]** 直接推送 `main`，不開 issue／PR — 來源：使用者選擇（開發階段）。

## Details
- 驗證：`pnpm typecheck` 通過、`pnpm test` 147/147 全過（先前 146/147）。
