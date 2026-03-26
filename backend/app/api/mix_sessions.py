from fastapi import APIRouter, Depends, HTTPException, status
from sqlalchemy.ext.asyncio import AsyncSession
from sqlalchemy import select
from uuid import UUID

from app.core.database import get_db
from app.models import MixSession, Project
from app.schemas import MixSessionUpdate, MixSessionResponse

router = APIRouter(prefix="/mix-sessions", tags=["mix-sessions"])


@router.post("/", response_model=MixSessionResponse, status_code=status.HTTP_201_CREATED)
async def create_mix_session(project_id: UUID, db: AsyncSession = Depends(get_db)):
    result = await db.execute(select(Project).where(Project.id == project_id))
    project = result.scalar_one_or_none()
    if not project:
        raise HTTPException(status_code=404, detail="Project not found")

    db_session = MixSession(project_id=project_id, graph={"nodes": [], "edges": []})
    db.add(db_session)
    await db.flush()
    await db.refresh(db_session)
    return db_session


@router.get("/{session_id}", response_model=MixSessionResponse)
async def get_mix_session(session_id: UUID, db: AsyncSession = Depends(get_db)):
    result = await db.execute(select(MixSession).where(MixSession.id == session_id))
    session = result.scalar_one_or_none()
    if not session:
        raise HTTPException(status_code=404, detail="Mix session not found")
    return session


@router.put("/{session_id}", response_model=MixSessionResponse)
async def update_mix_session(
    session_id: UUID,
    update: MixSessionUpdate,
    db: AsyncSession = Depends(get_db)
):
    result = await db.execute(select(MixSession).where(MixSession.id == session_id))
    session = result.scalar_one_or_none()
    if not session:
        raise HTTPException(status_code=404, detail="Mix session not found")

    session.graph = update.model_dump()
    await db.flush()
    await db.refresh(session)
    return session


@router.post("/{session_id}/render")
async def render_mix_session(session_id: UUID, db: AsyncSession = Depends(get_db)):
    result = await db.execute(select(MixSession).where(MixSession.id == session_id))
    session = result.scalar_one_or_none()
    if not session:
        raise HTTPException(status_code=404, detail="Mix session not found")

    return {"message": "Render job queued", "session_id": str(session_id)}
