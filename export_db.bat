@echo off
set PGPASSWORD=zero
pg_dump -U postgres -h localhost -p 5432 -F p --create --clean --if-exists system_monitor > system_monitor_backup.sql
echo Database export completed!
pause 