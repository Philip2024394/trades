@echo off
setlocal
cd /d "C:\Users\Victus\trades"
"C:\Program Files\nodejs\node.exe" scripts\nex-lab-business-categoriser.mjs --limit 1000 >> "C:\Users\Victus\trades\data\nex-lab\categoriser-task.log" 2>&1
exit /b %ERRORLEVEL%
