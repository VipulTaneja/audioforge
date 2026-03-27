# AudioForge - AI-Powered Audio Processing Platform

## Product Requirements Document (PRD)

---

## 1. Overview

**Product Name:** AudioForge  
**Type:** Full-stack SaaS audio processing platform  
**Core Functionality:** AI-powered audio separation, noise reduction, voice conversion, and professional mixing with real-time web preview  
**Target Users:** Musicians, podcasters, audio engineers, content creators, and studios

---

## 2. Tech Stack

### Frontend (Web)
- **Framework:** Next.js 14+ (React) with App Router
- **Audio Processing:** WebAudio API + AudioWorklet for low-latency preview, panning, meters
- **Music Sequencing:** Tone.js for basic sequencing/metronome
- **Client-side Transcoding:** ffmpeg.wasm
- **Real-time Communication:** Socket.IO for job progress/events
- **Styling:** Tailwind CSS + shadcn/ui

### Backend
- **Framework:** FastAPI (Python)
- **Job Queue:** Celery + Redis
- **Database:** PostgreSQL with JSONB for flexible job params
- **Object Storage:** MinIO (S3-compatible)
- **Authentication:** Keycloak integration
- **Authorization:** Casbin for RBAC

### ML/Audio Services (Workers)
- **Source Separation:** Demucs v4
- **Noise Reduction:** RNNoise, WebRTC NS
- **Instrument ID:** Essentia, OpenL3
- **Voice Conversion:** RVC (with consent gates)
- **Model Serving:** NVIDIA Triton / ONNX Runtime

### Infrastructure
- **Container Orchestration:** Kubernetes (k3s)
- **API Gateway:** Traefik
- **CDN:** Cloudflare R2/S3 + Cloudflare CDN
- **Monitoring:** Prometheus + Grafana + Loki + Jaeger

---

## 3. System Architecture

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
                    ┌────────────────────────────────┼────────────────┐
                    ▼                                ▼                ▼
            ┌──────────────┐              ┌─────────────────┐  ┌──────────┐
            │  CPU Workers │              │  GPU Workers    │  │  Triton  │
            │ (ffmpeg/EQ)  │              │ (Demucs/RVC)    │  │ (Models) │
            └──────────────┘              └─────────────────┘  └──────────┘
```

---

## 4. Core Data Model

### Users & Organizations
```
users
├── id (UUID, PK)
├── email (UNIQUE)
├── name
├── keycloak_id
└── created_at

orgs
├── id (UUID, PK)
├── name
├── plan (free/pro/enterprise)
└── created_at

org_members
├── org_id (FK)
├── user_id (FK)
└── role (owner/admin/member)
```

### Projects & Assets
```
projects
├── id (UUID, PK)
├── org_id (FK)
├── name
├── status (active/archived)
└── created_at

assets
├── id (UUID, PK)
├── project_id (FK)
├── type (original/stem/mix/preset)
├── s3_key
├── duration (seconds)
├── channels (1/2/5.1/7.1)
├── sample_rate
├── waveform_png (URL)
├── created_by (FK)
└── created_at

jobs
├── id (UUID, PK)
├── project_id (FK)
├── type (separate/denoise/rvc/tts_sing/mixdown/instrument_id/spatialize)
├── status (pending/running/succeeded/failed)
├── params (JSONB)
├── result (JSONB)
├── created_at
├── started_at
├── ended_at
└── worker_pod

mix_sessions
├── id (UUID, PK)
├── project_id (FK)
├── graph (JSONB) -- node/edge DSP graph
└── updated_at

audit_logs
├── id (UUID, PK)
├── org_id (FK)
├── actor_id (FK)
├── action
├── target
├── metadata (JSONB)
└── ts
```

---

## 5. Processing Pipeline

### 5.1 Ingest
1. User uploads audio → presigned S3 URL
2. API creates asset record with metadata
3. (Optional) Client-side normalization via ffmpeg.wasm

### 5.2 Analyze
1. Background job: instrument_id → Essentia/OpenL3 embeddings
2. Beat/BPM/key detection via Essentia
3. Results stored in asset.result

### 5.3 Separate / Denoise
1. `separate` job → Demucs v4 → stems (vocals/drums/bass/other)
2. `denoise` job → RNNoise/WebRTC NS → clean stems

### 5.4 Voice Tasks
1. `rvc` job: voice conversion on isolated vocals (consent required)
2. `tts_sing` pipeline: lyrics + melody → synth vocal

### 5.5 Arrange / Generate (Phase 3)
1. `arrange` job: harmony/backing per style prompt

### 5.6 Mix & Spatialize
1. Client renders mix graph (nodes: stems, FX; edges: routing)
2. `spatialize` job: multi-channel (5.1/7.1/Ambisonics) or binaural render

### 5.7 Export
1. `mixdown` job → WAV/FLAC/MP3
2. Multi-track exports as ZIP
3. Result assets created; signed URLs returned

---

## 6. API Surface

### Authentication
- Delegated to Keycloak; API uses JWT introspection

### Projects
```
POST   /api/v1/projects              Create project
GET    /api/v1/projects             List projects
GET    /api/v1/projects/:id         Get project
PUT    /api/v1/projects/:id         Update project
DELETE /api/v1/projects/:id         Delete project
```

### Assets
```
POST   /api/v1/assets/presign       Get presigned upload URL
POST   /api/v1/assets               Finalize asset record
GET    /api/v1/projects/:id/assets   List project assets
DELETE /api/v1/assets/:id            Delete asset
```

### Jobs
```
POST   /api/v1/jobs                  Create job
GET    /api/v1/jobs/:id              Get job status/result
WS     /api/v1/ws/projects/:id      WebSocket for job progress
```

### Mix Sessions
```
GET    /api/v1/mix-sessions/:id      Get mix session
PUT    /api/v1/mix-sessions/:id      Update mix graph
POST   /api/v1/mix-sessions/:id/render  Trigger mixdown job
```

### RBAC Permissions
```
project:read      View project and assets
asset:write      Upload/delete assets
job:run          Create and run jobs
billing:manage   Manage subscription (admin only)
```

---

## 7. Open-Source Components

| Component | Library | License |
|-----------|---------|---------|
| Source Separation | Demucs v4 / MDX-Net | MIT |
| Noise Reduction | RNNoise, WebRTC NS | BSD |
| Instrument ID | Essentia, OpenL3 | AGPL/MIT |
| Pitch Detection | CREPE, pyworld | MIT |
| Voice Conversion | RVC, so-vits-svc | CC/Proprietary |
| Spatial Audio | libmysofa (HRTF) | BSD |
| Model Serving | Triton, ONNX Runtime | Apache 2.0 |
| DSP/Features | librosa, torchaudio | MIT |

---

## 8. Security & Compliance

### Authentication & Authorization
- Keycloak for email/password + OAuth/SAML
- Casbin for fine-grained RBAC
- JWT tokens with short expiry + refresh

### Data Protection
- mTLS between services
- Presigned URLs with tight TTL
- Server-side encryption (SSE-S3)
- PII encryption in PostgreSQL (pgcrypto)

### Audit & Consent
- All voice cloning actions logged in audit_logs
- Consent gate for voice conversion uploads
- Watermark synthesized vocals
- Per-org policy toggles

### Rate Limiting
- Gateway-level limits (1000 req/min)
- Per-user/org limits in Redis
- Quota enforcement on job creation

---

## 9. MVP Roadmap

### Phase 0: Foundations
- [ ] Next.js app with authentication
- [ ] FastAPI BFF with Keycloak integration
- [ ] PostgreSQL + MinIO + Redis setup
- [ ] Celery job framework with basic worker
- [ ] WebSocket for job progress

### Phase 1: Audio Core
- [ ] Demucs separation (GPU worker)
- [ ] RNNoise/WebRTC noise reduction
- [ ] Instrument ID tags
- [ ] Waveform previews
- [ ] Simple mix graph (volume/pan/mute/solo)
- [ ] Export stems + stereo mixdown
- [ ] Basic RBAC

### Phase 2: Creative
- [ ] RVC voice conversion (consent gate)
- [ ] Melody/pitch detection (CREPE)
- [ ] Key/BPM detection
- [ ] Spatialize to binaural & 5.1
- [ ] Multi-channel export

### Phase 3: Scale & Enterprise
- [ ] Triton model serving
- [ ] Autoscaling workers
- [ ] Prometheus + Grafana + tracing
- [ ] Teams & SSO (SAML)
- [ ] Usage-based quotas
- [ ] Stripe billing integration

---

## 10. Example Job Contract

### Request
```json
{
  "type": "separate",
  "project_id": "proj_123",
  "input_asset_id": "asset_abc",
  "params": {
    "model": "demucs_v4",
    "stems": ["vocals", "drums", "bass", "other"]
  }
}
```

### Response
```json
{
  "status": "succeeded",
  "result": {
    "stems": [
      {"role": "vocals", "asset_id": "asset_v1"},
      {"role": "drums", "asset_id": "asset_d1"},
      {"role": "bass", "asset_id": "asset_b1"},
      {"role": "other", "asset_id": "asset_o1"}
    ],
    "metrics": {"rtf": 0.7, "sr": 44100}
  }
}
```

---

## 11. Deployment Topology

### Kubernetes Pods
| Pod | Resources | Description |
|-----|-----------|-------------|
| api | CPU (2-4 cores) | FastAPI BFF |
| workers-cpu | CPU (4-8 cores) | Essentia/ffmpeg tasks |
| workers-gpu | GPU (T4/A100) | Demucs, RVC, generation |
| triton | GPU (T4/A100) | Model inference server |
| keycloak | CPU (2 cores) | Identity provider |
| postgres | CPU + 4GB RAM | Metadata store |
| redis | CPU + 2GB RAM | Cache & queue |
| minio | CPU + 4GB RAM | Object storage |

### Autoscaling
- HPA on Celery queue depth
- HPA on GPU utilization (custom metrics)
- Cluster autoscaler for node provisioning

---

## 12. UX Features

- Waveform display with stem lanes
- Draggable panning controls
- A/B comparison (original vs processed)
- Live preview via WebAudio (local)
- Server-side high-quality render
- Optimistic UI updates
- Per-job progress & ETA
- Retry logic with exponential backoff

---

## 13. Non-Functional Requirements

| Requirement | Target |
|-------------|--------|
| API Latency (p95) | < 200ms |
| Preview Latency | < 50ms |
| Job Throughput | 100 concurrent jobs |
| Availability | 99.9% SLA |
| Data Retention | Per org policy |
| Max File Size | 500MB per asset |

---

## 14. Implementation Status

### Backend (FastAPI + Celery)
- [x] Database models with SQLAlchemy (users, orgs, projects, assets, jobs)
- [x] Asset model with stem support (parent_asset_id, stem_type)
- [x] S3/MinIO storage service for file uploads/downloads
- [x] Presigned URL generation for uploads
- [x] Celery worker for audio separation
- [x] Demucs integration (with mock fallback if not installed)
- [x] Job status tracking with progress updates
- [x] WebSocket support for real-time updates
- [x] API routes: projects, assets, jobs

### Frontend (Next.js 14)
- [x] Project list with localStorage persistence
- [x] Project detail page with tabs (Upload/Separate/Mixer)
- [x] File upload with progress
- [x] Separation job triggering with progress display
- [x] Mixer UI with stem selection
- [x] Volume and pan controls
- [x] Mute/Solo buttons
- [x] Play/Pause with oscillator-based audio preview

### Running the Application

1. **Start infrastructure:**
   ```bash
   docker-compose up -d postgres redis minio
   ```

2. **Start backend:**
   ```bash
   cd backend
   pip install -r requirements.txt
   python -m uvicorn app.main:app --reload --port 8000
   ```

3. **Start Celery worker (in separate terminal):**
   ```bash
   cd backend
   celery -A app.workers.celery_app worker --loglevel=info
   ```

4. **Start frontend:**
   ```bash
   cd frontend
   npm install
   npm run dev
   ```

### Installing Demucs (for actual audio separation)

```bash
pip install demucs
```

If Demucs is not installed, the worker will use mock separation (creates placeholder audio files).
