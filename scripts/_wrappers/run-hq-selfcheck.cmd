@echo off
setlocal
cd /d "C:\Users\Victus\trades"
"C:\Program Files\nodejs\node.exe" scripts\nex-hq-selfcheck.mjs >> "C:\Users\Victus\trades\data\nex-lab\hq-selfcheck-task.log" 2>&1
exit /b %ERRORLEVEL%
