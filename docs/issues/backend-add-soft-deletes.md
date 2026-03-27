# Issue: Backend - Add Soft Deletes to Database Models

## Issue Description
The current implementation uses hard deletes for projects and assets. There's no way to recover accidentally deleted data. This is a critical data safety issue.

## Current Problems
1. **No recovery**: Deleted projects/assets are permanently lost
2. **Cascading deletes**: Assets deleted when project deleted
3. **No audit trail**: Can't see what was deleted and when
4. **Data loss risk**: Buggy delete operations cause permanent data loss

## Expected Solution
Add soft delete functionality:

```python
class Project(Base):
    __tablename__ = "projects"
    
    id = Column(UUID(as_uuid=True), primary_key=True, default=uuid.uuid4)
    name = Column(String(255), nullable=False)
    created_at = Column(DateTime, default=datetime.utcnow)
    deleted_at = Column(DateTime, nullable=True)  # Soft delete
    
    # Query helper
    @hybrid_property
    def is_deleted(self):
        return self.deleted_at is not None
```

## Query Pattern Change
All queries need to filter out deleted records:
```python
# Before
result = await db.execute(select(Project))

# After
from sqlalchemy import and_
result = await db.execute(
    select(Project).where(Project.deleted_at.is_(None))
)
```

Or use a global query filter with SQLAlchemy event listeners.

## Priority
High - Data safety is critical

## Related
- Technical Architecture: `docs/technical-architecture.md`
