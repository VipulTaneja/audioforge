# AudioForge - Project Context

## Overview
AI-Powered Audio Processing Platform - Source separation, noise reduction, voice conversion, and professional mixing.

## Tech Stack
- **Frontend**: Next.js 16 (React) + Tailwind CSS + TypeScript
- **Backend**: FastAPI (Python 3.12)
- **Database**: PostgreSQL (async with SQLAlchemy)
- **Job Queue**: Celery + Redis
- **Storage**: MinIO (S3-compatible)
- **Audio Processing**: Demucs (separation), soundfile (audio loading)

## Key Files

### Backend (`backend/app/`)
| File | Purpose |
|------|---------|
| `main.py` | FastAPI app, CORS, router setup |
| `models/models.py` | SQLAlchemy models (User, Org, Project, Asset, Job, MixSession) |
| `schemas/schemas.py` | Pydantic schemas for API request/response |
| `api/projects.py` | Project CRUD endpoints |
| `api/assets.py` | Asset management + presigned URL + waveform endpoint |
| `api/jobs.py` | Job creation + status polling |
| `workers/separation.py` | Celery task for Demucs audio separation (Python API) |
| `core/storage.py` | MinIO/S3 client for file operations |
| `core/database.py` | Async SQLAlchemy session setup |

### Frontend (`frontend/src/`)
| File | Purpose |
|------|---------|
| `app/projects/page.tsx` | Project list with create modal |
| `app/projects/[id]/page.tsx` | Project detail with 3 tabs (Upload/Separate/Mixer) |
| `app/admin/jobs/page.tsx` | Admin jobs console for status review and overrides |
| `lib/api.ts` | API service for all backend calls |

## Data Model

```
User → OrgMember → Org
Org → Project
Project → Asset, Job, MixSession
Asset (parent_asset_id) → Asset (stems)
```

**Asset types**: `original`, `stem`, `mix`, `preset`
**Job types**: `separate`, `denoise`, `rvc`, `tts_sing`, `mixdown`, `instrument_id`, `spatialize`
**Job status**: `pending`, `running`, `succeeded`, `failed`

## API Endpoints

- `POST /api/v1/projects/` - Create project
- `GET /api/v1/projects/` - List projects
- `POST /api/v1/assets/presign` - Get presigned upload URL
- `POST /api/v1/assets/` - Create asset record
- `GET /api/v1/assets/{id}/waveform` - Get waveform peaks for visualization
- `POST /api/v1/jobs/` - Create job (separate/denoise/etc)
- `GET /api/v1/jobs/{id}/status` - Get job status

## Frontend Features

### Upload Tab
- Drag-drop file upload
- Progress indicator
- Creates and persists original asset records in the backend
- Links to a dedicated composer page for synth-based assets with scale helpers, phrase presets, preview, and save
- Rich asset workspace with inline rename, audio preview, and batch actions

### Separate Tab
- Select original audio file
- Choose a Demucs model (`htdemucs`, `htdemucs_ft`, `mdx`, `mdx_extra`)
- Choose an output mode (`four_stem` or `two_stem_vocals`)
- `four_stem` is restricted to HT Demucs variants for reliable multi-stem output
- Trigger Demucs separation job
- Poll job status, show progress
- Separated stems are persisted as project assets and reloaded into the mixer

### Mixer Tab
- 4 stem tracks (vocals, drums, bass, other)
- Per-stem: volume slider, pan slider, mute (VolumeX/Volume2 icon), solo (Headphones icon)
- Per-track live level meters during playback
- Master output section with overall volume control and output metering
- Quick actions to reset the mix, unmute all tracks, and clear solo state
- Real waveform visualization from actual audio files
- Real-time mute/solo/selection controls (no restart needed)
- Exclusive solo: clicking solo deselects all other tracks

### Admin Jobs Page
- View all jobs across projects
- Filter/search jobs by status, ID, project, or type
- Inspect job params, results, timestamps, and errors
- Stop pending/running jobs or mark any job as failed from the admin console

## Running the App

```bash
# Backend
cd backend
pip install -r requirements.txt
alembic upgrade head
uvicorn app.main:app --reload --port 8000

# Celery worker (separate terminal)
celery -A app.workers.celery_app worker --loglevel=info

# Frontend
cd frontend
npm install
npm run lint
npm run dev
```

## Environment Variables (Backend)
```
DATABASE_URL=postgresql+asyncpg://postgres:postgres@localhost:5432/audioforge
REDIS_URL=redis://localhost:6379/0
CELERY_BROKER_URL=redis://localhost:6379/1
MINIO_ENDPOINT=localhost:9000
MINIO_ACCESS_KEY=minioadmin
MINIO_SECRET_KEY=minioadmin
```

## Important Notes
- Default user/org created automatically if none exist
- Demucs uses Python API with soundfile (not ffmpeg)
- Frontend uses real stem audio files for playback (with oscillator fallback)
- Waveform displays actual audio peaks from backend
- Job polling interval: 2 seconds
- Next.js proxies `/api/v1/*` to backend on port 8000

## Dependencies
- **Backend**: fastapi, uvicorn, sqlalchemy, asyncpg, celery, boto3, demucs, soundfile, scipy, numpy, librosa
- **Frontend**: next, react, tailwindcss, lucide-react, eslint, eslint-config-next
