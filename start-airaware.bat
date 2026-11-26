@echo off
setlocal
cd /d "%~dp0"

where node >nul 2>nul
if errorlevel 1 (
  echo Node.js is required. Install Node.js 18 or newer, then run this file again.
  pause
  exit /b 1
)

node -e "if (Number(process.versions.node.split('.')[0]) < 18) process.exit(1)"
if errorlevel 1 (
  echo This project needs Node.js 18 or newer. Install a supported version, then run this file again.
  pause
  exit /b 1
)

echo Checking and installing AirAware AI dependencies...
call npm install
if errorlevel 1 (
  echo Dependency installation failed.
  pause
  exit /b 1
)

echo Starting AirAware AI...
call npm run dev
pause
