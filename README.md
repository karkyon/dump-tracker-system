# 🚛 Dump Tracker — ダンプ運行記録システム

ダンプトラックの運行記録・GPS追跡・帳票出力・マスタ管理を一元化するフルスタック業務システム。

---

## 🏗️ システム構成

```
dump-tracker/
├── backend/                        — Node.js / TypeScript / Express / Prisma (PostgreSQL)
│   ├── src/
│   │   ├── app.ts                  — Expressアプリ初期化（CORS・Helmet・ルーティング）
│   │   ├── server.ts               — HTTPS/HTTPサーバー起動
│   │   ├── routes/
│   │   │   ├── index.ts            — 全ルート統合（404ハンドラー前に新規ルート追加）
│   │   │   ├── authRoutes.ts       — 認証・JWT
│   │   │   ├── operationRoutes.ts  — 運行管理
│   │   │   ├── operationDetailRoutes.ts — 運行明細
│   │   │   ├── vehicleRoutes.ts    — 車両管理
│   │   │   ├── mobileRoutes.ts     — モバイル専用API
│   │   │   ├── userRoutes.ts       — ユーザー管理
│   │   │   ├── customerRoutes.ts   — 客先マスタ
│   │   │   ├── locationRoutes.ts   — 積込・積降場所マスタ
│   │   │   ├── itemRoutes.ts       — 品目マスタ
│   │   │   ├── inspectionRoutes.ts — 点検記録
│   │   │   ├── inspectionItemRoutes.ts — 点検項目マスタ
│   │   │   ├── reportRoutes.ts     — 帳票出力
│   │   │   ├── gpsRoutes.ts        — GPS横断機能
│   │   │   ├── debugRoutes.ts      — デバッグAPI（ADMIN専用）
│   │   │   ├── devCleanupRoutes.ts — UAT準備クリーンアップAPI（ADMIN専用）
│   │   │   └── ...
│   │   ├── controllers/            — リクエスト処理
│   │   ├── services/               — ビジネスロジック
│   │   ├── middleware/
│   │   │   ├── auth.ts             — JWT認証 authenticateToken() / requireAdmin
│   │   │   └── errorHandler.ts     — 統一エラーハンドリング
│   │   └── utils/
│   │       ├── database.ts         — DatabaseService.getInstance() ← ここからimport
│   │       ├── response.ts         — sendSuccess / sendError
│   │       └── logger.ts           — Winston ロガー
│   └── prisma/
│       ├── schema.prisma           — スネークケーススキーマ（DB物理テーブル）
│       └── schema.camel.prisma     — camelCaseスキーマ（@prisma/client 出力用）★使用中
│
├── frontend/
│   ├── mobile/                     — Mobile PWA（運転手向け）port 3002
│   │   ├── index.html              — CSP設定（全環境対応済み）
│   │   └── src/
│   │       ├── pages/
│   │       │   ├── Login.tsx            — D1: ログイン
│   │       │   ├── VehicleInfo.tsx      — D2: 車両選択・開始距離入力
│   │       │   ├── PreDepartureInspection.tsx — D3: 乗車前点検
│   │       │   ├── OperationRecord.tsx  — D4: 運行中MAP・操作
│   │       │   ├── LoadingInput.tsx     — D5: 客先積載物入力
│   │       │   ├── RefuelRecord.tsx     — D7: 給油記録
│   │       │   ├── PostTripInspection.tsx — D8: 乗車後点検
│   │       │   └── OperationHistory.tsx — D9: 運行履歴
│   │       ├── components/
│   │       │   └── ActivityEditSheet.tsx — アクティビティ編集シート
│   │       ├── stores/
│   │       │   ├── operationStore.ts    — 運行状態管理（Zustand + localStorage）
│   │       │   └── authStore.ts         — 認証状態管理
│   │       └── services/
│   │           └── api.ts               — APIクライアント（Axios）
│   │
│   └── cms/                        — CMS管理画面（管理者・マネージャー向け）port 3001
│       ├── index.html              — CSP metaなし（backendのhelmetが担当）
│       └── src/
│           ├── pages/
│           │   ├── Dashboard.tsx        — ダッシュボード
│           │   ├── OperationRecords.tsx — 運行記録一覧
│           │   ├── VehicleManagement.tsx — 車両管理
│           │   ├── UserManagement.tsx   — ユーザー管理
│           │   ├── CustomerManagement.tsx — 客先管理
│           │   ├── LocationManagement.tsx — 場所管理
│           │   ├── ItemManagement.tsx   — 品目管理
│           │   ├── InspectionItemManagement.tsx — 点検項目管理
│           │   ├── ReportOutput.tsx     — 帳票出力
│           │   ├── AccidentRecordManagement.tsx — 事故記録管理
│           │   ├── FeedbackList.tsx     — フィードバック管理
│           │   └── DevDataCleanup.tsx   — UAT準備データクリーンアップ
│           ├── components/
│           │   └── common/
│           │       ├── Table.tsx        — スクロール対応テーブル（scrollClassName prop）
│           │       └── Pagination.tsx   — ページネーション
│           ├── stores/                  — Zustand各マスタストア
│           └── App.tsx                 — ルーティング定義
│
├── .github/
│   └── workflows/
│       └── staging-deploy.yml      — GitHub Actions CI/CD（staging自動デプロイ）
│
└── README.md                       ← このファイル（システム全体）
```

---

## 🌐 環境別アクセス先

| 環境 | Mobile | CMS | Backend API |
|------|--------|-----|-------------|
| **開発** (omega-dev) | `https://10.1.119.244:3002` | `https://10.1.119.244:3001` | `https://10.1.119.244:8443` |
| **Staging** | `https://dumptracker-s.ddns.net` | `https://dumptracker-s.ddns.net:3003` | nginx プロキシ経由 |
| **Production** | `https://dumptracker.ddns.net` | `https://dumptracker.ddns.net:3003` | nginx プロキシ経由 |

### サーバー情報
| 項目 | 値 |
|------|-----|
| 開発サーバー | `karkyon@35.212.239.48` (omega-dev) |
| アプリルート | `~/projects/dump-tracker/` |
| Staging VM | `dump-tracker-vm-staging-v2`（IP: `8.228.253.81`）|
| Staging SSH | `karkyon_dump@8.228.253.81` |
| SSL証明書 | Let's Encrypt（期限: 2026-08-22） |

---

## 🛠️ 技術スタック

### Backend
| 技術 | バージョン | 用途 |
|------|-----------|------|
| Node.js | v18+ | ランタイム |
| TypeScript | ^5.0 | 型安全開発 |
| Express | ^4.x | Webフレームワーク |
| Prisma | ^5.x | ORM（`schema.camel.prisma` 使用） |
| PostgreSQL | 14+ | データベース |
| JWT | - | 認証トークン |
| pdfkit | - | PDF帳票生成（IPA フォント必須） |
| Winston | - | ログ管理 |
| mkcert | - | 開発用HTTPS証明書 |

### Frontend（Mobile / CMS 共通）
| 技術 | バージョン | 用途 |
|------|-----------|------|
| React | 18 | UIフレームワーク |
| TypeScript | ^5.0 | 型安全開発 |
| Vite | ^4.x | ビルドツール |
| Tailwind CSS | ^3.x | スタイリング |
| Zustand | ^4.x | 状態管理 |
| React Router DOM | ^6.x | ルーティング |
| Axios | ^1.x | HTTPクライアント |
| React Hot Toast | ^2.x | 通知UI |
| Lucide React | - | アイコン |

### Mobile 追加
| 技術 | 用途 |
|------|------|
| Google Maps API (WebGL Vector) | マップ表示・GPS追跡 |
| PWA (Vite Plugin) | プログレッシブWebアプリ対応 |

---

## 🗄️ データベース構造（主要テーブル）

### マスタテーブル
| テーブル | 説明 |
|---------|------|
| `users` | ユーザー（ADMIN / MANAGER / DRIVER） |
| `vehicles` | 車両マスタ（ナンバー・車種・走行距離） |
| `customers` | 客先マスタ |
| `locations` | 積込・積降場所マスタ |
| `items` | 品目マスタ（積載物） |
| `inspection_items` | 点検項目マスタ |

### トランザクションテーブル（外部キー制約順）
```
inspection_item_results → operation_detail_items → operation_details
→ inspection_records → gps_logs → accident_records → operations
→ maintenance_records → reports → notifications → audit_logs
```

---

## 🚀 開発サーバー起動

```bash
# バックエンド + 全サービス完全再起動
dt-restart

# 個別起動
dt-backend   # バックエンドのみ
dt-cms       # CMS のみ (port 3001)
dt-mobile    # Mobile のみ (port 3002)

# 手動起動
cd backend && npm run dev
cd frontend/cms && npm run dev -- --port 3001
cd frontend/mobile && npm run dev -- --port 3002
```

### 標準コミットフロー

```bash
npx tsc --noEmit          # TypeScript エラー 0 確認（必須）
git add -A
git commit -m "fix: ..."
git push origin main
# → GitHub Actions が staging に自動デプロイ（CI/CD 有効時）
```

---

## 🔒 セキュリティ — CSP（Content Security Policy）

### Mobile (`frontend/mobile/index.html`)
`<meta>` タグで CSP を直接定義。**全環境対応済み**（2026-05-27 修正）。

| 環境 | `connect-src` に含まれる主なオリジン |
|------|--------------------------------------|
| 開発 | `https://10.1.119.244:8443`, `https://localhost:3001`, `https://localhost:3002` |
| Staging | `https://dumptracker-s.ddns.net` |
| Production | `https://dumptracker.ddns.net` |
| 共通 | `https://maps.googleapis.com`, `https://tlog-apex.ddns.net`, `wss:` |

### CMS (`frontend/cms/index.html`)
CSP `<meta>` タグなし。バックエンドの helmet が `connectSrc: ['https:', 'wss:']` で担当。修正不要。

### CSP 修正ルール
- 新オリジン追加 → `frontend/mobile/index.html` を直接編集
- `dumptracker.ddns.net`（本番）と `dumptracker-s.ddns.net`（staging）は常に両方含める

---

## 🎨 カラーシステム（Mobile Trade Colors）

| 種別 | 用途 | メインカラー | 濃色（ヘッダー） | 薄色（背景） |
|---|---|---|---|---|
| 積込 | 積込場所到着・積込作業 | `#2196F3` | `#1565C0` | `#E3F2FD` |
| 積降 | 積降場所到着・積降作業 | `#4CAF50` | `#2E7D32` | `#E8F5E9` |
| 給油 | 給油記録 | `#FF9800` | `#E65100` | `#FFF3E0` |
| 休憩 | 休憩・待機 | `#9C27B0` | `#6A1B9A` | `#F3E5F5` |
| 運行終了 | 運行終了・危険操作 | `#F44336` | `#B71C1C` | `#FFEBEE` |

ヘッダー背景: `linear-gradient(135deg, {濃色} 0%, {メインカラー} 100%)`

---

## 🛠️ UAT準備 データクリーンアップ機能

**ADMIN専用・開発環境裏機能**。UAT開始前のテストデータ一掃に使用する。

### アクセス
```
https://10.1.119.244:3001/dev/data-cleanup
```

### 確認コード（トランザクション全件削除）
```
DUMPTRACKER2026
```

### API一覧（ADMIN認証必須）
| メソッド | パス | 説明 |
|---------|------|------|
| `GET` | `/api/v1/dev/cleanup/counts` | 各テーブルの件数取得 |
| `POST` | `/api/v1/dev/cleanup/transactions` | トランザクション全件物理削除 |
| `POST` | `/api/v1/dev/cleanup/master/bulk-delete` | マスタ複数件物理削除 |
| `DELETE` | `/api/v1/dev/cleanup/master/:table/:id` | マスタ1件物理削除 |

### テーブルキー対応表（重要）
フロントのキー名と DB 物理テーブル名は別物。`tableMap` で変換。

| フロントキー | DB物理テーブル | 備考 |
|------------|-------------|------|
| `vehicles` | `vehicles` | |
| `users_driver` | `users` | `role=DRIVER` フィルタはバックエンド側 |
| `customers` | `customers` | |
| `locations` | `locations` | |
| `items` | `items` | |
| `inspectionItems` | `inspection_items` | camelCase → snake_case 変換必須 |

---

## ⚙️ 重要な技術ルール

### バックエンド
| ルール | 内容 |
|-------|------|
| `DatabaseService` の import | `from '../utils/database'`（`../services/databaseService` は**誤り**） |
| `authenticateToken()` | 必ず**括弧付き**で呼ぶ。参照渡しすると silent fail する |
| `MAX_PAGE_SIZE` | `100`（`limit=200` 以上は 400 Bad Request になる） |
| 新規ルート追加 | `routes/index.ts` の 404 ハンドラーより**前**に `safeImportAndRegisterRoute` で追加 |
| Prismaスキーマ | `schema.camel.prisma`（camelCase フィールド）を使用 |
| `as any` キャスト | **禁止**。runtime の `undefined`/NULL バグの原因になる |
| `req.user?.userId` | undefined になり得る → `?? 'unknown'` でフォールバック |

### フロントエンド (CMS)
| ルール | 内容 |
|-------|------|
| `localStorage` トークンキー | `'auth_token'`（`'token'` は**誤り**） |
| API `limit` 上限 | `100`（MAX_PAGE_SIZE） |
| `fetchCounts` 内の `setPhase` | フェーズを意図せずリセットしないよう注意 |

### GPS / Mobile
| ルール | 内容 |
|-------|------|
| GPS 取得方式 | `setInterval` + `latestPositionRef`（`watchPosition` コールバックは**禁止**） |
| 異常距離フィルタ | `MAX_REASONABLE_DISTANCE_KM = 200` を超える距離はスキップ |
| React Strict Mode | `useRef` ガードで `useEffect` 二重実行を防ぐ |
| PDF生成フォント | pdfkit は TTC 非対応 → IPA TTF/OTF（`ipaexg.ttf`）を使用 |

### コード修正ルール（必須）
| ルール | 内容 |
|-------|------|
| コード確認 | **必ず**プロジェクトナレッジ(GitHub)で確認してから修正 |
| 修正方法 | Python パッチスクリプトで一括修正 |
| コンパイル確認 | `npx tsc --noEmit` エラー 0 確認後に `git push` |

---

## 📋 ロール・権限

| ロール | 説明 | 主な権限 |
|--------|------|---------|
| `ADMIN` | システム管理者 | 全機能 + UAT クリーンアップ |
| `MANAGER` | 運行管理者 | CMS 全機能（クリーンアップ除く） |
| `DRIVER` | ドライバー | Mobile アプリのみ |

---

## 🔗 関連ドキュメント

- Mobile アプリ詳細: `frontend/mobile/README.md`
- Prisma スキーマ: `backend/prisma/schema.camel.prisma`
- API ドキュメント: `https://10.1.119.244:8443/docs`（Swagger UI）
- SSL 証明書期限: **2026-08-22**（Let's Encrypt、要自動更新設定確認）
