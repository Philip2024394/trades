@echo off
setlocal
cd /d "C:\Users\Victus\trades"
"C:\Program Files\nodejs\node.exe" scripts\nex-lab-quality-agent.mjs --limit 500 >> "C:\Users\Victus\trades\data\nex-lab\quality-agent-task.log" 2>&1
exit /b %ERRORLEVEL%
