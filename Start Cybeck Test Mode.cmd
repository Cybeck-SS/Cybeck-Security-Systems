@echo off
setlocal
title Cybeck Security Systems - Local Test Mode
cd /d "%~dp0"

if not exist "node_modules\electron\dist\electron.exe" (
  echo Cybeck's local test runtime is not installed.
  echo Run npm install from this folder, then start Test Mode again.
  pause
  exit /b 1
)

echo Starting Cybeck in Local Test Mode...
echo The packaged updater is disabled during this test session.
set "CYBECK_TEST_MODE=1"
call npm start

if errorlevel 1 (
  echo.
  echo Cybeck Test Mode exited with an error.
  pause
)

endlocal
