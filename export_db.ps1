# 設置變量
$date = Get-Date -Format "yyyyMMdd"
$backupPath = ".\backups"
$fileName = "system_monitor_$date.sql"
$tempFile = "temp_dump.sql"
$pgPath = "C:\Program Files\PostgreSQL\17\bin"

# 創建備份目錄（如果不存在）
if (-not (Test-Path -Path $backupPath)) {
    New-Item -ItemType Directory -Path $backupPath
}

# 設置環境變量
$env:PGPASSWORD = "zero"
$env:PGCLIENTENCODING = "UTF8"

Write-Host "Starting database backup..." -ForegroundColor Green

try {
    # 使用最簡單的導出選項
    & "$pgPath\pg_dump" -U postgres -h localhost -p 5432 `
        --format=p `
        --encoding=UTF8 `
        --no-owner `
        --no-privileges `
        --no-tablespaces `
        --no-comments `
        --clean `
        --if-exists `
        --schema-only `
        zerodev > "$backupPath\schema.sql"

    # 導出數據
    & "$pgPath\pg_dump" -U postgres -h localhost -p 5432 `
        --format=p `
        --encoding=UTF8 `
        --data-only `
        --inserts `
        zerodev > "$backupPath\data.sql"

    if ($LASTEXITCODE -eq 0) {
        # 合併文件
        $schema = Get-Content -Path "$backupPath\schema.sql" -Raw
        $data = Get-Content -Path "$backupPath\data.sql" -Raw
        
        # 移除所有SET命令
        $schema = $schema -replace '(?m)^SET .*?;\r?\n', ''
        $data = $data -replace '(?m)^SET .*?;\r?\n', ''
        
        # 替換觸發器語法
        $schema = $schema -replace 'EXECUTE FUNCTION', 'EXECUTE PROCEDURE'
        
        # 添加類型刪除語句
        $dropTypes = @'
DO $$
BEGIN
    DROP TYPE IF EXISTS rma_inventory_status CASCADE;
    DROP TYPE IF EXISTS rma_status CASCADE;
    DROP TYPE IF EXISTS store_order_status CASCADE;
    DROP TYPE IF EXISTS store_rma_status CASCADE;
    DROP TYPE IF EXISTS system_record_status CASCADE;
    DROP TYPE IF EXISTS user_role CASCADE;
EXCEPTION
    WHEN OTHERS THEN
        NULL;
END $$;

'@
        
        # 合併並寫入最終文件
        $content = $dropTypes + $schema + "`n" + $data
        [System.IO.File]::WriteAllText("$backupPath\$fileName", $content, [System.Text.ASCIIEncoding]::new())

        Write-Host "Backup completed successfully!" -ForegroundColor Green
        Write-Host "Backup file: $backupPath\$fileName" -ForegroundColor Yellow

        # 刪除臨時文件
        Remove-Item -Path "$backupPath\schema.sql" -Force
        Remove-Item -Path "$backupPath\data.sql" -Force
    } else {
        Write-Host "Backup failed with exit code: $LASTEXITCODE" -ForegroundColor Red
    }
} catch {
    Write-Host "An error occurred: $_" -ForegroundColor Red
} finally {
    # 清除密碼
    $env:PGCLIENTENCODING = ""
    $env:PGPASSWORD = ""
    # 確保臨時文件被刪除
    if (Test-Path "$backupPath\schema.sql") {
        Remove-Item -Path "$backupPath\schema.sql" -Force
    }
    if (Test-Path "$backupPath\data.sql") {
        Remove-Item -Path "$backupPath\data.sql" -Force
    }
}

Write-Host "Press any key to exit..."
$null = $Host.UI.RawUI.ReadKey("NoEcho,IncludeKeyDown") 