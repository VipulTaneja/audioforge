#!/usr/bin/env bash

set -euo pipefail

SCRIPT_DIR=$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)

IMAGE_TAG="${AUDIOFORGE_IMAGE_TAG:-0.1.0}"
IMAGE_NAMESPACE="${AUDIOFORGE_IMAGE_NAMESPACE:-audioforge}"
GITHUB_ORG=""
if [[ -n "${GITHUB_REPOSITORY:-}" ]]; then
  GITHUB_ORG="${GITHUB_REPOSITORY%%/*}"
elif command -v git >/dev/null 2>&1 && git -C "${SCRIPT_DIR}" rev-parse --is-inside-work-tree >/dev/null 2>&1; then
  REMOTE_URL="$(git -C "${SCRIPT_DIR}" remote get-url origin 2>/dev/null || true)"
  if [[ "${REMOTE_URL}" =~ github.com[:/]{1,2}([^/]+)/([^/.]+)(\.git)?$ ]]; then
    GITHUB_ORG="${BASH_REMATCH[1]}"
  fi
fi

AUDIOFORGE_REGISTRY="${AUDIOFORGE_REGISTRY:-}"
AUDIOFORGE_REGISTRY_DEFAULT="ghcr.io/${GITHUB_ORG:-audioforge}"
if [[ -z "${AUDIOFORGE_REGISTRY}" && -n "${GITHUB_ORG}" ]]; then
  AUDIOFORGE_REGISTRY="${AUDIOFORGE_REGISTRY_DEFAULT}"
fi

if [[ -z "${AUDIOFORGE_REGISTRY}" && -z "${AUDIOFORGE_IMAGE_PREFIX}" ]]; then
  AUDIOFORGE_REGISTRY="ghcr.io/${GITHUB_ORG:-audioforge}"
fi
AUDIOFORGE_IMAGE_PREFIX="${AUDIOFORGE_IMAGE_PREFIX:-}"
if [[ -n "${AUDIOFORGE_IMAGE_PREFIX}" ]]; then
  IMAGE_NAME_PREFIX="${AUDIOFORGE_IMAGE_PREFIX}"
elif [[ -n "${AUDIOFORGE_REGISTRY}" ]]; then
  IMAGE_NAME_PREFIX="${AUDIOFORGE_REGISTRY%/}/${IMAGE_NAMESPACE}"
else
  echo "AUDIOFORGE_REGISTRY or AUDIOFORGE_IMAGE_PREFIX is required for registry deployment"
  exit 1
fi

export AUDIOFORGE_IMAGE_TAG="${IMAGE_TAG}"
export AUDIOFORGE_IMAGE_NAME_PREFIX="${IMAGE_NAME_PREFIX}"

LOCAL_REGISTRY="${AUDIOFORGE_REGISTRY}"
LOCAL_REGISTRY_USERNAME="${AUDIOFORGE_REGISTRY_USERNAME:-}"
LOCAL_REGISTRY_PASSWORD="${AUDIOFORGE_REGISTRY_PASSWORD:-}"

REMOTE_REGISTRY="${AUDIOFORGE_REMOTE_REGISTRY:-${AUDIOFORGE_REGISTRY}}"
REMOTE_REGISTRY_USERNAME="${AUDIOFORGE_REMOTE_REGISTRY_USERNAME:-${AUDIOFORGE_REGISTRY_USERNAME:-}}"
REMOTE_REGISTRY_PASSWORD="${AUDIOFORGE_REMOTE_REGISTRY_PASSWORD:-${AUDIOFORGE_REGISTRY_PASSWORD:-}}"

if [[ "${AUDIOFORGE_REGISTRY}" == ghcr.io* ]]; then
  if [[ -z "${LOCAL_REGISTRY_USERNAME:-}" && -n "${GH_TOKEN:-}" ]]; then
    LOCAL_REGISTRY_USERNAME="github"
  fi
  if [[ -z "${LOCAL_REGISTRY_PASSWORD:-}" && -n "${GH_TOKEN:-}" ]]; then
    LOCAL_REGISTRY_PASSWORD="${GH_TOKEN}"
  fi
  if [[ -z "${REMOTE_REGISTRY_USERNAME:-}" && -n "${GH_TOKEN:-}" ]]; then
    REMOTE_REGISTRY_USERNAME="github"
  fi
  if [[ -z "${REMOTE_REGISTRY_PASSWORD:-}" && -n "${GH_TOKEN:-}" ]]; then
    REMOTE_REGISTRY_PASSWORD="${GH_TOKEN}"
  fi
fi

REMOTE_USER="${AUDIOFORGE_REMOTE_USER:-ubuntu}"
REMOTE_HOST="${AUDIOFORGE_REMOTE_HOST:-localhost}"
REMOTE_PATH="${AUDIOFORGE_REMOTE_PATH:-/home/ubuntu/audioforge}"
SSH_KEY="${AUDIOFORGE_SSH_KEY:-${HOME}/.ssh/id_ed25519}"
REMOTE_DOCKER_CMD="${AUDIOFORGE_REMOTE_DOCKER_CMD:-sudo -E docker}"
REMOTE_COMPOSE_CMD="${AUDIOFORGE_REMOTE_COMPOSE_CMD:-sudo -E docker-compose}"
REMOTE_DOCKER_CMD_B64="$(printf '%s' "${REMOTE_DOCKER_CMD}" | base64 -w0)"
REMOTE_COMPOSE_CMD_B64="$(printf '%s' "${REMOTE_COMPOSE_CMD}" | base64 -w0)"

BACKEND_IMAGE="${IMAGE_NAME_PREFIX}/backend:${IMAGE_TAG}"
WORKER_IMAGE="${IMAGE_NAME_PREFIX}/celery-worker:${IMAGE_TAG}"
FRONTEND_IMAGE="${IMAGE_NAME_PREFIX}/frontend:${IMAGE_TAG}"

COMPOSE_FILE="docker-compose.runtime.yml"
REMOTE_FRONTEND_HOST_PORT="${AUDIOFORGE_REMOTE_FRONTEND_HOST_PORT:-80}"

if ! command -v docker >/dev/null 2>&1; then
  echo "docker is required on this machine"
  exit 1
fi

if ! command -v ssh >/dev/null 2>&1; then
  echo "ssh is required on this machine"
  exit 1
fi

echo "=== Resolving image naming ==="
echo "  IMAGE_TAG: ${IMAGE_TAG}"
echo "  IMAGE_NAME_PREFIX: ${IMAGE_NAME_PREFIX}"

if [[ -n "${LOCAL_REGISTRY}" && -n "${LOCAL_REGISTRY_USERNAME}" && -n "${LOCAL_REGISTRY_PASSWORD}" ]]; then
  echo "=== Logging in to registry locally ==="
  printf '%s' "${LOCAL_REGISTRY_PASSWORD}" | docker login --username "${LOCAL_REGISTRY_USERNAME}" --password-stdin "${LOCAL_REGISTRY}"
fi

echo "=== Building images locally using registry tags ==="
docker compose -f deployment/docker-compose.prod.yml build backend celery-worker frontend

docker_push_with_hint() {
  local image="$1"

  if ! docker push "${image}"; then
    if [[ "${AUDIOFORGE_REGISTRY}" == ghcr.io* ]]; then
      echo "Failed pushing ${image}." >&2
      echo "GitHub Container Registry expects a token with write:packages scope (and repo access)." >&2
      echo "Set a PAT as GH_TOKEN or AUDIOFORGE_REGISTRY_PASSWORD and retry." >&2
    else
      echo "Failed pushing ${image}." >&2
    fi
    exit 1
  fi
}

echo "=== Pushing images to registry ==="
docker_push_with_hint "${BACKEND_IMAGE}"
docker_push_with_hint "${WORKER_IMAGE}"
docker_push_with_hint "${FRONTEND_IMAGE}"

echo "=== Copying runtime compose file to ${REMOTE_USER}@${REMOTE_HOST} ==="
ssh -i "${SSH_KEY}" "${REMOTE_USER}@${REMOTE_HOST}" "mkdir -p \"${REMOTE_PATH}\""
scp -i "${SSH_KEY}" "${SCRIPT_DIR}/${COMPOSE_FILE}" "${REMOTE_USER}@${REMOTE_HOST}:${REMOTE_PATH}/${COMPOSE_FILE}"

echo "=== Logging in and pulling containers on VM ==="
ssh -i "${SSH_KEY}" "${REMOTE_USER}@${REMOTE_HOST}" /bin/bash -s -- \
  "${AUDIOFORGE_IMAGE_NAME_PREFIX}" \
  "${AUDIOFORGE_IMAGE_TAG}" \
  "${REMOTE_FRONTEND_HOST_PORT}" \
  "${REMOTE_REGISTRY}" \
  "${REMOTE_REGISTRY_USERNAME}" \
  "${REMOTE_REGISTRY_PASSWORD}" \
  "${REMOTE_PATH}" \
  "${REMOTE_DOCKER_CMD_B64}" \
  "${REMOTE_COMPOSE_CMD_B64}" <<'EOF'
set -euo pipefail

IMAGE_NAME_PREFIX="${1}"
IMAGE_TAG="${2}"
FRONTEND_HOST_PORT="${3}"
REGISTRY="${4}"
REGISTRY_USERNAME="${5}"
REGISTRY_PASSWORD="${6}"
TARGET_PATH="${7}"
REMOTE_DOCKER_CMD="$(printf '%s' "${8}" | base64 -d)"
REMOTE_COMPOSE_CMD="$(printf '%s' "${9}" | base64 -d)"
read -r -a REMOTE_DOCKER_CMD_ARR <<< "${REMOTE_DOCKER_CMD}"
read -r -a REMOTE_COMPOSE_CMD_ARR <<< "${REMOTE_COMPOSE_CMD}"

if [ -n "${REGISTRY}" ] && [ -n "${REGISTRY_USERNAME}" ] && [ -n "${REGISTRY_PASSWORD}" ]; then
  printf '%s' "${REGISTRY_PASSWORD}" | "${REMOTE_DOCKER_CMD_ARR[@]}" login --username "${REGISTRY_USERNAME}" --password-stdin "${REGISTRY}"
fi

mkdir -p "${TARGET_PATH}"
cd "${TARGET_PATH}"

  AUDIOFORGE_IMAGE_NAME_PREFIX="${IMAGE_NAME_PREFIX}" \
  AUDIOFORGE_IMAGE_TAG="${IMAGE_TAG}" \
  AUDIOFORGE_FRONTEND_HOST_PORT="${FRONTEND_HOST_PORT}" \
  "${REMOTE_COMPOSE_CMD_ARR[@]}" -f docker-compose.runtime.yml pull

  AUDIOFORGE_IMAGE_NAME_PREFIX="${IMAGE_NAME_PREFIX}" \
  AUDIOFORGE_IMAGE_TAG="${IMAGE_TAG}" \
  AUDIOFORGE_FRONTEND_HOST_PORT="${FRONTEND_HOST_PORT}" \
  "${REMOTE_COMPOSE_CMD_ARR[@]}" -f docker-compose.runtime.yml up -d --remove-orphans

  for image in "${IMAGE_NAME_PREFIX}/backend:${IMAGE_TAG}" \
    "${IMAGE_NAME_PREFIX}/celery-worker:${IMAGE_TAG}" \
    "${IMAGE_NAME_PREFIX}/frontend:${IMAGE_TAG}"; do
    "${REMOTE_DOCKER_CMD_ARR[@]}" image ls "${image}"
  done

  smoke_check() {
    local name="$1"
    local url="$2"
    local attempts="${3:-30}"
    local delay="${4:-2}"
    local attempt=1

    while (( attempt <= attempts )); do
      if curl -fsS --max-time 5 "${url}" >/dev/null 2>&1; then
        echo "[smoke-check] ${name} is healthy (${url})"
        return 0
      fi

      echo "[smoke-check] Waiting for ${name} (${attempt}/${attempts})"
      sleep "${delay}"
      attempt=$((attempt + 1))
    done

    echo "[smoke-check] ${name} did not become healthy: ${url}" >&2
    return 1
  }

  smoke_check "backend" "http://127.0.0.1:8000/health" 40 2
  smoke_check "frontend" "http://127.0.0.1:${FRONTEND_HOST_PORT}" 40 2

  "${REMOTE_COMPOSE_CMD_ARR[@]}" -f docker-compose.runtime.yml ps
EOF

echo "=== Deployment complete ==="
if [[ "${REMOTE_FRONTEND_HOST_PORT}" == "80" ]]; then
  FRONTEND_URL="http://${REMOTE_HOST}"
else
  FRONTEND_URL="http://${REMOTE_HOST}:${REMOTE_FRONTEND_HOST_PORT}"
fi
echo "Application should be available at:"
echo "  Frontend: ${FRONTEND_URL}"
echo "  Backend:  http://${REMOTE_HOST}:8000"
