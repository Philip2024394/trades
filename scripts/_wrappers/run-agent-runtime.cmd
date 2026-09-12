@echo off
setlocal
cd /d "C:\Users\Victus\trades"
"C:\Program Files\nodejs\node.exe" scripts\nex-agents.mjs start all >> "C:\Users\Victus\trades\data\nex-agent-runtime\task-launch.log" 2>&1
exit /b %ERRORLEVEL%
