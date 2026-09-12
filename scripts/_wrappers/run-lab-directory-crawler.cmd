@echo off
setlocal
cd /d "C:\Users\Victus\trades"
"C:\Program Files\nodejs\node.exe" scripts\nex-lab-directory-crawler.mjs --limit 30 >> "C:\Users\Victus\trades\data\nex-lab\directory-crawler-task.log" 2>&1
exit /b %ERRORLEVEL%
