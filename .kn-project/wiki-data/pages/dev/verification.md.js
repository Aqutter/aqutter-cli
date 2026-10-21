WIKI_PAGE("dev/verification.md",{
"title":"驗證指令",
"summary":"修改 CLI 後依序執行型別檢查、單元測試與打包。打包後的產物納入版控，使用者直接從 GitHub 安裝，所以改動原始碼或範本之後必須重新打包並一併提交。內建的版本清單快照由同步腳本更新，不手改。",
"svgs":{},
"seq":{},
"ext":["archive/2610211114-split-cli-to-aqutter-cli-repo.md"],
"changelog":[{"plan": "2610211114-split-cli-to-aqutter-cli-repo", "date": "2026-10-21", "version": "0.0.0", "note": "建立", "issue": "[#1](https://github.com/Aqutter/aqutter-cli/issues/1)", "pr": "—"}],
"md":"# 驗證指令\n\n## Summary\n修改 CLI 後依序執行型別檢查、單元測試與打包。打包後的產物納入版控，使用者直接從 GitHub 安裝，所以改動原始碼或範本之後必須重新打包並一併提交。內建的版本清單快照由同步腳本更新，不手改。\n\n## 驗證順序\n1. 型別檢查。\n2. 單元測試。\n3. 打包，並確認打包產物沒有未提交的差異。\n\n### 型別檢查\n\n```bash\npnpm typecheck\n```\n\n### 單元測試\n\n```bash\npnpm test\n```\n\n### 打包\n\n```bash\npnpm build\n```\n\n### 同步內建快照\n\n```bash\npnpm manifest:sync\n```\n\n來源：1. [package.json](../../../package.json#L28-L33)　2. [syncManifest.mjs](../../../scripts/syncManifest.mjs)\n\n## 規則\n| 規則 | 說明 |\n|---|---|\n| 打包產物同步 | 改動原始碼或範本後重新打包並提交；持續整合會檢查沒有差異 |\n| 範本與清單一致 | 範本的 Flutter 與 sdk 約束必須等於內建快照所記載的基準，由持續整合檢查 |\n| 已知的既有失敗 | 打包範本的測試在 Windows 上有一項既有失敗，與清單無關 |\n\n來源：1. [ci.yml](../../../.github/workflows/ci.yml)\n\n---\n[🏠 Wiki](../index.md)\n"
});
