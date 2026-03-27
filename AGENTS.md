# AudioForge - Agent Guidelines

## Tech Stack
- **Frontend**: Next.js 16 (React) + Tailwind CSS + TypeScript
- **Backend**: FastAPI (Python 3.12)
- **Database**: PostgreSQL (async with SQLAlchemy)
- **Job Queue**: Celery + Redis
- **Storage**: MinIO (S3-compatible)

## Build, Lint, and Test Commands

### Frontend
```bash
cd frontend
npm install
npm run dev          # Dev server (port 3000)
npm run build        # Production build
npm run lint         # ESLint
npm run lint --fix   # ESLint auto-fix
npx tsc --noEmit     # TypeScript check
npm test             # Run tests
npm test -- filename.test.ts  # Single test
```

### Backend
```bash
cd backend
python3 -m venv venv && source venv/bin/activate
pip install -r requirements.txt
pip install pytest pytest-asyncio httpx
alembic upgrade head
uvicorn app.main:app --reload --port 8000
celery -A app.workers.celery_app worker --loglevel=info
pytest                 # All tests
pytest tests/test_file.py::test_name  # Single test
pytest -v             # Verbose
```

### Docker
```bash
docker-compose up -d postgres redis minio keycloak
docker-compose build && docker-compose up -d
docker-compose down
```

## Code Style Guidelines

### Python (Backend)
- **Imports**: Absolute, group: stdlib → third-party → local, sort alphabetically
- **Formatting**: Max 100 chars/line, 4 spaces, use Black
- **Types**: Type hints for all args/returns, Pydantic for schemas, SQLAlchemy for models
- **Naming**: snake_case (vars/functions), PascalCase (classes), UPPER_SNAKE_CASE (constants)
- **Error Handling**: HTTPException, try/except, log appropriately, never expose secrets
- **Database**: Async SQLAlchemy + asyncpg, dependency injection (`db: AsyncSession = Depends(get_db)`), use `await db.flush()` after add, `await db.refresh()` before return, UUIDs for PKs

### TypeScript/React (Frontend)
- **Imports**: Absolute with `@/` prefix (e.g., `@/lib/api`), group: React/next → libs → components → types
- **Formatting**: 2 spaces, single quotes, trailing commas, semicolons
- **Types**: TypeScript interfaces, explicit props/state, avoid `any`
- **Naming**: camelCase (vars/functions), PascalCase (components/types)
- **Components**: Functional + hooks, `'use client'` for client-side
- **State**: useState (local), useEffect (side effects), cleanup in useEffect
- **Error Handling**: try/catch async ops, user-friendly messages

## Project Structure
```
backend/
├── app/
│   ├── api/        # FastAPI routers
│   ├── core/       # Config, database, security, storage
│   ├── models/     # SQLAlchemy models
│   ├── schemas/    # Pydantic schemas
│   └── workers/    # Celery tasks
├── alembic/        # Database migrations
└── tests/          # Test files

frontend/
├── src/
│   ├── app/        # Next.js App Router
│   ├── components/ # React components
│   ├── hooks/      # Custom hooks
│   ├── lib/        # API client, utilities
│   └── types/      # TypeScript types
├── public/         # Static assets
└── tailwind.config.ts
```

## Key Conventions
- Backend routes under `/api/v1`
- Jobs async via Celery, poll every 2 seconds
- Assets in MinIO, use presigned URLs
- Project detail: 3 tabs (Upload/Separate/Mixer)
- Admin: `/admin/jobs` for job management
- UUID primary keys, UTC timestamps, soft deletes

## Environment Variables
```
DATABASE_URL=postgresql+asyncpg://postgres:postgres@localhost:5432/audioforge
REDIS_URL=redis://localhost:6379/0
CELERY_BROKER_URL=redis://localhost:6379/1
MINIO_ENDPOINT=localhost:9000
MINIO_ACCESS_KEY=minioadmin
MINIO_SECRET_KEY=minioadmin
```

## Common Patterns

### Create Job (Backend)
```python
@router.post("/", response_model=JobResponse)
async def create_job(job: JobCreate, db: AsyncSession = Depends(get_db)):
    db_job = Job(project_id=job.project_id, type=job.type.value, params=job.params)
    db.add(db_job)
    await db.flush()
    await db.refresh(db_job)
    separate_audio.delay(str(db_job.id))
    return db_job
```

### Upload Flow (Frontend)
1. POST `/api/v1/assets/presign` → get presigned URL
2. PUT file to S3/MinIO
3. POST `/api/v1/assets/` → create asset record

### Poll Job Status
```typescript
const pollInterval = setInterval(async () => {
  const status = await api.getJobStatus(job.id);
  if (status.status === 'succeeded') {
    clearInterval(pollInterval);
    // Handle result
  }
}, 2000);
```

## Important Reminders
1. Update AGENTS.md when adding dependencies, features, or API endpoints
2. Python packages → `backend/requirements.txt`, Node packages → `frontend/package.json`
3. Frontend proxies `/api/v1/*` to backend on port 8000
4. Run lint and typecheck before committing
5. Use async/await for all database operations
6. Never expose secrets in error messages or logs
7. Use `GH_TOKEN` for GitHub access: `echo $GH_TOKEN | gh auth login --with-token`

## Audio OSS Stack
- **Media I/O**: PyAV + FFmpeg CLI
- **Simple edits**: PyDub
- **Noise reduction**: noisereduce
- **Stem separation**: Spleeter
- **Effects**: Pedalboard
- Use WAV/PCM internally, separate DSP/ML from core services

## Testing Guidelines
- **Backend**: pytest + pytest-asyncio, test files in `backend/tests/`, use `httpx.AsyncClient`, naming: `test_module_name.py`
- **Frontend**: Tests alongside components (`filename.test.ts`), React Testing Library, mock API with MSW

## Error Handling
- **Backend**: Use FastAPI's `HTTPException`, custom handlers in `app/core/exceptions.py`, log with context, return user-friendly messages
- **Frontend**: Wrap async in try/catch, toast notifications, log with context, handle loading/error/success states
