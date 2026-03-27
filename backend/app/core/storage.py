from app.core.config import get_settings
import boto3
from botocore.client import Config
from botocore.exceptions import ClientError

settings = get_settings()


def get_s3_client():
    return boto3.client(
        's3',
        endpoint_url=f"http://{settings.minio_endpoint}",
        aws_access_key_id=settings.minio_access_key,
        aws_secret_access_key=settings.minio_secret_key,
        config=Config(signature_version='s3v4'),
    )


def ensure_bucket_exists(bucket_name: str):
    s3 = get_s3_client()
    try:
        s3.head_bucket(Bucket=bucket_name)
    except ClientError:
        s3.create_bucket(Bucket=bucket_name)


def generate_presigned_upload_url(s3_key: str, content_type: str, expires_in: int = 3600) -> str:
    ensure_bucket_exists(settings.minio_bucket_assets)
    s3 = get_s3_client()
    url = s3.generate_presigned_url(
        'put_object',
        Params={
            'Bucket': settings.minio_bucket_assets,
            'Key': s3_key,
            'ContentType': content_type,
        },
        ExpiresIn=expires_in,
    )
    return url


def generate_presigned_download_url(s3_key: str, expires_in: int = 3600) -> str:
    s3 = get_s3_client()
    url = s3.generate_presigned_url(
        'get_object',
        Params={
            'Bucket': settings.minio_bucket_assets,
            'Key': s3_key,
        },
        ExpiresIn=expires_in,
    )
    return url


def delete_s3_object(s3_key: str) -> bool:
    s3 = get_s3_client()
    try:
        s3.delete_object(Bucket=settings.minio_bucket_assets, Key=s3_key)
        return True
    except ClientError:
        return False
