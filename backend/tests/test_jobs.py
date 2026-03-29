import pytest
from httpx import AsyncClient, ASGITransport


@pytest.fixture
async def client():
    """Create test client."""
    from app.main import app
    async with AsyncClient(transport=ASGITransport(app=app), base_url="http://test") as ac:
        yield ac


@pytest.fixture
async def test_project(client):
    """Create a test project."""
    response = await client.post("/api/v1/projects/", json={"name": "Test Project for Jobs"})
    return response.json()


@pytest.fixture
async def test_asset(client, test_project):
    """Create a test asset."""
    project_id = test_project["id"]
    asset_data = {
        "project_id": project_id,
        "type": "original",
        "s3_key": f"test/test-file.mp3",
        "filename": "test-file.mp3",
        "duration": 180
    }
    response = await client.post("/api/v1/assets/", json=asset_data)
    return response.json()


@pytest.mark.asyncio
async def test_list_jobs(client):
    """Test listing all jobs."""
    response = await client.get("/api/v1/jobs/")
    assert response.status_code == 200
    assert isinstance(response.json(), list)


@pytest.mark.asyncio
async def test_create_separate_job(client, test_project, test_asset):
    """Test creating a separation job."""
    project_id = test_project["id"]
    asset_id = test_asset["id"]
    
    job_data = {
        "project_id": project_id,
        "type": "separate",
        "asset_ids": [asset_id],
        "params": {
            "separator": "demucs",
            "demucs_model": "htdemucs",
            "stem_mode": "four_stem"
        }
    }
    response = await client.post("/api/v1/jobs/", json=job_data)
    assert response.status_code == 201
    data = response.json()
    assert data["type"] == "separate"
    assert data["project_id"] == project_id


@pytest.mark.asyncio
async def test_create_denoise_job(client, test_project, test_asset):
    """Test creating a denoise job."""
    project_id = test_project["id"]
    asset_id = test_asset["id"]
    
    job_data = {
        "project_id": project_id,
        "type": "denoise",
        "asset_ids": [asset_id],
        "params": {
            "output_mode": "new",
            "stationary": True,
            "noise_threshold": 1.5
        }
    }
    response = await client.post("/api/v1/jobs/", json=job_data)
    assert response.status_code == 201
    data = response.json()
    assert data["type"] == "denoise"


@pytest.mark.asyncio
async def test_create_job_requires_type(client, test_project):
    """Test that job requires type."""
    job_data = {
        "project_id": test_project["id"],
        "asset_ids": []
    }
    response = await client.post("/api/v1/jobs/", json=job_data)
    assert response.status_code == 422


@pytest.mark.asyncio
async def test_get_job_status(client, test_project, test_asset):
    """Test getting job status."""
    project_id = test_project["id"]
    asset_id = test_asset["id"]
    
    # Create a job
    job_data = {
        "project_id": project_id,
        "type": "separate",
        "asset_ids": [asset_id],
        "params": {"separator": "demucs"}
    }
    create_response = await client.post("/api/v1/jobs/", json=job_data)
    job_id = create_response.json()["id"]
    
    # Get job status
    response = await client.get(f"/api/v1/jobs/{job_id}/status")
    assert response.status_code == 200
    data = response.json()
    assert "status" in data


@pytest.mark.asyncio
async def test_get_nonexistent_job(client):
    """Test getting non-existent job returns 404."""
    fake_id = "00000000-0000-0000-0000-000000000000"
    response = await client.get(f"/api/v1/jobs/{fake_id}")
    assert response.status_code == 404


@pytest.mark.asyncio
async def test_job_with_demucs_params(client, test_project, test_asset):
    """Test job creation with Demucs parameters."""
    project_id = test_project["id"]
    asset_id = test_asset["id"]
    
    job_data = {
        "project_id": project_id,
        "type": "separate",
        "asset_ids": [asset_id],
        "params": {
            "separator": "demucs",
            "demucs_model": "htdemucs_ft",
            "stem_mode": "four_stem"
        }
    }
    response = await client.post("/api/v1/jobs/", json=job_data)
    assert response.status_code == 201
    data = response.json()
    assert data["params"]["demucs_model"] == "htdemucs_ft"


@pytest.mark.asyncio
async def test_job_with_spleeter_params(client, test_project, test_asset):
    """Test job creation with Spleeter parameters."""
    project_id = test_project["id"]
    asset_id = test_asset["id"]
    
    job_data = {
        "project_id": project_id,
        "type": "separate",
        "asset_ids": [asset_id],
        "params": {
            "separator": "spleeter"
        }
    }
    response = await client.post("/api/v1/jobs/", json=job_data)
    assert response.status_code == 201
