@echo off
set ELECTRON_RUN_AS_NODE=
cd /d "%~dp0"
if exist "release\Fieldwork-win32-x64\Fieldwork.exe" (
  start "" "release\Fieldwork-win32-x64\Fieldwork.exe"
  exit /b
)
call npm.cmd start
