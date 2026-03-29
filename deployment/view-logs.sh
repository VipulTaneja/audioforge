#!/bin/bash

# Script to view logs from AudioForge production deployment
# Usage: ./view-logs.sh [service-name] [options]

COMPOSE_FILE="docker-compose.runtime.yml"
SERVICE=${1:-""}

show_help() {
    echo "AudioForge Production Log Viewer"
    echo ""
    echo "Usage: ./view-logs.sh [service] [options]"
    echo ""
    echo "Services:"
    echo "  backend        - Backend API server logs"
    echo "  celery-worker  - Celery worker logs"
    echo "  frontend       - Frontend logs"
    echo "  nginx          - Nginx proxy logs"
    echo "  postgres       - Database logs"
    echo "  redis          - Redis logs"
    echo "  minio          - MinIO logs"
    echo "  keycloak       - Keycloak logs"
    echo "  all            - All services (follow mode)"
    echo ""
    echo "Options:"
    echo "  -f, --follow   - Follow log output (tail -f style)"
    echo "  -n, --lines    - Number of lines to show (default: 100)"
    echo "  --since        - Show logs since duration (e.g., 10m, 1h)"
    echo ""
    echo "Examples:"
    echo "  ./view-logs.sh backend -f           # Follow backend logs"
    echo "  ./view-logs.sh celery-worker -n 50  # Last 50 lines of celery"
    echo "  ./view-logs.sh all -f               # Follow all services"
    echo "  ./view-logs.sh nginx --since 10m    # Nginx logs from last 10 min"
}

if [ "$1" == "-h" ] || [ "$1" == "--help" ]; then
    show_help
    exit 0
fi

# Build docker-compose command options
DOCKER_OPTS=""
FOLLOW=false
LINES=100

# Parse remaining arguments
shift 2>/dev/null || true
while [[ $# -gt 0 ]]; do
    case $1 in
        -f|--follow)
            FOLLOW=true
            shift
            ;;
        -n|--lines)
            LINES="$2"
            shift 2
            ;;
        --since)
            DOCKER_OPTS="$DOCKER_OPTS --since=$2"
            shift 2
            ;;
        *)
            shift
            ;;
    esac
done

if [ "$FOLLOW" = true ]; then
    DOCKER_OPTS="$DOCKER_OPTS -f"
fi

DOCKER_OPTS="$DOCKER_OPTS --tail=$LINES"

case $SERVICE in
    backend|celery-worker|frontend|nginx|postgres|redis|minio|keycloak)
        echo "Showing logs for: $SERVICE"
        sudo docker-compose -f $COMPOSE_FILE logs $DOCKER_OPTS $SERVICE
        ;;
    all)
        echo "Showing logs for all services"
        sudo docker-compose -f $COMPOSE_FILE logs $DOCKER_OPTS
        ;;
    "")
        echo "Error: No service specified"
        show_help
        exit 1
        ;;
    *)
        echo "Error: Unknown service '$SERVICE'"
        show_help
        exit 1
        ;;
esac
