"""Private object storage client for listing media (MinIO locally, S3 in the cloud)."""

import uuid
from functools import lru_cache
from typing import BinaryIO

import boto3  # type: ignore[import-untyped]
from botocore.client import Config  # type: ignore[import-untyped]

from app.core.config import Settings, get_settings


class ObjectStorage:
    """Upload, delete, and issue short-lived download links for private objects."""

    def __init__(
        self,
        *,
        endpoint_url: str | None,
        region: str,
        bucket: str,
        access_key_id: str | None,
        secret_access_key: str | None,
    ) -> None:
        self.bucket = bucket
        self._client = boto3.client(
            "s3",
            endpoint_url=endpoint_url,
            region_name=region,
            aws_access_key_id=access_key_id,
            aws_secret_access_key=secret_access_key,
            config=Config(signature_version="s3v4"),
        )

    def upload(self, *, file_obj: BinaryIO, content_type: str, key_prefix: str) -> str:
        """Store an object under an opaque key and return that key."""
        key = f"{key_prefix}/{uuid.uuid4().hex}"
        self._client.upload_fileobj(
            file_obj, self.bucket, key, ExtraArgs={"ContentType": content_type}
        )
        return key

    def delete(self, object_key: str) -> None:
        self._client.delete_object(Bucket=self.bucket, Key=object_key)

    def presigned_url(self, object_key: str, *, expires_in_seconds: int = 3600) -> str:
        return self._client.generate_presigned_url(
            "get_object",
            Params={"Bucket": self.bucket, "Key": object_key},
            ExpiresIn=expires_in_seconds,
        )


def build_object_storage(settings: Settings) -> ObjectStorage:
    return ObjectStorage(
        endpoint_url=settings.s3_endpoint_url,
        region=settings.s3_region,
        bucket=settings.s3_bucket,
        access_key_id=settings.s3_access_key_id,
        secret_access_key=settings.s3_secret_access_key,
    )


@lru_cache
def get_object_storage() -> ObjectStorage:
    """Return one cached storage client per process."""
    return build_object_storage(get_settings())
