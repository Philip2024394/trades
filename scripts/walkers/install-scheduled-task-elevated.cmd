@echo off
REM Double-click this file to install the NEX Walker Watchdog scheduled task.
REM
REM It self-elevates via UAC · you'll see a "Do you want to allow this app to
REM make changes" prompt · click Yes · a new elevated PowerShell window will
REM run the installer and pause so you can read the result.

setlocal
set "SCRIPT_DIR=%~dp0"
set "PS1_PATH=%SCRIPT_DIR%install-scheduled-task.ps1"

REM Ask PowerShell to self-elevate and run the installer, then pause.
powershell -NoProfile -ExecutionPolicy Bypass -Command ^
    "Start-Process powershell -ArgumentList '-NoExit','-ExecutionPolicy','Bypass','-File','%PS1_PATH%' -Verb RunAs"

endlocal
