$ErrorActionPreference = "Stop"

$root = Split-Path -Parent $PSScriptRoot
$backendDir = Join-Path $root "backend"
$python = Join-Path $root ".venv\Scripts\python.exe"

if (-not (Test-Path $python)) {
  throw "No se encontró .venv. Ejecuta primero la instalación de dependencias del backend."
}

Set-Location $backendDir

$env:DJANGO_DEBUG = "1"
$env:DJANGO_USE_SQLITE = "0"
$env:DATABASE_URL = "postgres://acopio360:acopio360@localhost:5432/acopio360"
$env:DJANGO_ROOT_REDIRECT_URL = "http://localhost:8000/api/"
$env:DJANGO_ALLOWED_HOSTS = "localhost,127.0.0.1,backend,192.168.0.103"
$env:DJANGO_CORS_ALLOWED_ORIGINS = "http://localhost:5000,http://localhost:3000,http://localhost:5173"
$env:DJANGO_CSRF_TRUSTED_ORIGINS = "http://localhost:5000,http://localhost:3000,http://localhost:5173"

& $python manage.py migrate
& $python manage.py seed_demo
& $python manage.py runserver 0.0.0.0:8000
