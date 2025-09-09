# データベース設計書

## 概要

ダンプ運行記録システムのデータベース設計書です。PostgreSQL を使用し、運行記録、車両管理、ユーザー管理などの機能を提供します。

## データベース構成

### 基本情報
- **データベース名**: dump_tracker_dev
- **ユーザー**: dump_tracker_user
- **エンコーディング**: UTF-8
- **タイムゾーン**: Asia/Tokyo

### 拡張機能
- **uuid-ossp**: UUID生成
- **pg_trgm**: 全文検索サポート

## テーブル設計

### 1. ユーザー管理（users）

| カラム | 型 | 制約 | 説明 |
|----------|-----|------|------|
| id | UUID | PRIMARY KEY | ユーザーID |
| username | VARCHAR(50) | UNIQUE, NOT NULL | ログイン用ユーザー名 |
| email | VARCHAR(255) | UNIQUE, NOT NULL | メールアドレス |
| password_hash | VARCHAR(255) | NOT NULL | ハッシュ化パスワード |
| name | VARCHAR(100) | NOT NULL | 表示名 |
| role | user_role | DEFAULT 'DRIVER' | 権限 (ADMIN/MANAGER/DRIVER) |
| employee_id | VARCHAR(50) | | 従業員番号 |
| phone | VARCHAR(20) | | 電話番号 |
| is_active | BOOLEAN | DEFAULT true | アクティブフラグ |
| last_login_at | TIMESTAMP | | 最終ログイン日時 |
| created_at | TIMESTAMP | DEFAULT NOW() | 作成日時 |
| updated_at | TIMESTAMP | DEFAULT NOW() | 更新日時 |

### 2. 車両管理（vehicles）

車両の基本情報、ステータス、メンテナンス情報を管理します。

### 3. 場所管理（locations）

運行の積込・積下場所を管理します。

### 4. 品目管理（items）

運搬する品目（砂利、コンクリート廃材等）を管理します。

### 5. 運行記録（operations）

ダンプトラックの運行記録を管理します。

### 6. 運行詳細（operation_details）

個別の積込・積下作業を記録します。

### 7. GPS ログ（gps_logs）

車両の位置情報を時系列で記録します。

### 8. メンテナンス記録（maintenance_records）

車両のメンテナンス履歴を管理します。

### 9. 監査ログ（audit_logs）

システムでの全ての変更操作を記録します。

## ビュー設計

### 1. 運行統計ビュー（operation_statistics）
月別の運行統計情報を提供

### 2. 車両稼働状況ビュー（vehicle_utilization）
車両別の稼働状況と実績を提供

### 3. ドライバー実績ビュー（driver_performance）
ドライバー別の運行実績を提供

## 関数設計

### 1. GPS関連関数
- **calculate_distance_km**: ハーバーサイン式による距離計算
- **calculate_operation_distance**: 運行の総距離計算
- **find_nearest_locations**: 最寄り場所検索

### 2. 統計関数
- **calculate_operation_efficiency**: 運行効率計算
- **get_monthly_statistics**: 月別統計取得

## トリガー設計

### 1. 監査ログトリガー
重要テーブルの変更を自動記録

### 2. 運行番号自動生成トリガー
運行記録作成時に番号を自動生成（YYYYMM-NNNNフォーマット）

### 3. メンテナンス期限チェックトリガー
車検・保険期限の警告を自動生成

## インデックス設計

### 主要インデックス
- ユーザー名、メールアドレス
- 車両ナンバー、車両状態
- 場所名、場所種別
- 運行番号、運行状態
- 日時フィールド

## セキュリティ

### アクセス制御
- ロールベースアクセス制御（RBAC）
- データベースユーザーの権限制限

### 監査
- 全ての変更操作を audit_logs に記録
- IPアドレス、ユーザーエージェントの記録

## バックアップ・復旧

### バックアップ戦略
- 毎日の自動バックアップ
- 30日間の保持期間
- スキーマのみとフルバックアップの両方

### 復旧手順
1. バックアップファイルの確認
2. データベース停止
3. リストア実行
4. データ整合性確認

## パフォーマンス最適化

### インデックス最適化
- 複合インデックスの適切な設計
- 使用頻度の高いクエリに対するインデックス

## 今後の拡張予定

1. **地理空間機能の強化**
   - ルート最適化
   - ジオフェンシング

2. **レポート機能**
   - カスタムレポート生成
   - 統計データの可視化

3. **リアルタイム機能**
   - WebSocket を使用したリアルタイム追跡
   - プッシュ通知

4. **マスターデータ管理**
   - より詳細な車両情報
   - 顧客マスタ管理
