# 🚛 Dump Tracker — Mobile App

ダンプトラック運行記録モバイルアプリ

---

## 🎨 カラーシステム（Trade Colors）

モバイルアプリ全体で統一するトレードカラー。  
**新規コンポーネントやUI追加時は必ずこのカラーを使用すること。**

| 種別 | 用途 | メインカラー | 濃色（ヘッダー） | 薄色（バナー背景） |
|---|---|---|---|---|
| 積込 | 積込場所到着・積込作業 | `#2196F3` | `#1565C0` | `#E3F2FD` |
| 積降 | 積降場所到着・積降作業 | `#4CAF50` | `#2E7D32` | `#E8F5E9` |
| 給油 | 給油記録 | `#FF9800` | `#E65100` | `#FFF3E0` |
| 休憩 | 休憩・待機 | `#9C27B0` | `#6A1B9A` | `#F3E5F5` |
| 運行終了 | 運行終了・危険操作 | `#F44336` | `#B71C1C` | `#FFEBEE` |

### 使用例（ActivityEditSheet / OperationRecord）

```typescript
// OperationRecord.tsx — フェーズボタン
積込場所到着  : background: '#2196F3'
積降場所到着  : background: '#4CAF50'
休憩ボタン    : background: '#9C27B0'
給油ボタン    : background: '#FF9800'
運行終了      : background: '#F44336'

// ActivityEditSheet.tsx — ACTIVITY_CONFIG
積込系 color: '#1565C0', colorLight: '#2196F3', bannerBg: '#E3F2FD'
積降系 color: '#2E7D32', colorLight: '#4CAF50', bannerBg: '#E8F5E9'
給油系 color: '#E65100', colorLight: '#FF9800', bannerBg: '#FFF3E0'
休憩系 color: '#6A1B9A', colorLight: '#9C27B0', bannerBg: '#F3E5F5'
```

### グラデーション適用ルール

ヘッダー背景には `linear-gradient(135deg, {濃色} 0%, {メインカラー} 100%)` を使用。

---

## 📁 プロジェクト構成

```
frontend/mobile/src/
├── pages/
│   ├── OperationRecord.tsx       — 運行中MAP画面（D4）
│   ├── LoadingInput.tsx          — 客先積載物入力（D5）
│   └── ...
├── components/
│   ├── ActivityEditSheet.tsx     — アクティビティ編集シート
│   └── ...
├── services/
│   └── api.ts                    — APIクライアント
└── stores/
    ├── operationStore.ts         — 運行状態管理
    └── authStore.ts              — 認証状態管理
```

---

## 🚀 開発サーバー起動

```bash
# バックエンド
dt-restart

# モバイルフロントエンド (port 3002)
cd frontend/mobile && npm run dev

# CMS (port 3001)
cd frontend/cms && npm run dev
```

---

## 🔗 関連ドキュメント

- バックエンドAPI: `backend/README.md`
- ハンドオフ資料: `docs/HANDOFF_dump-tracker_20260424.md`

