-- 車両管理テーブル
CREATE TABLE IF NOT EXISTS vehicles (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    plate_number VARCHAR(20) UNIQUE NOT NULL,
    model VARCHAR(100) NOT NULL,
    manufacturer VARCHAR(100),
    year INTEGER,
    fuel_type fuel_type DEFAULT 'DIESEL',
    capacity_tons DECIMAL(5,2),
    current_mileage INTEGER DEFAULT 0,
    status vehicle_status DEFAULT 'ACTIVE',
    purchase_date DATE,
    insurance_expiry DATE,
    inspection_expiry DATE,
    notes TEXT,
    created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
    updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

-- インデックス作成
CREATE INDEX IF NOT EXISTS idx_vehicles_plate_number ON vehicles(plate_number);
CREATE INDEX IF NOT EXISTS idx_vehicles_status ON vehicles(status);
CREATE INDEX IF NOT EXISTS idx_vehicles_manufacturer ON vehicles(manufacturer) WHERE manufacturer IS NOT NULL;

-- トリガー作成
DROP TRIGGER IF EXISTS set_timestamp_vehicles ON vehicles;
CREATE TRIGGER set_timestamp_vehicles
    BEFORE UPDATE ON vehicles
    FOR EACH ROW
    EXECUTE FUNCTION trigger_set_timestamp();

-- コメント追加
COMMENT ON TABLE vehicles IS '車両管理テーブル';
