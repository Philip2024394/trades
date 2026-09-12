@echo off
setlocal
cd /d "C:\Users\Victus\trades"
"C:\Program Files\nodejs\node.exe" scripts\nex-pg-backup.mjs >> "C:\Users\Victus\trades\data\nex-backups\backup-task.log" 2>&1
exit /b %ERRORLEVEL%
