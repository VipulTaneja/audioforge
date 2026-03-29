"""Audio trimming worker using PyDub and FFmpeg."""

import os
import tempfile
import logging
from pathlib import Path
from celery import Task

from app.workers.celery_app import celery_app

logger = logging.getLogger(__name__)


@celery_app.task(bind=True, name='tasks.trim_audio')
def trim_audio(
    self: Task,
    job_id: str,
    input_asset_id: str,
    project_id: str,
    start_time: float,
    end_time: float,
    output_name: str | None = None,
):
    """
    Trim audio to a specific time range.
    
    Args:
        job_id: UUID of the job record
        input_asset_id: UUID of the source audio asset
        project_id: UUID of the project
        start_time: Start time in seconds
        end_time: End time in seconds
        output_name: Optional name for output file
    
    Returns:
        dict with status and trimmed asset information
    """
    from app.core.database import SessionLocal
    from app.models import Job, Asset, JobStatus
    from sqlalchemy import update
    from sqlalchemy.sql import func
    import uuid
    
    temp_dir = None
    
    try:
        with SessionLocal() as db:
            db.execute(
                update(Job)
                .where(Job.id == job_id)
                .values(
                    status=JobStatus.RUNNING.value,
                    started_at=func.now(),
                    worker_pod=os.environ.get('HOSTNAME', 'local')
                )
            )
            db.commit()
            
            _report_progress(self, job_id, 5, 'Fetching asset info...')
            
            asset = db.query(Asset).filter(Asset.id == input_asset_id).first()
            if not asset:
                raise ValueError(f"Asset {input_asset_id} not found")
            
            if start_time < 0:
                raise ValueError("Start time cannot be negative")
            
            if end_time <= start_time:
                raise ValueError("End time must be greater than start time")
            
            if asset.duration and end_time > asset.duration:
                raise ValueError(f"End time ({end_time}s) exceeds asset duration ({asset.duration}s)")
            
            s3_key = asset.s3_key
            
            _report_progress(self, job_id, 10, 'Downloading audio from storage...')
            
            temp_dir = tempfile.mkdtemp()
            input_ext = Path(s3_key).suffix or '.wav'
            input_path = os.path.join(temp_dir, f"input{input_ext}")
            
            from app.core.storage import get_s3_client
            from app.core.config import get_settings
            
            settings = get_settings()
            s3_client = get_s3_client()
            
            try:
                s3_client.download_file(settings.minio_bucket_assets, s3_key, input_path)
            except Exception as e:
                raise ValueError(f"Failed to download from S3: {e}")
            
            _report_progress(self, job_id, 30, 'Trimming audio...')
            
            base_name = output_name or Path(asset.s3_key).stem
            output_filename = f"{base_name}_trimmed.wav"
            output_path = os.path.join(temp_dir, output_filename)
            
            try:
                trim_with_pydub(input_path, output_path, start_time, end_time)
            except Exception as e:
                logger.warning(f"PyDub trim failed, trying FFmpeg fallback: {e}")
                trim_with_ffmpeg(input_path, output_path, start_time, end_time)
            
            _report_progress(self, job_id, 70, 'Uploading trimmed audio...')
            
            output_s3_key = f"{project_id}/{uuid.uuid4()}_{output_filename}"
            
            try:
                s3_client.upload_file(
                    output_path,
                    settings.minio_bucket_assets,
                    output_s3_key,
                    ExtraArgs={'ContentType': 'audio/wav'}
                )
            except Exception as e:
                raise ValueError(f"Failed to upload to S3: {e}")
            
            _report_progress(self, job_id, 90, 'Creating asset record...')
            
            from app.models import User
            user = db.query(User).first()
            if not user:
                user = User(email="local@audioforge.local", name="Local User")
                db.add(user)
                db.flush()
            
            trimmed_duration = end_time - start_time
            
            trimmed_asset = Asset(
                project_id=project_id,
                created_by=user.id,
                s3_key=output_s3_key,
                type="original",
                duration=trimmed_duration,
            )
            db.add(trimmed_asset)
            
            job = db.query(Job).filter(Job.id == job_id).first()
            job.status = JobStatus.SUCCEEDED.value
            job.progress = 100
            job.ended_at = func.now()
            job.result = {
                "status": "succeeded",
                "trimmed_asset_id": str(trimmed_asset.id),
                "start_time": start_time,
                "end_time": end_time,
                "duration": trimmed_duration,
                "s3_key": output_s3_key,
            }
            
            db.commit()
            
            _report_progress(self, job_id, 100, 'Trim complete!')
            
            return {
                "status": "succeeded",
                "trimmed_asset_id": str(trimmed_asset.id),
                "s3_key": output_s3_key,
            }
            
    except Exception as e:
        logger.error(f"Trim failed: {e}")
        with SessionLocal() as db:
            job = db.query(Job).filter(Job.id == job_id).first()
            if job:
                job.status = JobStatus.FAILED.value
                job.error = str(e)
                job.ended_at = func.now()
                db.commit()
        
        return {"status": "failed", "error": str(e)}
    
    finally:
        if temp_dir and os.path.exists(temp_dir):
            import shutil
            shutil.rmtree(temp_dir, ignore_errors=True)


def trim_with_pydub(input_path: str, output_path: str, start_sec: float, end_sec: float):
    """Trim audio using PyDub."""
    import subprocess
    from pydub import AudioSegment
    
    ext = input_path.lower().split('.')[-1] if '.' in input_path else 'wav'
    format_map = {
        'mp3': 'mp3',
        'wav': 'wav',
        'flac': 'flac',
        'ogg': 'ogg',
        'm4a': 'mp4',
        'aac': 'mp4',
    }
    audio_format = format_map.get(ext, 'wav')
    
    try:
        audio = AudioSegment.from_file(input_path, format=audio_format)
    except Exception:
        cmd = ['ffmpeg', '-i', input_path, '-f', 'wav', '-']
        result = subprocess.run(cmd, capture_output=True, text=True)
        if result.returncode != 0:
            raise ValueError(f"Failed to decode audio: {result.stderr}")
        import io
        audio = AudioSegment.from_file(io.BytesIO(result.stdout.encode()), format='wav')
    
    start_ms = start_sec * 1000
    end_ms = end_sec * 1000
    
    trimmed = audio[start_ms:end_ms]
    trimmed.export(output_path, format="wav")


def trim_with_ffmpeg(input_path: str, output_path: str, start_sec: float, end_sec: float):
    """Fallback trim using FFmpeg CLI."""
    import subprocess
    
    duration = end_sec - start_sec
    
    cmd = [
        'ffmpeg',
        '-y',
        '-i', input_path,
        '-ss', str(start_sec),
        '-t', str(duration),
        '-acodec', 'pcm_s16le',
        output_path
    ]
    
    result = subprocess.run(cmd, capture_output=True, text=True)
    if result.returncode != 0:
        raise ValueError(f"FFmpeg trim failed: {result.stderr}")


def _report_progress(task: Task | None, job_id: str, progress: int, status_message: str):
    """Report progress for a job."""
    if task:
        task.update_state(
            state='PROGRESS',
            meta={'progress': progress, 'status': status_message}
        )

    try:
        from app.core.database import SessionLocal
        from app.models import Job, JobStatus
        from datetime import datetime
        
        with SessionLocal() as db:
            job = db.query(Job).filter(Job.id == job_id).first()
            if not job:
                return

            current_result = dict(job.result or {})
            current_result['message'] = status_message
            job.progress = progress
            if job.status != JobStatus.SUCCEEDED.value:
                job.status = JobStatus.RUNNING.value
            if job.started_at is None:
                job.started_at = datetime.utcnow()
            job.result = current_result
            db.commit()
    except Exception as e:
        logger.error(f"Failed to persist job progress for {job_id}: {e}")
