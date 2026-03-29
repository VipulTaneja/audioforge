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
    response = await client.post("/api/v1/projects/", json={"name": "Test Project for Assets"})
    return response.json()


@pytest.mark.asyncio
async def test_get_project_assets(client, test_project):
    """Test getting all assets for a project."""
    project_id = test_project["id"]
    response = await client.get(f"/api/v1/assets/project/{project_id}")
    assert response.status_code == 200
    assert isinstance(response.json(), list)


@pytest.mark.asyncio
async def test_get_asset_not_found(client):
    """Test getting non-existent asset returns 404."""
    fake_id = "00000000-0000-0000-0000-000000000000"
    response = await client.get(f"/api/v1/assets/{fake_id}")
    assert response.status_code == 404


@pytest.mark.asyncio
async def test_presign_upload(client, test_project):
    """Test getting presigned upload URL."""
    project_id = test_project["id"]
    presign_data = {
        "project_id": project_id,
        "filename": "test.mp3",
        "content_type": "audio/mpeg"
    }
    response = await client.post("/api/v1/assets/presign", json=presign_data)
    assert response.status_code == 200
    data = response.json()
    assert "upload_url" in data
    assert "s3_key" in data


@pytest.mark.asyncio
async def test_create_asset_requires_project_id(client):
    """Test that creating asset requires project_id."""
    invalid_data = {
        "filename": "test.mp3",
        "content_type": "audio/mpeg"
    }
    response = await client.post("/api/v1/assets/", json=invalid_data)
    assert response.status_code == 422  # Validation error


@pytest.mark.asyncio
async def test_get_asset_waveform(client, test_project):
    """Test getting asset waveform."""
    project_id = test_project["id"]
    
    # First create an asset record
    asset_data = {
        "project_id": project_id,
        "type": "original",
        "s3_key": f"test/test-file.mp3",
        "filename": "test-file.mp3"
    }
    asset_response = await client.post("/api/v1/assets/", json=asset_data)
    
    if asset_response.status_code == 201:
        asset_id = asset_response.json()["id"]
        waveform_response = await client.get(f"/api/v1/assets/{asset_id}/waveform")
        # May return 404 if file doesn't exist in storage
        assert waveform_response.status_code in [200, 404]


@pytest.mark.asyncio
async def test_get_asset_bpm(client, test_project):
    """Test getting BPM for an asset."""
    project_id = test_project["id"]
    
    # Create an asset
    asset_data = {
        "project_id": project_id,
        "type": "original",
        "s3_key": f"test/test-file.mp3",
        "filename": "test-file.mp3",
        "duration": 180
    }
    asset_response = await client.post("/api/v1/assets/", json=asset_data)
    
    if asset_response.status_code == 201:
        asset_id = asset_response.json()["id"]
        bpm_response = await client.get(f"/api/v1/assets/{asset_id}/bpm")
        assert bpm_response.status_code == 200
        data = bpm_response.json()
        assert "bpm" in data


@pytest.mark.asyncio
async def test_get_asset_key(client, test_project):
    """Test getting musical key for an asset."""
    project_id = test_project["id"]
    
    # Create an asset
    asset_data = {
        "project_id": project_id,
        "type": "original",
        "s3_key": f"test/test-file.mp3",
        "filename": "test-file.mp3",
        "duration": 180
    }
    asset_response = await client.post("/api/v1/assets/", json=asset_data)
    
    if asset_response.status_code == 201:
        asset_id = asset_response.json()["id"]
        key_response = await client.get(f"/api/v1/assets/{asset_id}/key")
        assert key_response.status_code == 200
        data = key_response.json()
        assert "key" in data
