from app.core.database import Base
from sqlalchemy import Column, String, DateTime, ForeignKey, Enum, Integer, Float, JSON, Text
from sqlalchemy.dialects.postgresql import UUID
from sqlalchemy.orm import relationship
from datetime import datetime
import uuid
import enum


class ProjectStatus(str, enum.Enum):
    ACTIVE = "active"
    ARCHIVED = "archived"


class AssetType(str, enum.Enum):
    ORIGINAL = "original"
    STEM = "stem"
    MIX = "mix"
    PRESET = "preset"


class JobType(str, enum.Enum):
    SEPARATE = "separate"
    DENOISE = "denoise"
    RVC = "rvc"
    TTS_SING = "tts_sing"
    MIXDOWN = "mixdown"
    INSTRUMENT_ID = "instrument_id"
    SPATIALIZE = "spatialize"


class JobStatus(str, enum.Enum):
    PENDING = "pending"
    RUNNING = "running"
    SUCCEEDED = "succeeded"
    FAILED = "failed"


class OrgRole(str, enum.Enum):
    OWNER = "owner"
    ADMIN = "admin"
    MEMBER = "member"


class User(Base):
    __tablename__ = "users"

    id = Column(UUID(as_uuid=True), primary_key=True, default=uuid.uuid4)
    email = Column(String(255), unique=True, nullable=False, index=True)
    name = Column(String(255), nullable=False)
    keycloak_id = Column(String(255), unique=True, nullable=True)
    created_at = Column(DateTime, default=datetime.utcnow)

    memberships = relationship("OrgMember", back_populates="user")
    created_assets = relationship("Asset", back_populates="creator")


class Org(Base):
    __tablename__ = "orgs"

    id = Column(UUID(as_uuid=True), primary_key=True, default=uuid.uuid4)
    name = Column(String(255), nullable=False)
    plan = Column(String(50), default="free")
    created_at = Column(DateTime, default=datetime.utcnow)

    members = relationship("OrgMember", back_populates="org")
    projects = relationship("Project", back_populates="org")


class OrgMember(Base):
    __tablename__ = "org_members"

    id = Column(UUID(as_uuid=True), primary_key=True, default=uuid.uuid4)
    org_id = Column(UUID(as_uuid=True), ForeignKey("orgs.id"), nullable=False)
    user_id = Column(UUID(as_uuid=True), ForeignKey("users.id"), nullable=False)
    role = Column(String(50), default=OrgRole.MEMBER.value)

    org = relationship("Org", back_populates="members")
    user = relationship("User", back_populates="memberships")


class Project(Base):
    __tablename__ = "projects"

    id = Column(UUID(as_uuid=True), primary_key=True, default=uuid.uuid4)
    org_id = Column(UUID(as_uuid=True), ForeignKey("orgs.id"), nullable=False)
    name = Column(String(255), nullable=False)
    status = Column(String(50), default=ProjectStatus.ACTIVE.value)
    created_at = Column(DateTime, default=datetime.utcnow)

    org = relationship("Org", back_populates="projects")
    assets = relationship("Asset", back_populates="project")
    jobs = relationship("Job", back_populates="project")
    mix_session = relationship("MixSession", back_populates="project", uselist=False)


class Asset(Base):
    __tablename__ = "assets"

    id = Column(UUID(as_uuid=True), primary_key=True, default=uuid.uuid4)
    project_id = Column(UUID(as_uuid=True), ForeignKey("projects.id"), nullable=False)
    type = Column(String(50), default=AssetType.ORIGINAL.value)
    stem_type = Column(String(50), nullable=True)  # vocals, drums, bass, other
    parent_asset_id = Column(UUID(as_uuid=True), ForeignKey("assets.id"), nullable=True)  # For stems
    s3_key = Column(Text, nullable=False)
    s3_key_preview = Column(Text, nullable=True)  # Preview URL
    duration = Column(Float, nullable=True)
    channels = Column(Integer, default=2)
    sample_rate = Column(Integer, default=44100)
    waveform_png = Column(Text, nullable=True)
    created_by = Column(UUID(as_uuid=True), ForeignKey("users.id"), nullable=False)
    created_at = Column(DateTime, default=datetime.utcnow)
    result = Column(JSON, nullable=True)

    project = relationship("Project", back_populates="assets")
    creator = relationship("User", back_populates="created_assets")
    parent = relationship("Asset", remote_side=[id], backref="stems")


class Job(Base):
    __tablename__ = "jobs"

    id = Column(UUID(as_uuid=True), primary_key=True, default=uuid.uuid4)
    project_id = Column(UUID(as_uuid=True), ForeignKey("projects.id"), nullable=False)
    type = Column(String(50), nullable=False)
    status = Column(String(50), default=JobStatus.PENDING.value)
    params = Column(JSON, nullable=True)
    result = Column(JSON, nullable=True)
    progress = Column(Integer, default=0)
    error = Column(Text, nullable=True)
    created_at = Column(DateTime, default=datetime.utcnow)
    started_at = Column(DateTime, nullable=True)
    ended_at = Column(DateTime, nullable=True)
    worker_pod = Column(String(255), nullable=True)

    project = relationship("Project", back_populates="jobs")


class MixSession(Base):
    __tablename__ = "mix_sessions"

    id = Column(UUID(as_uuid=True), primary_key=True, default=uuid.uuid4)
    project_id = Column(UUID(as_uuid=True), ForeignKey("projects.id"), nullable=False)
    graph = Column(JSON, nullable=True)
    updated_at = Column(DateTime, default=datetime.utcnow, onupdate=datetime.utcnow)

    project = relationship("Project", back_populates="mix_session")


class AuditLog(Base):
    __tablename__ = "audit_logs"

    id = Column(UUID(as_uuid=True), primary_key=True, default=uuid.uuid4)
    org_id = Column(UUID(as_uuid=True), ForeignKey("orgs.id"), nullable=False)
    actor_id = Column(UUID(as_uuid=True), ForeignKey("users.id"), nullable=False)
    action = Column(String(255), nullable=False)
    target = Column(String(255), nullable=False)
    extra_data = Column(JSON, nullable=True)
    ts = Column(DateTime, default=datetime.utcnow)
