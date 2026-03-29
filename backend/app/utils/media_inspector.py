"""Media inspection and validation utilities using PyAV."""

import os
import tempfile
import logging
from pathlib import Path
from typing import Optional

logger = logging.getLogger(__name__)

SUPPORTED_FORMATS = {"wav", "mp3", "flac", "aac", "ogg", "m4a", "wma", "aiff"}
DEFAULT_SAMPLE_RATES = {44100, 48000}
DEFAULT_MAX_DURATION = 3600  # 1 hour


class MediaValidationError(Exception):
    """Raised when media validation fails."""
    pass


class MediaInspectionResult:
    """Result of media inspection."""
    
    def __init__(
        self,
        valid: bool,
        duration: Optional[float] = None,
        sample_rate: Optional[int] = None,
        channels: Optional[int] = None,
        codec: Optional[str] = None,
        bitrate: Optional[int] = None,
        format_name: Optional[str] = None,
        metadata: Optional[dict] = None,
        errors: Optional[list[str]] = None,
    ):
        self.valid = valid
        self.duration = duration
        self.sample_rate = sample_rate
        self.channels = channels
        self.codec = codec
        self.bitrate = bitrate
        self.format_name = format_name
        self.metadata = metadata or {}
        self.errors = errors or []
    
    def to_dict(self) -> dict:
        return {
            "valid": self.valid,
            "duration": self.duration,
            "sample_rate": self.sample_rate,
            "channels": self.channels,
            "codec": self.codec,
            "bitrate": self.bitrate,
            "format_name": self.format_name,
            "metadata": self.metadata,
            "errors": self.errors,
        }


class MediaValidationConfig:
    """Configuration for media validation."""
    
    def __init__(
        self,
        supported_formats: set[str] = SUPPORTED_FORMATS,
        allowed_sample_rates: set[int] = DEFAULT_SAMPLE_RATES,
        max_duration: int = DEFAULT_MAX_DURATION,
        allow_multichannel: bool = True,
    ):
        self.supported_formats = supported_formats
        self.allowed_sample_rates = allowed_sample_rates
        self.max_duration = max_duration
        self.allow_multichannel = allow_multichannel


def inspect_media(
    file_path: str,
    config: Optional[MediaValidationConfig] = None,
) -> MediaInspectionResult:
    """
    Inspect media file and validate against rules.
    
    Args:
        file_path: Path to the media file
        config: Validation configuration
        
    Returns:
        MediaInspectionResult with inspection data and validation status
    """
    if config is None:
        config = MediaValidationConfig()
    
    errors = []
    
    # Try PyAV first
    try:
        return _inspect_with_pyav(file_path, config)
    except Exception as e:
        logger.warning(f"PyAV inspection failed: {e}, trying FFmpeg fallback")
    
    # Fallback to FFmpeg
    try:
        return _inspect_with_ffmpeg(file_path, config)
    except Exception as e:
        logger.error(f"FFmpeg inspection also failed: {e}")
        return MediaInspectionResult(
            valid=False,
            errors=[f"Failed to inspect media: {str(e)}"]
        )


def _inspect_with_pyav(file_path: str, config: MediaValidationConfig) -> MediaInspectionResult:
    """Inspect media using PyAV."""
    import av
    
    errors = []
    
    try:
        container = av.open(file_path)
    except Exception as e:
        raise MediaValidationError(f"Cannot open file: {e}")
    
    if not container.streams.audio:
        container.close()
        raise MediaValidationError("No audio stream found")
    
    audio_stream = container.streams.audio[0]
    
    # Get basic properties
    duration = float(container.duration / av.time_base) if container.duration else None
    sample_rate = audio_stream.rate
    channels = audio_stream.channels
    codec_name = audio_stream.codec_context.name if audio_stream.codec_context else None
    
    # Try to get bitrate
    bitrate = None
    if audio_stream.codec_context and audio_stream.codec_context.bit_rate:
        bitrate = audio_stream.codec_context.bit_rate
    
    # Get format
    format_name = container.format.name if container.format else None
    
    # Get metadata
    metadata = {}
    if audio_stream.metadata:
        metadata = dict(audio_stream.metadata)
    if container.metadata:
        metadata.update(dict(container.metadata))
    
    container.close()
    
    # Validate
    if format_name and format_name.lower() not in config.supported_formats:
        errors.append(f"Unsupported format: {format_name}")
    
    if sample_rate and sample_rate not in config.allowed_sample_rates:
        errors.append(f"Unsupported sample rate: {sample_rate}Hz (allowed: {config.allowed_sample_rates})")
    
    if duration and duration > config.max_duration:
        errors.append(f"File too long: {duration:.1f}s (max: {config.max_duration}s)")
    
    # Channel validation
    if channels and not config.allow_multichannel and channels > 2:
        errors.append(f"Too many channels: {channels} (max: 2 for stereo)")
    
    return MediaInspectionResult(
        valid=len(errors) == 0,
        duration=duration,
        sample_rate=sample_rate,
        channels=channels,
        codec=codec_name,
        bitrate=bitrate,
        format_name=format_name,
        metadata=metadata,
        errors=errors,
    )


def _inspect_with_ffmpeg(file_path: str, config: MediaValidationConfig) -> MediaInspectionResult:
    """Fallback inspection using FFmpeg CLI."""
    import subprocess
    import json
    
    cmd = [
        'ffprobe',
        '-v', 'quiet',
        '-print_format', 'json',
        '-show_format',
        '-show_streams',
        file_path
    ]
    
    result = subprocess.run(cmd, capture_output=True, text=True)
    
    if result.returncode != 0:
        raise MediaValidationError(f"FFprobe failed: {result.stderr}")
    
    try:
        data = json.loads(result.stdout)
    except json.JSONDecodeError as e:
        raise MediaValidationError(f"Failed to parse ffprobe output: {e}")
    
    errors = []
    
    # Find audio stream
    audio_stream = None
    for stream in data.get('streams', []):
        if stream.get('codec_type') == 'audio':
            audio_stream = stream
            break
    
    if not audio_stream:
        raise MediaValidationError("No audio stream found")
    
    # Extract properties
    duration = float(data.get('format', {}).get('duration')) if data.get('format', {}).get('duration') else None
    sample_rate = int(audio_stream.get('sample_rate')) if audio_stream.get('sample_rate') else None
    channels = audio_stream.get('channels')
    codec_name = audio_stream.get('codec_name')
    bitrate = int(data.get('format', {}).get('bit_rate')) if data.get('format', {}).get('bit_rate') else None
    format_name = data.get('format', {}).get('format_name')
    
    # Get metadata
    metadata = {}
    format_tags = data.get('format', {}).get('tags', {})
    if format_tags:
        metadata = {k: v for k, v in format_tags.items() if isinstance(v, str)}
    
    # Validate
    if format_name and format_name.lower() not in config.supported_formats:
        errors.append(f"Unsupported format: {format_name}")
    
    if sample_rate and sample_rate not in config.allowed_sample_rates:
        errors.append(f"Unsupported sample rate: {sample_rate}Hz (allowed: {config.allowed_sample_rates})")
    
    if duration and duration > config.max_duration:
        errors.append(f"File too long: {duration:.1f}s (max: {config.max_duration}s)")
    
    if channels and not config.allow_multichannel and channels > 2:
        errors.append(f"Too many channels: {channels} (max: 2 for stereo)")
    
    return MediaInspectionResult(
        valid=len(errors) == 0,
        duration=duration,
        sample_rate=sample_rate,
        channels=channels,
        codec=codec_name,
        bitrate=bitrate,
        format_name=format_name,
        metadata=metadata,
        errors=errors,
    )


def inspect_from_s3(
    s3_key: str,
    config: Optional[MediaValidationConfig] = None,
) -> MediaInspectionResult:
    """
    Inspect media directly from S3 without saving locally.
    
    Downloads to temp file, inspects, then cleans up.
    """
    from app.core.storage import get_s3_client
    from app.core.config import get_settings
    
    settings = get_settings()
    s3_client = get_s3_client()
    
    temp_dir = tempfile.mkdtemp()
    temp_path = None
    
    try:
        temp_path = os.path.join(temp_dir, Path(s3_key).name)
        s3_client.download_file(settings.minio_bucket_assets, s3_key, temp_path)
        
        result = inspect_media(temp_path, config)
        return result
        
    finally:
        if temp_path and os.path.exists(temp_dir):
            import shutil
            shutil.rmtree(temp_dir, ignore_errors=True)


__all__ = [
    "MediaInspectionResult",
    "MediaValidationConfig", 
    "MediaValidationError",
    "inspect_media",
    "inspect_from_s3",
    "SUPPORTED_FORMATS",
    "DEFAULT_SAMPLE_RATES",
    "DEFAULT_MAX_DURATION",
]
