-- 自動生成的 SQL migration 文件
-- 生成時間: 2025-02-25T21:02:35.622Z
-- 基於開發環境數據庫分析

BEGIN;

-- 表結構信息
/*
[
  {
    "column_name": "id",
    "data_type": "integer",
    "column_default": "nextval('system_records_id_seq'::regclass)",
    "is_nullable": "NO",
    "character_maximum_length": null
  },
  {
    "column_name": "serialnumber",
    "data_type": "character varying",
    "column_default": null,
    "is_nullable": "YES",
    "character_maximum_length": 100
  },
  {
    "column_name": "computername",
    "data_type": "character varying",
    "column_default": null,
    "is_nullable": "YES",
    "character_maximum_length": 200
  },
  {
    "column_name": "manufacturer",
    "data_type": "character varying",
    "column_default": null,
    "is_nullable": "YES",
    "character_maximum_length": 200
  },
  {
    "column_name": "model",
    "data_type": "character varying",
    "column_default": null,
    "is_nullable": "YES",
    "character_maximum_length": 200
  },
  {
    "column_name": "systemsku",
    "data_type": "text",
    "column_default": null,
    "is_nullable": "YES",
    "character_maximum_length": null
  },
  {
    "column_name": "operatingsystem",
    "data_type": "text",
    "column_default": null,
    "is_nullable": "YES",
    "character_maximum_length": null
  },
  {
    "column_name": "cpu",
    "data_type": "text",
    "column_default": null,
    "is_nullable": "YES",
    "character_maximum_length": null
  },
  {
    "column_name": "resolution",
    "data_type": "character varying",
    "column_default": null,
    "is_nullable": "YES",
    "character_maximum_length": 100
  },
  {
    "column_name": "graphicscard",
    "data_type": "text",
    "column_default": null,
    "is_nullable": "YES",
    "character_maximum_length": null
  },
  {
    "column_name": "touchscreen",
    "data_type": "character varying",
    "column_default": null,
    "is_nullable": "YES",
    "character_maximum_length": 100
  },
  {
    "column_name": "ram_gb",
    "data_type": "numeric",
    "column_default": "0.0",
    "is_nullable": "YES",
    "character_maximum_length": null
  },
  {
    "column_name": "disks",
    "data_type": "text",
    "column_default": null,
    "is_nullable": "YES",
    "character_maximum_length": null
  },
  {
    "column_name": "design_capacity",
    "data_type": "bigint",
    "column_default": "0.0",
    "is_nullable": "YES",
    "character_maximum_length": null
  },
  {
    "column_name": "full_charge_capacity",
    "data_type": "bigint",
    "column_default": "0.0",
    "is_nullable": "YES",
    "character_maximum_length": null
  },
  {
    "column_name": "cycle_count",
    "data_type": "bigint",
    "column_default": "0.0",
    "is_nullable": "YES",
    "character_maximum_length": null
  },
  {
    "column_name": "battery_health",
    "data_type": "numeric",
    "column_default": "0.0",
    "is_nullable": "YES",
    "character_maximum_length": null
  },
  {
    "column_name": "created_at",
    "data_type": "timestamp without time zone",
    "column_default": "CURRENT_TIMESTAMP",
    "is_nullable": "YES",
    "character_maximum_length": null
  },
  {
    "column_name": "is_current",
    "data_type": "boolean",
    "column_default": "true",
    "is_nullable": "YES",
    "character_maximum_length": null
  },
  {
    "column_name": "outbound_status",
    "data_type": "character varying",
    "column_default": "'available'::character varying",
    "is_nullable": "YES",
    "character_maximum_length": 20
  },
  {
    "column_name": "sync_status",
    "data_type": "character varying",
    "column_default": "'pending'::character varying",
    "is_nullable": "YES",
    "character_maximum_length": 20
  },
  {
    "column_name": "last_sync_time",
    "data_type": "timestamp without time zone",
    "column_default": null,
    "is_nullable": "YES",
    "character_maximum_length": null
  },
  {
    "column_name": "sync_version",
    "data_type": "character varying",
    "column_default": "1.0",
    "is_nullable": "YES",
    "character_maximum_length": null
  },
  {
    "column_name": "started_at",
    "data_type": "timestamp with time zone",
    "column_default": "CURRENT_TIMESTAMP",
    "is_nullable": "NO",
    "character_maximum_length": null
  },
  {
    "column_name": "disks_gb",
    "data_type": "numeric",
    "column_default": null,
    "is_nullable": "YES",
    "character_maximum_length": null
  },
  {
    "column_name": "last_updated_at",
    "data_type": "timestamp with time zone",
    "column_default": null,
    "is_nullable": "YES",
    "character_maximum_length": null
  },
  {
    "column_name": "data_source",
    "data_type": "character varying",
    "column_default": null,
    "is_nullable": "YES",
    "character_maximum_length": null
  },
  {
    "column_name": "validation_status",
    "data_type": "character varying",
    "column_default": null,
    "is_nullable": "YES",
    "character_maximum_length": null
  },
  {
    "column_name": "validation_message",
    "data_type": "text",
    "column_default": null,
    "is_nullable": "YES",
    "character_maximum_length": null
  }
]
*/

-- Disks 字段分析
/*
[
  {
    "raw_format": "256GB",
    "clean_format": "256GB",
    "occurrence_count": "379",
    "size_value": "256",
    "size_unit": "GB",
    "total_length": 5,
    "has_outer_quotes": false,
    "has_double_quotes": false,
    "has_single_quotes": false
  },
  {
    "raw_format": "238.47GB",
    "clean_format": "238.47GB",
    "occurrence_count": "243",
    "size_value": "238.47",
    "size_unit": "GB",
    "total_length": 8,
    "has_outer_quotes": false,
    "has_double_quotes": false,
    "has_single_quotes": false
  },
  {
    "raw_format": "512GB",
    "clean_format": "512GB",
    "occurrence_count": "223",
    "size_value": "512",
    "size_unit": "GB",
    "total_length": 5,
    "has_outer_quotes": false,
    "has_double_quotes": false,
    "has_single_quotes": false
  },
  {
    "raw_format": "476.94GB",
    "clean_format": "476.94GB",
    "occurrence_count": "214",
    "size_value": "476.94",
    "size_unit": "GB",
    "total_length": 8,
    "has_outer_quotes": false,
    "has_double_quotes": false,
    "has_single_quotes": false
  },
  {
    "raw_format": "1TB",
    "clean_format": "1TB",
    "occurrence_count": "59",
    "size_value": "1",
    "size_unit": "TB",
    "total_length": 3,
    "has_outer_quotes": false,
    "has_double_quotes": false,
    "has_single_quotes": false
  },
  {
    "raw_format": "953.86GB",
    "clean_format": "953.86GB",
    "occurrence_count": "30",
    "size_value": "953.86",
    "size_unit": "GB",
    "total_length": 8,
    "has_outer_quotes": false,
    "has_double_quotes": false,
    "has_single_quotes": false
  },
  {
    "raw_format": "465.76GB",
    "clean_format": "465.76GB",
    "occurrence_count": "3",
    "size_value": "465.76",
    "size_unit": "GB",
    "total_length": 8,
    "has_outer_quotes": false,
    "has_double_quotes": false,
    "has_single_quotes": false
  },
  {
    "raw_format": "0GB",
    "clean_format": "0GB",
    "occurrence_count": "1",
    "size_value": "0",
    "size_unit": "GB",
    "total_length": 3,
    "has_outer_quotes": false,
    "has_double_quotes": false,
    "has_single_quotes": false
  },
  {
    "raw_format": "1907.73GB",
    "clean_format": "1907.73GB",
    "occurrence_count": "1",
    "size_value": "1907.73",
    "size_unit": "GB",
    "total_length": 9,
    "has_outer_quotes": false,
    "has_double_quotes": false,
    "has_single_quotes": false
  },
  {
    "raw_format": "931.51GB",
    "clean_format": "931.51GB",
    "occurrence_count": "1",
    "size_value": "931.51",
    "size_unit": "GB",
    "total_length": 8,
    "has_outer_quotes": false,
    "has_double_quotes": false,
    "has_single_quotes": false
  }
]
*/

-- 數據分佈
/*
{
  "total_records": "1154",
  "null_disks": "0",
  "standard_format_count": "0",
  "gb_suffix_count": "1095",
  "tb_suffix_count": "59",
  "oldest_record": "2024-11-08T22:31:00.000Z",
  "newest_record": "2025-02-25T20:42:00.000Z"
}
*/

-- 現有約束
/*
[
  {
    "constraint_name": "system_records_pkey",
    "constraint_definition": "PRIMARY KEY (id)",
    "constraint_type": "p"
  }
]
*/

-- 現有索引
/*
[
  {
    "indexname": "idx_system_records_created_at",
    "indexdef": "CREATE INDEX idx_system_records_created_at ON public.system_records USING btree (created_at DESC)"
  },
  {
    "indexname": "idx_system_records_serialnumber_current",
    "indexdef": "CREATE INDEX idx_system_records_serialnumber_current ON public.system_records USING btree (serialnumber, is_current) WHERE (is_current = true)"
  },
  {
    "indexname": "system_records_pkey",
    "indexdef": "CREATE UNIQUE INDEX system_records_pkey ON public.system_records USING btree (id)"
  }
]
*/

-- 根據分析生成的 Migration SQL
ALTER TABLE system_records ADD COLUMN IF NOT EXISTS disks_temp TEXT;
ALTER TABLE system_records ADD COLUMN IF NOT EXISTS disks_gb NUMERIC DEFAULT 0;

-- 更新數據
UPDATE system_records 
SET 
    disks_temp = 
        CASE 
            WHEN disks IS NULL OR disks = '' THEN 
                NULL
            WHEN disks ~ '^[^:]+:[^:]+:[^:]+$' THEN 
                disks
            WHEN disks ~ '^[0-9]+GB$' THEN 
                'SSD:' || disks || ':Unknown'
            ELSE 
                'Unknown:' || COALESCE(disks, '0GB') || ':Unknown'
        END,
    disks_gb = 
        CASE 
            WHEN disks ~ '[0-9]+' THEN 
                (regexp_replace(disks, '[^0-9]', '', 'g'))::NUMERIC
            ELSE 
                0
        END;

-- 驗證數據
DO $$ 
BEGIN
    IF EXISTS (
        SELECT 1 
        FROM system_records 
        WHERE disks_temp IS NOT NULL 
        AND disks_temp NOT LIKE '%:%:%'
    ) THEN
        RAISE EXCEPTION 'Invalid disk format found after conversion';
    END IF;
END $$;

-- 替換列
ALTER TABLE system_records DROP COLUMN disks;
ALTER TABLE system_records RENAME COLUMN disks_temp TO disks;

-- 添加約束
ALTER TABLE system_records 
    ADD CONSTRAINT check_disks_format 
    CHECK (disks ~ '^[^:]+:[^:]+:[^:]+$');

ALTER TABLE system_records 
    ADD CONSTRAINT check_disks_gb_positive 
    CHECK (disks_gb >= 0);

COMMIT;

-- 回滾腳本
/*
BEGIN;
    ALTER TABLE system_records DROP CONSTRAINT IF EXISTS check_disks_format;
    ALTER TABLE system_records DROP CONSTRAINT IF EXISTS check_disks_gb_positive;
    ALTER TABLE system_records DROP COLUMN IF EXISTS disks_gb;
    ALTER TABLE system_records RENAME COLUMN disks TO disks_old;
    ALTER TABLE system_records ADD COLUMN disks TEXT;
    UPDATE system_records 
    SET disks = 
        CASE 
            WHEN disks_old ~ '^[^:]+:([^:]+):[^:]+$' 
            THEN regexp_replace(regexp_matches(disks_old, '^[^:]+:([^:]+):[^:]+$')[1], '[^0-9]', '', 'g') || 'GB'
            ELSE disks_old
        END;
    ALTER TABLE system_records DROP COLUMN disks_old;
COMMIT;
*/
