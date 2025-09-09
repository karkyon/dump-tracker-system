-- 統計関数

-- 運行効率計算
CREATE OR REPLACE FUNCTION calculate_operation_efficiency(
    start_date DATE DEFAULT CURRENT_DATE - INTERVAL '30 days',
    end_date DATE DEFAULT CURRENT_DATE
) RETURNS TABLE(
    vehicle_id UUID,
    plate_number VARCHAR,
    total_operations BIGINT,
    completed_operations BIGINT,
    completion_rate DECIMAL,
    total_distance_km DECIMAL,
    total_fuel_liters DECIMAL,
    fuel_efficiency DECIMAL
) AS $
BEGIN
    RETURN QUERY
    SELECT 
        v.id,
        v.plate_number,
        COUNT(o.id) as total_ops,
        COUNT(CASE WHEN o.status = 'COMPLETED' THEN 1 END) as completed_ops,
        ROUND(
            CASE 
                WHEN COUNT(o.id) > 0 THEN
                    COUNT(CASE WHEN o.status = 'COMPLETED' THEN 1 END)::DECIMAL / COUNT(o.id) * 100
                ELSE 0
            END, 2
        ) as completion_rate,
        ROUND(COALESCE(SUM(o.total_distance_km), 0), 2) as total_distance,
        ROUND(COALESCE(SUM(o.fuel_consumed_liters), 0), 2) as total_fuel,
        ROUND(
            CASE 
                WHEN SUM(o.fuel_consumed_liters) > 0 THEN
                    COALESCE(SUM(o.total_distance_km), 0) / SUM(o.fuel_consumed_liters)
                ELSE 0
            END, 2
        ) as fuel_eff
    FROM vehicles v
    LEFT JOIN operations o ON v.id = o.vehicle_id 
        AND DATE(o.actual_start_time) BETWEEN start_date AND end_date
    WHERE v.status = 'ACTIVE'
    GROUP BY v.id, v.plate_number
    ORDER BY total_ops DESC;
END;
$ LANGUAGE plpgsql;

-- 月別統計
CREATE OR REPLACE FUNCTION get_monthly_statistics(target_year INTEGER DEFAULT EXTRACT(YEAR FROM CURRENT_DATE))
RETURNS TABLE(
    month_year TEXT,
    total_operations BIGINT,
    completed_operations BIGINT,
    total_distance_km DECIMAL,
    total_fuel_liters DECIMAL,
    avg_fuel_efficiency DECIMAL
) AS $
BEGIN
    RETURN QUERY
    SELECT 
        TO_CHAR(DATE_TRUNC('month', o.actual_start_time), 'YYYY-MM') as month_year,
        COUNT(o.id) as total_ops,
        COUNT(CASE WHEN o.status = 'COMPLETED' THEN 1 END) as completed_ops,
        ROUND(COALESCE(SUM(o.total_distance_km), 0), 2) as total_distance,
        ROUND(COALESCE(SUM(o.fuel_consumed_liters), 0), 2) as total_fuel,
        ROUND(
            CASE 
                WHEN SUM(o.fuel_consumed_liters) > 0 THEN
                    COALESCE(SUM(o.total_distance_km), 0) / SUM(o.fuel_consumed_liters)
                ELSE 0
            END, 2
        ) as avg_fuel_eff
    FROM operations o
    WHERE EXTRACT(YEAR FROM o.actual_start_time) = target_year
      AND o.actual_start_time IS NOT NULL
    GROUP BY DATE_TRUNC('month', o.actual_start_time)
    ORDER BY month_year;
END;
$ LANGUAGE plpgsql;

COMMENT ON FUNCTION calculate_operation_efficiency IS '指定期間の車両別運行効率を計算';
COMMENT ON FUNCTION get_monthly_statistics IS '指定年の月別統計を取得';
