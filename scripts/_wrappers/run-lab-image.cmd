@echo off
setlocal
cd /d "C:\Users\Victus\trades"
"C:\Program Files\nodejs\node.exe" scripts\nex-lab-image-fetcher.mjs >> "C:\Users\Victus\trades\data\nex-lab\image-task.log" 2>&1
exit /b %ERRORLEVEL%
