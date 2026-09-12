@echo off
setlocal
cd /d "C:\Users\Victus\trades"
"C:\Program Files\nodejs\node.exe" scripts\nex-marketing-import-emails.mjs >> "C:\Users\Victus\trades\data\nex-lab\marketing-import-task.log" 2>&1
exit /b %ERRORLEVEL%
