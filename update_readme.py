#!/usr/bin/env python3
"""
frontend/mobile/README.md を最新の開発状況に合わせて全面更新
"""
import os, subprocess

ROOT = os.path.expanduser('~/projects/dump-tracker')

NEW_README = '''# 🚛 Dump Tracker — Mobile App

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
dump-tracker/
├── backend/                          — Node.js / TypeScript / Express / Prisma
│   ├── src/
│   │   ├── routes/
│   │   │   ├── index.ts              — ルート統合（404ハンドラー前に新規ルート追加）
│   │   │   ├── devCleanupRoutes.ts   — UAT準備データクリーンアップAPI（ADMIN専用）
│   │   │   └── ...
│   │   ├── controllers/
│   │   ├── services/
│   │   ├── middleware/
│   │   │   └── auth.ts               — authenticateToken() / requireAdmin
│   │   └── utils/
│   │       └── database.ts           — DatabaseService.getInstance() ← ここからimport
│   └── prisma/
│       └── schema.camel.prisma       — スキーマ（camelCase フィールド）
│
├── frontend/
│   ├── mobile/                       — Mobile PWA (port 3002)
│   │   ├── index.html                — CSP設定（全環境対応済み）
│   │   ├── src/
│   │   │   ├── pages/
│   │   │   │   ├── OperationRecord.tsx   — 運行中MAP画面（D4）
│   │   │   │   ├── LoadingInput.tsx      — 客先積載物入力（D5）
│   │   │   │   └── ...
│   │   │   ├── components/
│   │   │   │   └── ActivityEditSheet.tsx — アクティビティ編集シート
│   │   │   ├── services/
│   │   │   │   └── api.ts               — APIクライアント
│   │   │   └── stores/
│   │   │       ├── operationStore.ts     — 運行状態管理（Zustand）
│   │   │       └── authStore.ts          — 認証状態管理
│   │   └── README.md                 ← このファイル
│   │
│   └── cms/                          — CMS管理画面 (port 3001)
│       ├── index.html                — CSP metaなし（backendのhelmetが担当）
│       └── src/
│           ├── pages/
│           │   ├── DevDataCleanup.tsx    — UAT準備データクリーンアップ画面
│           │   ├── OperationRecords.tsx  — 運行記録一覧
│           │   ├── Dashboard.tsx
│           │   └── ...
│           └── App.tsx               — ルーティング定義
```

---

## 🌐 環境別アクセス先

| 環境 | Mobile | CMS | Backend |
|------|--------|-----|---------|
| 開発 (omega-dev) | `https://10.1.119.244:3002` | `https://10.1.119.244:3001` | `https://10.1.119.244:8443` |
| Staging | `https://dumptracker-s.ddns.net` | `https://dumptracker-s.ddns.net:3003` | nginx プロキシ経由 |
| Production | `https://dumptracker.ddns.net` | `https://dumptracker.ddns.net:3003` | nginx プロキシ経由 |

---

## 🔒 セキュリティ — CSP（Content Security Policy）

### Mobile (`frontend/mobile/index.html`)

`<meta>` タグで CSP を直接定義。**全環境対応済み**（2026-05-27 修正）。

| 環境 | `connect-src` に含まれる主なオリジン |
|------|--------------------------------------|
| 開発 | `https://10.1.119.244:8443`, `https://localhost:3001`, `https://localhost:3002` |
| Staging | `https://dumptracker-s.ddns.net` |
| Production | `https://dumptracker.ddns.net` ← 以前は未追加でログイン不可だった |
| 共通 | `https://maps.googleapis.com`, `https://tlog-apex.ddns.net`, `wss:` |

### CMS (`frontend/cms/index.html`)

CSP `<meta>` タグなし。バックエンドの helmet が `connectSrc: ['https:', 'wss:']` で全 HTTPS 接続を許可するため修正不要。

### CSP を修正するときのルール

- Mobile の `connect-src` に新オリジンを追加する場合は `frontend/mobile/index.html` を直接編集
- 新しい環境（本番 IP 変更など）が追加されたら必ず `connect-src` に追加すること
- `dumptracker.ddns.net`（本番）と `dumptracker-s.ddns.net`（staging）の両方を常に含めること

---

## 🛠️ UAT準備 データクリーンアップ機能

**ADMIN専用・開発環境裏機能**。UAT開始前のテストデータ一掃に使用する。

### アクセス

```
https://10.1.119.244:3001/dev/data-cleanup
```

### 機能

| 機能 | 説明 |
|------|------|
| トランザクションデータ全件削除 | 運行記録・GPS・点検記録など全トランザクションを外部キー順に物理削除 |
| マスタデータ個別削除 | 車両・ユーザー(DRIVER)・客先・場所・品目・点検項目を選択して物理削除 |

### 確認コード

トランザクション全件削除の実行には以下の確認コードが必要：

```
DUMPTRACKER2026
```

### APIエンドポイント（ADMIN認証必須）

| メソッド | パス | 説明 |
|---------|------|------|
| `GET` | `/api/v1/dev/cleanup/counts` | 各テーブルの件数取得 |
| `POST` | `/api/v1/dev/cleanup/transactions` | トランザクション全件削除 |
| `POST` | `/api/v1/dev/cleanup/master/bulk-delete` | マスタ複数件削除 |
| `DELETE` | `/api/v1/dev/cleanup/master/:table/:id` | マスタ1件削除 |

### テーブルキー対応表（重要）

フロントのキー名（`MASTER_TABLES.key`）と DB 物理テーブル名は別物。`tableMap` で変換している。

| フロントキー | DB物理テーブル | 備考 |
|------------|-------------|------|
| `vehicles` | `vehicles` | |
| `users_driver` | `users` | `role=DRIVER` フィルタはバックエンド側 |
| `customers` | `customers` | |
| `locations` | `locations` | |
| `items` | `items` | |
| `inspectionItems` | `inspection_items` | camelCase → snake_case |

### トランザクション削除順序（外部キー制約考慮）

```
inspection_item_results → operation_detail_items → operation_details
→ inspection_records → gps_logs → accident_records → operations
→ maintenance_records → reports → notifications → audit_logs
```

---

## ⚙️ 重要な技術ルール

### バックエンド

| ルール | 内容 |
|-------|------|
| `DatabaseService` の import | `from '../utils/database'`（`../services/databaseService` は誤り） |
| `authenticateToken()` | 必ず括弧付きで呼ぶ（参照渡しすると silent fail する） |
| `MAX_PAGE_SIZE` | `100`（`limit=200` 以上は 400 Bad Request になる） |
| 新規ルート追加 | `routes/index.ts` の 404 ハンドラーより**前**に `safeImportAndRegisterRoute` で追加 |
| Prisma スキーマ | `schema.camel.prisma`（camelCase フィールド） |
| `as any` キャスト | 禁止。runtime の `undefined`/NULL バグの原因になる |

### フロントエンド (CMS)

| ルール | 内容 |
|-------|------|
| `localStorage` トークンキー | `'auth_token'`（`'token'` は誤り） |
| API `limit` 上限 | `100`（MAX_PAGE_SIZE） |
| `authenticateToken()` | 括弧必須（参照渡し禁止） |

### GPS / Mobile

| ルール | 内容 |
|-------|------|
| GPS 取得方式 | `setInterval` + `latestPositionRef`（`watchPosition` コールバックは禁止） |
| 異常距離フィルタ | `MAX_REASONABLE_DISTANCE_KM = 200` を超える距離はスキップ |
| React Strict Mode | `useRef` ガードで `useEffect` 二重実行を防ぐ |

---

## 🚀 開発サーバー起動

```bash
# バックエンド + 全サービス完全再起動
dt-restart

# モバイルフロントエンドのみ (port 3002)
dt-mobile   # または cd frontend/mobile && npm run dev

# CMS のみ (port 3001)
dt-cms      # または cd frontend/cms && npm run dev

# バックエンドのみ
dt-backend  # または cd backend && npm run dev
```

### 標準コミットフロー

```bash
npx tsc --noEmit          # TypeScript エラー 0 確認
git add -A
git commit -m "fix: ..."
git push origin main
# → GitHub Actions が staging に自動デプロイ（CI/CD 有効時）
```

---

## 🔗 関連ドキュメント・リソース

- バックエンドAPI: `backend/README.md`
- Prisma スキーマ: `backend/prisma/schema.camel.prisma`
- ハンドオフ資料: `docs/HANDOFF_dump-tracker_20260424.md`
- Staging VM: `dump-tracker-vm-staging-v2`（IP: `8.228.253.81`）
- SSL 証明書期限: 2026-08-22（Let\'s Encrypt、自動更新設定要確認）
'''

filepath = os.path.join(ROOT, 'frontend/mobile/README.md')
with open(filepath, 'w', encoding='utf-8') as f:
    f.write(NEW_README)
print('✅ README.md 更新完了')

print('\n[TypeScript コンパイルチェック - Mobile]')
r = subprocess.run(
    'cd ~/projects/dump-tracker/frontend/mobile && npx tsc --noEmit 2>&1',
    shell=True, capture_output=True, text=True
)
errors = [l for l in (r.stdout+r.stderr).splitlines() if 'error TS' in l]
if errors:
    print('❌ TSエラー:')
    for e in errors: print(' ', e)
    exit(1)
print('✅ TypeScript: エラー 0件')

print('\n[Git commit & push...]')
subprocess.run(
    'cd ~/projects/dump-tracker && git add -A && '
    'git commit -m "docs: README.md 全面更新 (CSP/クリーンアップ機能/技術ルール/環境情報)" && '
    'git push origin main',
    shell=True
)

print('\n✅ README.md 更新・push完了！')
