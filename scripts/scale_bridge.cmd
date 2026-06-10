@echo off
powershell -NoProfile -ExecutionPolicy Bypass -File "%~dp0scale_bridge.ps1" %*
