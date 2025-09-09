-- 車両稼働状況ビュー
DROP VIEW IF EXISTS vehicle_utilization;
CREATE VIEW vehicle_utilization AS
SELECT 
    v.id,
    v.plate_number,
    v.model,
    v.status,
    COUNT(o.id) as total_operations,
    COUNT(CASE WHEN o.status = 'COMPLETED' THEN 1 END) as completed_operations,
    ROUND(AVG(o.total_distance_km), 2) as avg_distance_km,
    ROUND(SUM(o.total_distance_km), 2) as total_distance_km,
    MAX(o.actual_end_time) as last_operation_date
FROM vehicles v
LEFT JOIN operations o ON v.id = o.vehicle_id
WHERE v.status = 'ACTIVE'
GROUP BY v.id, v.plate_number, v.model, v.status
ORDER BY total_operations DESC;

COMMENT ON VIEW vehicle_utilization IS '車両稼働状況ビュー';
