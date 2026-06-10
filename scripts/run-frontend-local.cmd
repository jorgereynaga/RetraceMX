@echo off
setlocal
cd /d %~dp0\..\frontend
set VITE_PROXY_TARGET=http://localhost:8000
npm run dev -- --host 0.0.0.0 --port 5173 --strictPort
endlocal
