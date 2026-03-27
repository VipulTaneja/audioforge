from datetime import datetime

from fastapi import APIRouter, Depends, HTTPException, status, BackgroundTasks
from sqlalchemy.ext.asyncio import AsyncSession
from sqlalchemy import select
from uuid import UUID
import logging

from app.core.database import get_db
from app.core.cache import get_cache_service, JOB_STATUS_CACHE_TTL
from app.models import Job, Project, Asset, JobStatus
from app.schemas import JobCreate, JobResponse, JobUpdate
from app.workers.celery_app import celery_app

router = APIRouter(prefix="/jobs", tags=["jobs"])
logger = logging.getLogger(__name__)

FOUR_STEM_MODELS = {"htdemucs", "htdemucs_ft"}
TWO_STEM_MODELS = {"htdemucs", "htdemucs_ft", "mdx", "mdx_extra"}


@router.post("/", response_model=JobResponse, status_code=status.HTTP_201_CREATED)
async def create_job(
    job: JobCreate,
    background_tasks: BackgroundTasks,
    db: AsyncSession = Depends(get_db)
):
    # Validate project exists
    result = await db.execute(select(Project).where(Project.id == job.project_id))
    project = result.scalar_one_or_none()
    if not project:
        raise HTTPException(status_code=404, detail="Project not found")

    # Validate assets exist for separation jobs
    if job.type == "separate":
        if not job.asset_ids:
            raise HTTPException(status_code=400, detail="asset_ids required for separation")

        params = dict(job.params or {})
        demucs_model = params.get("demucs_model", "htdemucs")
        stem_mode = params.get("stem_mode", "four_stem")
        separator = params.get("separator", "demucs")

        if separator == "demucs":
            if stem_mode == "four_stem" and demucs_model not in FOUR_STEM_MODELS:
                raise HTTPException(
                    status_code=400,
                    detail="The selected model only supports reliable vocals/accompaniment extraction. Choose HT Demucs or HT Demucs FT for 4-stem separation.",
                )
            if stem_mode == "two_stem_vocals" and demucs_model not in TWO_STEM_MODELS:
                raise HTTPException(status_code=400, detail="Unsupported model for two-stem separation")
        elif separator == "spleeter":
            if stem_mode == "four_stem":
                pass
            elif stem_mode == "two_stem_vocals":
                pass
            else:
                raise HTTPException(status_code=400, detail="Unsupported stem mode for Spleeter")
        
        for asset_id in job.asset_ids:
            asset_result = await db.execute(select(Asset).where(Asset.id == asset_id))
            asset = asset_result.scalar_one_or_none()
            if not asset:
                raise HTTPException(status_code=404, detail=f"Asset {asset_id} not found")

    # Create job record
    db_job = Job(
        project_id=job.project_id,
        type=job.type,
        params=job.params,
        status=JobStatus.PENDING.value,
    )
    db.add(db_job)
    await db.flush()
    await db.refresh(db_job)

    # Trigger appropriate worker task based on job type
    job_type_handlers = {
        "separate": "tasks.separate_audio_demucs",
        "denoise": "tasks.denoise_audio",
        "instrument_id": "tasks.identify_instruments",
    }

    if job.type == "separate" and job.params:
        params = dict(job.params)
        separator = params.get("separator", "demucs")
        if separator == "spleeter":
            job_type_handlers["separate"] = "tasks.separate_audio_spleeter"
    
    handler_name = job_type_handlers.get(job.type)
    
    if handler_name:
        try:
            # Queue the Celery task
            task = celery_app.send_task(
                handler_name,
                args=[str(db_job.id), str(job.asset_ids[0]) if job.asset_ids else None, str(job.project_id)],
                kwargs=job.params
            )
            logger.info(f"Queued job {db_job.id} with task {handler_name}, task_id={task.id}")
        except Exception as e:
            logger.error(f"Failed to queue job {db_job.id}: {e}")
            # Job is still created but worker might fail - that's ok for now
    else:
        logger.warning(f"No handler for job type: {job.type}")

    return db_job


@router.get("/", response_model=list[JobResponse])
async def list_jobs(db: AsyncSession = Depends(get_db)):
    result = await db.execute(select(Job).order_by(Job.created_at.desc()))
    return result.scalars().all()


@router.get("/{job_id}", response_model=JobResponse)
async def get_job(job_id: UUID, db: AsyncSession = Depends(get_db)):
    result = await db.execute(select(Job).where(Job.id == job_id))
    job = result.scalar_one_or_none()
    if not job:
        raise HTTPException(status_code=404, detail="Job not found")
    return job


@router.get("/{job_id}/status")
async def get_job_status(job_id: UUID, db: AsyncSession = Depends(get_db)):
    """Get detailed job status including progress and result."""
    cache_key = f"job_status:{job_id}"
    cache = await get_cache_service()
    cached = await cache.get(cache_key)
    if cached is not None:
        return cached

    result = await db.execute(select(Job).where(Job.id == job_id))
    job = result.scalar_one_or_none()
    if not job:
        raise HTTPException(status_code=404, detail="Job not found")

    response = {
        "id": str(job.id),
        "type": job.type,
        "status": job.status,
        "progress": job.progress,
        "result": job.result,
        "error": job.error,
        "created_at": job.created_at.isoformat() if job.created_at else None,
        "started_at": job.started_at.isoformat() if job.started_at else None,
        "ended_at": job.ended_at.isoformat() if job.ended_at else None,
    }

    await cache.set(cache_key, response, JOB_STATUS_CACHE_TTL)

    return response


@router.patch("/{job_id}", response_model=JobResponse)
async def update_job(job_id: UUID, payload: JobUpdate, db: AsyncSession = Depends(get_db)):
    result = await db.execute(select(Job).where(Job.id == job_id))
    job = result.scalar_one_or_none()
    if not job:
        raise HTTPException(status_code=404, detail="Job not found")

    if payload.status is not None:
        allowed_statuses = {status.value for status in JobStatus}
        if payload.status not in allowed_statuses:
            raise HTTPException(status_code=400, detail="Invalid job status")
        job.status = payload.status
        if payload.status in {JobStatus.FAILED.value, JobStatus.SUCCEEDED.value}:
            job.ended_at = datetime.utcnow()
        elif payload.status == JobStatus.RUNNING.value and job.started_at is None:
            job.started_at = datetime.utcnow()

    if payload.error is not None:
        job.error = payload.error

    await db.flush()
    await db.refresh(job)

    cache = await get_cache_service()
    await cache.delete(f"job_status:{job_id}")

    return job


@router.get("/project/{project_id}", response_model=list[JobResponse])
async def list_project_jobs(
    project_id: UUID,
    status: JobStatus | None = None,
    limit: int = 50,
    offset: int = 0,
    db: AsyncSession = Depends(get_db),
):
    query = select(Job).where(Job.project_id == project_id)
    
    if status:
        query = query.where(Job.status == status.value)
    
    query = query.order_by(Job.created_at.desc()).limit(limit).offset(offset)
    
    result = await db.execute(query)
    jobs = result.scalars().all()
    return jobs
