@echo off
cd /d "%~dp0"
if not exist node_modules (
  echo Installing project dependencies. An internet connection is needed the first time.
  call npm install
  if errorlevel 1 pause & exit /b 1
)
call npm run dev
pause
