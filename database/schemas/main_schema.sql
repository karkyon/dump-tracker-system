-- メインスキーマ定義
-- 拡張機能の有効化
CREATE EXTENSION IF NOT EXISTS "uuid-ossp";
CREATE EXTENSION IF NOT EXISTS "pg_trgm";

-- カスタム型定義
DO $ BEGIN
    CREATE TYPE user_role AS ENUM ('ADMIN', 'MANAGER', 'DRIVER');
EXCEPTION
    WHEN duplicate_object THEN null;
END $;

DO $ BEGIN
    CREATE TYPE vehicle_status AS ENUM ('ACTIVE', 'MAINTENANCE', 'INACTIVE', 'RETIRED');
EXCEPTION
    WHEN duplicate_object THEN null;
END $;

DO $ BEGIN
    CREATE TYPE operation_status AS ENUM ('PLANNING', 'IN_PROGRESS', 'COMPLETED', 'CANCELLED');
EXCEPTION
    WHEN duplicate_object THEN null;
END $;

DO $ BEGIN
    CREATE TYPE location_type AS ENUM ('LOADING', 'UNLOADING', 'BOTH');
EXCEPTION
    WHEN duplicate_object THEN null;
END $;

DO $ BEGIN
    CREATE TYPE maintenance_type AS ENUM ('ROUTINE', 'REPAIR', 'INSPECTION', 'EMERGENCY');
EXCEPTION
    WHEN duplicate_object THEN null;
END $;

DO $ BEGIN
    CREATE TYPE fuel_type AS ENUM ('GASOLINE', 'DIESEL', 'HYBRID', 'ELECTRIC');
EXCEPTION
    WHEN duplicate_object THEN null;
END $;

-- 共通カラム更新関数
CREATE OR REPLACE FUNCTION trigger_set_timestamp()
RETURNS TRIGGER AS $
BEGIN
  NEW.updated_at = NOW();
  RETURN NEW;
END;
$ LANGUAGE plpgsql;
