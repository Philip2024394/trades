@echo off
setlocal
cd /d "C:\Users\Victus\trades"
"C:\Program Files\nodejs\node.exe" scripts\nex-master-ai-supervisor.mjs >> "C:\Users\Victus\trades\data\master-ai\supervisor-task.log" 2>&1
exit /b %ERRORLEVEL%
