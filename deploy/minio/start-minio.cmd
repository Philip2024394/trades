@echo off
REM Founder 2026-09-10 · NEX MinIO launcher.
REM Called by Windows Scheduled Task NEX-MinIO-Server on startup + hourly.
REM Idempotent · will NOOP if MinIO already listening on 9000.
setlocal
set MINIO_ROOT_USER=nex_admin
set MINIO_ROOT_PASSWORD=NexStorageRockSolid2026!!
set MINIO_REGION=eu-west
set MINIO_DIR=C:\Users\Victus\trades\deploy\minio
set MINIO_DATA=C:\Users\Victus\trades\deploy\minio\data
set MINIO_LOG=C:\Users\Victus\trades\deploy\minio\minio-server.log

REM Check if already running
powershell -NoProfile -Command "if (Get-NetTCPConnection -LocalPort 9000 -State Listen -ErrorAction SilentlyContinue) { exit 0 } else { exit 1 }"
if %ERRORLEVEL% EQU 0 (
  echo [%DATE% %TIME%] minio_already_running >> "%MINIO_LOG%"
  exit /b 0
)

echo [%DATE% %TIME%] starting minio ... >> "%MINIO_LOG%"
start "" /B "%MINIO_DIR%\minio.exe" server "%MINIO_DATA%" --console-address ":9001" --address ":9000" >> "%MINIO_LOG%" 2>&1
exit /b 0
