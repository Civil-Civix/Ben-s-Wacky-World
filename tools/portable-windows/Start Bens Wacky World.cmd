@echo off
title Bens Wacky World Portable
cd /d "%~dp0"
"%~dp0runtime\node.exe" "%~dp0server.mjs"
if errorlevel 1 pause
