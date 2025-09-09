-- メンテナンス期限チェックトリガー

-- 車両ステータス更新関数
CREATE OR REPLACE FUNCTION check_vehicle_maintenance_status()
RETURNS TRIGGER AS $
BEGIN
    -- 車検期限チェック
    IF NEW.inspection_expiry IS NOT NULL AND NEW.inspection_expiry <= CURRENT_DATE + INTERVAL '30 days' THEN
        -- 30日以内に車検期限が切れる場合は警告ログ
        INSERT INTO audit_logs (
            table_name, operation_type, record_id, new_values, created_at
        ) VALUES (
            'vehicles', 'WARNING', NEW.id,
            jsonb_build_object(
                'warning_type', 'inspection_expiry',
                'expiry_date', NEW.inspection_expiry,
                'days_remaining', NEW.inspection_expiry - CURRENT_DATE
            ),
            NOW()
        );
    END IF;
    
    -- 保険期限チェック
    IF NEW.insurance_expiry IS NOT NULL AND NEW.insurance_expiry <= CURRENT_DATE + INTERVAL '30 days' THEN
        INSERT INTO audit_logs (
            table_name, operation_type, record_id, new_values, created_at
        ) VALUES (
            'vehicles', 'WARNING', NEW.id,
            jsonb_build_object(
                'warning_type', 'insurance_expiry',
                'expiry_date', NEW.insurance_expiry,
                'days_remaining', NEW.insurance_expiry - CURRENT_DATE
            ),
            NOW()
        );
    END IF;
    
    RETURN NEW;
END;
$ LANGUAGE plpgsql;

-- 既存のトリガーを削除
DROP TRIGGER IF EXISTS check_vehicle_maintenance_trigger ON vehicles;

-- トリガー作成
CREATE TRIGGER check_vehicle_maintenance_trigger
    AFTER INSERT OR UPDATE ON vehicles
    FOR EACH ROW
    EXECUTE FUNCTION check_vehicle_maintenance_status();

COMMENT ON FUNCTION check_vehicle_maintenance_status IS '車両メンテナンス期限チェック関数';
