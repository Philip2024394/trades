@echo off
setlocal
cd /d "C:\Users\Victus\trades"
"C:\Program Files\nodejs\node.exe" scripts\nex-lab-gov-harvester.mjs --limit 30 >> "C:\Users\Victus\trades\data\nex-lab\gov-harvester-task.log" 2>&1
exit /b %ERRORLEVEL%
