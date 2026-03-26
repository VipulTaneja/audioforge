from fastapi import APIRouter, Depends, HTTPException
from sqlalchemy.ext.asyncio import AsyncSession
from sqlalchemy import select
from typing import List
from uuid import UUID
import uuid

from app.core.database import get_db
from app.models.models import ProjectSnapshot
from app.schemas.schemas import ProjectSnapshotCreate, ProjectSnapshotResponse

router = APIRouter(prefix="/projects/{project_id}/snapshots", tags=["snapshots"])


@router.get("", response_model=List[ProjectSnapshotResponse])
async def list_snapshots(
    project_id: UUID,
    db: AsyncSession = Depends(get_db),
):
    result = await db.execute(
        select(ProjectSnapshot)
        .where(ProjectSnapshot.project_id == project_id)
        .order_by(ProjectSnapshot.created_at.desc())
    )
    snapshots = result.scalars().all()
    return snapshots


@router.post("", response_model=ProjectSnapshotResponse, status_code=201)
async def create_snapshot(
    project_id: UUID,
    snapshot: ProjectSnapshotCreate,
    db: AsyncSession = Depends(get_db),
):
    db_snapshot = ProjectSnapshot(
        project_id=project_id,
        name=snapshot.name,
        description=snapshot.description,
        data=snapshot.data,
        created_by=uuid.uuid4(),
    )
    db.add(db_snapshot)
    await db.flush()
    await db.refresh(db_snapshot)
    return db_snapshot


@router.get("/{snapshot_id}", response_model=ProjectSnapshotResponse)
async def get_snapshot(
    project_id: UUID,
    snapshot_id: UUID,
    db: AsyncSession = Depends(get_db),
):
    result = await db.execute(
        select(ProjectSnapshot).where(
            ProjectSnapshot.id == snapshot_id,
            ProjectSnapshot.project_id == project_id,
        )
    )
    db_snapshot = result.scalar_one_or_none()
    if not db_snapshot:
        raise HTTPException(status_code=404, detail="Snapshot not found")
    return db_snapshot


@router.delete("/{snapshot_id}", status_code=204)
async def delete_snapshot(
    project_id: UUID,
    snapshot_id: UUID,
    db: AsyncSession = Depends(get_db),
):
    result = await db.execute(
        select(ProjectSnapshot).where(
            ProjectSnapshot.id == snapshot_id,
            ProjectSnapshot.project_id == project_id,
        )
    )
    db_snapshot = result.scalar_one_or_none()
    if not db_snapshot:
        raise HTTPException(status_code=404, detail="Snapshot not found")

    await db.delete(db_snapshot)
    await db.flush()
