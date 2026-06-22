-- 🆕 車両別オペレーションパターン追加
-- 積込パターン: 1=開始+完了, 2=品目選択後完了のみ, 3=即時完了
-- 荷降パターン: 1=開始+完了, 2=到着後完了のみ, 3=即時完了
ALTER TABLE vehicles 
  ADD COLUMN IF NOT EXISTS loading_pattern SMALLINT NOT NULL DEFAULT 2,
  ADD COLUMN IF NOT EXISTS unloading_pattern SMALLINT NOT NULL DEFAULT 2;

COMMENT ON COLUMN vehicles.loading_pattern IS '積込オペレーションパターン (1=開始+完了, 2=品目選択後完了, 3=即時完了)';
COMMENT ON COLUMN vehicles.unloading_pattern IS '荷降オペレーションパターン (1=開始+完了, 2=到着後完了, 3=即時完了)';
