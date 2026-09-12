@echo off
REM Founder 2026-09-10 · scheduled-task wrapper · avoids >> parsing issues
REM Task Scheduler mangles `>>` inside args · this .cmd handles it internally.
setlocal
cd /d "C:\Users\Victus\trades"
"C:\Program Files\nodejs\node.exe" scripts\nex-lab-harvest.mjs >> "C:\Users\Victus\trades\data\nex-lab\harvest-task.log" 2>&1
exit /b %ERRORLEVEL%
