#!/bin/bash

PROJECT_ROOT="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"

echo "=== AudioForge Startup Script ==="

check_port() {
    local port=$1
    local name=$2
    if nc -z localhost "$port" 2>/dev/null; then
        echo "✓ $name is running on port $port"
        return 0
    else
        echo "✗ $name is NOT running on port $port"
        return 1
    fi
}

check_process() {
    local name=$1
    local pattern=$2
    if pgrep -f "$pattern" > /dev/null; then
        echo "✓ $name is running"
        return 0
    else
        echo "✗ $name is NOT running"
        return 1
    fi
}

running=0
not_running=0

echo ""
echo "=== Checking Docker Services ==="
if command -v docker &> /dev/null; then
    if docker ps --format '{{.Names}}' 2>/dev/null | grep -q "postgres\|redis\|minio\|keycloak"; then
        echo "✓ Docker services are running"
        running=1
    else
        echo "Starting Docker services..."
        docker compose up -d 2>&1 || echo "⚠ Docker services failed to start (continuing anyway)"
        not_running=1
    fi
else
    echo "⚠ Docker not available (skipping)"
fi

echo ""
echo "=== Checking Backend (port 8000) ==="
if check_port 8000 "Backend"; then
    running=1
else
    echo "Starting backend..."
    cd "$PROJECT_ROOT/backend"
    source venv/bin/activate
    nohup uvicorn app.main:app --reload --port 8000 > /tmp/audioforge_api.log 2>&1 &
    echo "Backend started (PID: $!)"
    not_running=1
fi

echo ""
echo "=== Checking Frontend (port 3000) ==="
if check_port 3000 "Frontend"; then
    running=1
else
    echo "Starting frontend..."
    cd "$PROJECT_ROOT/frontend"
    nohup npm run dev > /tmp/audioforge_frontend.log 2>&1 &
    echo "Frontend started (PID: $!)"
    not_running=1
fi

echo ""
echo "=== Checking Celery Worker ==="
if check_process "Celery Worker" "celery.*worker"; then
    running=1
else
    echo "Starting Celery worker..."
    cd "$PROJECT_ROOT/backend"
    source venv/bin/activate
    nohup celery -A app.workers.celery_app worker --loglevel=info > /tmp/audioforge_Celery.log 2>&1 &
    echo "Celery worker started (PID: $!)"
    not_running=1
fi

echo ""
echo "=== Summary ==="
if [ $not_running -eq 0 ]; then
    echo "All components are already running!"
else
    echo "Started missing components. Logs:"
    echo "  Backend:  /tmp/audioforge_api.log"
    echo "  Frontend: /tmp/audioforge_frontend.log"
    echo "  Celery:   /tmp/audioforge_Celery.log"
fi

echo ""
echo "=== Access URLs ==="
echo "  Frontend: http://localhost:3000"
echo "  Backend:  http://localhost:8000"
echo "  MinIO:    http://localhost:9000 (console: http://localhost:9001)"
echo "  Keycloak: http://localhost:8080"

echo ""
echo "=== Tail Logs ==="
echo "  Backend:  wsl -d Ubuntu -- tail -f /tmp/audioforge_api.log"
echo "  Frontend: wsl -d Ubuntu -- tail -f /tmp/audioforge_frontend.log"
echo "  Celery:   wsl -d Ubuntu -- tail -f /tmp/audioforge_Celery.log"
