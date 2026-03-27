# AudioForge - Agent Guidelines

## Tech Stack
- **Frontend**: Next.js 16 (React) + Tailwind CSS + TypeScript
- **Backend**: FastAPI (Python 3.12)
- **Database**: PostgreSQL (async with SQLAlchemy)
- **Job Queue**: Celery + Redis
- **Storage**: MinIO (S3-compatible)
- **Audio Processing**: soundfile (audio loading)

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
| `workers/separation.py` | Celery task for audio separation |
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

## Build, Lint, and Test Commands

### Frontend (Next.js)

```bash
cd frontend

# Install dependencies
npm install

# Development server
npm run dev

# Build for production
npm run build

# Lint code
npm run lint

# Run a single test file
npm test -- --testPathPattern=filename.test.ts
```

### Backend (FastAPI)

```bash
cd backend

# Create and activate virtual environment
python3 -m venv venv
source venv/bin/activate

# Install dependencies
pip install -r requirements.txt

# Run database migrations
alembic upgrade head

# Start API server
uvicorn app.main:app --reload --port 8000

# Start Celery worker (required for audio processing)
celery -A app.workers.celery_app worker --loglevel=info
```

### Docker

```bash
# Start infrastructure services
docker-compose up -d postgres redis minio keycloak

# Build and run all services
docker-compose build && docker-compose up -d
```

---

## Code Style Guidelines

### Python (Backend)

**Imports**
- Use absolute imports (e.g., `from app.core.database import get_db`)
- Group imports: standard library → third-party → local application
- Sort alphabetically within groups

**Formatting**
- Maximum line length: 100 characters
- Use 4 spaces for indentation
- Use Black for code formatting when available

**Types**
- Use type hints for all function arguments and return values
- Use Pydantic models for request/response schemas
- Use SQLAlchemy models for database entities

**Naming Conventions**
- `snake_case` for functions, variables, and methods
- `PascalCase` for classes and types
- `UPPER_SNAKE_CASE` for constants
- Prefix private methods with underscore: `_private_method()`

**Error Handling**
- Use `HTTPException` for API errors with appropriate status codes
- Use try/except blocks for operations that may fail
- Log errors with appropriate level (error, warning, info)
- Never expose sensitive information in error messages

**Database**
- Use async SQLAlchemy with asyncpg
- Always use dependency injection for database sessions: `db: AsyncSession = Depends(get_db)`
- Use `await db.flush()` after adding entities, `await db.refresh()` before returning
- Use UUIDs for primary keys

**API Endpoints**
- Follow REST conventions (GET/POST/PUT/DELETE)
- Use appropriate HTTP status codes (200, 201, 204, 404, 500)
- Return Pydantic models as response models
- Use path parameters for resource identifiers

### TypeScript/JavaScript (Frontend)

**Imports**
- Use absolute imports with `@/` prefix (e.g., `import { api } from '@/lib/api'`)
- Group imports: React/next → external libs → internal components → types

**Formatting**
- Use 2 spaces for indentation
- Use single quotes for strings
- Add trailing commas
- Use semicolons

**Types**
- Use TypeScript interfaces for object shapes
- Use explicit types for props and state
- Avoid `any` - use `unknown` if type is truly unknown

**Naming Conventions**
- `camelCase` for variables, functions, and props
- `PascalCase` for components and types
- Use descriptive names (e.g., `isProcessing` not `flag`)

**Components**
- Use functional components with hooks
- Use `'use client'` directive for client-side components
- Extract reusable logic into custom hooks
- Use `useCallback` and `useMemo` for performance optimization when needed

**State Management**
- Use React `useState` for local component state
- Use `useEffect` for side effects
- Clean up subscriptions and timers in `useEffect` cleanup functions

**Error Handling**
- Use try/catch for async operations
- Display user-friendly error messages
- Log errors to console with context

---

## Project Structure

### Backend

```
backend/app/
├── api/           # Route handlers (FastAPI routers)
├── core/          # Config, database, security, storage
├── models/        # SQLAlchemy ORM models
├── schemas/       # Pydantic request/response models
├── services/      # Business logic
└── workers/       # Celery tasks (audio processing)
```

### Frontend

```
frontend/src/
├── app/           # Next.js App Router pages
├── components/    # React components
├── hooks/         # Custom React hooks
├── lib/           # Utilities and API client
└── types/         # TypeScript type definitions
```

---

## Key Conventions

1. **Backend API**: All routes under `/api/v1` prefix
2. **Job Processing**: Jobs are async via Celery; poll status with 2-second interval
3. **File Storage**: Assets stored in MinIO; use presigned URLs for upload/download
4. **Audio Processing**: Soundfile for audio loading, with Celery workers for async processing
5. **Frontend Tabs**: Project detail has 3 tabs - Upload, Separate, Mixer
   Upload links to a dedicated composer page for synth-based asset creation
6. **Separation Options**: The Separate tab supports selectable separation models and output modes
7. **Admin Jobs Console**: `/admin/jobs` lists all jobs with details and supports admin status overrides for stopping or failing jobs
8. **Dark Mode**: ThemeToggle component for dark/light theme switching
7. **Database**: UUID primary keys, timestamps with UTC, soft deletes via status field

## API Endpoints

- `POST /api/v1/projects/` - Create project
- `GET /api/v1/projects/` - List projects
- `POST /api/v1/assets/presign` - Get presigned upload URL
- `POST /api/v1/assets/` - Create asset record
- `GET /api/v1/assets/{id}/waveform` - Get waveform peaks for visualization
- `POST /api/v1/jobs/` - Create job (separate/denoise/etc)
- `GET /api/v1/jobs/{id}/status` - Get job status

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
- Frontend uses real stem audio files for playback (with oscillator fallback)
- Waveform displays actual audio peaks from backend
- Job polling interval: 2 seconds
- Next.js proxies `/api/v1/*` to backend on port 8000

## Frontend Features

### Upload Tab
- Drag-drop file upload
- Progress indicator
- Creates and persists original asset records in the backend
- Links to a dedicated composer page for synth-based assets with scale helpers, phrase presets, preview, and save
- Rich asset workspace with inline rename, audio preview, and batch actions

### Separate Tab
- Select original audio file
- Choose a separation model
- Choose an output mode
- Trigger separation job
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

---

## Common Patterns

### Creating a Job (Backend)
```python
@router.post("/", response_model=JobResponse)
async def create_job(job: JobCreate, db: AsyncSession = Depends(get_db)):
    db_job = Job(project_id=job.project_id, type=job.type.value, params=job.params)
    db.add(db_job)
    await db.flush()
    await db.refresh(db_job)
    # Queue Celery task
    separate_audio.delay(str(db_job.id))
    return db_job
```

### Upload Flow (Frontend)
1. Call `/api/v1/assets/presign` to get presigned URL
2. PUT file to S3/MinIO
3. POST to `/api/v1/assets/` to create asset record

### Polling Job Status
```typescript
const pollInterval = setInterval(async () => {
  const status = await api.getJobStatus(job.id);
  if (status.status === 'succeeded') {
    clearInterval(pollInterval);
    // Handle result
  }
}, 2000);
```

---

## Important Reminders

1. **Update Documentation**: When adding new dependencies, features, or API endpoints, always update:
   - `README.md` - Project documentation
   - `AGENTS.md` - Agent guidelines (this file)

2. **Adding Dependencies**:
   - Add Python packages to `backend/requirements.txt`
   - Add Node packages to `frontend/package.json`
   - Document installation steps in README.md

3. **API Changes**: Update README.md API endpoints section when adding/modifying endpoints

4. **New Features**: Document new features in README.md Features section

---

## Frontend Mixer Controls

The mixer in the frontend provides real-time audio control:

- **Mute (VolumeX/Volume2 icon)**: Toggles mute on/off for a track
- **Solo (Headphones icon)**: Exclusive solo - when enabled, only that track plays (all others are deselected)
- **Selection checkbox**: Enables/disables playback for a track in real-time
- **Track Meters**: Show live per-track levels while audio is playing
- **Master Output**: Provides overall output volume control and master metering
- **Quick Actions**: Reset the mix, clear solo state, or unmute all tracks quickly
- **Waveform**: Displays actual audio peaks from the backend `/api/v1/assets/{id}/waveform` endpoint
- **Playhead (red line)**: Drag horizontally to seek to any position in the timeline

All controls update audio in real-time without needing to restart playback.

---

## API Endpoints Added

- `GET /api/v1/assets/{id}/waveform` - Returns waveform peaks for visualization
- `GET /api/v1/assets/{id}/download` - Downloads the asset file

The frontend proxies `/api/v1/*` to the backend via Next.js rewrites in `next.config.js`.

---

## Audio OSS Implementation Guidance

Refer to `docs/audio_oss_implementation_guidance.md` for the recommended audio library stack:

- **Media I/O**: PyAV + FFmpeg CLI (NOT librosa/torchaudio as core)
- **Simple edits**: PyDub
- **Noise reduction**: noisereduce
- **Speech ML**: SpeechBrain + pyannote.audio
- **Stem separation**: Spleeter (NOT Demucs as default - maintenance risk)
- **Effects**: Pedalboard (with license review)

Key principles:
- Use WAV/PCM internally to avoid generational loss
- Keep editing, DSP, and ML inference in separate layers
- Isolate ML services from core product services
- Benchmark on project data, not demo files
