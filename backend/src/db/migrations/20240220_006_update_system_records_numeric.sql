-- 第一步：修改列類型
BEGIN;
DO $$ 
BEGIN
    -- 修改 system_records 表的數值欄位為 NUMERIC
    ALTER TABLE system_records
        ALTER COLUMN ram_gb TYPE NUMERIC USING COALESCE(ram_gb::numeric, 0),
        ALTER COLUMN battery_health TYPE NUMERIC USING COALESCE(battery_health::numeric, 0),
        ALTER COLUMN cycle_count TYPE NUMERIC USING COALESCE(cycle_count::numeric, 0),
        ALTER COLUMN design_capacity TYPE NUMERIC USING COALESCE(design_capacity::numeric, 0),
        ALTER COLUMN full_charge_capacity TYPE NUMERIC USING COALESCE(full_charge_capacity::numeric, 0),
        ALTER COLUMN sync_version TYPE NUMERIC USING COALESCE(sync_version::numeric, 1);
    RAISE NOTICE 'Column types updated successfully';
EXCEPTION
    WHEN OTHERS THEN
        RAISE NOTICE 'Error updating column types: %', SQLERRM;
        RAISE;
END $$;
COMMIT;

-- 第二步：設置默認值
BEGIN;
DO $$ 
BEGIN
    ALTER TABLE system_records
        ALTER COLUMN ram_gb SET DEFAULT 0.0,
        ALTER COLUMN battery_health SET DEFAULT 0.0,
        ALTER COLUMN cycle_count SET DEFAULT 0.0,
        ALTER COLUMN design_capacity SET DEFAULT 0.0,
        ALTER COLUMN full_charge_capacity SET DEFAULT 0.0,
        ALTER COLUMN sync_version SET DEFAULT 1.0;
    RAISE NOTICE 'Default values set successfully';
EXCEPTION
    WHEN OTHERS THEN
        RAISE NOTICE 'Error setting default values: %', SQLERRM;
        RAISE;
END $$;
COMMIT;

-- 第三步：清理無效數據
BEGIN;
DO $$ 
BEGIN
    -- 清理 ram_gb
    UPDATE system_records SET ram_gb = 0 WHERE ram_gb < 0 OR ram_gb IS NULL;
    RAISE NOTICE 'ram_gb cleaned';

    -- 清理 battery_health
    UPDATE system_records 
    SET battery_health = 
        CASE 
            WHEN battery_health > 100 THEN 100
            WHEN battery_health < 0 THEN 0
            WHEN battery_health IS NULL THEN 0
            ELSE battery_health
        END;
    RAISE NOTICE 'battery_health cleaned';

    -- 清理其他欄位
    UPDATE system_records SET cycle_count = 0 WHERE cycle_count < 0 OR cycle_count IS NULL;
    UPDATE system_records SET design_capacity = 0 WHERE design_capacity < 0 OR design_capacity IS NULL;
    UPDATE system_records SET full_charge_capacity = 0 WHERE full_charge_capacity < 0 OR full_charge_capacity IS NULL;
    UPDATE system_records SET sync_version = 1 WHERE sync_version < 0 OR sync_version IS NULL;
    RAISE NOTICE 'Other fields cleaned';
EXCEPTION
    WHEN OTHERS THEN
        RAISE NOTICE 'Error cleaning data: %', SQLERRM;
        RAISE;
END $$;
COMMIT;

-- 第四步：添加檢查約束
BEGIN;
DO $$ 
BEGIN
    -- 逐個添加約束以便於定位問題
    ALTER TABLE system_records ADD CONSTRAINT check_ram_gb_positive CHECK (ram_gb >= 0);
    RAISE NOTICE 'ram_gb constraint added';

    ALTER TABLE system_records ADD CONSTRAINT check_battery_health_range CHECK (battery_health >= 0 AND battery_health <= 100);
    RAISE NOTICE 'battery_health constraint added';

    ALTER TABLE system_records ADD CONSTRAINT check_cycle_count_positive CHECK (cycle_count >= 0);
    RAISE NOTICE 'cycle_count constraint added';

    ALTER TABLE system_records ADD CONSTRAINT check_design_capacity_positive CHECK (design_capacity >= 0);
    RAISE NOTICE 'design_capacity constraint added';

    ALTER TABLE system_records ADD CONSTRAINT check_full_charge_capacity_positive CHECK (full_charge_capacity >= 0);
    RAISE NOTICE 'full_charge_capacity constraint added';

    ALTER TABLE system_records ADD CONSTRAINT check_sync_version_positive CHECK (sync_version >= 0);
    RAISE NOTICE 'sync_version constraint added';
EXCEPTION
    WHEN OTHERS THEN
        RAISE NOTICE 'Error adding constraints: %', SQLERRM;
        RAISE;
END $$;
COMMIT;

-- 驗證數據
SELECT 
    COUNT(*) as total_records,
    COUNT(CASE WHEN ram_gb < 0 THEN 1 END) as invalid_ram,
    COUNT(CASE WHEN battery_health < 0 OR battery_health > 100 THEN 1 END) as invalid_battery,
    COUNT(CASE WHEN cycle_count < 0 THEN 1 END) as invalid_cycle,
    COUNT(CASE WHEN design_capacity < 0 THEN 1 END) as invalid_design,
    COUNT(CASE WHEN full_charge_capacity < 0 THEN 1 END) as invalid_full,
    COUNT(CASE WHEN sync_version < 0 THEN 1 END) as invalid_sync
FROM system_records;

-- 驗證列定義
SELECT 
    column_name,
    data_type,
    column_default,
    is_nullable
FROM information_schema.columns 
WHERE table_name = 'system_records'
AND column_name IN (
    'ram_gb',
    'battery_health',
    'cycle_count',
    'design_capacity',
    'full_charge_capacity',
    'sync_version'
)
ORDER BY column_name;

-- 回滾腳本（按相反順序執行）
/*
BEGIN;
-- 移除檢查約束
ALTER TABLE system_records
    DROP CONSTRAINT IF EXISTS check_ram_gb_positive,
    DROP CONSTRAINT IF EXISTS check_battery_health_range,
    DROP CONSTRAINT IF EXISTS check_cycle_count_positive,
    DROP CONSTRAINT IF EXISTS check_design_capacity_positive,
    DROP CONSTRAINT IF EXISTS check_full_charge_capacity_positive,
    DROP CONSTRAINT IF EXISTS check_sync_version_positive;
COMMIT;

BEGIN;
-- 恢復為整數類型
ALTER TABLE system_records
    ALTER COLUMN ram_gb TYPE INTEGER USING ram_gb::integer,
    ALTER COLUMN battery_health TYPE INTEGER USING battery_health::integer,
    ALTER COLUMN cycle_count TYPE INTEGER USING cycle_count::integer,
    ALTER COLUMN design_capacity TYPE INTEGER USING design_capacity::integer,
    ALTER COLUMN full_charge_capacity TYPE INTEGER USING full_charge_capacity::integer,
    ALTER COLUMN sync_version TYPE INTEGER USING sync_version::integer;
COMMIT;

BEGIN;
-- 恢復默認值
ALTER TABLE system_records
    ALTER COLUMN ram_gb SET DEFAULT 0,
    ALTER COLUMN battery_health SET DEFAULT 0,
    ALTER COLUMN cycle_count SET DEFAULT 0,
    ALTER COLUMN design_capacity SET DEFAULT 0,
    ALTER COLUMN full_charge_capacity SET DEFAULT 0,
    ALTER COLUMN sync_version SET DEFAULT 1;
COMMIT;
*/ 