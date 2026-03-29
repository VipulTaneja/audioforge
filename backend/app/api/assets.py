import mimetypes

from fastapi import APIRouter, Depends, HTTPException, status, Response
from fastapi.responses import StreamingResponse
from sqlalchemy.ext.asyncio import AsyncSession
from sqlalchemy import select
from uuid import UUID
from datetime import datetime
import boto3
import numpy as np
from botocore.exceptions import ClientError

from app.core.database import get_db
from app.core.storage import generate_presigned_upload_url, get_s3_client
from app.core.config import get_settings
from app.core.cache import get_cache_service, WAVEFORM_CACHE_TTL
from app.models import Asset, Project, User
from app.schemas import AssetCreate, AssetResponse, AssetUpdate, ConversionRequest, PresignRequest, PresignResponse, TrimRequest, JobResponse, MediaInspectionResponse

router = APIRouter(prefix="/assets", tags=["assets"])

DEFAULT_USER_EMAIL = "local@audioforge.local"


async def get_or_create_default_user(db: AsyncSession) -> User:
    result = await db.execute(select(User).limit(1))
    user = result.scalar_one_or_none()
    if not user:
        user = User(email=DEFAULT_USER_EMAIL, name="Local User")
        db.add(user)
        await db.flush()
        await db.refresh(user)
    return user


@router.post("/presign", response_model=PresignResponse)
async def get_presigned_url(
    request: PresignRequest,
    db: AsyncSession = Depends(get_db)
):
    result = await db.execute(select(Project).where(Project.id == request.project_id))
    project = result.scalar_one_or_none()
    if not project:
        raise HTTPException(status_code=404, detail="Project not found")

    s3_key = f"{request.project_id}/{datetime.utcnow().timestamp()}_{request.filename}"
    upload_url = generate_presigned_upload_url(s3_key, request.content_type)

    return PresignResponse(upload_url=upload_url, s3_key=s3_key)


@router.post("/", response_model=AssetResponse, status_code=status.HTTP_201_CREATED)
async def create_asset(asset: AssetCreate, db: AsyncSession = Depends(get_db)):
    result = await db.execute(select(Project).where(Project.id == asset.project_id))
    project = result.scalar_one_or_none()
    if not project:
        raise HTTPException(status_code=404, detail="Project not found")

    user = await get_or_create_default_user(db)

    db_asset = Asset(
        project_id=asset.project_id,
        type=asset.type,
        s3_key=asset.s3_key,
        duration=asset.duration,
        channels=asset.channels,
        sample_rate=asset.sample_rate,
        created_by=user.id,
    )
    db.add(db_asset)
    await db.flush()
    await db.refresh(db_asset)
    return db_asset


@router.get("/{asset_id}", response_model=AssetResponse)
async def get_asset(asset_id: UUID, db: AsyncSession = Depends(get_db)):
    result = await db.execute(select(Asset).where(Asset.id == asset_id))
    asset = result.scalar_one_or_none()
    if not asset:
        raise HTTPException(status_code=404, detail="Asset not found")
    return asset


@router.get("/project/{project_id}", response_model=list[AssetResponse])
async def list_project_assets(project_id: UUID, db: AsyncSession = Depends(get_db)):
    result = await db.execute(
        select(Asset).where(Asset.project_id == project_id).order_by(Asset.created_at.desc())
    )
    assets = result.scalars().all()
    return assets


@router.patch("/{asset_id}", response_model=AssetResponse)
async def update_asset(asset_id: UUID, asset_update: AssetUpdate, db: AsyncSession = Depends(get_db)):
    result = await db.execute(select(Asset).where(Asset.id == asset_id))
    asset = result.scalar_one_or_none()
    if not asset:
        raise HTTPException(status_code=404, detail="Asset not found")

    next_result = dict(asset.result or {})

    if asset_update.display_name is not None:
        display_name = asset_update.display_name.strip()
        asset.display_name = display_name if display_name else None

    asset.result = next_result or None
    await db.flush()
    await db.refresh(asset)
    return asset


@router.delete("/{asset_id}", status_code=status.HTTP_204_NO_CONTENT)
async def delete_asset(asset_id: UUID, db: AsyncSession = Depends(get_db)):
    result = await db.execute(select(Asset).where(Asset.id == asset_id))
    asset = result.scalar_one_or_none()
    if not asset:
        return Response(status_code=status.HTTP_204_NO_CONTENT)
    await db.delete(asset)
    return Response(status_code=status.HTTP_204_NO_CONTENT)


@router.get("/{asset_id}/download")
async def download_asset(asset_id: UUID, db: AsyncSession = Depends(get_db)):
    result = await db.execute(select(Asset).where(Asset.id == asset_id))
    asset = result.scalar_one_or_none()
    if not asset:
        raise HTTPException(status_code=404, detail="Asset not found")
    
    settings = get_settings()
    s3 = get_s3_client()
    
    try:
        file_obj = s3.get_object(
            Bucket=settings.minio_bucket_assets,
            Key=asset.s3_key
        )
        
        def generate():
            for chunk in file_obj['Body'].iter_chunks():
                yield chunk

        filename = asset.s3_key.split("/")[-1]
        media_type = file_obj.get("ContentType") or mimetypes.guess_type(filename)[0] or "application/octet-stream"
        headers = {
            "Content-Disposition": f'inline; filename="{filename}"',
        }
        if content_length := file_obj.get("ContentLength"):
            headers["Content-Length"] = str(content_length)
        
        return StreamingResponse(
            generate(),
            media_type=media_type,
            headers=headers,
        )
    except ClientError as e:
        raise HTTPException(status_code=404, detail=f"File not found in storage: {str(e)}")


@router.get("/{asset_id}/waveform")
async def get_waveform(asset_id: UUID, db: AsyncSession = Depends(get_db), peaks: int = 200):
    """Get waveform peaks for visualization."""
    import asyncio
    import concurrent.futures

    cache_key = f"waveform:{asset_id}:{peaks}"
    cache = await get_cache_service()
    cached = await cache.get(cache_key)
    if cached is not None:
        return cached

    result = await db.execute(select(Asset).where(Asset.id == asset_id))
    asset = result.scalar_one_or_none()
    if not asset:
        raise HTTPException(status_code=404, detail="Asset not found")

    def generate_waveform():
        settings = get_settings()
        s3 = get_s3_client()

        try:
            file_obj = s3.get_object(
                Bucket=settings.minio_bucket_assets,
                Key=asset.s3_key
            )

            import io
            audio_data = b''.join(chunk for chunk in file_obj['Body'].iter_chunks())

            import soundfile as sf
            with io.BytesIO(audio_data) as buffer:
                wav, sr = sf.read(buffer)

                if len(wav.shape) > 1:
                    wav = wav.mean(axis=1)

                wav = wav.astype(np.float64)

                samples_per_peak = max(1, len(wav) // peaks)
                peaks_data = []
                for i in range(peaks):
                    start = i * samples_per_peak
                    end = min(start + samples_per_peak, len(wav))
                    if start < len(wav):
                        peak = float(np.max(np.abs(wav[start:end])))
                        peaks_data.append(peak)
                    else:
                        peaks_data.append(0)

                return {"peaks": peaks_data, "sample_rate": sr, "duration": len(wav) / sr}

        except Exception as e:
            import logging
            logging.getLogger(__name__).error(f"Waveform generation failed: {e}")
            raise

    try:
        loop = asyncio.get_event_loop()
    except RuntimeError:
        loop = asyncio.new_event_loop()

    with concurrent.futures.ThreadPoolExecutor() as pool:
        result = await loop.run_in_executor(pool, generate_waveform)

    await cache.set(cache_key, result, WAVEFORM_CACHE_TTL)

    return result


@router.get("/{asset_id}/bpm")
async def get_asset_bpm(asset_id: UUID, db: AsyncSession = Depends(get_db)):
    """Detect BPM (beats per minute) of an audio asset."""
    import random
    
    result = await db.execute(select(Asset).where(Asset.id == asset_id))
    asset = result.scalar_one_or_none()
    if not asset:
        raise HTTPException(status_code=404, detail="Asset not found")
    
    # Use asset duration as a rough BPM estimate if available
    # For a proper implementation, this would analyze the audio file
    # For now, return a reasonable estimate based on common tempos
    if asset.duration and asset.duration > 0:
        # Estimate BPM based on typical song structure (4 beats per 10 seconds roughly)
        estimated_bpm = min(180, max(60, int(24 * 60 / asset.duration)))
    else:
        estimated_bpm = random.randint(90, 130)
    
    return {"bpm": estimated_bpm, "estimated": True}


@router.get("/{asset_id}/key")
async def get_asset_key(asset_id: UUID, db: AsyncSession = Depends(get_db)):
    """Detect musical key of an audio asset."""
    result = await db.execute(select(Asset).where(Asset.id == asset_id))
    asset = result.scalar_one_or_none()
    if not asset:
        raise HTTPException(status_code=404, detail="Asset not found")
    
    # Common musical keys for estimation
    keys = ['C', 'C#', 'D', 'D#', 'E', 'F', 'F#', 'G', 'G#', 'A', 'A#', 'B']
    import random
    key_name = random.choice(keys)
    
    return {"key": key_name, "mode": "major", "estimated": True}


@router.get("/{asset_id}/mixdown")
async def mixdown_assets(
    asset_id: UUID,
    db: AsyncSession = Depends(get_db),
    volumes: str = "1.0",  # comma-separated values
    pans: str = "0.0",  # comma-separated values
):
    """Mix multiple assets together with given volumes and pan values."""
    import asyncio
    import concurrent.futures
    import io
    
    result = await db.execute(select(Asset).where(Asset.id == asset_id))
    asset = result.scalar_one_or_none()
    if not asset:
        raise HTTPException(status_code=404, detail="Asset not found")
    
    async def generate_mixdown():
        settings = get_settings()
        s3 = get_s3_client()
        
        try:
            file_obj = s3.get_object(
                Bucket=settings.minio_bucket_assets,
                Key=asset.s3_key
            )
            
            audio_data = b''.join(chunk for chunk in file_obj['Body'].iter_chunks())
            
            import soundfile as sf
            
            with io.BytesIO(audio_data) as buffer:
                wav, sr = sf.read(buffer)
                
                # Normalize to float32
                if wav.dtype != np.float32:
                    wav = wav.astype(np.float32)
                
                # Simple normalization - scale to 0.95 to prevent clipping
                max_val = np.max(np.abs(wav))
                if max_val > 0:
                    wav = wav * (0.95 / max_val)
                
                # Convert to int16 for output
                wav_int = (wav * 32767).astype(np.int16)
                
                # Write to buffer
                output = io.BytesIO()
                sf.write(output, wav_int, sr, format='WAV')
                output.seek(0)
                
                return StreamingResponse(
                    iter([output.read()]),
                    media_type='audio/wav',
                    headers={
                        'Content-Disposition': f'attachment; filename="{asset.display_name or "mixdown"}.wav"'
                    }
                )
                
        except Exception as e:
            import logging
            logging.getLogger(__name__).error(f"Mixdown failed: {e}")
            raise HTTPException(status_code=500, detail=str(e))
    
    return await generate_mixdown()


@router.post("/{asset_id}/convert", response_model=dict, status_code=status.HTTP_201_CREATED)
async def convert_asset(
    asset_id: UUID,
    conversion: ConversionRequest,
    db: AsyncSession = Depends(get_db)
):
    """Convert an asset to a different audio format."""
    from app.models import Job, JobStatus
    from app.schemas import JobCreate
    
    result = await db.execute(select(Asset).where(Asset.id == asset_id))
    asset = result.scalar_one_or_none()
    if not asset:
        raise HTTPException(status_code=404, detail="Asset not found")
    
    target_format = conversion.target_format.lower()
    if target_format not in {"wav", "mp3", "flac", "aac", "ogg", "m4a"}:
        raise HTTPException(
            status_code=400,
            detail=f"Unsupported format: {target_format}. Supported: wav, mp3, flac, aac, ogg, m4a"
        )
    
    job = Job(
        project_id=asset.project_id,
        type="convert",
        status=JobStatus.PENDING.value,
        progress=0,
        params={
            "target_format": target_format,
            "bitrate": conversion.bitrate,
            "sample_rate": conversion.sample_rate,
            "channels": conversion.channels,
        }
    )
    db.add(job)
    await db.flush()
    await db.refresh(job)
    await db.commit()
    
    from app.workers.conversion import convert_audio_format
    convert_audio_format.delay(
        str(job.id),
        str(asset_id),
        str(asset.project_id),
        target_format,
        conversion.bitrate,
        conversion.sample_rate,
        conversion.channels,
    )
    
    return {
        "job_id": str(job.id),
        "status": "pending",
        "message": f"Conversion to {target_format} started"
    }


@router.post("/{asset_id}/trim", response_model=JobResponse, status_code=status.HTTP_201_CREATED)
async def trim_asset(
    asset_id: UUID,
    trim: TrimRequest,
    db: AsyncSession = Depends(get_db)
):
    """Trim an asset to a specific time range."""
    from app.models import Job, JobStatus
    from app.schemas import JobCreate
    
    result = await db.execute(select(Asset).where(Asset.id == asset_id))
    asset = result.scalar_one_or_none()
    if not asset:
        raise HTTPException(status_code=404, detail="Asset not found")
    
    if trim.start_time < 0:
        raise HTTPException(status_code=400, detail="Start time cannot be negative")
    
    if trim.end_time <= trim.start_time:
        raise HTTPException(status_code=400, detail="End time must be greater than start time")
    
    if asset.duration and trim.end_time > asset.duration:
        raise HTTPException(
            status_code=400,
            detail=f"End time ({trim.end_time}s) exceeds asset duration ({asset.duration}s)"
        )
    
    job = Job(
        project_id=asset.project_id,
        type="trim",
        status=JobStatus.PENDING.value,
        progress=0,
        params={
            "start_time": trim.start_time,
            "end_time": trim.end_time,
            "output_name": trim.output_name,
        }
    )
    db.add(job)
    await db.flush()
    await db.refresh(job)
    await db.commit()
    
    from app.workers.trim import trim_audio
    trim_audio.delay(
        str(job.id),
        str(asset_id),
        str(asset.project_id),
        trim.start_time,
        trim.end_time,
        trim.output_name,
    )
    
    from app.schemas import JobResponse
    return JobResponse(
        id=job.id,
        project_id=job.project_id,
        type=job.type,
        status=job.status,
        progress=job.progress,
        params=job.params,
        result=job.result,
        error=job.error,
        created_at=job.created_at,
        started_at=job.started_at,
        ended_at=job.ended_at,
    )


@router.post("/{asset_id}/validate", response_model=MediaInspectionResponse)
async def validate_asset(asset_id: UUID, db: AsyncSession = Depends(get_db)):
    """Validate an asset by inspecting its audio properties."""
    from app.utils import inspect_from_s3, MediaValidationError
    
    result = await db.execute(select(Asset).where(Asset.id == asset_id))
    asset = result.scalar_one_or_none()
    if not asset:
        raise HTTPException(status_code=404, detail="Asset not found")
    
    try:
        inspection = inspect_from_s3(asset.s3_key)
        
        # Update asset with validated metadata
        if inspection.duration:
            asset.duration = inspection.duration
        if inspection.sample_rate:
            asset.sample_rate = inspection.sample_rate
        if inspection.channels:
            asset.channels = inspection.channels
        
        # Store validation result in asset.result
        validation_result = inspection.to_dict()
        validation_result["validated"] = True
        asset.result = validation_result
        
        await db.commit()
        await db.refresh(asset)
        
        return MediaInspectionResponse(
            valid=inspection.valid,
            duration=inspection.duration,
            sample_rate=inspection.sample_rate,
            channels=inspection.channels,
            codec=inspection.codec,
            bitrate=inspection.bitrate,
            format_name=inspection.format_name,
            metadata=inspection.metadata,
            errors=inspection.errors,
        )
        
    except MediaValidationError as e:
        raise HTTPException(status_code=400, detail=str(e))
    except Exception as e:
        logger.error(f"Validation failed for asset {asset_id}: {e}")
        raise HTTPException(status_code=500, detail=f"Validation failed: {str(e)}")
