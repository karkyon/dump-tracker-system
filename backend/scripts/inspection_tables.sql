-- ================================================================================
-- ダンプ運行記録システム: 点検機能テーブル
-- 作成日: 2025年
-- 機能: A4 点検項目マスタ管理 + D3 乗車前点検 + D8 乗車後点検
-- ================================================================================

-- 1. 点検タイプ列挙型作成
DO $$ BEGIN
    CREATE TYPE inspection_type AS ENUM ('PRE_TRIP', 'POST_TRIP', 'DAILY', 'WEEKLY', 'MONTHLY');
EXCEPTION
    WHEN duplicate_object THEN null;
END $$;

-- 2. 点検項目入力タイプ列挙型作成
DO $$ BEGIN
    CREATE TYPE input_type AS ENUM ('CHECKBOX', 'TEXT', 'NUMBER', 'SELECT');
EXCEPTION
    WHEN duplicate_object THEN null;
END $$;

-- 3. 点検ステータス列挙型作成
DO $$ BEGIN
    CREATE TYPE inspection_status AS ENUM ('PENDING', 'IN_PROGRESS', 'COMPLETED', 'FAILED', 'SKIPPED');
EXCEPTION
    WHEN duplicate_object THEN null;
END $$;

-- ================================================================================
-- 点検項目マスタテーブル (inspection_items)
-- 管理者が設定する点検項目の定義
-- ================================================================================
CREATE TABLE IF NOT EXISTS inspection_items (
    id                  UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    name                VARCHAR(255) NOT NULL,                          -- 点検項目名
    description         TEXT,                                           -- 説明・詳細
    inspection_type     inspection_type NOT NULL,                       -- 点検タイプ（乗車前/乗車後/日次等）
    input_type          input_type NOT NULL DEFAULT 'CHECKBOX',         -- 入力タイプ
    category            VARCHAR(100),                                    -- カテゴリ（エンジン系、タイヤ系等）
    display_order       INTEGER NOT NULL DEFAULT 0,                     -- 表示順序
    is_required         BOOLEAN NOT NULL DEFAULT true,                  -- 必須項目かどうか
    is_active           BOOLEAN NOT NULL DEFAULT true,                  -- アクティブ状態
    default_value       TEXT,                                           -- デフォルト値
    validation_rules    JSONB,                                          -- バリデーションルール（JSON形式）
    help_text           TEXT,                                           -- ヘルプテキスト
    
    -- タイムスタンプ
    created_at          TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    updated_at          TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    created_by          UUID REFERENCES users(id),
    
    -- 制約
    CONSTRAINT inspection_items_name_type_unique UNIQUE (name, inspection_type),
    CONSTRAINT inspection_items_display_order_check CHECK (display_order >= 0)
);

-- ================================================================================
-- 点検記録テーブル (inspection_records)
-- 実際の点検実行記録
-- ================================================================================
CREATE TABLE IF NOT EXISTS inspection_records (
    id                  UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    operation_id        UUID REFERENCES operations(id) ON DELETE CASCADE,  -- 運行記録との関連
    vehicle_id          UUID NOT NULL REFERENCES vehicles(id),             -- 車両
    inspector_id        UUID NOT NULL REFERENCES users(id),                -- 点検実施者
    inspection_type     inspection_type NOT NULL,                          -- 点検タイプ
    status              inspection_status NOT NULL DEFAULT 'PENDING',      -- 点検ステータス
    
    -- 点検実施情報
    scheduled_at        TIMESTAMPTZ,                                       -- 予定実施日時
    started_at          TIMESTAMPTZ,                                       -- 開始日時
    completed_at        TIMESTAMPTZ,                                       -- 完了日時
    
    -- 総合評価
    overall_result      BOOLEAN,                                           -- 総合結果（合格/不合格）
    overall_notes       TEXT,                                              -- 総合備考
    defects_found       INTEGER DEFAULT 0,                                 -- 発見された不具合数
    
    -- GPS位置情報（点検実施場所）
    latitude            DECIMAL(10, 8),
    longitude           DECIMAL(11, 8),
    location_name       VARCHAR(255),                                      -- 点検場所名
    
    -- 環境情報
    weather_condition   VARCHAR(50),                                       -- 天候
    temperature         DECIMAL(4, 1),                                     -- 気温
    
    -- タイムスタンプ
    created_at          TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    updated_at          TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    
    -- インデックス用制約
    CONSTRAINT inspection_records_dates_check 
        CHECK (completed_at IS NULL OR started_at IS NULL OR completed_at >= started_at)
);

-- ================================================================================
-- 点検項目結果テーブル (inspection_item_results)
-- 各点検項目の個別結果
-- ================================================================================
CREATE TABLE IF NOT EXISTS inspection_item_results (
    id                  UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    inspection_record_id UUID NOT NULL REFERENCES inspection_records(id) ON DELETE CASCADE,
    inspection_item_id  UUID NOT NULL REFERENCES inspection_items(id),
    
    -- 点検結果
    result_value        TEXT,                                              -- 点検結果値（チェック状態、入力値等）
    is_passed           BOOLEAN,                                           -- 合格/不合格
    notes               TEXT,                                              -- 個別備考
    defect_level        VARCHAR(20) CHECK (defect_level IN ('LOW', 'MEDIUM', 'HIGH', 'CRITICAL')), -- 不具合レベル
    
    -- 画像・添付ファイル
    photo_urls          TEXT[],                                            -- 写真URL配列
    attachment_urls     TEXT[],                                            -- 添付ファイルURL配列
    
    -- 実施情報
    checked_at          TIMESTAMPTZ NOT NULL DEFAULT NOW(),               -- 点検実施日時
    checked_by          UUID REFERENCES users(id),                        -- 点検実施者（delegateの場合）
    
    -- タイムスタンプ
    created_at          TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    updated_at          TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    
    -- 制約
    CONSTRAINT inspection_item_results_unique 
        UNIQUE (inspection_record_id, inspection_item_id)
);

-- ================================================================================
-- インデックス作成
-- ================================================================================

-- inspection_items テーブルのインデックス
CREATE INDEX IF NOT EXISTS idx_inspection_items_type ON inspection_items(inspection_type);
CREATE INDEX IF NOT EXISTS idx_inspection_items_active ON inspection_items(is_active) WHERE is_active = true;
CREATE INDEX IF NOT EXISTS idx_inspection_items_order ON inspection_items(inspection_type, display_order);
CREATE INDEX IF NOT EXISTS idx_inspection_items_category ON inspection_items(category) WHERE category IS NOT NULL;

-- inspection_records テーブルのインデックス
CREATE INDEX IF NOT EXISTS idx_inspection_records_operation ON inspection_records(operation_id) WHERE operation_id IS NOT NULL;
CREATE INDEX IF NOT EXISTS idx_inspection_records_vehicle ON inspection_records(vehicle_id);
CREATE INDEX IF NOT EXISTS idx_inspection_records_inspector ON inspection_records(inspector_id);
CREATE INDEX IF NOT EXISTS idx_inspection_records_type ON inspection_records(inspection_type);
CREATE INDEX IF NOT EXISTS idx_inspection_records_status ON inspection_records(status);
CREATE INDEX IF NOT EXISTS idx_inspection_records_date ON inspection_records(created_at);
CREATE INDEX IF NOT EXISTS idx_inspection_records_completed ON inspection_records(completed_at) WHERE completed_at IS NOT NULL;

-- inspection_item_results テーブルのインデックス
CREATE INDEX IF NOT EXISTS idx_inspection_item_results_record ON inspection_item_results(inspection_record_id);
CREATE INDEX IF NOT EXISTS idx_inspection_item_results_item ON inspection_item_results(inspection_item_id);
CREATE INDEX IF NOT EXISTS idx_inspection_item_results_passed ON inspection_item_results(is_passed);
CREATE INDEX IF NOT EXISTS idx_inspection_item_results_defect ON inspection_item_results(defect_level) WHERE defect_level IS NOT NULL;

-- ================================================================================
-- トリガー関数（更新日時自動設定）
-- ================================================================================
CREATE OR REPLACE FUNCTION update_inspection_timestamp()
RETURNS TRIGGER AS $$
BEGIN
    NEW.updated_at = NOW();
    RETURN NEW;
END;
$$ LANGUAGE plpgsql;

-- トリガー作成
DROP TRIGGER IF EXISTS set_timestamp_inspection_items ON inspection_items;
CREATE TRIGGER set_timestamp_inspection_items
    BEFORE UPDATE ON inspection_items
    FOR EACH ROW EXECUTE FUNCTION update_inspection_timestamp();

DROP TRIGGER IF EXISTS set_timestamp_inspection_records ON inspection_records;
CREATE TRIGGER set_timestamp_inspection_records
    BEFORE UPDATE ON inspection_records
    FOR EACH ROW EXECUTE FUNCTION update_inspection_timestamp();

DROP TRIGGER IF EXISTS set_timestamp_inspection_item_results ON inspection_item_results;
CREATE TRIGGER set_timestamp_inspection_item_results
    BEFORE UPDATE ON inspection_item_results
    FOR EACH ROW EXECUTE FUNCTION update_inspection_timestamp();

-- ================================================================================
-- 監査ログトリガー（既存の監査システムを利用）
-- ================================================================================
DROP TRIGGER IF EXISTS audit_inspection_items_trigger ON inspection_items;
CREATE TRIGGER audit_inspection_items_trigger
    AFTER INSERT OR UPDATE OR DELETE ON inspection_items
    FOR EACH ROW EXECUTE FUNCTION audit_trigger_function();

DROP TRIGGER IF EXISTS audit_inspection_records_trigger ON inspection_records;
CREATE TRIGGER audit_inspection_records_trigger
    AFTER INSERT OR UPDATE OR DELETE ON inspection_records
    FOR EACH ROW EXECUTE FUNCTION audit_trigger_function();

DROP TRIGGER IF EXISTS audit_inspection_item_results_trigger ON inspection_item_results;
CREATE TRIGGER audit_inspection_item_results_trigger
    AFTER INSERT OR UPDATE OR DELETE ON inspection_item_results
    FOR EACH ROW EXECUTE FUNCTION audit_trigger_function();

-- ================================================================================
-- テーブル権限設定
-- ================================================================================
ALTER TABLE inspection_items OWNER TO dump_tracker_user;
ALTER TABLE inspection_records OWNER TO dump_tracker_user;
ALTER TABLE inspection_item_results OWNER TO dump_tracker_user;

GRANT ALL PRIVILEGES ON TABLE inspection_items TO dump_tracker_user;
GRANT ALL PRIVILEGES ON TABLE inspection_records TO dump_tracker_user;
GRANT ALL PRIVILEGES ON TABLE inspection_item_results TO dump_tracker_user;

-- ================================================================================
-- 初期データ投入（プロジェクト仕様の点検項目）
-- ================================================================================

-- 乗車前点検項目
INSERT INTO inspection_items (name, description, inspection_type, input_type, category, display_order, is_required, created_by) VALUES
    ('エンジンオイル', 'エンジンオイルの量・色・汚れ状況を確認', 'PRE_TRIP', 'CHECKBOX', 'エンジン系', 1, true, NULL),
    ('タイヤの摩耗・亀裂', 'タイヤの摩耗状況、亀裂、異物の確認', 'PRE_TRIP', 'CHECKBOX', 'タイヤ系', 2, true, NULL),
    ('各作動油の漏れ', 'ブレーキオイル、パワステオイル等の漏れ確認', 'PRE_TRIP', 'CHECKBOX', '油圧系', 3, true, NULL),
    ('ライト', 'ヘッドライト、テールライト、ウィンカーの動作確認', 'PRE_TRIP', 'CHECKBOX', '電装系', 4, true, NULL),
    ('車体の清潔', '車体の汚れ、ナンバープレートの視認性確認', 'PRE_TRIP', 'CHECKBOX', '外観', 5, false, NULL)
ON CONFLICT (name, inspection_type) DO NOTHING;

-- 乗車後点検項目
INSERT INTO inspection_items (name, description, inspection_type, input_type, category, display_order, is_required, created_by) VALUES
    ('エンジンオイル', 'エンジンオイルの消費・汚れ状況を確認', 'POST_TRIP', 'CHECKBOX', 'エンジン系', 1, true, NULL),
    ('タイヤの摩耗・亀裂', 'タイヤの摩耗進行、新たな亀裂の確認', 'POST_TRIP', 'CHECKBOX', 'タイヤ系', 2, true, NULL),
    ('各作動油の漏れ', '運行後の新たなオイル漏れの確認', 'POST_TRIP', 'CHECKBOX', '油圧系', 3, true, NULL),
    ('終了距離', '運行終了時の走行距離メーター値', 'POST_TRIP', 'NUMBER', '走行記録', 4, true, NULL),
    ('備考', '運行中の特記事項、不具合、気づいた点', 'POST_TRIP', 'TEXT', 'その他', 5, false, NULL)
ON CONFLICT (name, inspection_type) DO NOTHING;

-- ================================================================================
-- 完了メッセージ
-- ================================================================================
DO $$
BEGIN
    RAISE NOTICE '点検機能テーブルの作成が完了しました。';
    RAISE NOTICE '- inspection_items: 点検項目マスタ';
    RAISE NOTICE '- inspection_records: 点検記録';
    RAISE NOTICE '- inspection_item_results: 点検項目結果';
    RAISE NOTICE '初期データ（乗車前・乗車後点検項目）も投入されました。';
END $$;