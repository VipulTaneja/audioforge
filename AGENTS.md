# AudioForge - Agent Guidelines

<!-- DO NOT REMOVE: This section is mandatory for all GitHub issue implementations -->

## GitHub Issue Workflow (Mandatory)

Follow this process for every GitHub issue:

### Setup
- Check current branch → Create/switch to `fix/issue-00-implementation`

### Context Discovery
- Search codebase for related references (grep/LSP). First do this for backend and then for frontend as well. If required, both backend and frontend changes should be done together. 
- **IMPORTANT**: Always read existing model schemas first before using model fields (e.g., check `backend/app/models/models.py` to verify field names like `filename`, `s3_key`, etc.)
- Check `backend/app/schemas/__init__.py` to verify schema exports

### Execution Plan
- Write detailed step-by-step technical plan
- Identify 2+ potential side effects/breaking changes with mitigation steps

### Implementation
- Apply changes systematically
- **NEW Celery tasks**: If adding a new worker, import it in `backend/app/workers/__init__.py` to ensure auto-discovery
- **New Python dependencies**: Add to `backend/requirements.txt` and install with `pip install -r requirements.txt`
- **Restart services**: When adding new Celery tasks, restart the worker: `pkill -f celery && celery -A app.workers.celery_app worker --loglevel=info`

### Automated Validation
- Run build command (`npm run build` or `make`)
- Run tests (`npm test` or `pytest`)
- Iterate until tests pass
- if test do not pass in 3 iteration, mark as test failed. 

### Runtime Verification (Critical for Workers)
- Always test the actual end-to-end flow, not just unit tests
- Check Celery worker logs for task execution errors: `tail -50 /tmp/audioforge_celery.log`
- Verify new Celery tasks are registered: look for `. tasks.your_task_name` in startup logs
- For audio processing: verify system dependencies (ffmpeg, etc.) are installed or add fallbacks

### If tests failed:
1. Leave comments with deatils of changes you did and issue you faced and anything else that will be relevant to work on this in future.
2. Add tag to the issue as help-wanted. 
3. Summarize what you did and stop working further.


### If tests pass:
1. Final linting check
2. Comment on GitHub issue with summary including:
   - Files created/modified
   - Key implementation details
   - How to test
   - Any known issues or dependencies
3. Udpate documentation - docs/FunctionalFeatures.md, docs/AudioForge-User-Guide.md, docs/project-structure.md
4. Commit the branch with descriptive message
5. Merge to master (`git checkout master && git merge fix/issue-XX-description`)
6. Close the issue (`gh issue close <number>`)

---
### MY COMMITMENTS
THESE ARE VERY IMPORTANT INSTRUCTIONS THAT YOU CAN NOT FORGET OR AVOID.
1. Any promises made to users must be added in this "MY COMMITMENTS" sections and preserved. Do not remove such commitments when trimming this file.
2. Quick Reference section will be used for mentiond topic, any update required for these topics, will be makde in corresponding file and not in agents.md
3. When asked to start AudioForge, ALWAYS use `./start-audioforge.sh` instead of starting components manually


## Quick Reference

Read all the below files and memorize them.

| Topic | File |
|-------|------|
| Tech Stack | Below |
| Build/Lint/Test Commands | Below |
| Code Style | [docs/code-style.md](docs/code-style.md) |
| Project Structure | [docs/project-structure.md](docs/project-structure.md) |
| Common Patterns | [docs/common-patterns.md](docs/common-patterns.md) |
| Testing | [docs/testing.md](docs/testing.md) |

---

## Tech Stack

- **Frontend**: Next.js 16 (React 19) + Tailwind CSS + TypeScript
- **Backend**: FastAPI (Python 3.12)
- **Database**: PostgreSQL (async with SQLAlchemy)
- **Job Queue**: Celery + Redis
- **Storage**: MinIO (S3-compatible)
- **Audio Processing**: Demucs, RNNoise, Essentia, librosa

---

## Build, Lint, and Test Commands

### Frontend
```bash
cd frontend
npm install
npm run dev          # Dev server (port 3000)
npm run lint         # ESLint
npm run lint --fix   # ESLint auto-fix
npx tsc --noEmit     # TypeScript check
npm run build        # Production build (runs typecheck + lint)
npm test             # Run all tests
npm test -- filename.test.ts  # Single test file
npm test -- --watch  # Watch mode
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
