-- 運行番号自動生成トリガー

-- 運行番号生成関数
CREATE OR REPLACE FUNCTION generate_operation_number()
RETURNS TRIGGER AS $
DECLARE
    year_month TEXT;
    sequence_num INTEGER;
    new_operation_number TEXT;
BEGIN
    -- 年月を取得 (YYYYMMフォーマット)
    year_month := TO_CHAR(COALESCE(NEW.planned_start_time, NOW()), 'YYYYMM');
    
    -- その月の最大シーケンス番号を取得
    SELECT COALESCE(
        MAX(
            CASE 
                WHEN operation_number ~ ('^' || year_month || '-[0-9]+) THEN
                    CAST(SUBSTRING(operation_number FROM '[0-9]+) AS INTEGER)
                ELSE 0
            END
        ), 0
    ) + 1
    INTO sequence_num
    FROM operations
    WHERE operation_number LIKE year_month || '-%';
    
    -- 運行番号生成 (YYYYMM-NNNNフォーマット)
    new_operation_number := year_month || '-' || LPAD(sequence_num::TEXT, 4, '0');
    
    NEW.operation_number := new_operation_number;
    
    RETURN NEW;
END;
$ LANGUAGE plpgsql;

-- 既存のトリガーを削除
DROP TRIGGER IF EXISTS generate_operation_number_trigger ON operations;

-- トリガー作成
CREATE TRIGGER generate_operation_number_trigger
    BEFORE INSERT ON operations
    FOR EACH ROW
    WHEN (NEW.operation_number IS NULL OR NEW.operation_number = '')
    EXECUTE FUNCTION generate_operation_number();

COMMENT ON FUNCTION generate_operation_number IS '運行番号自動生成関数 (YYYYMM-NNNNフォーマット)';
