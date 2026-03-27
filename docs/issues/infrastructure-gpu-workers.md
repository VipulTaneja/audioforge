# Issue: Infrastructure - Add GPU Support for Demucs Processing

## Issue Description
Demucs source separation is extremely slow on CPU (10-30x realtime). GPU acceleration would make it viable for production use. Current implementation doesn't leverage GPU.

## Current Problems
1. **Slow processing**: CPU-only Demucs takes 10-30 minutes for a 3-minute song
2. **No GPU workers**: Can't leverage CUDA for acceleration
3. **Poor UX**: Users wait long periods for results
4. **Resource waste**: High-end machines not utilizing GPU

## Expected Solution
Add GPU-enabled Docker workers:

```dockerfile
# Dockerfile.gpu
FROM nvidia/cuda:11.8-runtime-ubuntu22.04

RUN pip install torch torchvision torchaudio --index-url https://download.pytorch.org/whl/cu118
RUN pip install demucs soundfile

CMD ["celery", "-A", "app.workers.celery_app", "worker", "--loglevel=info", "--pool=prefork", "-c", "4"]
```

Configure Celery to route GPU tasks:
```python
celery_app.conf.task_routes = {
    'tasks.separate_audio_demucs': {'queue': 'gpu_queue'},
    'tasks.denoise_audio': {'queue': 'cpu_queue'},
}
```

Start GPU worker:
```bash
celery -A app.workers.celery_app worker -Q gpu_queue -c 2 --loglevel=info
```

## Priority
High - Critical for production viability

## Related
- Technical Architecture: `docs/technical-architecture.md`
