"""Audio processing constants and utilities."""

import logging
from datetime import datetime
from pathlib import Path
from celery import Task

from app.models import Job, JobStatus

logger = logging.getLogger(__name__)

DEFAULT_DEMUCS_MODEL = "htdemucs"
SUPPORTED_DEMUCS_MODELS = {
    "htdemucs",
    "htdemucs_ft",
    "mdx",
    "mdx_extra",
}
SUPPORTED_STEM_MODES = {"four_stem", "two_stem_vocals"}
FOUR_STEM_MODELS = {"htdemucs", "htdemucs_ft"}
TWO_STEM_MODELS = {"htdemucs", "htdemucs_ft", "mdx", "mdx_extra"}

STEM_TYPES = ["vocals", "drums", "bass", "other", "accompaniment"]

FOUR_STEM_MAPPING = {
    "vocals": "Vocals",
    "drums": "Drums",
    "bass": "Bass",
    "other": "Other",
}


def validate_demucs_model(model: str) -> bool:
    """Check if the Demucs model is supported."""
    return model in SUPPORTED_DEMUCS_MODELS


def validate_stem_mode(mode: str) -> bool:
    """Check if the stem mode is supported."""
    return mode in SUPPORTED_STEM_MODES


def validate_model_for_stem_mode(model: str, stem_mode: str) -> tuple[bool, str]:
    """
    Validate that the model supports the requested stem mode.
    
    Returns:
        Tuple of (is_valid, error_message)
    """
    if stem_mode == "four_stem" and model not in FOUR_STEM_MODELS:
        return False, (
            "The selected model only supports reliable vocals/accompaniment extraction. "
            "Choose htdemucs or htdemucs_ft for 4-stem separation."
        )
    if stem_mode == "two_stem_vocals" and model not in TWO_STEM_MODELS:
        return False, f"Unsupported model for two-stem separation: {model}"
    return True, ""


def get_output_filename(stem_type: str, input_filename: str, stem_mode: str) -> str:
    """Generate output filename for a stem."""
    base_name = Path(input_filename).stem
    return f"{base_name}_{stem_type}.wav"


def report_progress(task: Task | None, job_id: str, progress: int, status_message: str):
    """
    Report progress for a job, updating both Celery task state and database record.
    
    Args:
        task: Celery task instance (optional)
        job_id: UUID of the job
        progress: Progress percentage (0-100)
        status_message: Current status message
    """
    if task:
        task.update_state(
            state='PROGRESS',
            meta={'progress': progress, 'status': status_message}
        )

    try:
        from app.core.database import SessionLocal
        
        with SessionLocal() as db:
            job = db.query(Job).filter(Job.id == job_id).first()
            if not job:
                logger.warning(f"Job {job_id} not found for progress update")
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
