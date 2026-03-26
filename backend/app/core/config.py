from pydantic import field_validator
from pydantic_settings import BaseSettings
from functools import lru_cache


class Settings(BaseSettings):
    app_name: str = "AudioForge API"
    debug: bool = False
    
    database_url: str = "postgresql+asyncpg://postgres:postgres@localhost:5432/audioforge"
    sync_database_url: str = "postgresql://postgres:postgres@localhost:5432/audioforge"
    
    redis_url: str = "redis://localhost:6379/0"
    celery_broker_url: str = "redis://localhost:6379/1"
    celery_result_backend: str = "redis://localhost:6379/2"
    
    minio_endpoint: str = "localhost:9000"
    minio_access_key: str = "minioadmin"
    minio_secret_key: str = "minioadmin"
    minio_bucket_assets: str = "assets"
    minio_bucket_previews: str = "previews"
    minio_bucket_exports: str = "exports"
    
    keycloak_url: str = "http://localhost:8080"
    keycloak_realm: str = "audioforge"
    keycloak_client_id: str = "audioforge-api"
    
    secret_key: str = "your-secret-key-change-in-production"
    algorithm: str = "HS256"
    access_token_expire_minutes: int = 30
    
    cors_origins: list[str] = ["http://localhost:3000", "http://localhost:5173"]
    
    demucs_timeout_seconds: int = 600
    demucs_model_download_timeout_seconds: int = 300

    @field_validator("debug", mode="before")
    @classmethod
    def parse_debug_flag(cls, value: object) -> object:
        if isinstance(value, str):
            normalized = value.strip().lower()
            if normalized in {"1", "true", "yes", "on", "debug", "development", "dev"}:
                return True
            if normalized in {"0", "false", "no", "off", "release", "production", "prod"}:
                return False
        return value

    class Config:
        env_file = ".env"


@lru_cache()
def get_settings() -> Settings:
    return Settings()
