-- ドライバー実績ビュー
DROP VIEW IF EXISTS driver_performance;
CREATE VIEW driver_performance AS
SELECT 
    u.id,
    u.name,
    u.employee_id,
    COUNT(o.id) as total_operations,
    COUNT(CASE WHEN o.status = 'COMPLETED' THEN 1 END) as completed_operations,
    ROUND(
        CASE 
            WHEN COUNT(o.id) > 0 THEN
                COUNT(CASE WHEN o.status = 'COMPLETED' THEN 1 END)::DECIMAL / COUNT(o.id) * 100
            ELSE 0
        END, 2
    ) as completion_rate_percent,
    ROUND(AVG(o.total_distance_km), 2) as avg_distance_km,
    ROUND(SUM(o.total_distance_km), 2) as total_distance_km,
    ROUND(AVG(o.fuel_consumed_liters), 2) as avg_fuel_efficiency,
    MAX(o.actual_end_time) as last_operation_date
FROM users u
LEFT JOIN operations o ON u.id = o.driver_id
WHERE u.role = 'DRIVER' AND u.is_active = true
GROUP BY u.id, u.name, u.employee_id
ORDER BY total_operations DESC;

COMMENT ON VIEW driver_performance IS 'ドライバー実績ビュー';
