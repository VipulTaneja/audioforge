# Common Patterns

## Create Job (Backend)

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

## Upload Flow (Frontend)

1. POST `/api/v1/assets/presign` → get presigned URL
2. PUT file to S3/MinIO
3. POST `/api/v1/assets/` → create asset record

## Poll Job Status

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

# Environment Variables

```
DATABASE_URL=postgresql+asyncpg://postgres:postgres@localhost:5432/audioforge
REDIS_URL=redis://localhost:6379/0
CELERY_BROKER_URL=redis://localhost:6379/1
MINIO_ENDPOINT=localhost:9000
MINIO_ACCESS_KEY=minioadmin
MINIO_SECRET_KEY=minioadmin
```

---

# Important Reminders

1. Update AGENTS.md when adding dependencies, features, or API endpoints
2. Python packages → `backend/requirements.txt`, Node packages → `frontend/package.json`
3. Frontend proxies `/api/v1/*` to backend on port 8000
4. Run lint and typecheck before committing
5. Use async/await for all database operations
6. Never expose secrets in error messages or logs
7. Use `GH_TOKEN` for GitHub access: `echo $GH_TOKEN | gh auth login --with-token`

---

# VS Code Debugging

Use `.vscode/launch.json` configurations:

- **Python: FastAPI Backend** - Debug API server
- **Python: Celery Worker** - Debug background workers
- **Node: Frontend Dev** - Debug frontend

---

# Audio OSS Stack

- **Media I/O**: PyAV + FFmpeg CLI
- **Simple edits**: PyDub
- **Noise reduction**: noisereduce
- **Stem separation**: Spleeter
- **Effects**: Pedalboard
- Use WAV/PCM internally, separate DSP/ML from core services

---

# Error Handling

- **Backend**: Use FastAPI's `HTTPException`, custom handlers in `app/core/exceptions.py`, log with context, return user-friendly messages
- **Frontend**: Wrap async in try/catch, toast notifications, log with context, handle loading/error/success states

---

# Database Sessions

- Get DB session via dependency injection: `db: AsyncSession = Depends(get_db)`
- Always use `await db.flush()` after `db.add()` to get generated IDs
- Use `await db.refresh(obj, attribute_names=['...'])` before returning
- Use UUIDs for primary keys, UTC timestamps, soft deletes
