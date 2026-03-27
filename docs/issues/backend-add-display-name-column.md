# Issue: Backend - Add display_name Column to Asset Model

## Issue Description
The `Asset` model in `backend/app/models/models.py` uses a JSON column (`result`) to store `display_name`, but this should be a proper database column for several reasons:

## Current Problems
1. **Overhead**: JSON column adds storage and query overhead
2. **Type Safety**: Can't use TypeScript/Python type hints properly
3. **Indexing**: Can't easily index or query by display_name
4. **Schema Clarity**: Mixed with result metadata which should be separate

## Technical Details
- File: `backend/app/models/models.py`
- Current: `result = Column(JSON, nullable=True)` stores `{"display_name": "..."}`
- Workaround needed: Access via `asset.result.get('display_name')`

## Expected Solution
Add a `display_name` column to the Asset model:

```python
class Asset(Base):
    __tablename__ = "assets"
    
    id = Column(UUID(as_uuid=True), primary_key=True, default=uuid.uuid4)
    project_id = Column(UUID(as_uuid=True), ForeignKey("projects.id"), nullable=False)
    type = Column(String(50), default=AssetType.ORIGINAL.value)
    stem_type = Column(String(50), nullable=True)
    parent_asset_id = Column(UUID(as_uuid=True), ForeignKey("assets.id"), nullable=True)
    s3_key = Column(Text, nullable=False)
    s3_key_preview = Column(Text, nullable=True)
    display_name = Column(String(255), nullable=True)  # NEW COLUMN
    duration = Column(Float, nullable=True)
    channels = Column(Integer, default=2)
    sample_rate = Column(Integer, default=44100)
    waveform_png = Column(Text, nullable=True)
    created_by = Column(UUID(as_uuid=True), ForeignKey("users.id"), nullable=False)
    created_at = Column(DateTime, default=datetime.utcnow)
    result = Column(JSON, nullable=True)  # Keep for machine-readable results
```

## Migration Required
```bash
alembic revision --autogenerate -m "Add display_name to assets"
alembic upgrade head
```

## Files to Update
- `backend/app/models/models.py` - Add column
- `backend/app/schemas/schemas.py` - Update Pydantic schemas
- `backend/app/api/assets.py` - Update API to use new column
- `backend/app/workers/denoise.py` - Update worker to use new column

## Priority
Medium - Technical debt that affects type safety and query performance

## Related
- Technical Architecture: `docs/technical-architecture.md`
- Also causes LSP errors in denoise.py and assets.py
