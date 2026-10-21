# 驗證指令

## Summary
修改 CLI 後依序執行型別檢查、單元測試與打包。打包後的產物納入版控，使用者直接從 GitHub 安裝，所以改動原始碼或範本之後必須重新打包並一併提交。內建的版本清單快照由同步腳本更新，不手改。

## 驗證順序
1. 型別檢查。
2. 單元測試。
3. 打包，並確認打包產物沒有未提交的差異。

### 型別檢查

```bash
pnpm typecheck
```

### 單元測試

```bash
pnpm test
```

### 打包

```bash
pnpm build
```

### 同步內建快照

```bash
pnpm manifest:sync
```

來源：1. [package.json](../../../package.json#L28-L33)　2. [syncManifest.mjs](../../../scripts/syncManifest.mjs)

## 規則
| 規則 | 說明 |
|---|---|
| 打包產物同步 | 改動原始碼或範本後重新打包並提交；持續整合會檢查沒有差異 |
| 範本與清單一致 | 範本的 Flutter 與 sdk 約束必須等於內建快照所記載的基準，由持續整合檢查 |
| 已知的既有失敗 | 打包範本的測試在 Windows 上有一項既有失敗，與清單無關 |

來源：1. [ci.yml](../../../.github/workflows/ci.yml)

---
[🏠 Wiki](../index.md)
