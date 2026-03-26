from fastapi import APIRouter, Depends, HTTPException, status
from sqlalchemy.ext.asyncio import AsyncSession
from sqlalchemy import select
from uuid import UUID

from app.core.database import get_db
from app.models import Org, OrgMember, OrgRole
from app.schemas import OrgCreate, OrgResponse

router = APIRouter(prefix="/orgs", tags=["organizations"])


@router.post("/", response_model=OrgResponse, status_code=status.HTTP_201_CREATED)
async def create_org(org: OrgCreate, db: AsyncSession = Depends(get_db)):
    db_org = Org(name=org.name)
    db.add(db_org)
    await db.flush()
    await db.refresh(db_org)
    return db_org


@router.get("/{org_id}", response_model=OrgResponse)
async def get_org(org_id: UUID, db: AsyncSession = Depends(get_db)):
    result = await db.execute(select(Org).where(Org.id == org_id))
    org = result.scalar_one_or_none()
    if not org:
        raise HTTPException(status_code=404, detail="Organization not found")
    return org


@router.get("/", response_model=list[OrgResponse])
async def list_orgs(db: AsyncSession = Depends(get_db)):
    result = await db.execute(select(Org))
    orgs = result.scalars().all()
    return orgs
