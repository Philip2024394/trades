@echo off
setlocal
cd /d "C:\Users\Victus\trades"
"C:\Program Files\nodejs\node.exe" scripts\nex-founder-window-probe.mjs >> "C:\Users\Victus\trades\data\nex-lab\founder-window-probe.log" 2>&1
exit /b %ERRORLEVEL%
