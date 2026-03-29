from pydantic import BaseModel, EmailStr, model_validator
from typing import Optional
from uuid import UUID
from datetime import datetime


class UserBase(BaseModel):
    email: EmailStr
    name: str


class UserCreate(UserBase):
    pass


class UserResponse(UserBase):
    id: UUID
    keycloak_id: Optional[str] = None
    created_at: datetime

    class Config:
        from_attributes = True


class OrgBase(BaseModel):
    name: str


class OrgCreate(OrgBase):
    pass


class OrgResponse(OrgBase):
    id: UUID
    plan: str
    created_at: datetime

    class Config:
        from_attributes = True


class ProjectBase(BaseModel):
    name: str


class ProjectCreate(ProjectBase):
    org_id: Optional[UUID] = None


class ProjectUpdate(BaseModel):
    name: Optional[str] = None


class ProjectResponse(ProjectBase):
    id: UUID
    org_id: UUID
    status: str
    created_at: datetime

    class Config:
        from_attributes = True


class AssetCreate(BaseModel):
    project_id: UUID
    type: str = "original"
    stem_type: Optional[str] = None
    parent_asset_id: Optional[UUID] = None
    s3_key: str
    s3_key_preview: Optional[str] = None
    duration: Optional[float] = None
    channels: int = 2
    sample_rate: int = 44100


class AssetResponse(AssetCreate):
    id: UUID
    waveform_png: Optional[str] = None
    display_name: Optional[str] = None
    created_by: UUID
    created_at: datetime
    result: Optional[dict] = None

    class Config:
        from_attributes = True


class AssetUpdate(BaseModel):
    display_name: Optional[str] = None


class ConversionRequest(BaseModel):
    target_format: str
    bitrate: Optional[int] = 192000
    sample_rate: Optional[int] = 44100
    channels: Optional[int] = 2


class PresignRequest(BaseModel):
    filename: str
    content_type: str
    project_id: UUID


class PresignResponse(BaseModel):
    upload_url: str
    s3_key: str


class JobCreate(BaseModel):
    project_id: UUID
    type: str
    asset_ids: list[UUID] = []
    params: dict = {}


class JobResponse(BaseModel):
    id: UUID
    project_id: UUID
    type: str
    status: str
    progress: int
    params: Optional[dict] = None
    result: Optional[dict] = None
    error: Optional[str] = None
    created_at: datetime
    started_at: Optional[datetime] = None
    ended_at: Optional[datetime] = None

    class Config:
        from_attributes = True


class JobUpdate(BaseModel):
    status: Optional[str] = None
    error: Optional[str] = None


class MixGraphNode(BaseModel):
    id: str
    type: str
    asset_id: Optional[UUID] = None
    params: dict = {}


class MixGraphEdge(BaseModel):
    source: str
    target: str
    params: dict = {}


class MixGraph(BaseModel):
    nodes: list[MixGraphNode]
    edges: list[MixGraphEdge]


class MixSessionUpdate(BaseModel):
    graph: MixGraph


class MixSessionResponse(BaseModel):
    id: UUID
    project_id: UUID
    graph: Optional[dict] = None
    updated_at: datetime

    class Config:
        from_attributes = True


class TimelineMarkerCreate(BaseModel):
    time: float
    label: Optional[str] = None
    color: str = "yellow"


class TimelineMarkerUpdate(BaseModel):
    time: Optional[float] = None
    label: Optional[str] = None
    color: Optional[str] = None


class TimelineMarkerResponse(BaseModel):
    id: UUID
    project_id: UUID
    time: float
    label: Optional[str] = None
    color: str
    created_by: UUID
    created_at: datetime

    class Config:
        from_attributes = True


class ProjectSnapshotCreate(BaseModel):
    name: str
    description: Optional[str] = None
    data: Optional[dict] = None


class ProjectSnapshotResponse(BaseModel):
    id: UUID
    project_id: UUID
    name: str
    description: Optional[str] = None
    data: Optional[dict] = None
    created_by: UUID
    created_at: datetime

    class Config:
        from_attributes = True


class Token(BaseModel):
    access_token: str
    token_type: str = "bearer"


class TokenData(BaseModel):
    user_id: Optional[str] = None


class TrimRequest(BaseModel):
    start_time: float
    end_time: float
    output_name: Optional[str] = None

    @model_validator(mode='after')
    def validate_times(self):
        if self.start_time < 0:
            raise ValueError("Start time cannot be negative")
        if self.end_time <= self.start_time:
            raise ValueError("End time must be greater than start time")
        return self


class MediaInspectionResponse(BaseModel):
    valid: bool
    duration: Optional[float] = None
    sample_rate: Optional[int] = None
    channels: Optional[int] = None
    codec: Optional[str] = None
    bitrate: Optional[int] = None
    format_name: Optional[str] = None
    metadata: Optional[dict] = None
    errors: list[str] = []
