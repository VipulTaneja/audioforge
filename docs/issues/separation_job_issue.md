# Separation Job Implementation Issue - Spleeter Integration

## Problem
When creating a separation job using Spleeter (via the "separator": "spleeter" param), the Celery worker does not pick up the task. The job remains in "pending" status and never executes.

## Root Cause
The Celery worker was not aware of the new `tasks.separate_audio_spleeter` task because:
1. The task was added to `separation.py` but the worker hadn't been restarted to pick up the new task definition
2. Additionally, there may be multiple Celery worker processes running with stale configurations

## Evidence from Celery Logs
```
[2026-03-27 05:56:42,029: ERROR/MainProcess] Received unregistered task of type 'tasks.separate_audio_spleeter'.
The message has been ignored and discarded.

Did you remember to import the module containing this task?
Or maybe you're using relative imports?
```

## Solution Steps for Agent

### 1. Restart Celery Worker
```bash
# Kill all existing Celery processes
pkill -f "celery.*audioforge"

# Start fresh Celery worker
cd backend
source venv/bin/activate
celery -A app.workers.celery_app worker --loglevel=info
```

### 2. Verify Task Registration
```bash
cd backend
source venv/bin/activate
celery -A app.workers.celery_app inspect registered
```
Should show both:
- tasks.separate_audio_demucs
- tasks.separate_audio_spleeter

### 3. Test Spleeter Job
Create a test job and verify it starts executing:
```bash
curl -X POST http://localhost:8000/api/v1/jobs/ \
  -H "Content-Type: application/json" \
  -d '{
    "project_id":"<PROJECT_ID>",
    "type":"separate",
    "asset_ids":["<ASSET_ID>"],
    "params":{"separator":"spleeter","stem_mode":"four_stem"}
  }'
```

## Files Modified

### Backend
1. **backend/app/workers/separation.py**
   - Added `separate_audio_spleeter` Celery task (lines ~540-727)
   - Added `run_spleeter` helper function (lines ~698-727)

2. **backend/app/api/jobs.py**
   - Updated validation logic to accept "spleeter" as separator option (lines 41-57)
   - Added dispatch logic to route to spleeter task when separator="spleeter" (lines 83-87)

3. **backend/requirements.txt**
   - Added `spleeter` package
   - Added `tensorflow` package (Spleeter dependency)

### Frontend
4. **frontend/src/app/projects/[id]/page.tsx**
   - Added `separator` state variable (line 233)
   - Added separator selection UI (Demucs vs Spleeter buttons) (lines ~1966-2012)
   - Updated job creation to include separator param (lines ~591-598)
   - Conditionally show Demucs model picker only when Demucs is selected
   - Updated status display to show separator info

## Key Implementation Details

### Job Dispatch Logic (jobs.py)
```python
if job.type == "separate" and job.params:
    params = dict(job.params)
    separator = params.get("separator", "demucs")
    if separator == "spleeter":
        job_type_handlers["separate"] = "tasks.separate_audio_spleeter"
```

### Spleeter Task (separation.py)
- Uses `spleeter:4stems` model for 4-stem separation
- Falls back to mock_separate if Spleeter is unavailable
- Creates stem assets in database similar to Demucs task

## Testing Checklist
- [ ] Verify Celery worker has both tasks registered
- [ ] Create Spleeter job from frontend
- [ ] Confirm job status changes from "pending" to "running"
- [ ] Confirm separation completes successfully
- [ ] Verify stems are created in database
- [ ] Verify Demucs still works as before

## Notes
- The worker must be restarted whenever new tasks are added to Celery
- Multiple worker processes may exist - ensure all are killed before restarting
- Use `celery inspect registered` to verify task registration