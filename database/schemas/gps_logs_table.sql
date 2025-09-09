-- GPS位置情報ログテーブル
CREATE TABLE IF NOT EXISTS gps_logs (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    vehicle_id UUID NOT NULL REFERENCES vehicles(id),
    operation_id UUID REFERENCES operations(id),
    latitude DECIMAL(10,8) NOT NULL,
    longitude DECIMAL(11,8) NOT NULL,
    altitude DECIMAL(8,2),
    speed_kmh DECIMAL(5,2),
    heading DECIMAL(5,2),
    accuracy_meters DECIMAL(5,2),
    recorded_at TIMESTAMP WITH TIME ZONE NOT NULL,
    created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

-- インデックス作成
CREATE INDEX IF NOT EXISTS idx_gps_logs_vehicle ON gps_logs(vehicle_id);
CREATE INDEX IF NOT EXISTS idx_gps_logs_operation ON gps_logs(operation_id) WHERE operation_id IS NOT NULL;
CREATE INDEX IF NOT EXISTS idx_gps_logs_time ON gps_logs(recorded_at);

-- コメント追加
COMMENT ON TABLE gps_logs IS 'GPS位置情報ログテーブル';
