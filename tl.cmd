@echo off
setlocal
set "SCRIPT_DIR=%~dp0"
node "%SCRIPT_DIR%src\terminal-launcher.js" %*
exit /b %ERRORLEVEL%
