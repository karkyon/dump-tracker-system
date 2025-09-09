# ダンプ運行記録システム API 使用ガイド

## 概要

このAPIは、ダンプトラック運行記録管理システムのバックエンドサービスです。

## 基本情報

- **ベースURL**: `http://localhost:8000/api/v1`
- **認証方式**: JWT Bearer Token
- **データフォーマット**: JSON
- **文字エンコーディング**: UTF-8

## 認証フロー

### 1. ログイン

```bash
curl -X POST http://localhost:8000/api/v1/auth/login \
  -H "Content-Type: application/json" \
  -d '{
    "username": "admin",
    "password": "admin123"
  }'
```

レスポンス:
```json
{
  "success": true,
  "message": "ログインに成功しました",
  "data": {
    "user": {
      "id": "uuid",
      "username": "admin",
      "role": "ADMIN"
    },
    "accessToken": "eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9...",
    "refreshToken": "eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9..."
  }
}
```

### 2. 認証が必要なAPIの呼び出し

```bash
curl -X GET http://localhost:8000/api/v1/vehicles \
  -H "Authorization: Bearer eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9..."
```

## エンドポイント例

### 車両一覧取得

```bash
# 基本的な一覧取得
curl -X GET "http://localhost:8000/api/v1/vehicles" \
  -H "Authorization: Bearer YOUR_TOKEN"

# ページネーション付き
curl -X GET "http://localhost:8000/api/v1/vehicles?page=1&limit=10" \
  -H "Authorization: Bearer YOUR_TOKEN"

# フィルタ付き
curl -X GET "http://localhost:8000/api/v1/vehicles?status=ACTIVE&search=大阪" \
  -H "Authorization: Bearer YOUR_TOKEN"
```

### 車両作成

```bash
curl -X POST http://localhost:8000/api/v1/vehicles \
  -H "Content-Type: application/json" \
  -H "Authorization: Bearer YOUR_TOKEN" \
  -d '{
    "plateNumber": "大阪 500 あ 1234",
    "model": "UD クオン",
    "manufacturer": "UD Trucks",
    "year": 2022,
    "fuelType": "DIESEL",
    "capacityTons": 10.0,
    "currentMileage": 45000
  }'
```

### 車両更新

```bash
curl -X PUT http://localhost:8000/api/v1/vehicles/VEHICLE_ID \
  -H "Content-Type: application/json" \
  -H "Authorization: Bearer YOUR_TOKEN" \
  -d '{
    "currentMileage": 46000,
    "status": "MAINTENANCE"
  }'
```

## エラーハンドリング

APIは以下の標準的なHTTPステータスコードを使用します：

- `200` - 成功
- `201` - 作成成功
- `400` - バリデーションエラー
- `401` - 認証エラー
- `403` - 権限エラー
- `404` - リソースが見つからない
- `409` - 競合エラー（重複など）
- `500` - サーバーエラー

エラーレスポンス例:
```json
{
  "success": false,
  "message": "車両が見つかりません",
  "error": "VEHICLE_NOT_FOUND"
}
```

## 権限レベル

- **ADMIN**: 全ての操作が可能
- **MANAGER**: ユーザー管理以外の操作が可能
- **DRIVER**: 読み取り専用、自分の運行記録の操作のみ

## レート制限

- **認証前**: 15分間に15リクエスト
- **認証後**: 15分間に100リクエスト

## ページネーション

リスト系APIはページネーションをサポートしています：

- `page`: ページ番号（デフォルト: 1）
- `limit`: 1ページあたりの件数（デフォルト: 10、最大: 100）

レスポンスには以下のページネーション情報が含まれます：
```json
{
  "data": {
    "vehicles": [...],
    "pagination": {
      "currentPage": 1,
      "totalPages": 5,
      "totalCount": 50,
      "limit": 10
    }
  }
}
```

## 開発・テスト用

### ヘルスチェック

```bash
curl http://localhost:8000/health
```

### 初期ログイン情報

- **管理者**: `admin` / `admin123`
- **マネージャー**: `manager01` / `manager123`  
- **ドライバー**: `driver01` / `driver123`

## トラブルシューティング

### よくあるエラー

1. **401 Unauthorized**
   - トークンが無効または期限切れ
   - `Authorization`ヘッダーの形式が正しくない

2. **403 Forbidden**
   - 権限が不足している
   - 必要な役割レベルを確認

3. **400 Bad Request**
   - リクエストボディの形式が不正
   - 必須フィールドが不足

### デバッグ方法

1. ログファイルを確認: `tail -f logs/combined.log`
2. データベース接続確認: `PGPASSWORD='development_password' psql -h localhost -U dump_tracker_user -d dump_tracker_dev`
3. サーバー状態確認: `curl http://localhost:8000/health`
