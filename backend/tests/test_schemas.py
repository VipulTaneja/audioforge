import pytest
from pydantic import ValidationError
from app.schemas.schemas import (
    ProjectCreate,
    AssetCreate,
    JobCreate,
    PresignRequest,
)


class TestProjectSchemas:
    """Test project schema validation."""

    def test_project_create_valid(self):
        """Test creating project with valid data."""
        project = ProjectCreate(name="Test Project")
        assert project.name == "Test Project"

    def test_project_create_with_org(self):
        """Test creating project with organization."""
        import uuid
        org_uuid = uuid.UUID("123e4567-e89b-12d3-a456-426614174000")
        project = ProjectCreate(name="Test Project", org_id=org_uuid)
        assert project.name == "Test Project"
        assert project.org_id == org_uuid


class TestAssetSchemas:
    """Test asset schema validation."""

    def test_asset_create_valid(self):
        """Test creating asset with valid data."""
        asset = AssetCreate(
            project_id="123e4567-e89b-12d3-a456-426614174000",
            type="original",
            s3_key="test/file.mp3",
            filename="test.mp3"
        )
        assert asset.type == "original"
        assert asset.s3_key == "test/file.mp3"

    def test_asset_create_valid_types(self):
        """Test creating asset with valid types."""
        asset = AssetCreate(
            project_id="123e4567-e89b-12d3-a456-426614174000",
            type="original",
            s3_key="test/file.mp3",
            filename="test.mp3"
        )
        assert asset.type == "original"
        
        asset2 = AssetCreate(
            project_id="123e4567-e89b-12d3-a456-426614174000",
            type="stem",
            s3_key="test/file.mp3",
            filename="test.mp3"
        )
        assert asset2.type == "stem"

    def test_asset_create_missing_required(self):
        """Test creating asset without required fields."""
        with pytest.raises(ValidationError):
            AssetCreate(type="original")

    def test_asset_create_with_duration(self):
        """Test creating asset with duration."""
        asset = AssetCreate(
            project_id="123e4567-e89b-12d3-a456-426614174000",
            type="original",
            s3_key="test/file.mp3",
            filename="test.mp3",
            duration=180
        )
        assert asset.duration == 180


class TestJobSchemas:
    """Test job schema validation."""

    def test_job_create_separate_valid(self):
        """Test creating separation job with valid data."""
        job = JobCreate(
            project_id="123e4567-e89b-12d3-a456-426614174000",
            type="separate",
            asset_ids=["123e4567-e89b-12d3-a456-426614174001"],
            params={"separator": "demucs", "demucs_model": "htdemucs"}
        )
        assert job.type == "separate"
        assert len(job.asset_ids) == 1

    def test_job_create_denoise_valid(self):
        """Test creating denoise job with valid data."""
        job = JobCreate(
            project_id="123e4567-e89b-12d3-a456-426614174000",
            type="denoise",
            asset_ids=["123e4567-e89b-12d3-a456-426614174001"],
            params={"output_mode": "new", "stationary": True}
        )
        assert job.type == "denoise"

    def test_job_create_missing_type(self):
        """Test creating job without type fails."""
        with pytest.raises(ValidationError):
            JobCreate(
                project_id="123e4567-e89b-12d3-a456-426614174000",
                asset_ids=[]
            )

    def test_job_create_invalid_type(self):
        """Test creating job with invalid type."""
        with pytest.raises(ValidationError):
            JobCreate(
                project_id="123e4567-e89b-12d3-a456-426614174000",
                type="invalid_type",
                asset_ids=[]
            )

    def test_job_create_empty_asset_ids(self):
        """Test creating job with empty asset_ids."""
        job = JobCreate(
            project_id="123e4567-e89b-12d3-a456-426614174000",
            type="separate",
            asset_ids=[]
        )
        assert len(job.asset_ids) == 0


class TestPresignSchemas:
    """Test presign request schema validation."""

    def test_presign_request_valid(self):
        """Test presign request with valid data."""
        request = PresignRequest(
            project_id="123e4567-e89b-12d3-a456-426614174000",
            filename="test.mp3",
            content_type="audio/mpeg"
        )
        assert request.filename == "test.mp3"
        assert request.content_type == "audio/mpeg"

    def test_presign_request_audio_types(self):
        """Test presign request with various audio content types."""
        request = PresignRequest(
            project_id="123e4567-e89b-12d3-a456-426614174000",
            filename="test.mp3",
            content_type="audio/mpeg"
        )
        assert request.content_type == "audio/mpeg"
        
        request2 = PresignRequest(
            project_id="123e4567-e89b-12d3-a456-426614174000",
            filename="test.wav",
            content_type="audio/wav"
        )
        assert request2.content_type == "audio/wav"

    def test_presign_request_no_extension(self):
        """Test presign request with file without extension."""
        request = PresignRequest(
            project_id="123e4567-e89b-12d3-a456-426614174000",
            filename="testfile",
            content_type="audio/mpeg"
        )
        assert request.filename == "testfile"


class TestJobSchemas:
    """Test job schema validation."""

    def test_job_response_has_status(self):
        """Test job response schema has expected fields."""
        from app.schemas.schemas import JobResponse
        
        job = JobResponse(
            id="123e4567-e89b-12d3-a456-426614174000",
            project_id="123e4567-e89b-12d3-a456-426614174001",
            type="separate",
            status="pending",
            progress=0,
            params={},
            result=None,
            error=None,
            created_at="2024-01-01T00:00:00",
            started_at=None,
            ended_at=None
        )
        assert job.status == "pending"
        assert job.progress == 0
