@echo off
setlocal
cd /d "C:\Users\Victus\trades"
"C:\Program Files\nodejs\node.exe" scripts\nex-lab-email-enricher.mjs --limit 25 >> "C:\Users\Victus\trades\data\nex-lab\email-enricher-task.log" 2>&1
exit /b %ERRORLEVEL%
