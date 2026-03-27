# AudioForge - Agent Guidelines

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
4. **Audio Processing**: Demucs for separation, RNNoise for denoise, fallback to mock if not installed
5. **Frontend Tabs**: Project detail has 3 tabs - Upload, Separate, Mixer
   Upload links to a dedicated composer page for synth-based asset creation
6. **Separation Options**: The Separate tab supports selectable Demucs models (`htdemucs`, `htdemucs_ft`, `mdx`, `mdx_extra`) and output modes (`four_stem`, `two_stem_vocals`)
7. **Admin Jobs Console**: `/admin/jobs` lists all jobs with details and supports admin status overrides for stopping or failing jobs
8. **Dark Mode**: ThemeToggle component for dark/light theme switching
7. **Database**: UUID primary keys, timestamps with UTC, soft deletes via status field

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
   - `context.md` - Quick context summary

2. **Adding Dependencies**:
   - Add Python packages to `backend/requirements.txt`
   - Add Node packages to `frontend/package.json`
   - Document installation steps in README.md

3. **API Changes**: Update README.md API endpoints section when adding/modifying endpoints

4. **New Features**: Document new features in README.md Features section

---

## Troubleshooting: Demucs Audio Separation

### Issue: "FFmpeg is not installed" or "Could not load libtorchcodec"

The Demucs worker uses Python API with soundfile for audio loading (not CLI/ffmpeg). If separation fails:
- Check Celery worker logs for the actual error
- Ensure `demucs` and `soundfile` packages are installed in the venv
- The worker automatically falls back to mock separation if Demucs fails

### Debugging Demucs

```bash
# Test demucs in Python
cd backend
source venv/bin/activate
python -c "
from demucs.pretrained import get_model
from demucs.apply import apply_model
import torch
m = get_model('htdemucs')
print('Model loaded:', m)
"
```

### Mock Separation

If Demucs cannot be used (no GPU, missing dependencies), the system uses mock separation which creates placeholder sine wave audio. This is indicated by logs showing "Using mock separation".

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

All controls update audio in real-time without needing to restart playback.

---

## API Endpoints Added

- `GET /api/v1/assets/{id}/waveform` - Returns waveform peaks for visualization
- `GET /api/v1/assets/{id}/download` - Downloads the asset file

The frontend proxies `/api/v1/*` to the backend via Next.js rewrites in `next.config.js`.

---

## Audio OSS Implementation Guidance

Refer to `audio_oss_implementation_guidance.md` for the recommended audio library stack:

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
