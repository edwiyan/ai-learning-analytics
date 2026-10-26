#!/bin/bash
set -e

echo "=== Running database migrations ==="
alembic upgrade head

echo "=== Seeding initial data ==="
python -m backend.seed

echo "=== Seeding demo data ==="
python -m backend.seed_demo

echo "=== Starting AILAS backend ==="
exec uvicorn backend.main:app --host 0.0.0.0 --port 8000
