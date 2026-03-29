import pytest
from httpx import AsyncClient, ASGITransport
from unittest.mock import patch, AsyncMock, MagicMock
from datetime import datetime


@pytest.fixture
async def client():
    """Create test client."""
    from app.main import app
    async with AsyncClient(transport=ASGITransport(app=app), base_url="http://test") as ac:
        yield ac


@pytest.mark.asyncio
async def test_health_endpoint(client):
    """Test health check endpoint returns healthy status."""
    response = await client.get("/health")
    assert response.status_code == 200
    data = response.json()
    assert data["status"] == "healthy"


@pytest.mark.asyncio
async def test_create_project(client):
    """Test creating a new project."""
    project_data = {"name": "Test Project"}
    response = await client.post("/api/v1/projects/", json=project_data)
    assert response.status_code == 201
    data = response.json()
    assert data["name"] == "Test Project"
    assert "id" in data


@pytest.mark.asyncio
async def test_list_projects(client):
    """Test listing all projects."""
    response = await client.get("/api/v1/projects/")
    assert response.status_code == 200
    assert isinstance(response.json(), list)


@pytest.mark.asyncio
async def test_get_project(client):
    """Test getting a specific project."""
    # First create a project
    create_response = await client.post("/api/v1/projects/", json={"name": "Test Project"})
    project_id = create_response.json()["id"]
    
    # Then get it
    response = await client.get(f"/api/v1/projects/{project_id}")
    assert response.status_code == 200
    data = response.json()
    assert data["id"] == project_id
    assert data["name"] == "Test Project"


@pytest.mark.asyncio
async def test_update_project(client):
    """Test updating a project."""
    # Create project
    create_response = await client.post("/api/v1/projects/", json={"name": "Original Name"})
    project_id = create_response.json()["id"]
    
    # Update project
    response = await client.patch(f"/api/v1/projects/{project_id}", json={"name": "Updated Name"})
    assert response.status_code == 200
    data = response.json()
    assert data["name"] == "Updated Name"


@pytest.mark.asyncio
async def test_delete_project(client):
    """Test deleting a project."""
    # Create project
    create_response = await client.post("/api/v1/projects/", json={"name": "To Delete"})
    project_id = create_response.json()["id"]
    
    # Delete project
    response = await client.delete(f"/api/v1/projects/{project_id}")
    assert response.status_code == 204
    
    # Verify it's gone
    get_response = await client.get(f"/api/v1/projects/{project_id}")
    assert get_response.status_code == 404


@pytest.mark.asyncio
async def test_get_project_not_found(client):
    """Test getting a non-existent project returns 404."""
    fake_id = "00000000-0000-0000-0000-000000000000"
    response = await client.get(f"/api/v1/projects/{fake_id}")
    assert response.status_code == 404
