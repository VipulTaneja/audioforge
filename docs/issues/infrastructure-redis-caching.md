# Issue: Infrastructure - Add Redis Caching for Waveforms and Job Status

## Issue Description
Currently, every request for waveform data hits the database and regenerates peaks. Job status polling also hits the database. Redis caching would significantly improve performance.

## Current Problems
1. **No caching**: Waveform peaks regenerated on every request
2. **Database load**: Frequent queries for job status
3. **Slow responses**: Repeated computation for same data

## Expected Solution
Add Redis caching:
```python
import redis
import json

redis_client = redis.Redis(host='localhost', port=6379, db=3)

def get_waveform_peaks(asset_id):
    cache_key = f"waveform:{asset_id}"
    cached = redis_client.get(cache_key)
    if cached:
        return json.loads(cached)
    
    # Generate peaks
    peaks = generate_waveform_peaks(asset_id)
    redis_client.setex(cache_key, 3600, json.dumps(peaks))  # 1 hour cache
    return peaks
```

## Priority
Medium - Performance optimization

## Related
- Technical Architecture: `docs/technical-architecture.md`
