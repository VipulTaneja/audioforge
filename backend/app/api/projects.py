from fastapi import APIRouter, Depends, HTTPException, status
from sqlalchemy.ext.asyncio import AsyncSession
from sqlalchemy import select
from uuid import UUID

from app.core.database import get_db
from app.core.storage import delete_s3_object
from app.models import Project, Org, Asset, Job
from app.schemas import ProjectCreate, ProjectResponse

router = APIRouter(prefix="/projects", tags=["projects"])

DEFAULT_ORG_NAME = "Default Organization"


async def get_or_create_default_org(db: AsyncSession) -> Org:
    result = await db.execute(select(Org).limit(1))
    org = result.scalar_one_or_none()
    if not org:
        org = Org(name=DEFAULT_ORG_NAME)
        db.add(org)
        await db.flush()
        await db.refresh(org)
    return org


@router.post("/", response_model=ProjectResponse, status_code=status.HTTP_201_CREATED)
async def create_project(project: ProjectCreate, db: AsyncSession = Depends(get_db)):
    org = await get_or_create_default_org(db)
    db_project = Project(org_id=org.id, name=project.name)
    db.add(db_project)
    await db.flush()
    await db.refresh(db_project)
    return db_project


@router.get("/{project_id}", response_model=ProjectResponse)
async def get_project(project_id: UUID, db: AsyncSession = Depends(get_db)):
    result = await db.execute(select(Project).where(Project.id == project_id))
    project = result.scalar_one_or_none()
    if not project:
        raise HTTPException(status_code=404, detail="Project not found")
    return project


@router.get("/", response_model=list[ProjectResponse])
async def list_projects(db: AsyncSession = Depends(get_db)):
    result = await db.execute(select(Project))
    projects = result.scalars().all()
    return projects


@router.delete("/{project_id}", status_code=status.HTTP_204_NO_CONTENT)
async def delete_project(project_id: UUID, db: AsyncSession = Depends(get_db)):
    result = await db.execute(select(Project).where(Project.id == project_id))
    project = result.scalar_one_or_none()
    if not project:
        raise HTTPException(status_code=404, detail="Project not found")
    
    # Get all assets for this project
    assets_result = await db.execute(select(Asset).where(Asset.project_id == project_id))
    assets = assets_result.scalars().all()
    
    # Get all jobs for this project
    jobs_result = await db.execute(select(Job).where(Job.project_id == project_id))
    jobs = jobs_result.scalars().all()
    
    # Delete S3 files for all assets
    for asset in assets:
        s3_key = str(asset.s3_key) if asset.s3_key is not None else None
        if s3_key and s3_key != 'None':
            delete_s3_object(s3_key)
        s3_key_preview = str(asset.s3_key_preview) if asset.s3_key_preview is not None else None
        if s3_key_preview and s3_key_preview != 'None':
            delete_s3_object(s3_key_preview)
    
    # Delete all jobs (cascade)
    for job in jobs:
        await db.delete(job)
    
    # Delete all assets (cascade)
    for asset in assets:
        await db.delete(asset)
    
    await db.delete(project)
    await db.commit()
