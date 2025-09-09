-- メンテナンス記録テーブル
CREATE TABLE IF NOT EXISTS maintenance_records (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    vehicle_id UUID NOT NULL REFERENCES vehicles(id),
    maintenance_type maintenance_type NOT NULL,
    scheduled_date DATE,
    completed_date DATE,
    mileage_at_maintenance INTEGER,
    cost DECIMAL(10,2),
    vendor_name VARCHAR(255),
    description TEXT,
    next_maintenance_date DATE,
    next_maintenance_mileage INTEGER,
    is_completed BOOLEAN DEFAULT false,
    created_by UUID REFERENCES users(id),
    created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
    updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

-- インデックス作成
CREATE INDEX IF NOT EXISTS idx_maintenance_vehicle ON maintenance_records(vehicle_id);
CREATE INDEX IF NOT EXISTS idx_maintenance_type ON maintenance_records(maintenance_type);
CREATE INDEX IF NOT EXISTS idx_maintenance_scheduled ON maintenance_records(scheduled_date) WHERE scheduled_date IS NOT NULL;
CREATE INDEX IF NOT EXISTS idx_maintenance_completed ON maintenance_records(is_completed);

-- トリガー作成
DROP TRIGGER IF EXISTS set_timestamp_maintenance_records ON maintenance_records;
CREATE TRIGGER set_timestamp_maintenance_records
    BEFORE UPDATE ON maintenance_records
    FOR EACH ROW
    EXECUTE FUNCTION trigger_set_timestamp();

-- コメント追加
COMMENT ON TABLE maintenance_records IS 'メンテナンス記録テーブル';
