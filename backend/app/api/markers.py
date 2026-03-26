from fastapi import APIRouter, Depends, HTTPException
from sqlalchemy.ext.asyncio import AsyncSession
from sqlalchemy import select
from typing import List
from uuid import UUID

from app.core.database import get_db
from app.core.security import get_current_user
from app.models.models import TimelineMarker
from app.schemas.schemas import TimelineMarkerCreate, TimelineMarkerUpdate, TimelineMarkerResponse

router = APIRouter(prefix="/api/v1/projects/{project_id}/markers", tags=["markers"])


@router.get("", response_model=List[TimelineMarkerResponse])
async def list_markers(
    project_id: UUID,
    db: AsyncSession = Depends(get_db),
    current_user = Depends(get_current_user),
):
    result = await db.execute(
        select(TimelineMarker)
        .where(TimelineMarker.project_id == project_id)
        .order_by(TimelineMarker.time)
    )
    markers = result.scalars().all()
    return markers


@router.post("", response_model=TimelineMarkerResponse, status_code=201)
async def create_marker(
    project_id: UUID,
    marker: TimelineMarkerCreate,
    db: AsyncSession = Depends(get_db),
    current_user = Depends(get_current_user),
):
    db_marker = TimelineMarker(
        project_id=project_id,
        time=marker.time,
        label=marker.label,
        color=marker.color,
        created_by=current_user.id,
    )
    db.add(db_marker)
    await db.flush()
    await db.refresh(db_marker)
    return db_marker


@router.put("/{marker_id}", response_model=TimelineMarkerResponse)
async def update_marker(
    project_id: UUID,
    marker_id: UUID,
    marker: TimelineMarkerUpdate,
    db: AsyncSession = Depends(get_db),
    current_user = Depends(get_current_user),
):
    result = await db.execute(
        select(TimelineMarker).where(
            TimelineMarker.id == marker_id,
            TimelineMarker.project_id == project_id,
        )
    )
    db_marker = result.scalar_one_or_none()
    if not db_marker:
        raise HTTPException(status_code=404, detail="Marker not found")

    if marker.time is not None:
        db_marker.time = marker.time
    if marker.label is not None:
        db_marker.label = marker.label
    if marker.color is not None:
        db_marker.color = marker.color

    await db.flush()
    await db.refresh(db_marker)
    return db_marker


@router.delete("/{marker_id}", status_code=204)
async def delete_marker(
    project_id: UUID,
    marker_id: UUID,
    db: AsyncSession = Depends(get_db),
    current_user = Depends(get_current_user),
):
    result = await db.execute(
        select(TimelineMarker).where(
            TimelineMarker.id == marker_id,
            TimelineMarker.project_id == project_id,
        )
    )
    db_marker = result.scalar_one_or_none()
    if not db_marker:
        raise HTTPException(status_code=404, detail="Marker not found")

    await db.delete(db_marker)
    await db.flush()
