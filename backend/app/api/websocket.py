from fastapi import APIRouter, WebSocket, WebSocketDisconnect
from typing import Dict, Set
import asyncio
import logging

router = APIRouter()
logger = logging.getLogger(__name__)


class ConnectionManager:
    """Manage WebSocket connections per project."""
    
    def __init__(self):
        # project_id -> set of websockets
        self.active_connections: Dict[str, Set[WebSocket]] = {}
        # job_id -> project_id mapping
        self.job_to_project: Dict[str, str] = {}
    
    async def connect(self, websocket: WebSocket, project_id: str):
        await websocket.accept()
        if project_id not in self.active_connections:
            self.active_connections[project_id] = set()
        self.active_connections[project_id].add(websocket)
        logger.info(f"WebSocket connected for project {project_id}")
    
    def disconnect(self, websocket: WebSocket, project_id: str):
        if project_id in self.active_connections:
            self.active_connections[project_id].discard(websocket)
            if not self.active_connections[project_id]:
                del self.active_connections[project_id]
        logger.info(f"WebSocket disconnected for project {project_id}")
    
    def register_job(self, job_id: str, project_id: str):
        self.job_to_project[job_id] = project_id
    
    async def send_to_project(self, project_id: str, message: dict):
        if project_id in self.active_connections:
            dead_connections = set()
            for websocket in self.active_connections[project_id]:
                try:
                    await websocket.send_json(message)
                except Exception as e:
                    logger.error(f"Error sending to websocket: {e}")
                    dead_connections.add(websocket)
            
            # Clean up dead connections
            for ws in dead_connections:
                self.active_connections[project_id].discard(ws)
    
    async def broadcast_job_update(self, job_id: str, data: dict):
        project_id = self.job_to_project.get(job_id)
        if project_id:
            await self.send_to_project(project_id, {
                "type": "job_update",
                "job_id": job_id,
                **data
            })


manager = ConnectionManager()


@router.websocket("/ws/projects/{project_id}")
async def websocket_endpoint(websocket: WebSocket, project_id: str):
    await manager.connect(websocket, project_id)
    
    try:
        while True:
            # Keep connection alive, handle client messages
            data = await websocket.receive_text()
            
            # Handle ping/pong
            if data == "ping":
                await websocket.send_text("pong")
            else:
                # Handle other client messages if needed
                pass
                
    except WebSocketDisconnect:
        manager.disconnect(websocket, project_id)
    except Exception as e:
        logger.error(f"WebSocket error: {e}")
        manager.disconnect(websocket, project_id)


async def notify_job_progress(job_id: str, project_id: str, progress: int, status: str, result: dict = None):
    """Called by workers to notify job progress."""
    manager.register_job(job_id, project_id)
    await manager.broadcast_job_update(job_id, {
        "status": status,
        "progress": progress,
        "result": result
    })
