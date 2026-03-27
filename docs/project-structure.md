# Project Structure

## Backend
```
backend/
├── app/
│   ├── api/        # FastAPI routers
│   ├── core/       # Config, database, security, storage
│   ├── models/     # SQLAlchemy models
│   ├── schemas/    # Pydantic schemas
│   ├── services/   # Business logic
│   └── workers/    # Celery tasks
│       ├── separation.py  # Demucs audio separation
│       ├── denoise.py     # Noise reduction
│       └── instrument_id.py # Instrument identification
├── alembic/        # Database migrations
└── tests/          # Test files
```

## Frontend
```
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
