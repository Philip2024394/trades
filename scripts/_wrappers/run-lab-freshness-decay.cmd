@echo off
setlocal
cd /d "C:\Users\Victus\trades"
"C:\Program Files\nodejs\node.exe" scripts\nex-lab-freshness-decay.mjs >> "C:\Users\Victus\trades\data\nex-lab\freshness-decay-task.log" 2>&1
exit /b %ERRORLEVEL%
