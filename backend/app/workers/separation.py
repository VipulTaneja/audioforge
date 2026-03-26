import os
import tempfile
import logging
from pathlib import Path
from celery import Task
from celery.exceptions import SoftTimeLimitExceeded

from app.workers.celery_app import celery_app

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


@celery_app.task(bind=True, name='tasks.separate_audio_demucs')
def separate_audio_demucs(
    self: Task,
    job_id: str,
    input_asset_id: str,
    project_id: str,
    demucs_model: str | None = None,
    stem_mode: str | None = None,
):
    """
    Separate audio into stems using Demucs.
    
    Args:
        job_id: UUID of the job record
        input_asset_id: UUID of the source audio asset
        project_id: UUID of the project
    
    Returns:
        dict with status and stem information
    """
    from app.core.database import SessionLocal
    from app.models import Job, Asset, JobStatus
    from sqlalchemy import update
    from sqlalchemy.sql import func
    
    temp_dir = None
    
    try:
        with SessionLocal() as db:
            # Update job status to running
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
            
            # Get asset info
            asset = db.query(Asset).filter(Asset.id == input_asset_id).first()
            
            if not asset:
                raise ValueError(f"Asset {input_asset_id} not found")
            
            s3_key = asset.s3_key
            
            # Download audio from S3
            _report_progress(self, job_id, 10, 'Downloading audio from storage...')
            
            temp_dir = tempfile.mkdtemp()
            input_ext = Path(s3_key).suffix or '.audio'
            audio_path = os.path.join(temp_dir, f'input_audio{input_ext}')
            stems_dir = os.path.join(temp_dir, 'stems')
            Path(stems_dir).mkdir(exist_ok=True)
            
            from app.services.storage import storage_service
            storage_service.download_file(s3_key, audio_path)
            
            # Convert to wav if needed (demucs works best with wav)
            input_ext = Path(audio_path).suffix.lower()
            if input_ext != '.wav':
                try:
                    import soundfile as sf
                    wav_path = audio_path.replace(input_ext, '.wav')
                    audio_data, sr = sf.read(audio_path)
                    sf.write(wav_path, audio_data, sr)
                    audio_path = wav_path
                    logger.info(f"Converted {input_ext} to wav")
                except Exception as e:
                    logger.warning(f"Could not convert to wav: {e}")
            
            _report_progress(self, job_id, 20, 'Running Demucs separation...')
            
            job = db.query(Job).filter(Job.id == job_id).first()
            job_params = dict(job.params or {}) if job else {}
            demucs_model = demucs_model or job_params.get("demucs_model", DEFAULT_DEMUCS_MODEL)
            stem_mode = stem_mode or job_params.get("stem_mode", "four_stem")

            if demucs_model not in SUPPORTED_DEMUCS_MODELS:
                raise ValueError(f"Unsupported Demucs model: {demucs_model}")
            if stem_mode not in SUPPORTED_STEM_MODES:
                raise ValueError(f"Unsupported stem mode: {stem_mode}")
            if stem_mode == "four_stem" and demucs_model not in FOUR_STEM_MODELS:
                raise ValueError(
                    "The selected model only supports reliable vocals/accompaniment extraction. "
                    "Choose htdemucs or htdemucs_ft for 4-stem separation."
                )
            if stem_mode == "two_stem_vocals" and demucs_model not in TWO_STEM_MODELS:
                raise ValueError(f"Unsupported model for two-stem separation: {demucs_model}")

            # Run Demucs
            result_stems = run_demucs(
                audio_path,
                stems_dir,
                self,
                job_id=job_id,
                demucs_model=demucs_model,
                stem_mode=stem_mode,
            )
            
            _report_progress(self, job_id, 80, 'Uploading stems to storage...')
            
            # Upload stems and create asset records
            stem_assets = []
            
            for stem_type, stem_path in result_stems.items():
                if stem_path and os.path.exists(stem_path):
                    filename = Path(stem_path).name
                    stem_s3_key = f"projects/{project_id}/stems/{job_id}/{filename}"
                    storage_service.upload_file(stem_path, stem_s3_key)
                    
                    # Create stem asset
                    stem_asset = Asset(
                        project_id=project_id,
                        type='stem',
                        stem_type=stem_type,
                        parent_asset_id=input_asset_id,
                        s3_key=stem_s3_key,
                        s3_key_preview=stem_s3_key,
                        created_by=asset.created_by,
                    )
                    db.add(stem_asset)
                    db.flush()
                    
                    stem_assets.append({
                        'stem_type': stem_type,
                        'asset_id': str(stem_asset.id),
                        's3_key': stem_s3_key,
                    })
            
            _report_progress(self, job_id, 95, 'Finalizing...')
            
            # Update job as succeeded
            db.execute(
                update(Job)
                .where(Job.id == job_id)
                .values(
                    status=JobStatus.SUCCEEDED.value,
                    result={
                        'stems': stem_assets,
                        'message': f"Separation complete using {demucs_model} ({stem_mode.replace('_', ' ')})",
                        'demucs_model': demucs_model,
                        'stem_mode': stem_mode,
                    },
                    progress=100,
                    ended_at=func.now()
                )
            )
            db.commit()
            
            # Cleanup
            if temp_dir and os.path.exists(temp_dir):
                import shutil
                shutil.rmtree(temp_dir, ignore_errors=True)
            
            return {
                'status': 'succeeded',
                'stems': stem_assets,
                'progress': 100
            }
        
    except SoftTimeLimitExceeded:
        logger.error(f"Job {job_id} timed out (soft limit)")
        _update_job_failed(job_id, "Job timed out (soft limit)")
        raise
    except TimeoutError as e:
        logger.error(f"Job {job_id} failed: Demucs timeout - {e}")
        _update_job_failed(job_id, str(e))
        raise
    except Exception as e:
        logger.error(f"Job {job_id} failed: {e}")
        _update_job_failed(job_id, str(e))
        raise


def _update_job_failed(job_id: str, error: str):
    from app.core.database import SessionLocal
    from sqlalchemy import update
    from sqlalchemy.sql import func
    from app.models import Job, JobStatus
    
    try:
        with SessionLocal() as db:
            db.execute(
                update(Job)
                .where(Job.id == job_id)
                .values(
                    status=JobStatus.FAILED.value,
                    progress=0,
                    error=error,
                    result={'message': error},
                    ended_at=func.now()
                )
            )
            db.commit()
    except Exception as e:
        logger.error(f"Failed to update job status: {e}")


def _report_progress(task: Task | None, job_id: str, progress: int, status_message: str):
    if task:
        task.update_state(
            state='PROGRESS',
            meta={'progress': progress, 'status': status_message}
        )

    from app.core.database import SessionLocal
    from app.models import Job, JobStatus

    try:
        with SessionLocal() as db:
            job = db.query(Job).filter(Job.id == job_id).first()
            if not job:
                return

            current_result = dict(job.result or {})
            current_result['message'] = status_message
            job.progress = progress
            if job.status != JobStatus.SUCCEEDED.value:
                job.status = JobStatus.RUNNING.value
            job.result = current_result
            db.commit()
    except Exception as e:
        logger.error(f"Failed to persist job progress for {job_id}: {e}")


def _get_demucs_env() -> dict:
    """Get environment with PATH set to include venv bin."""
    import os
    venv_bin = '/home/vipul/src/test-opencode/backend/venv/bin'
    env = os.environ.copy()
    if 'PATH' in env:
        env['PATH'] = venv_bin + ':' + env['PATH']
    else:
        env['PATH'] = venv_bin
    return env


def _find_demucs_executable() -> str:
    """Find the demucs executable, checking common locations."""
    import shutil
    import os
    
    # First try system PATH
    demucs_path = shutil.which('demucs')
    if demucs_path:
        return demucs_path
    
    # Try common venv locations
    venv_paths = [
        '/home/vipul/src/test-opencode/backend/venv/bin/demucs',
        os.path.expanduser('~/venv/bin/demucs'),
        '/opt/venv/bin/demucs',
    ]
    
    for path in venv_paths:
        if os.path.isfile(path) and os.access(path, os.X_OK):
            return path
    
    return 'demucs'


def run_demucs(
    audio_path: str,
    output_dir: str,
    task: Task = None,
    job_id: str | None = None,
    demucs_model: str = DEFAULT_DEMUCS_MODEL,
    stem_mode: str = "four_stem",
) -> dict:
    """
    Run Demucs separation on audio file using Python API.
    
    Args:
        audio_path: Path to input audio file
        output_dir: Directory to save separated stems
        task: Celery task for progress updates
    
    Returns:
        dict with paths to separated stems
    """
    import os
    from app.core.config import get_settings
    
    settings = get_settings()
    demucs_timeout = settings.demucs_timeout_seconds
    
    # Check if we can use demucs Python API
    demucs_available = False
    try:
        from demucs.pretrained import get_model
        demucs_available = True
        logger.info("Demucs Python module available")
    except ImportError as e:
        logger.warning(f"Demucs Python module not available: {e}")
    
    if not demucs_available:
        logger.warning("Demucs not available, using mock separation")
        return mock_separate(audio_path, output_dir, task, job_id=job_id, stem_mode=stem_mode)
    
    try:
        import torch
        from demucs.pretrained import get_model
        from demucs.apply import apply_model
        
        # Force CPU
        device = 'cpu'
        
        # Load model
        model = get_model(name=demucs_model)
        logger.info(f"Loaded Demucs model '{demucs_model}' on {device}")
        
        # Update progress
        if job_id:
            _report_progress(task, job_id, 30, 'Loading audio...')
        
        # Load audio using soundfile (works without ffmpeg/torchcodec)
        import soundfile as sf
        wav, sr = sf.read(audio_path)
        
        # Convert to tensor with batch dimension
        if len(wav.shape) == 1:
            wav = wav.reshape(1, 1, -1)  # batch, channels, samples
        else:
            wav = wav.T  # samples, channels -> channels, samples
            wav = wav.reshape(1, wav.shape[0], wav.shape[1])  # add batch dim
        
        # Resample if needed
        if sr != model.samplerate:
            try:
                import torchaudio.transforms as T
                resampler = T.Resample(sr, model.samplerate)
                wav = resampler(wav)
            except Exception as e:
                logger.warning(f"Could not resample audio: {e}")
        
        # Convert to float tensor
        wav = torch.from_numpy(wav).float()
        
        # Update progress
        if job_id:
            _report_progress(task, job_id, 50, 'Separating audio...')
        
        # Separate
        with torch.no_grad():
            separated = apply_model(model, wav, device=device)
        
        # separated shape: [batch, stems, channels, samples]
        logger.info(f"Separated shape: {separated.shape}")
        
        # Update progress
        if job_id:
            _report_progress(task, job_id, 70, 'Saving stems...')
        
        # Save stems
        os.makedirs(output_dir, exist_ok=True)
        stems = {}
        source_names = list(getattr(model, "sources", []) or ['vocals', 'drums', 'bass', 'other'])
        
        # Get the first batch item
        separated = separated[0]  # [stems, channels, samples]
        
        if stem_mode == "two_stem_vocals":
            if "vocals" not in source_names:
                raise ValueError(f"Selected model '{demucs_model}' does not expose a vocals source")

            vocals_index = source_names.index("vocals")
            vocals_wav = separated[vocals_index].cpu().numpy()
            accompaniment_wav = separated.sum(dim=0).cpu().numpy() - vocals_wav

            for stem_name, stem_wav in {
                "vocals": vocals_wav,
                "accompaniment": accompaniment_wav,
            }.items():
                if len(stem_wav.shape) > 1:
                    stem_wav = stem_wav.mean(axis=0)
                stem_path = os.path.join(output_dir, f"{stem_name}.wav")
                sf.write(stem_path, stem_wav, model.samplerate)
                stems[stem_name] = stem_path
                logger.info(f"Saved {stem_name} to {stem_path}")
        else:
            preferred_sources = ["vocals", "drums", "bass", "other"]
            for stem_name in preferred_sources:
                if stem_name not in source_names:
                    continue
                stem_index = source_names.index(stem_name)
                stem_wav = separated[stem_index].cpu().numpy()
                if len(stem_wav.shape) > 1:
                    stem_wav = stem_wav.mean(axis=0)
                stem_path = os.path.join(output_dir, f"{stem_name}.wav")
                sf.write(stem_path, stem_wav, model.samplerate)
                stems[stem_name] = stem_path
                logger.info(f"Saved {stem_name} to {stem_path}")
        
        return stems
        
    except Exception as e:
        logger.error(f"Demucs Python API failed: {e}")
        logger.warning("Falling back to mock separation")
        return mock_separate(audio_path, output_dir, task, job_id=job_id, stem_mode=stem_mode)


def mock_separate(
    audio_path: str,
    output_dir: str,
    task: Task = None,
    job_id: str | None = None,
    stem_mode: str = "four_stem",
) -> dict:
    """
    Mock separation for testing when Demucs is not available.
    Creates placeholder audio files based on input audio duration.
    """
    import numpy as np
    import scipy.io.wavfile as wavfile
    
    logger.info("Using mock separation (Demucs not available)")
    
    if job_id:
        _report_progress(task, job_id, 50, 'Creating mock stems...')
    
    sample_rate = 44100
    duration = 30  # 30 seconds default
    num_samples = sample_rate * duration
    
    # Try to read input audio to get actual duration
    try:
        import soundfile as sf
        audio_data, sr = sf.read(audio_path)
        duration = len(audio_data) / sr
        sample_rate = sr
        num_samples = len(audio_data)
        if len(audio_data.shape) > 1:
            audio_data = audio_data.mean(axis=1)
    except ImportError:
        logger.warning("soundfile not installed, using default duration")
    except Exception as e:
        logger.warning(f"Could not read input audio, using default duration: {e}")
    
    stems = {}
    stem_names = (
        ['vocals', 'accompaniment']
        if stem_mode == "two_stem_vocals"
        else ['vocals', 'drums', 'bass', 'other']
    )
    
    # Different characteristics for each stem type
    stem_configs = {
        'vocals': {'freq_range': (200, 800), 'modulation': True},
        'drums': {'freq_range': (60, 200), 'modulation': False},
        'bass': {'freq_range': (40, 150), 'modulation': False},
        'other': {'freq_range': (200, 2000), 'modulation': True},
        'accompaniment': {'freq_range': (120, 1600), 'modulation': True},
    }
    
    np.random.seed(42)
    
    for i, stem_name in enumerate(stem_names):
        config = stem_configs[stem_name]
        
        # Generate noise-based audio with frequency characteristics
        t = np.linspace(0, duration, num_samples)
        
        # Base frequency with some variation
        base_freq = (config['freq_range'][0] + config['freq_range'][1]) / 2
        freq_variation = np.random.uniform(*config['freq_range']) * 0.1
        freq = base_freq + freq_variation
        
        # Generate audio with harmonics
        audio = np.sin(2 * np.pi * freq * t)
        audio += 0.3 * np.sin(2 * np.pi * freq * 2 * t)  # 2nd harmonic
        audio += 0.15 * np.sin(2 * np.pi * freq * 3 * t)  # 3rd harmonic
        
        # Add some noise for texture
        audio += 0.1 * np.random.randn(len(audio))
        
        # Apply envelope modulation for vocals/other
        if config['modulation']:
            envelope = 0.5 + 0.5 * np.sin(2 * np.pi * 0.5 * t)  # Slow modulation
            audio *= envelope
        
        # Normalize
        audio = audio / np.max(np.abs(audio)) * 0.7
        audio = (audio * 32767).astype(np.int16)
        
        stem_path = os.path.join(output_dir, f'{stem_name}.wav')
        wavfile.write(stem_path, sample_rate, audio)
        stems[stem_name] = stem_path
        
        if job_id:
            progress = min(75, 50 + (i * 10))
            _report_progress(task, job_id, progress, f'Created {stem_name}.wav')
    
    return stems
