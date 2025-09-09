-- 運行統計ビュー
DROP VIEW IF EXISTS operation_statistics;
CREATE VIEW operation_statistics AS
SELECT 
    DATE_TRUNC('month', actual_start_time) as month,
    COUNT(*) as total_operations,
    COUNT(CASE WHEN status = 'COMPLETED' THEN 1 END) as completed_operations,
    COUNT(CASE WHEN status = 'CANCELLED' THEN 1 END) as cancelled_operations,
    ROUND(AVG(total_distance_km), 2) as avg_distance_km,
    ROUND(SUM(total_distance_km), 2) as total_distance_km,
    ROUND(AVG(fuel_consumed_liters), 2) as avg_fuel_liters,
    ROUND(SUM(fuel_consumed_liters), 2) as total_fuel_liters
FROM operations
WHERE actual_start_time IS NOT NULL
GROUP BY DATE_TRUNC('month', actual_start_time)
ORDER BY month DESC;

COMMENT ON VIEW operation_statistics IS '月別運行統計ビュー';
