-- 品目管理テーブル
CREATE TABLE IF NOT EXISTS items (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    name VARCHAR(255) UNIQUE NOT NULL,
    category VARCHAR(100),
    unit VARCHAR(20) DEFAULT 'トン',
    standard_weight_tons DECIMAL(5,2),
    hazardous BOOLEAN DEFAULT false,
    description TEXT,
    is_active BOOLEAN DEFAULT true,
    created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
    updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

-- インデックス作成
CREATE INDEX IF NOT EXISTS idx_items_category ON items(category) WHERE category IS NOT NULL;
CREATE INDEX IF NOT EXISTS idx_items_hazardous ON items(hazardous);

-- トリガー作成
DROP TRIGGER IF EXISTS set_timestamp_items ON items;
CREATE TRIGGER set_timestamp_items
    BEFORE UPDATE ON items
    FOR EACH ROW
    EXECUTE FUNCTION trigger_set_timestamp();

-- コメント追加
COMMENT ON TABLE items IS '品目管理テーブル';
