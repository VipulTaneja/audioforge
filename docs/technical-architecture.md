# AudioForge Technical Architecture

## Executive Summary

AudioForge is a full-stack audio processing platform built on a microservices-inspired architecture using FastAPI (Python), Next.js (TypeScript/React), PostgreSQL, Redis/Celery, and MinIO for S3-compatible storage. The platform provides source separation, noise reduction, and real-time audio mixing capabilities with a modern web interface.

This document provides a detailed technical overview for engineers evaluating the system architecture, identifying potential improvements, and understanding the communication patterns between components.

---

## System Overview

```
┌─────────────────────────────────────────────────────────────────────────────┐
│                           CLIENT LAYER                                       │
│  ┌──────────────────────────────────────────────────────────────────────┐    │
│  │                     Next.js 16 Frontend                              │    │
│  │   • App Router (React Server Components)                           │    │
│  │   • Web Audio API (real-time mixing, metering)                     │    │
│  │   • Tailwind CSS + TypeScript                                       │    │
│  └──────────────────────────────────────────────────────────────────────┘    │
└────────────────────────────────────┬────────────────────────────────────────┘
                                     │
                    ┌────────────────┴────────────────┐
                    │       Reverse Proxy / API Gateway
                    │         (Next.js rewrites)
                    │    /api/v1/* → localhost:8000
                    └────────────────┬────────────────┘
                                     │
┌────────────────────────────────────┴────────────────────────────────────────┐
│                           BACKEND LAYER                                      │
│  ┌─────────────────────────────────────────────────────────────────────┐   │
│  │                    FastAPI Application                                │   │
│  │   • Async SQLAlchemy ORM                                           │   │
│  │   • Pydantic schemas for validation                                │   │
│  │   • REST API endpoints                                            │   │
│  │   • JWT authentication (python-jose)                               │   │
│  └─────────────────────────────────────────────────────────────────────┘   │
└────────────────────────────────────┬────────────────────────────────────────┘
                                     │
         ┌───────────────────────────┼───────────────────────────┐
         │                           │                           │
         ▼                           ▼                           ▼
┌─────────────────┐       ┌─────────────────┐       ┌─────────────────┐
│   PostgreSQL    │       │      Redis       │       │     MinIO      │
│  (asyncpg)      │       │  (Celery broker) │       │   (S3 storage)  │
└─────────────────┘       └─────────────────┘       └─────────────────┘
                                     │
                    ┌────────────────┴────────────────┐
                    │       Celery Workers             │
                    │   • separation (Demucs/Spleeter)│
                    │   • denoise (noisereduce)       │
                    │   • instrument_id               │
                    └─────────────────────────────────┘
```

---

## Component Analysis

### 1. Frontend (Next.js 16 + React)

**Technology Stack:**
- Next.js 16 with App Router
- React 18 with Server Components
- TypeScript 5.x
- Tailwind CSS 3.x
- Lucide React (icons)

**Architecture:**

The frontend uses a single-page application pattern within the Next.js framework. Key architectural decisions:

1. **Routing**: App Router (`/app`) with dynamic routes for projects (`/projects/[id]`)
2. **State Management**: React `useState`, `useRef`, `useCallback` for local state; no global state library
3. **API Communication**: Custom `api.ts` module with `fetch` wrapper
4. **Audio Processing**: Web Audio API for real-time mixing, metering, and effects

**Key Components:**

```
frontend/src/
├── app/projects/[id]/page.tsx    # Main project detail (3000+ lines)
├── components/
│   ├── Waveform.tsx              # Canvas-based waveform visualization
│   └── ThemeToggle.tsx           # Dark mode toggle
├── lib/
│   ├── api.ts                    # API client with fetch wrapper
│   ├── datetime.ts               # Date formatting utilities
│   └── generated-asset.ts        # Audio generation utilities
└── types/                        # TypeScript definitions
```

**Audio Implementation:**

The mixer uses Web Audio API for real-time playback:
- `AudioContext` for the audio processing graph
- `StereoPannerNode` for panning
- `GainNode` for volume control
- `AnalyserNode` for metering (Peak, RMS, Phase correlation)
- `ConvolverNode` for reverb (generated impulse response)
- `DelayNode` for echo effects
- `BiquadFilterNode` for potential EQ

```typescript
// Audio chain architecture
source → GainNode → StereoPannerNode → ConvolverNode → DelayNode → AnalyserNode → destination
```

**Critique Points:**
1. **Large Component**: `page.tsx` is 3000+ lines - should be decomposed into smaller components
2. **No State Management Library**: Complex state (timeline stems, meters) is managed with useState/useRef making it harder to test and maintain
3. **Memory Leaks Risk**: Audio nodes created in `useEffect` need careful cleanup - currently handled but fragile
4. **No Audio Worklet**: Audio processing runs on main thread; compute-intensive DSP could cause glitches
5. **Monolithic File**: Project detail page mixes concerns (UI, audio, API, state)

---

### 2. Backend (FastAPI + Python)

**Technology Stack:**
- FastAPI 0.100+
- Python 3.12
- SQLAlchemy 2.0 (async)
- asyncpg (PostgreSQL driver)
- Pydantic 2.0
- python-jose (JWT)
- Celery 5.3
- boto3 (S3/MinIO)

**Architecture:**

The backend follows a layered architecture:

```
backend/app/
├── api/              # Route handlers (FastAPI routers)
├── core/             # Configuration, database, storage
├── models/           # SQLAlchemy ORM models
├── schemas/          # Pydantic request/response models
├── services/         # Business logic (optional layer)
└── workers/          # Celery tasks (async processing)
```

**API Endpoints:**

| Endpoint | Method | Description |
|----------|--------|-------------|
| `/api/v1/projects/` | POST, GET | Create/list projects |
| `/api/v1/assets/` | POST, GET | Create/list assets |
| `/api/v1/assets/presign` | POST | Get S3 presigned URL |
| `/api/v1/assets/{id}/waveform` | GET | Get waveform peaks |
| `/api/v1/jobs/` | POST, GET | Create/list jobs |
| `/api/v1/jobs/{id}/status` | GET | Poll job status |
| `/api/v1/assets/{id}/bpm` | GET | Detect BPM |
| `/api/v1/assets/{id}/key` | GET | Detect musical key |

**Database Models:**

```python
# Key models (SQLAlchemy)
class Project(Base):
    id: UUID
    name: str
    created_at: datetime
    
class Asset(Base):
    id: UUID
    project_id: UUID (FK)
    type: str  # original, stem, mix
    stem_type: str  # vocals, drums, bass, other
    s3_key: str
    duration: float
    sample_rate: int
    result: JSON  # Flexible storage for metadata

class Job(Base):
    id: UUID
    project_id: UUID (FK)
    type: str  # separate, denoise, instrument_id
    status: str  # pending, running, succeeded, failed
    params: JSON
    result: JSON
    progress: int
    error: str
```

**Critique Points:**
1. **JSON for Metadata**: Asset uses JSON column for `display_name` - adds overhead, should be a proper column
2. **No Soft Deletes**: Deleting projects/assets is hard delete - no recovery
3. **Async/Sync Mixing**: Celery workers use sync SQLAlchemy while API uses async
4. **No Middleware**: No request logging, tracing, or rate limiting
5. **Limited Validation**: Pydantic schemas are basic, could use more sophisticated validation

---

### 3. Database (PostgreSQL)

**Configuration:**
- Host: `localhost:5432`
- Database: `audioforge`
- Driver: `asyncpg` (async) + `psycopg2-binary` (sync for Celery)
- Connection Pooling: SQLAlchemy async pool

**Schema:**
- UUID primary keys for all entities
- JSON columns for flexible metadata
- Foreign key constraints with cascade deletes
- Indexes on `project_id`, `type`, `status`

**Critique Points:**
1. **No Migrations Tool**: Using Alembic but schema changes aren't tracked
2. **Missing Indexes**: Could add indexes on `created_at`, `type`, `stem_type`
3. **No Partitioning**: Large job tables could benefit from partitioning by status
4. **Soft Delete Missing**: Would help with data recovery

---

### 4. Job Queue (Celery + Redis)

**Configuration:**
- Broker: `redis://localhost:6379/1`
- Result Backend: `redis://localhost:6379/2`
- Task Serializer: JSON
- Result Serializer: JSON
- Time Limit: 3600s (1 hour)

**Task Definitions:**

```python
# tasks.py / workers/
@celery_app.task(bind=True, name='tasks.separate_audio_demucs')
def separate_audio_demucs(self, job_id, input_asset_id, project_id, demucs_model, stem_mode):
    # Demucs separation using Python API
    # Downloads from S3 → processes → uploads to S3 → creates asset

@celery_app.task(bind=True, name='tasks.denoise_audio')
def denoise_audio(self, job_id, input_asset_id, project_id, output_mode, stationary, noise_threshold):
    # Noise reduction using noisereduce
    # Stationary vs non-stationary noise detection

@celery_app.task(bind=True, name='tasks.separate_audio_spleeter')
def separate_audio_spleeter(self, job_id, input_asset_id, project_id):
    # Spleeter-based separation (alternative to Demucs)
```

**Job Flow:**
1. Client creates job via POST to `/api/v1/jobs/`
2. FastAPI creates Job record with status `pending`
3. FastAPI sends task to Celery via `celery_app.send_task()`
4. Worker picks up task, updates progress via `task.update_state()`
5. Client polls `/api/v1/jobs/{id}/status` every 2 seconds
6. On completion, worker updates Job record with result

**Critique Points:**
1. **No Retry Logic**: Failed tasks aren't retried automatically
2. **No Dead Letter Queue**: Failed tasks are lost
3. **Progress via Celery State**: Uses Celery's built-in state which can be unreliable
4. **Sync Workers**: Workers use synchronous SQLAlchemy - blocks connection pool
5. **No Task Scheduling**: Can't schedule tasks for future execution

---

### 5. Object Storage (MinIO)

**Configuration:**
- Endpoint: `localhost:9000`
- Access Key: `minioadmin`
- Secret Key: `minioadmin`
- Buckets: `assets`, `previews`, `exports`

**Storage Pattern:**
```
{project_id}/{timestamp}_{filename}
```

**Operations:**
- Presigned URLs for upload ( PUT )
- Presigned URLs for download ( GET )
- Direct upload for small files

**Critique Points:**
1. **No Lifecycle Policies**: No automatic transition to cold storage
2. **No Versioning**: Can't recover from accidental overwrites
3. **Public Access**: Previews could be accidentally exposed
4. **No CDN**: Large audio files served directly from MinIO

---

## Communication Patterns

### 1. Client → Backend (REST over HTTP)

```typescript
// Frontend API client (lib/api.ts)
async createDenoiseJob(projectId, assetIds, params) {
  return this.request('/api/v1/jobs/', {
    method: 'POST',
    body: JSON.stringify({
      project_id: projectId,
      type: 'denoise',
      asset_ids: assetIds,
      params,
    }),
  });
}
```

**Next.js Rewrites:**
```javascript
// next.config.js
async rewrites() {
  return [
    {
      source: '/api/v1/:path*',
      destination: 'http://localhost:8000/api/v1/:path*',
    },
  ];
}
```

### 2. Backend → Celery (AMQP over Redis)

```python
# API endpoint creates task
task = celery_app.send_task(
    'tasks.denoise_audio',
    args=[str(db_job.id), str(asset_id), str(project_id)],
    kwargs={'output_mode': 'new', 'stationary': True}
)
```

### 3. Worker → Storage (S3/MinIO)

```python
# Worker downloads, processes, uploads
audio_bytes = s3_client.get_object(Bucket=bucket, Key=s3_key)['Body'].read()
# ... process audio ...
s3_client.upload_fileobj(output_buffer, Bucket=bucket, Key=output_key)
```

### 4. Client → Web Audio (Browser API)

```typescript
// Real-time audio chain
const ctx = new AudioContext();
const gain = ctx.createGain();
const panner = ctx.createStereoPanner();
const analyser = ctx.createAnalyser();
const convolver = ctx.createConvolver();
const delay = ctx.createDelay();

// Chain: source → gain → panner → convolver → delay → analyser → destination
source.connect(gain);
gain.connect(panner);
panner.connect(convolver);
convolver.connect(delay);
delay.connect(analyser);
analyser.connect(ctx.destination);
```

---

## Audio Processing Libraries

### Demucs (Source Separation)

```python
from demucs.pretrained import get_model
from demucs.apply import apply_model
import torch

model = get_model('htdemucs')
separated = apply_model(model, audio, device='cpu')
# Returns: [source, drums, bass, other]
```

**Model Options:**
- `htdemucs`: Hybrid Transformer Demucs (4 stems)
- `htdemucs_ft`: Fine-tuned variant
- `mdx`: MusdbHQ MDX
- `mdx_extra`: Extra detail extraction

**Critique:**
- CPU inference is slow (10-30x realtime)
- GPU recommended but memory-constrained
- No batch processing optimization

### noisereduce (Noise Reduction)

```python
import noisereduce as nr

reduced = nr.reduce_noise(
    y=audio_data,
    sr=sample_rate,
    stationary=True,  # or False for non-stationary
    n_std_thresh_stationary=1.5,  # threshold multiplier
    n_fft=2048,
    hop_length=512,
)
```

**Parameters:**
- `stationary`: True for consistent noise (AC hum), False for varying noise
- `noise_threshold`: Higher = more aggressive noise reduction

**Critique:**
- Noisy is analyzed from the signal itself (no reference noise sample)
- Stationary mode assumes noise is consistent throughout
- Could benefit from spectral subtraction preprocessing

### Web Audio API (Real-time Mixing)

```typescript
// Real-time metering
const analyser = audioContext.createAnalyser();
analyser.fftSize = 256;

// Peak detection
const dataArray = new Uint8Array(analyser.frequencyBinCount);
analyser.getByteFrequencyData(dataArray);
const peak = Math.max(...dataArray) / 255;

// RMS calculation
const timeData = new Uint8Array(analyser.fftSize);
analyser.getByteTimeDomainData(timeData);
const rms = Math.sqrt(timeData.reduce((a, b) => a + (b - 128) ** 2, 0) / timeData.length) / 128;

// Phase correlation (simple version)
const left = new Float32Array(bufferSize);
const right = new Float32Array(bufferSize);
channelData[0].copyInto(left, 0);
channelData[1].copyInto(right, 0);
const correlation = left.reduce((sum, l, i) => sum + l * right[i], 0) / 
                   (Math.sqrt(left.reduce((s, l) => s + l**2, 0) * right.reduce((s, r) => s + r**2, 0)));
```

---

## Services Available

### 1. Source Separation
- **Models**: Demucs (HT Demucs, HT Demucs FT, MDX, MDX Extra), Spleeter
- **Output Modes**: 4-stem (vocals, drums, bass, other), 2-stem (vocals + accompaniment)
- **Processing**: Async via Celery
- **Delivery**: New assets created in project

### 2. Noise Reduction
- **Algorithm**: Spectral gating via noisereduce
- **Modes**: Stationary (consistent noise), Non-stationary (varying noise)
- **Parameters**: Noise threshold (0.5-3.0 std dev)
- **Output**: New asset or overwrite original

### 3. BPM Detection
- **Algorithm**: librosa.beat.tempo (tempogram-based)
- **Endpoint**: `GET /api/v1/assets/{id}/bpm`
- **Result**: JSON with bpm value

### 4. Key Detection
- **Algorithm**: librosa.key.key_finder (chromagram-based)
- **Endpoint**: `GET /api/v1/assets/{id}/key`
- **Result**: JSON with key (e.g., "C minor")

### 5. Real-time Mixing
- **Features**: Volume, pan, mute, solo, reverb, delay
- **Metering**: Peak, RMS, Phase correlation, LUFS
- **Visualization**: Waveform, spectrum analyzer

### 6. Asset Management
- **Upload**: Presigned URL upload to MinIO
- **Storage**: Project-based directory structure
- **Metadata**: JSON-based flexible storage
- **Operations**: Rename, delete, list, filter

### 7. Job Administration
- **List**: All jobs with filtering
- **Status**: Real-time progress polling
- **Override**: Admin can stop/fail jobs manually

---

## Security Considerations

1. **Authentication**: JWT tokens via python-jose
2. **Authorization**: Resource-based (project ownership)
3. **Input Validation**: Pydantic schemas
4. **Storage**: Presigned URLs (time-limited access)
5. **Database**: Parameterized queries (SQLAlchemy handles this)

---

## Performance Characteristics

| Operation | Latency | Notes |
|-----------|---------|-------|
| API Response | ~50ms | PostgreSQL query + JSON serialization |
| Asset Upload | ~1-5s | Network-bound, depends on file size |
| Stem Separation | 5-30 minutes | CPU-bound, model-dependent |
| Noise Reduction | 5-30 seconds | Audio length-dependent |
| Real-time Playback | <10ms | Browser Web Audio API |
| Waveform Generation | ~500ms | Backend processing |

---

## Scalability Assessment

### Current Limitations:
1. **Celery Workers**: Single worker, blocks on long tasks
2. **Database Connections**: Small pool size
3. **File Storage**: Local MinIO, no CDN
4. **Audio Processing**: No GPU acceleration in containers

### Recommended Improvements:
1. **Horizontal Scaling**: Multiple Celery workers with task routing
2. **GPU Workers**: Separate queue for Demucs with GPU
3. **Caching**: Redis for waveform cache, job status cache
4. **Queue Priorities**: Separate queues for different job types
5. **WebSockets**: Server-sent events for job progress instead of polling

---

## Conclusion

AudioForge demonstrates a functional full-stack audio processing platform with modern tooling. The architecture is straightforward and maintainable for a small team. Key areas for improvement include:

1. **Code Organization**: Decompose large frontend components
2. **State Management**: Consider Zustand or Redux for complex state
3. **Error Handling**: Add retry logic, dead letter queues
4. **Monitoring**: Add tracing, metrics, logging aggregation
5. **Caching**: Redis cache for waveform data
6. **GPU Acceleration**: Docker GPU support for Demucs

The platform is production-ready for moderate load with the understanding that audio processing is computationally intensive and requires appropriate infrastructure scaling.
