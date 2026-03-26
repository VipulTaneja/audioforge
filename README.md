# AudioForge

AI-Powered Audio Processing Platform - Source separation, noise reduction, voice conversion, and professional mixing.

## Overview

AudioForge is a full-stack SaaS platform for AI-powered audio processing. It enables users to upload audio files, separate them into stems (vocals, drums, bass, other), reduce noise, convert voices, and create professional mixes with real-time web preview.

## Features

- **Source Separation** - Split audio into stems using selectable Demucs models and output modes
- **Noise Reduction** - Clean audio using RNNoise
- **Voice Conversion** - Transform voices with RVC (Phase 2)
- **Professional Mixing** - Volume, pan, mute, metering, and master output control with real-time preview
- **Project Asset Library** - Persist uploaded originals and separated stems as project assets
- **Asset Workspace** - Preview, rename, batch-select, and manage project assets from a polished workspace view
- **Admin Jobs Console** - Inspect all jobs, review payload/result details, and administratively stop or fail problematic jobs
- **Multi-channel Export** - Export to stereo, 5.1, 7.1, or binaural
- **Web Interface** - Modern Next.js frontend with dark mode

## Tech Stack

| Layer | Technology |
|-------|------------|
| Frontend | Next.js 16 (React) + Tailwind CSS + TypeScript |
| Backend | FastAPI (Python 3.12) |
| Database | PostgreSQL (async SQLAlchemy) |
| Job Queue | Celery + Redis |
| Object Storage | MinIO (S3-compatible) |
| Audio Processing | Demucs, RNNoise, Essentia |

## Project Structure

```
.
├── frontend/                    # Next.js 16 application
│   ├── src/
│   │   ├── app/               # App Router pages
│   │   │   ├── projects/      # Project list & detail pages
│   │   │   └── page.tsx       # Home page
│   │   ├── components/        # React components
│   │   ├── hooks/             # Custom hooks
│   │   ├── lib/               # Utilities & API client
│   │   └── types/             # TypeScript types
│   ├── package.json
│   └── tailwind.config.ts
├── backend/                     # FastAPI application
│   ├── app/
│   │   ├── api/               # API routes
│   │   │   ├── users.py       # User endpoints
│   │   │   ├── orgs.py        # Organization endpoints
│   │   │   ├── projects.py    # Project CRUD
│   │   │   ├── assets.py      # Asset management + presigned URLs
│   │   │   ├── jobs.py        # Job creation & status
│   │   │   ├── mix_sessions.py # Mix session management
│   │   │   └── websocket.py   # Real-time updates
│   │   ├── core/              # Config, database, security, storage
│   │   ├── models/            # SQLAlchemy models
│   │   ├── schemas/           # Pydantic schemas
│   │   ├── services/          # Business logic
│   │   └── workers/           # Celery tasks
│   │       ├── separation.py  # Demucs audio separation
│   │       ├── denoise.py     # Noise reduction
│   │       └── instrument_id.py # Instrument identification
│   ├── requirements.txt
│   └── main.py                # FastAPI app entry point
├── docker-compose.yml          # Local development services
├── Dockerfile.frontend
├── Dockerfile.backend
├── Dockerfile.worker
└── README.md
```

## Prerequisites

- Node.js 18+
- Python 3.10+
- Docker & Docker Compose
- PostgreSQL 15+
- Redis 6+
- MinIO (or AWS S3)

## Quick Start

### 1. Start Infrastructure

```bash
docker-compose up -d postgres redis minio keycloak
```

### 2. Backend Setup

```bash
cd backend

# Create virtual environment (one time)
python3 -m venv venv
source venv/bin/activate

# Install dependencies (one time)
pip install -r requirements.txt

# Run database migrations (one time)
alembic upgrade head
```

**Start the API server (Terminal 1):**
```bash
source venv/bin/activate
uvicorn app.main:app --reload --port 8000
```

**Start the Celery worker (Terminal 2):**
```bash
source venv/bin/activate
celery -A app.workers.celery_app worker --loglevel=info
```

> **Note:** Both the API server and Celery worker must be running for audio processing (separation, denoise, etc.) to work.

### 3. Frontend Setup

```bash
cd frontend

# Install dependencies (one time)
npm install

# Lint the frontend
npm run lint

# Start development server
npm run dev
```

### URLs

| Service | URL |
|---------|-----|
| Frontend | http://localhost:3000 |
| API | http://localhost:8000 |
| Swagger Docs | http://localhost:8000/docs |
| MinIO Console | http://localhost:9001 |

## Data Model

```
User → OrgMember → Org
Org → Project
Project → Asset, Job, MixSession
Asset (parent_asset_id) → Asset (stems)
```

### Entity Types

| Entity | Description |
|--------|-------------|
| **User** | Authenticated user with email and name |
| **Org** | Organization with plan (free/pro/enterprise) |
| **Project** | Container for assets and jobs within an org |
| **Asset** | Audio file with type (original/stem/mix/preset) |
| **Job** | Background task with status (pending/running/succeeded/failed) |
| **MixSession** | Mix graph for combining stems |

### Asset Types

- `original` - Uploaded source audio
- `stem` - Separated track (vocals, drums, bass, other)
- `mix` - Final mixed output
- `preset` - Saved mix configuration

### Job Types

| Type | Description |
|------|-------------|
| `separate` | Source separation (Demucs) |
| `denoise` | Noise reduction (RNNoise) |
| `rvc` | Voice conversion |
| `tts_sing` | Text-to-sing |
| `mixdown` | Mix to stereo |
| `instrument_id` | Identify instruments |
| `spatialize` | Multi-channel spatialization |

### Job Status

| Status | Description |
|--------|-------------|
| `pending` | Job queued, waiting to start |
| `running` | Job currently processing |
| `succeeded` | Job completed successfully |
| `failed` | Job failed with error |

## API Endpoints

### Health

| Method | Endpoint | Description |
|--------|----------|-------------|
| GET | `/` | API root |
| GET | `/health` | Health check |
| GET | `/api/v1` | API info |

### Users

| Method | Endpoint | Description |
|--------|----------|-------------|
| POST | `/api/v1/users/` | Create user |
| GET | `/api/v1/users/` | List users |
| GET | `/api/v1/users/{id}` | Get user |

### Organizations

| Method | Endpoint | Description |
|--------|----------|-------------|
| POST | `/api/v1/orgs/` | Create org |
| GET | `/api/v1/orgs/` | List orgs |
| GET | `/api/v1/orgs/{id}` | Get org |

### Projects

| Method | Endpoint | Description |
|--------|----------|-------------|
| POST | `/api/v1/projects/` | Create project |
| GET | `/api/v1/projects/` | List projects |
| GET | `/api/v1/projects/{id}` | Get project |
| DELETE | `/api/v1/projects/{id}` | Delete project |

### Assets

| Method | Endpoint | Description |
|--------|----------|-------------|
| POST | `/api/v1/assets/presign` | Get presigned upload URL |
| POST | `/api/v1/assets/` | Create asset |
| GET | `/api/v1/assets/` | List assets |
| GET | `/api/v1/assets/{id}` | Get asset |
| GET | `/api/v1/assets/{id}/download` | Download asset file |
| GET | `/api/v1/assets/{id}/waveform` | Get waveform peaks for visualization |
| DELETE | `/api/v1/assets/{id}` | Delete asset |

### Jobs

| Method | Endpoint | Description |
|--------|----------|-------------|
| POST | `/api/v1/jobs/` | Create job |
| GET | `/api/v1/jobs/` | List jobs |
| GET | `/api/v1/jobs/{id}` | Get job status |

### Mix Sessions

| Method | Endpoint | Description |
|--------|----------|-------------|
| POST | `/api/v1/mix-sessions/` | Create mix session |
| GET | `/api/v1/mix-sessions/{id}` | Get session |
| PUT | `/api/v1/mix-sessions/{id}` | Update mix graph |
| POST | `/api/v1/mix-sessions/{id}/render` | Render mix |

## API Documentation

FastAPI auto-generates documentation:

- **Swagger UI**: http://localhost:8000/docs
- **ReDoc**: http://localhost:8000/redoc

## Environment Variables (Backend)

```bash
DATABASE_URL=postgresql+asyncpg://postgres:postgres@localhost:5432/audioforge
REDIS_URL=redis://localhost:6379/0
CELERY_BROKER_URL=redis://localhost:6379/1
MINIO_ENDPOINT=localhost:9000
MINIO_ACCESS_KEY=minioadmin
MINIO_SECRET_KEY=minioadmin
```

## Frontend Features

### Project List Page
- Display all projects with name and creation date
- Create new project modal
- Navigate to project detail

### Project Detail Page - 3 Tabs

**Upload Tab**
- Drag-drop file upload
- Progress indicator
- Creates asset record in backend
- Links to a dedicated asset composer for creating musical assets from instrument, scale, phrase presets, note sequence, tempo, and note length

**Separate Tab**
- Select original audio file
- Choose a Demucs model (`htdemucs`, `htdemucs_ft`, `mdx`, or `mdx_extra`)
- Choose an output mode (`4 stems` or `vocals + accompaniment`)
- `4 stems` is limited to HT Demucs variants because MDX-style models are used here for vocals/rest-style extraction
- Trigger Demucs separation job
- Poll job status, show progress

**Mixer Tab**
- 4 stem tracks (vocals, drums, bass, other)
- Per-stem: volume slider, pan slider, mute (VolumeX/Volume2 icon), solo (Headphones icon)
- Real waveform visualization from actual audio files
- Real-time mute/solo/selection controls (no playback restart needed)
- Exclusive solo: clicking solo deselects all other tracks

### Admin Jobs Page
- View all jobs across projects
- Filter by status and search by job ID, project ID, or type
- Review params, result payloads, timestamps, and errors
- Stop in-flight jobs or mark jobs as failed from the UI

## Example: Create a Separation Job

```bash
curl -X POST http://localhost:8000/api/v1/jobs/ \
  -H "Content-Type: application/json" \
  -d '{
    "project_id": "uuid-here",
    "type": "separate",
    "asset_ids": ["asset-uuid"],
    "params": {
      "demucs_model": "htdemucs_ft",
      "stem_mode": "two_stem_vocals"
    }
  }'
```

## System Architecture

```
┌─────────────────────────────────────────────────────────────────────┐
│                          Client (Browser)                           │
│  Next.js │ WebAudio │ Tone.js │ ffmpeg.wasm │ Socket.IO Client    │
└────────────────────────────┬────────────────────────────────────────┘
                             │ HTTPS
                             ▼
┌─────────────────────────────────────────────────────────────────────┐
│                        Traefik (API Gateway)                         │
│              Rate Limiting │ Auth │ mTLS │ Routing                   │
└──────┬─────────────────────────┬────────────────────────────────────┘
       │                         │
       ▼                         ▼
┌──────────────────┐     ┌────────────────────────────────────────────┐
│   Keycloak       │     │         FastAPI (BFF Layer)                │
│   (IAM/SSO)      │     │  Auth │ RBAC │ Quotas │ Job Orchestration  │
└──────────────────┘     └──────────────┬─────────────────────────────┘
                                        │
       ┌───────────────────┬────────────┼────────────┬───────────────┐
       ▼                   ▼            ▼            ▼               ▼
┌────────────┐     ┌───────────┐  ┌─────────┐  ┌─────────┐  ┌──────────┐
│ PostgreSQL │     │   Redis   │  │  MinIO  │  │ Celery  │  │ WebSocket│
│ (Metadata) │     │ (Cache)   │  │ (Files) │  │ (Queue) │  │  Server  │
└────────────┘     └───────────┘  └─────────┘  └────┬────┘  └──────────┘
                                                   │
                    ┌──────────────────────────────┼──────────────────┐
                    ▼                              ▼                  ▼
            ┌──────────────┐              ┌─────────────────┐  ┌──────────┐
            │  CPU Workers │              │  GPU Workers    │  │  Triton  │
            │ (ffmpeg/EQ)  │              │ (Demucs/RVC)    │  │ (Models) │
            └──────────────┘              └─────────────────┘  └──────────┘
```

## Docker Deployment

```bash
# Build images
docker-compose build

# Start all services
docker-compose up -d

# View logs
docker-compose logs -f
```

## VS Code Debugging

For VS Code debugging, use the `.vscode/launch.json` configurations:

- **Python: FastAPI Backend** - Debug API server
- **Python: Celery Worker** - Debug background workers
- **Node: Frontend Dev** - Debug frontend

## Installing Audio Processing Dependencies

For actual audio separation and processing, install the required packages:

```bash
cd backend
pip install -r requirements.txt
```

This installs:
- **Demucs** - AI-powered source separation (extracts vocals, drums, bass, other)
- **soundfile** - For reading audio files (used instead of ffmpeg for compatibility)
- **scipy** - For audio processing operations

### Demucs Setup Notes

The system uses Demucs via its Python API with soundfile for audio loading (not ffmpeg/torchcodec due to CUDA library compatibility issues on some systems).

If Demucs fails to load, the worker will fall back to mock separation (creates placeholder audio files).

> **Note:** 
> - Demucs requires ~4GB of disk space for models
> - On CPU-only systems, separation will take longer (can be 5-10+ minutes per track)
> - GPU is recommended for faster processing

## License

MIT
