-- 初期データ投入

-- 初期ユーザーデータ
INSERT INTO users (
    username, email, password_hash, name, role, employee_id, phone, is_active
) VALUES 
-- 管理者ユーザー
(
    'admin',
    'admin@dumptracker.local',
    '$2b$10$92IXUNpkjO0rOQ5byMi.Ye4oKoEa3Ro9llC/.og/at2.uheWG/igi', -- password: admin123
    '管理者',
    'ADMIN',
    'ADM001',
    '090-1234-5678',
    true
),
-- マネージャーユーザー
(
    'manager01',
    'manager01@dumptracker.local',
    '$2b$10$92IXUNpkjO0rOQ5byMi.Ye4oKoEa3Ro9llC/.og/at2.uheWG/igi', -- password: manager123
    '田中 太郎',
    'MANAGER',
    'MGR001',
    '090-2345-6789',
    true
),
-- ドライバーユーザー
(
    'driver01',
    'driver01@dumptracker.local',
    '$2b$10$92IXUNpkjO0rOQ5byMi.Ye4oKoEa3Ro9llC/.og/at2.uheWG/igi', -- password: driver123
    '佐藤 一郎',
    'DRIVER',
    'DRV001',
    '090-3456-7890',
    true
),
(
    'driver02',
    'driver02@dumptracker.local',
    '$2b$10$92IXUNpkjO0rOQ5byMi.Ye4oKoEa3Ro9llC/.og/at2.uheWG/igi', -- password: driver123
    '鈴木 次郎',
    'DRIVER',
    'DRV002',
    '090-4567-8901',
    true
)
ON CONFLICT (username) DO NOTHING;

-- サンプル車両データ
INSERT INTO vehicles (
    plate_number, model, manufacturer, year, fuel_type, capacity_tons, 
    current_mileage, status, purchase_date, insurance_expiry, inspection_expiry
) VALUES 
(
    '大阪 500 あ 1234',
    'UD クオン',
    'UD Trucks',
    2022,
    'DIESEL',
    10.00,
    45000,
    'ACTIVE',
    '2022-04-01',
    '2025-04-01',
    '2025-04-01'
),
(
    '大阪 500 あ 5678',
    'いすゞ ギガ',
    'いすゞ自動車',
    2021,
    'DIESEL',
    8.50,
    62000,
    'ACTIVE',
    '2021-03-15',
    '2025-03-15',
    '2025-03-15'
),
(
    '大阪 500 あ 9012',
    '日野 プロフィア',
    '日野自動車',
    2023,
    'DIESEL',
    12.00,
    18000,
    'ACTIVE',
    '2023-01-20',
    '2026-01-20',
    '2026-01-20'
)
ON CONFLICT (plate_number) DO NOTHING;

-- サンプル場所データ
INSERT INTO locations (
    name, address, latitude, longitude, location_type, client_name, 
    contact_person, contact_phone, operating_hours
) VALUES 
(
    '大阪港第1埠頭',
    '大阪府大阪市港区築港3-1-1',
    34.6441,
    135.4286,
    'LOADING',
    '大阪港運株式会社',
    '港 太郎',
    '06-1234-5678',
    '平日 8:00-17:00'
),
(
    '建設現場A',
    '大阪府吹田市千里山東1-1-1',
    34.7794,
    135.5181,
    'UNLOADING',
    '関西建設株式会社',
    '建設 花子',
    '06-2345-6789',
    '平日 7:00-18:00'
),
(
    '産業廃棄物処理場',
    '大阪府堺市西区築港浜寺町1-1',
    34.5333,
    135.4500,
    'UNLOADING',
    '環境リサイクル株式会社',
    '環境 次郎',
    '072-3456-7890',
    '平日 9:00-16:00'
),
(
    '砂利採取場',
    '大阪府河内長野市天野町1-1',
    34.4622,
    135.5700,
    'BOTH',
    '関西骨材株式会社',
    '骨材 三郎',
    '0721-4567-8901',
    '平日 8:00-17:00, 土曜 8:00-12:00'
)
ON CONFLICT (name) DO NOTHING;

-- サンプル品目データ
INSERT INTO items (
    name, category, unit, standard_weight_tons, description
) VALUES 
(
    '砂利',
    '骨材',
    'トン',
    1.6,
    '一般建設用砂利'
),
(
    '砂',
    '骨材',
    'トン',
    1.4,
    '建設用川砂'
),
(
    'コンクリート廃材',
    '産業廃棄物',
    'トン',
    2.2,
    '解体工事由来のコンクリート廃材'
),
(
    '建設汚泥',
    '産業廃棄物',
    'トン',
    1.8,
    '建設工事由来の汚泥'
),
(
    'アスファルト廃材',
    '産業廃棄物',
    'トン',
    2.0,
    '道路工事由来のアスファルト廃材'
)
ON CONFLICT (name) DO NOTHING;

-- サンプル運行記録データ
DO $
DECLARE
    admin_user_id UUID;
    driver1_id UUID;
    driver2_id UUID;
    vehicle1_id UUID;
    vehicle2_id UUID;
    location1_id UUID;
    location2_id UUID;
    item1_id UUID;
    operation1_id UUID;
BEGIN
    -- UUIDを取得
    SELECT id INTO admin_user_id FROM users WHERE username = 'admin';
    SELECT id INTO driver1_id FROM users WHERE username = 'driver01';
    SELECT id INTO driver2_id FROM users WHERE username = 'driver02';
    SELECT id INTO vehicle1_id FROM vehicles WHERE plate_number = '大阪 500 あ 1234';
    SELECT id INTO vehicle2_id FROM vehicles WHERE plate_number = '大阪 500 あ 5678';
    SELECT id INTO location1_id FROM locations WHERE name = '大阪港第1埠頭';
    SELECT id INTO location2_id FROM locations WHERE name = '建設現場A';
    SELECT id INTO item1_id FROM items WHERE name = '砂利';
    
    -- 運行記録を作成（既存データがない場合のみ）
    IF NOT EXISTS (SELECT 1 FROM operations WHERE vehicle_id = vehicle1_id AND driver_id = driver1_id) THEN
        INSERT INTO operations (
            vehicle_id, driver_id, status,
            planned_start_time, actual_start_time, planned_end_time, actual_end_time,
            total_distance_km, fuel_consumed_liters, notes, created_by
        ) VALUES (
            vehicle1_id, driver1_id, 'COMPLETED',
            NOW() - INTERVAL '2 days', NOW() - INTERVAL '2 days',
            NOW() - INTERVAL '2 days' + INTERVAL '6 hours', NOW() - INTERVAL '2 days' + INTERVAL '5 hours 30 minutes',
            45.5, 18.2, 'テスト運行記録', admin_user_id
        ) RETURNING id INTO operation1_id;
        
        -- 運行詳細を作成
        INSERT INTO operation_details (
            operation_id, sequence_number, activity_type, location_id, item_id,
            planned_time, actual_start_time, actual_end_time, quantity_tons, notes
        ) VALUES 
        (
            operation1_id, 1, 'LOADING', location1_id, item1_id,
            NOW() - INTERVAL '2 days' + INTERVAL '1 hour',
            NOW() - INTERVAL '2 days' + INTERVAL '1 hour',
            NOW() - INTERVAL '2 days' + INTERVAL '2 hours',
            8.5, '積込作業完了'
        ),
        (
            operation1_id, 2, 'UNLOADING', location2_id, item1_id,
            NOW() - INTERVAL '2 days' + INTERVAL '4 hours',
            NOW() - INTERVAL '2 days' + INTERVAL '4 hours',
            NOW() - INTERVAL '2 days' + INTERVAL '5 hours',
            8.5, '積下作業完了'
        );
    END IF;
END $;

-- システム初期化ログ
INSERT INTO audit_logs (
    table_name, operation_type, record_id, new_values, created_at
) VALUES (
    'SYSTEM', 'SEED_DATA', 
    uuid_generate_v4(),
    '{"message": "Initial seed data inserted successfully", "version": "1.0"}'::JSONB,
    NOW()
)
ON CONFLICT DO NOTHING;
