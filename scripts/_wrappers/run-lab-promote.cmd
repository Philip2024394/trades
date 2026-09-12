@echo off
setlocal
cd /d "C:\Users\Victus\trades"
"C:\Users\Victus\trades\node_modules\.bin\tsx.cmd" scripts\nex-lab-promote.mts >> "C:\Users\Victus\trades\data\nex-lab\promote-task.log" 2>&1
exit /b %ERRORLEVEL%
