from fastapi import FastAPI
from fastapi.middleware.cors import CORSMiddleware

from app.core.config import get_settings
from app.api import (
    users_router,
    orgs_router,
    projects_router,
    assets_router,
    jobs_router,
    mix_sessions_router,
)
from app.api.markers import router as markers_router
from app.api.websocket import router as websocket_router

settings = get_settings()

app = FastAPI(
    title=settings.app_name,
    description="AI-Powered Audio Processing Platform",
    version="0.1.0",
)

app.add_middleware(
    CORSMiddleware,
    allow_origins=settings.cors_origins,
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)

app.include_router(users_router, prefix="/api/v1")
app.include_router(orgs_router, prefix="/api/v1")
app.include_router(projects_router, prefix="/api/v1")
app.include_router(assets_router, prefix="/api/v1")
app.include_router(jobs_router, prefix="/api/v1")
app.include_router(mix_sessions_router, prefix="/api/v1")
app.include_router(markers_router, prefix="/api/v1")
app.include_router(websocket_router)


@app.get("/")
async def root():
    return {"message": "AudioForge API", "version": "0.1.0"}


@app.get("/health")
async def health():
    return {"status": "healthy"}


@app.get("/api/v1")
async def api_root():
    return {
        "message": "AudioForge API v1",
        "endpoints": {
            "users": "/api/v1/users",
            "orgs": "/api/v1/orgs",
            "projects": "/api/v1/projects",
            "assets": "/api/v1/assets",
            "jobs": "/api/v1/jobs",
            "mix-sessions": "/api/v1/mix-sessions",
        }
    }
