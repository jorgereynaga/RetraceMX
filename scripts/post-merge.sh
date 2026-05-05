#!/bin/bash
set -e

cd backend
pip install -r requirements.txt -q
python manage.py migrate --no-input

cd ../frontend
npm install --legacy-peer-deps
