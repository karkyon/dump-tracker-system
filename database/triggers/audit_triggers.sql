-- 監査ログトリガー

-- 汎用監査ログ関数
CREATE OR REPLACE FUNCTION audit_trigger_function()
RETURNS TRIGGER AS $
BEGIN
    -- INSERT の場合
    IF TG_OP = 'INSERT' THEN
        INSERT INTO audit_logs (
            table_name, operation_type, record_id, 
            new_values, created_at
        ) VALUES (
            TG_TABLE_NAME, TG_OP, NEW.id,
            row_to_json(NEW)::jsonb, NOW()
        );
        RETURN NEW;
    END IF;
    
    -- UPDATE の場合
    IF TG_OP = 'UPDATE' THEN
        INSERT INTO audit_logs (
            table_name, operation_type, record_id,
            old_values, new_values, created_at
        ) VALUES (
            TG_TABLE_NAME, TG_OP, NEW.id,
            row_to_json(OLD)::jsonb, row_to_json(NEW)::jsonb, NOW()
        );
        RETURN NEW;
    END IF;
    
    -- DELETE の場合
    IF TG_OP = 'DELETE' THEN
        INSERT INTO audit_logs (
            table_name, operation_type, record_id,
            old_values, created_at
        ) VALUES (
            TG_TABLE_NAME, TG_OP, OLD.id,
            row_to_json(OLD)::jsonb, NOW()
        );
        RETURN OLD;
    END IF;
    
    RETURN NULL;
END;
$ LANGUAGE plpgsql;

-- 重要テーブルに監査トリガーを設定
DO $
DECLARE
    table_name TEXT;
    trigger_name TEXT;
BEGIN
    FOR table_name IN VALUES ('users'), ('vehicles'), ('operations'), ('operation_details')
    LOOP
        trigger_name := 'audit_' || table_name || '_trigger';
        
        -- 既存のトリガーを削除
        EXECUTE 'DROP TRIGGER IF EXISTS ' || trigger_name || ' ON ' || table_name;
        
        -- 新しいトリガーを作成
        EXECUTE 'CREATE TRIGGER ' || trigger_name ||
                ' AFTER INSERT OR UPDATE OR DELETE ON ' || table_name ||
                ' FOR EACH ROW EXECUTE FUNCTION audit_trigger_function()';
    END LOOP;
END $;

COMMENT ON FUNCTION audit_trigger_function IS '汎用監査ログトリガー関数';
