@echo off
setlocal
cd /d "C:\Users\Victus\trades"
"C:\Program Files\nodejs\node.exe" scripts\nex-marketing-sender.mjs >> "C:\Users\Victus\trades\data\nex-lab\marketing-sender-task.log" 2>&1
exit /b %ERRORLEVEL%
