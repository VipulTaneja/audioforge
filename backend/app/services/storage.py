import boto3
from botocore.client import Config
from botocore.exceptions import ClientError
import uuid
from pathlib import Path
from typing import Optional, Tuple
import logging

from app.core.config import get_settings

settings = get_settings()
logger = logging.getLogger(__name__)


class StorageService:
    def __init__(self):
        self.s3 = boto3.client(
            's3',
            endpoint_url=f"http://{settings.minio_endpoint}",
            aws_access_key_id=settings.minio_access_key,
            aws_secret_access_key=settings.minio_secret_key,
            config=Config(signature_version='s3v4'),
        )
        self.bucket_assets = settings.minio_bucket_assets
        self.bucket_previews = settings.minio_bucket_previews
        self.bucket_exports = settings.minio_bucket_exports
        self._ensure_buckets()

    def _ensure_buckets(self):
        for bucket in [self.bucket_assets, self.bucket_previews, self.bucket_exports]:
            try:
                self.s3.head_bucket(Bucket=bucket)
            except ClientError:
                try:
                    self.s3.create_bucket(Bucket=bucket)
                    logger.info(f"Created bucket: {bucket}")
                except ClientError as e:
                    logger.warning(f"Could not create bucket {bucket}: {e}")

    def generate_presigned_upload_url(
        self,
        project_id: str,
        filename: str,
        content_type: str,
        bucket: str = None,
        expires_in: int = 3600
    ) -> Tuple[str, str]:
        if bucket is None:
            bucket = self.bucket_assets
        
        file_ext = Path(filename).suffix
        s3_key = f"projects/{project_id}/{uuid.uuid4()}{file_ext}"
        
        url = self.s3.generate_presigned_url(
            'put_object',
            Params={
                'Bucket': bucket,
                'Key': s3_key,
                'ContentType': content_type,
            },
            ExpiresIn=expires_in,
        )
        return url, s3_key

    def generate_presigned_download_url(
        self,
        s3_key: str,
        bucket: str = None,
        expires_in: int = 3600
    ) -> str:
        if bucket is None:
            bucket = self.bucket_assets
        
        url = self.s3.generate_presigned_url(
            'get_object',
            Params={
                'Bucket': bucket,
                'Key': s3_key,
            },
            ExpiresIn=expires_in,
        )
        return url

    def download_file(self, s3_key: str, local_path: str, bucket: str = None):
        if bucket is None:
            bucket = self.bucket_assets
        
        Path(local_path).parent.mkdir(parents=True, exist_ok=True)
        self.s3.download_file(bucket, s3_key, local_path)
        return local_path

    def upload_file(self, local_path: str, s3_key: str, bucket: str = None):
        if bucket is None:
            bucket = self.bucket_assets
        
        self.s3.upload_file(local_path, bucket, s3_key)
        return s3_key

    def delete_file(self, s3_key: str, bucket: str = None):
        if bucket is None:
            bucket = self.bucket_assets
        
        try:
            self.s3.delete_object(Bucket=bucket, Key=s3_key)
        except ClientError as e:
            logger.error(f"Error deleting file {s3_key}: {e}")

    def file_exists(self, s3_key: str, bucket: str = None) -> bool:
        if bucket is None:
            bucket = self.bucket_assets
        
        try:
            self.s3.head_object(Bucket=bucket, Key=s3_key)
            return True
        except ClientError:
            return False

    def get_file_size(self, s3_key: str, bucket: str = None) -> int:
        if bucket is None:
            bucket = self.bucket_assets
        
        try:
            response = self.s3.head_object(Bucket=bucket, Key=s3_key)
            return response['ContentLength']
        except ClientError:
            return 0


storage_service = StorageService()
