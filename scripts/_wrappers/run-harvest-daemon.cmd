@echo off
setlocal
cd /d "C:\Users\Victus\trades"
"C:\Program Files\nodejs\node.exe" scripts\nex-harvest-daemon.mjs >> "C:\Users\Victus\trades\data\harvest-osm\daemon-task.log" 2>&1
exit /b %ERRORLEVEL%
