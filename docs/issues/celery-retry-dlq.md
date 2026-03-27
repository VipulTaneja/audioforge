# Issue: Celery - Add Retry Logic and Dead Letter Queue

## Issue Description
The current Celery task implementation has no retry mechanism for transient failures and no dead letter queue (DLQ) for failed tasks. When a job fails, it's lost without any recovery option.

## Current Problems
1. **No automatic retries**: Failed tasks are marked as failed immediately
2. **No DLQ**: Failed tasks are lost, can't analyze or replay
3. **No visibility**: Can't easily see why tasks failed
4. **Lost work**: Processing time on failed tasks is wasted

## Expected Solution
Add retry configuration and DLQ:

```python
from celery import Celery
from celery.exceptions import MaxRetriesExceededError

@celery_app.task(
    bind=True,
    name='tasks.denoise_audio',
    autoretry_for=(Exception,),
    retry_backoff=True,
    retry_backoff_max=600,
    retry_kwargs={'max_retries': 3},
    acks_late=True,  # Acknowledge after processing
    reject_on_worker_lost=True,  # Requeue if worker dies
)
def denoise_audio(self, ...):
    try:
        # Processing logic
        pass
    except TransientError as e:
        # Retry for specific errors
        raise self.retry(exc=e)
```

And configure DLQ:
```python
celery_app.conf.task_queues = {
    'default': {},
    'audio_processing': {
        'exchange': 'audio_processing',
        'routing_key': 'audio.#',
    },
    'celery_dlq': {},  # Dead letter queue
}
```

## Priority
High - Job reliability is critical for audio processing

## Related
- Technical Architecture: `docs/technical-architecture.md`
