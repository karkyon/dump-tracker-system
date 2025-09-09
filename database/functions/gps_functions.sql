-- GPS関連関数

-- ハーバーサイン式による距離計算（km）
CREATE OR REPLACE FUNCTION calculate_distance_km(
    lat1 DECIMAL, lon1 DECIMAL, 
    lat2 DECIMAL, lon2 DECIMAL
) RETURNS DECIMAL AS $
DECLARE
    R DECIMAL := 6371; -- 地球の半径（km）
    dLat DECIMAL;
    dLon DECIMAL;
    a DECIMAL;
    c DECIMAL;
BEGIN
    -- 入力値チェック
    IF lat1 IS NULL OR lon1 IS NULL OR lat2 IS NULL OR lon2 IS NULL THEN
        RETURN NULL;
    END IF;
    
    dLat := RADIANS(lat2 - lat1);
    dLon := RADIANS(lon2 - lon1);
    
    a := SIN(dLat/2) * SIN(dLat/2) + 
         COS(RADIANS(lat1)) * COS(RADIANS(lat2)) * 
         SIN(dLon/2) * SIN(dLon/2);
    
    c := 2 * ATAN2(SQRT(a), SQRT(1-a));
    
    RETURN ROUND(R * c, 3);
END;
$ LANGUAGE plpgsql;

-- 運行の総距離計算
CREATE OR REPLACE FUNCTION calculate_operation_distance(operation_id_param UUID)
RETURNS DECIMAL AS $
DECLARE
    total_distance DECIMAL := 0;
    prev_lat DECIMAL;
    prev_lon DECIMAL;
    curr_lat DECIMAL;
    curr_lon DECIMAL;
    log_record RECORD;
BEGIN
    -- GPS ログから順次距離を計算
    FOR log_record IN 
        SELECT latitude, longitude 
        FROM gps_logs 
        WHERE operation_id = operation_id_param 
        ORDER BY recorded_at
    LOOP
        curr_lat := log_record.latitude;
        curr_lon := log_record.longitude;
        
        IF prev_lat IS NOT NULL AND prev_lon IS NOT NULL THEN
            total_distance := total_distance + 
                calculate_distance_km(prev_lat, prev_lon, curr_lat, curr_lon);
        END IF;
        
        prev_lat := curr_lat;
        prev_lon := curr_lon;
    END LOOP;
    
    RETURN ROUND(total_distance, 2);
END;
$ LANGUAGE plpgsql;

-- 最寄りの場所を検索
CREATE OR REPLACE FUNCTION find_nearest_locations(
    search_lat DECIMAL, 
    search_lon DECIMAL, 
    limit_count INTEGER DEFAULT 5
) RETURNS TABLE(
    location_id UUID,
    location_name VARCHAR,
    distance_km DECIMAL
) AS $
BEGIN
    RETURN QUERY
    SELECT 
        l.id,
        l.name,
        calculate_distance_km(search_lat, search_lon, l.latitude, l.longitude) as distance
    FROM locations l
    WHERE l.latitude IS NOT NULL 
      AND l.longitude IS NOT NULL
      AND l.is_active = true
    ORDER BY distance
    LIMIT limit_count;
END;
$ LANGUAGE plpgsql;

COMMENT ON FUNCTION calculate_distance_km IS 'ハーバーサイン式による2点間距離計算（km）';
COMMENT ON FUNCTION calculate_operation_distance IS '運行のGPSログから総距離を計算';
COMMENT ON FUNCTION find_nearest_locations IS '指定座標から最寄りの場所を検索';
