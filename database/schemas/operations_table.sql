-- 運行記録テーブル
CREATE TABLE IF NOT EXISTS operations (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    operation_number VARCHAR(50) UNIQUE NOT NULL DEFAULT '',
    vehicle_id UUID NOT NULL REFERENCES vehicles(id),
    driver_id UUID NOT NULL REFERENCES users(id),
    status operation_status DEFAULT 'PLANNING',
    planned_start_time TIMESTAMP WITH TIME ZONE,
    actual_start_time TIMESTAMP WITH TIME ZONE,
    planned_end_time TIMESTAMP WITH TIME ZONE,
    actual_end_time TIMESTAMP WITH TIME ZONE,
    total_distance_km DECIMAL(8,2),
    fuel_consumed_liters DECIMAL(8,2),
    notes TEXT,
    created_by UUID REFERENCES users(id),
    created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
    updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

-- インデックス作成
CREATE INDEX IF NOT EXISTS idx_operations_vehicle ON operations(vehicle_id);
CREATE INDEX IF NOT EXISTS idx_operations_driver ON operations(driver_id);
CREATE INDEX IF NOT EXISTS idx_operations_status ON operations(status);
CREATE INDEX IF NOT EXISTS idx_operations_actual_start_time ON operations(actual_start_time) WHERE actual_start_time IS NOT NULL;

-- トリガー作成
DROP TRIGGER IF EXISTS set_timestamp_operations ON operations;
CREATE TRIGGER set_timestamp_operations
    BEFORE UPDATE ON operations
    FOR EACH ROW
    EXECUTE FUNCTION trigger_set_timestamp();

-- コメント追加
COMMENT ON TABLE operations IS '運行記録テーブル';
