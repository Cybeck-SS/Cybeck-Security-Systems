@echo off
title Cybeck Security Systems v0.1.7
cd /d "%~dp0"
if not exist "node_modules" (
  echo Installing application dependencies...
  call npm install
)
call npm start
