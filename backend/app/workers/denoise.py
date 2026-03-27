import io
import logging
import numpy as np
import soundfile as sf
from celery import Task
import logging

from app.workers.celery_app import celery_app

logger = logging.getLogger(__name__)

try:
    import noisereduce as nr
    NOISE_REDUCE_AVAILABLE = True
except ImportError:
    NOISE_REDUCE_AVAILABLE = False
    logger.warning("noisereduce not available, noise reduction will use fallback")


@celery_app.task(bind=True, name='tasks.denoise_audio')
def denoise_audio(
    self: Task,
    job_id: str,
    input_asset_id: str,
    project_id: str,
    output_mode: str = 'new',
    stationary: bool = True,
    noise_threshold: float = 1.5,
):
    """Denoise an audio file using noisereduce."""
    from app.core.database import SessionLocal
    from app.models import Job, Asset, JobStatus
    from sqlalchemy import update

    self.update_state(state="PROGRESS", meta={"progress": 10, "status": "Loading audio..."})

    if not NOISE_REDUCE_AVAILABLE:
        return {
            "status": "failed",
            "error": "noisereduce not installed",
        }

    db = SessionLocal()
    try:
        # Get asset info and its creator
        asset = db.query(Asset).filter(Asset.id == input_asset_id).first()
        if not asset:
            return {"status": "failed", "error": f"Asset {input_asset_id} not found"}

        s3_key = asset.s3_key
        created_by = asset.created_by  # Inherit creator from original asset

        from app.core.storage import get_s3_client
        from app.core.config import get_settings

        settings = get_settings()
        s3_client = get_s3_client()

        # Download audio from S3
        self.update_state(state="PROGRESS", meta={"progress": 20, "status": "Downloading from storage..."})
        audio_bytes = s3_client.get_object(Bucket=settings.minio_bucket_assets, Key=s3_key)['Body'].read()
        
        # Load audio
        self.update_state(state="PROGRESS", meta={"progress": 40, "status": "Loading audio..."})
        audio_buffer = io.BytesIO(audio_bytes)
        audio_data, sample_rate = sf.read(audio_buffer)
        
        # Ensure mono for processing if stereo
        if len(audio_data.shape) > 1:
            audio_data = np.mean(audio_data, axis=1)
        
        # Reduce noise
        self.update_state(state="PROGRESS", meta={"progress": 60, "status": "Reducing noise..."})
        reduced_noise = nr.reduce_noise(
            y=audio_data,
            sr=sample_rate,
            stationary=stationary,
            n_fft=2048,
            hop_length=512,
            n_std_thresh_stationary=noise_threshold,
            use_tqdm=False,
        )
        
        # Upload denoised audio
        self.update_state(state="PROGRESS", meta={"progress": 80, "status": "Uploading result..."})
        
        if output_mode == 'overwrite':
            # Overwrite the original file
            output_key = s3_key
        else:
            # Create new asset
            output_key = s3_key.replace('.wav', '_denoised.wav').replace('.mp3', '_denoised.wav').replace('.flac', '_denoised.flac')
        
        output_buffer = io.BytesIO()
        sf.write(output_buffer, reduced_noise, sample_rate, format='WAV')
        output_buffer.seek(0)
        
        s3_client.upload_fileobj(
            output_buffer,
            Bucket=settings.minio_bucket_assets,
            Key=output_key,
            ExtraArgs={'ContentType': 'audio/wav'}
        )
        
        if output_mode == 'overwrite':
            # Update existing asset
            existing_name = asset.display_name or (asset.result.get('display_name') if asset.result else None)
            asset.display_name = f"{existing_name or 'Audio'} (Denoised)"
            db.flush()
            result_asset_id = str(asset.id)
        else:
            # Create new asset
            existing_name = asset.display_name or (asset.result.get('display_name') if asset.result else None)
            new_asset = Asset(
                project_id=project_id,
                type='original',
                s3_key=output_key,
                display_name=f"{existing_name or 'Audio'} (Denoised)",
                duration=len(reduced_noise) / sample_rate,
                sample_rate=sample_rate,
                channels=1,
                created_by=created_by,
            )
            db.add(new_asset)
            db.flush()
            result_asset_id = str(new_asset.id)
        
        # Update job status
        db.execute(
            update(Job)
            .where(Job.id == job_id)
            .values(
                status=JobStatus.SUCCEEDED.value,
                progress=100,
                result={"asset_id": result_asset_id},
            )
        )
        db.commit()
        
        self.update_state(state="PROGRESS", meta={"progress": 100, "status": "Complete!"})
        
        return {
            "status": "succeeded",
            "asset_id": result_asset_id,
            "metrics": {
                "sample_rate": sample_rate,
                "duration": len(reduced_noise) / sample_rate,
            },
        }
        
    except Exception as e:
        logger.error(f"Denoise failed for asset {input_asset_id}: {e}")
        try:
            db.execute(
                update(Job)
                .where(Job.id == job_id)
                .values(
                    status=JobStatus.FAILED.value,
                    error=str(e),
                )
            )
            db.commit()
        except:
            pass
        return {
            "status": "failed",
            "error": str(e),
        }
    finally:
        db.close()
