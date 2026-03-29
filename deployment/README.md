# Deployment Strategy

## Why this strategy

AudioForge production/VPS deployment now follows a **registry-first** flow:

- Build container images locally with pinned tags
- Push built images to a registry (default: GHCR)
- Copy only `docker-compose.runtime.yml` to the VM
- On the VM, pull from registry and run `up -d`

This avoids shipping source code to the server and keeps the VM as a thin runtime host.

## Current deployment flow

Primary script: `./deployment/deploy-runtime-to-vm.sh`

Default behavior:

- Resolves image namespace to `ghcr.io/<github-org>/audioforge` unless overridden
- Builds and pushes:
  - `backend`
  - `celery-worker`
  - `frontend`
- Pushes with tag from `AUDIOFORGE_IMAGE_TAG` (default `0.1.0`)
- Copies only `docker-compose.runtime.yml` to VM path
- Logs in remotely using registry credentials if provided
- Runs:
  - `docker-compose -f docker-compose.runtime.yml pull`
  - `docker-compose -f docker-compose.runtime.yml up -d --remove-orphans`
- Verifies runtime with smoke checks:
  - `http://127.0.0.1:8000/health`
  - `http://127.0.0.1:${AUDIOFORGE_REMOTE_FRONTEND_HOST_PORT}`

## Required repo files

- `deployment/deploy-runtime-to-vm.sh`
- `deployment/docker-compose.runtime.yml`
- `deployment/docker-compose.prod.yml`
- `deployment/nginx.conf` (nginx reverse proxy config)
- `deployment/README.md`

**Architecture:** Nginx acts as reverse proxy on port 80, routing `/api/*` to backend and all other traffic to frontend.

Note: `README.md` only links to deployment docs; all operational steps now live here.

## Recommended environment variables

```bash
export AUDIOFORGE_REGISTRY=ghcr.io/<org>
export AUDIOFORGE_IMAGE_NAMESPACE=audioforge   # optional, default audioforge
export AUDIOFORGE_IMAGE_TAG=0.1.0

export AUDIOFORGE_REMOTE_USER=ubuntu
export AUDIOFORGE_REMOTE_HOST=<vm-ip-or-host>
export AUDIOFORGE_REMOTE_PATH=/home/ubuntu/audioforge
export AUDIOFORGE_REMOTE_FRONTEND_HOST_PORT=80
export AUDIOFORGE_SSH_KEY=/path/to/ssh-key

export AUDIOFORGE_REMOTE_DOCKER_CMD='sudo -E docker'
export AUDIOFORGE_REMOTE_COMPOSE_CMD='sudo -E docker-compose'

# If GHCR is used, GH_TOKEN is the preferred auth input.
export GH_TOKEN=<github-token-with-write:packages>
```

## Deployment commands

```bash
export GH_TOKEN=<token>
export AUDIOFORGE_REGISTRY=ghcr.io/<your-org-or-user>
export AUDIOFORGE_IMAGE_TAG=0.1.0
./deployment/deploy-runtime-to-vm.sh
```

You can also set:

- `AUDIOFORGE_IMAGE_PREFIX` to fully override image prefix
- `AUDIOFORGE_REMOTE_REGISTRY`, `AUDIOFORGE_REMOTE_REGISTRY_USERNAME`, `AUDIOFORGE_REMOTE_REGISTRY_PASSWORD`

## VM runtime expectations

- Runtime directory should stay minimal (recommended):
  - `/home/ubuntu/audioforge/docker-compose.runtime.yml`
- Docker and Docker Compose v2 tooling must be available.
- If VM has only old compose behavior, install v2-compatible `docker-compose`:

```bash
sudo curl -fsSL https://github.com/docker/compose/releases/download/v2.32.4/docker-compose-linux-aarch64 -o /usr/local/bin/docker-compose
sudo chmod +x /usr/local/bin/docker-compose
```

## Compose image references

Runtime file uses:

- `${AUDIOFORGE_IMAGE_NAME_PREFIX:-audioforge}/backend:${AUDIOFORGE_IMAGE_TAG:-0.1.0}`
- `${AUDIOFORGE_IMAGE_NAME_PREFIX:-audioforge}/celery-worker:${AUDIOFORGE_IMAGE_TAG:-0.1.0}`
- `${AUDIOFORGE_IMAGE_NAME_PREFIX:-audioforge}/frontend:${AUDIOFORGE_IMAGE_TAG:-0.1.0}`

Frontend is mapped as:

- `${AUDIOFORGE_FRONTEND_HOST_PORT:-80}:3000`

## Logging

All services are configured with structured logging using Docker's json-file driver:

- **Log rotation**: 100MB per file, max 10 files per service
- **Log location**: Stored in Docker's default log directory on the VM
- **View logs**: Use the provided `view-logs.sh` script on the VM

### Log Viewing Commands

```bash
# On the VM, use the helper script:
./view-logs.sh backend -f              # Follow backend logs
./view-logs.sh celery-worker -n 100  # Last 100 celery lines
./view-logs.sh frontend --since 30m  # Frontend logs (last 30 min)
./view-logs.sh all -f                  # Follow all services
```

### Manual Log Access

```bash
# View specific service logs
sudo docker-compose -f docker-compose.runtime.yml logs -f backend
sudo docker-compose -f docker-compose.runtime.yml logs -f celery-worker
sudo docker-compose -f docker-compose.runtime.yml logs -f frontend

# View nginx access logs
sudo docker-compose -f docker-compose.runtime.yml logs -f nginx
```

## Recovery steps

- If the wrong command parser/path is used, check `AUDIOFORGE_REMOTE_DOCKER_CMD` and `AUDIOFORGE_REMOTE_COMPOSE_CMD`.
- If `docker-compose` pull/up shows image access errors, verify:
  - token in `GH_TOKEN` has `write:packages` and repo access
  - token is passed as `AUDIOFORGE_REGISTRY_PASSWORD` when needed
- If frontend appears down, check VM compose logs:

```bash
./view-logs.sh frontend -f
```

## Notes for future work

- Keep production images immutable per deployment by bumping `AUDIOFORGE_IMAGE_TAG`.
- Avoid manually copying source or extra artifact files to VM runtime directory.
- Smoke check behavior is inside script; if it fails, inspect logs and service health before retrying.
