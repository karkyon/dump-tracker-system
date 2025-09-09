-- 運行詳細テーブル（積込・積下記録）
CREATE TABLE IF NOT EXISTS operation_details (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    operation_id UUID NOT NULL REFERENCES operations(id) ON DELETE CASCADE,
    sequence_number INTEGER NOT NULL,
    activity_type VARCHAR(20) NOT NULL CHECK (activity_type IN ('LOADING', 'UNLOADING')),
    location_id UUID NOT NULL REFERENCES locations(id),
    item_id UUID NOT NULL REFERENCES items(id),
    planned_time TIMESTAMP WITH TIME ZONE,
    actual_start_time TIMESTAMP WITH TIME ZONE,
    actual_end_time TIMESTAMP WITH TIME ZONE,
    quantity_tons DECIMAL(8,2) NOT NULL,
    notes TEXT,
    created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
    updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
    UNIQUE(operation_id, sequence_number)
);

-- インデックス作成
CREATE INDEX IF NOT EXISTS idx_operation_details_operation ON operation_details(operation_id);
CREATE INDEX IF NOT EXISTS idx_operation_details_location ON operation_details(location_id);
CREATE INDEX IF NOT EXISTS idx_operation_details_item ON operation_details(item_id);
CREATE INDEX IF NOT EXISTS idx_operation_details_activity ON operation_details(activity_type);

-- トリガー作成
DROP TRIGGER IF EXISTS set_timestamp_operation_details ON operation_details;
CREATE TRIGGER set_timestamp_operation_details
    BEFORE UPDATE ON operation_details
    FOR EACH ROW
    EXECUTE FUNCTION trigger_set_timestamp();

-- コメント追加
COMMENT ON TABLE operation_details IS '運行詳細テーブル（積込・積下記録）';
