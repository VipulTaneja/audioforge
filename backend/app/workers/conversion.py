"""Audio format conversion worker using PyAV."""

import os
import tempfile
import logging
from pathlib import Path
from celery import Task

from app.workers.celery_app import celery_app

logger = logging.getLogger(__name__)

SUPPORTED_FORMATS = {"wav", "mp3", "flac", "aac", "ogg", "m4a"}
AUDIO_FORMATS = {"wav", "mp3", "flac", "aac", "ogg", "m4a", "wma", "aiff"}

CODEC_MAP = {
    "wav": "pcm_s16le",
    "mp3": "libmp3lame",
    "flac": "flac",
    "aac": "aac",
    "ogg": "libvorbis",
    "m4a": "aac",
}


def is_audio_format(format_str: str) -> bool:
    """Check if format is a supported audio format."""
    return format_str.lower() in AUDIO_FORMATS


def get_output_codec(format_str: str) -> str:
    """Get appropriate codec for output format."""
    return CODEC_MAP.get(format_str.lower(), "copy")


@celery_app.task(bind=True, name='tasks.convert_audio_format')
def convert_audio_format(
    self: Task,
    job_id: str,
    input_asset_id: str,
    project_id: str,
    target_format: str,
    bitrate: int = 192000,
    sample_rate: int = 44100,
    channels: int = 2,
):
    """
    Convert audio to target format using PyAV.
    
    Args:
        job_id: UUID of the job record
        input_asset_id: UUID of the source audio asset
        project_id: UUID of the project
        target_format: Target audio format (wav, mp3, flac, aac, ogg)
        bitrate: Target bitrate for lossy formats
        sample_rate: Target sample rate
        channels: Target channel count
    
    Returns:
        dict with status and converted asset information
    """
    from app.core.database import SessionLocal
    from app.models import Job, Asset, JobStatus
    from sqlalchemy import update
    from sqlalchemy.sql import func
    import av
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
            
            s3_key = asset.s3_key
            
            _report_progress(self, job_id, 10, 'Downloading audio from storage...')
            
            temp_dir = tempfile.mkdtemp()
            input_ext = Path(s3_key).suffix or '.audio'
            input_path = os.path.join(temp_dir, f"input{input_ext}")
            output_filename = f"converted_{Path(asset.filename or 'audio').stem}.{target_format}"
            output_path = os.path.join(temp_dir, output_filename)
            
            from app.core.storage import get_s3_client
            from app.core.config import get_settings
            
            settings = get_settings()
            s3_client = get_s3_client()
            
            try:
                s3_client.download_file(settings.minio_bucket_assets, s3_key, input_path)
            except Exception as e:
                raise ValueError(f"Failed to download from S3: {e}")
            
            _report_progress(self, job_id, 30, 'Converting audio format...')
            
            try:
                convert_with_pyav(input_path, output_path, target_format, bitrate, sample_rate, channels)
            except Exception as e:
                logger.warning(f"PyAV conversion failed, trying FFmpeg fallback: {e}")
                convert_with_ffmpeg(input_path, output_path, target_format, bitrate, sample_rate, channels)
            
            _report_progress(self, job_id, 70, 'Uploading converted audio...')
            
            output_s3_key = f"{project_id}/{uuid.uuid4()}_{output_filename}"
            
            try:
                s3_client.upload_file(
                    output_path,
                    settings.minio_bucket_assets,
                    output_s3_key,
                    ExtraArgs={
                        'ContentType': get_content_type(target_format)
                    }
                )
            except Exception as e:
                raise ValueError(f"Failed to upload to S3: {e}")
            
            _report_progress(self, job_id, 90, 'Creating asset record...')
            
            from app.api.assets import get_or_create_default_user
            user = db.query(User).first()
            if not user:
                from app.models import User
                user = User(email="local@audioforge.local", name="Local User")
                db.add(user)
                await db.flush()
            
            converted_asset = Asset(
                project_id=project_id,
                created_by=user.id,
                filename=output_filename,
                s3_key=output_s3_key,
                type="original",
                duration=asset.duration,
                status="ready"
            )
            db.add(converted_asset)
            
            job = db.query(Job).filter(Job.id == job_id).first()
            job.status = JobStatus.SUCCEEDED.value
            job.progress = 100
            job.ended_at = func.now()
            job.result = {
                "status": "succeeded",
                "converted_asset_id": str(converted_asset.id),
                "original_format": input_ext.lstrip('.'),
                "target_format": target_format,
                "s3_key": output_s3_key,
            }
            
            db.commit()
            
            _report_progress(self, job_id, 100, 'Conversion complete!')
            
            return {
                "status": "succeeded",
                "converted_asset_id": str(converted_asset.id),
                "s3_key": output_s3_key,
            }
            
    except Exception as e:
        logger.error(f"Conversion failed: {e}")
        with SessionLocal() as db:
            job = db.query(Job).filter(Job.id == job_id).first()
            if job:
                job.status = JobStatus.FAILED.value
                job.error = str(e)
                job.ended_at = func.now()
                db.commit()
        
        return {
            "status": "failed",
            "error": str(e),
        }
    
    finally:
        if temp_dir and os.path.exists(temp_dir):
            import shutil
            shutil.rmtree(temp_dir, ignore_errors=True)


def convert_with_pyav(
    input_path: str,
    output_path: str,
    target_format: str,
    bitrate: int,
    sample_rate: int,
    channels: int
):
    """Convert audio using PyAV."""
    import av
    
    input_container = av.open(input_path)
    input_stream = input_container.streams.audio[0]
    
    output_container = av.open(output_path, mode='w')
    
    output_stream = output_container.add_stream(codec_name=get_output_codec(target_format), rate=sample_rate)
    output_stream.channels = channels
    output_stream.layout = 'stereo' if channels == 2 else 'mono'
    
    if target_format in {'mp3', 'aac', 'ogg'}:
        output_stream.bit_rate = bitrate
    
    for frame in input_container.decode(input_stream):
        frame.pts = None
        for out_frame in output_stream.encode(frame):
            output_container.mux(out_frame)
    
    for out_frame in output_stream.encode():
        output_container.mux(out_frame)
    
    input_container.close()
    output_container.close()


def convert_with_ffmpeg(
    input_path: str,
    output_path: str,
    target_format: str,
    bitrate: int,
    sample_rate: int,
    channels: int
):
    """Fallback conversion using FFmpeg CLI."""
    import subprocess
    
    codec = get_output_codec(target_format)
    
    cmd = [
        'ffmpeg',
        '-y',
        '-i', input_path,
        '-acodec', codec,
        '-ar', str(sample_rate),
        '-ac', str(channels),
    ]
    
    if target_format in {'mp3', 'aac', 'ogg'}:
        cmd.extend(['-b:a', str(bitrate)])
    
    cmd.append(output_path)
    
    result = subprocess.run(cmd, capture_output=True, text=True)
    if result.returncode != 0:
        raise ValueError(f"FFmpeg conversion failed: {result.stderr}")


def get_content_type(format_str: str) -> str:
    """Get MIME content type for format."""
    content_types = {
        'wav': 'audio/wav',
        'mp3': 'audio/mpeg',
        'flac': 'audio/flac',
        'aac': 'audio/aac',
        'ogg': 'audio/ogg',
        'm4a': 'audio/mp4',
    }
    return content_types.get(format_str.lower(), 'audio/wav')


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
