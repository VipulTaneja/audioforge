import pytest
import pytest_asyncio


@pytest_asyncio.fixture
async def client():
    """Create test client."""
    from app.main import app
    from app.core.database import Base, engine
    from app.core.database import SessionLocal
    
    async with engine.begin() as conn:
        await conn.run_sync(Base.metadata.create_all)
    
    yield
    
    async with engine.begin() as conn:
        await conn.run_sync(Base.metadata.drop_all)


@pytest.fixture
def anyio_backend():
    return "asyncio"
