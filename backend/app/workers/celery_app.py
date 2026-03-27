from celery import Celery
from celery.exceptions import MaxRetriesExceededError
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
    task_default_queue="audioforge",
    task_queues={
        "audioforge": {},
        "audioforge_dlq": {
            "exchange": "audioforge_dlq",
            "routing_key": "audioforge_dlq",
        },
    },
    task_routes={
        "tasks.separate_audio_*": {"queue": "audioforge"},
        "tasks.denoise_audio": {"queue": "audioforge"},
        "tasks.instrument_id": {"queue": "audioforge"},
    },
    task_reject_on_worker_lost=True,
    task_acks_late=True,
    worker_disable_rate_limits=True,
)
