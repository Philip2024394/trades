@echo off
setlocal
cd /d "C:\Users\Victus\trades"
"C:\Program Files\nodejs\node.exe" scripts\nex-lab-wikidata.mjs --limit 20 >> "C:\Users\Victus\trades\data\nex-lab\wikidata-task.log" 2>&1
exit /b %ERRORLEVEL%
