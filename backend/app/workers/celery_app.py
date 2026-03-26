from celery import Celery
from app.core.config import get_settings

settings = get_settings()

celery_app = Celery(
    "audioforge",
    broker=settings.celery_broker_url,
    backend=settings.celery_result_backend,
    include=["app.workers.separation", "app.workers.denoise", "app.workers.instrument_id"],
)

celery_app.conf.update(
    task_serializer="json",
    accept_content=["json"],
    result_serializer="json",
    timezone="UTC",
    enable_utc=True,
    task_track_started=True,
    task_time_limit=3600,
    worker_prefetch_multiplier=1,
    task_ignore_result=False,
    result_extended=True,
)
