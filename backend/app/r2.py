"""Cloudflare R2 service — thin wrapper around boto3's S3-compatible client."""
import os
import uuid

import boto3
from botocore.client import Config


def _client():
    return boto3.client(
        "s3",
        endpoint_url=os.environ["R2_ENDPOINT"],
        aws_access_key_id=os.environ["R2_ACCESS_KEY_ID"],
        aws_secret_access_key=os.environ["R2_SECRET_ACCESS_KEY"],
        config=Config(signature_version="s3v4"),
        region_name="auto",
    )


def _bucket() -> str:
    return os.environ["R2_BUCKET_NAME"]


def upload_file(data: bytes, original_filename: str, content_type: str, folder: str = "uploads") -> str:
    """Upload bytes to R2 and return the object key (e.g. 'wiki/abc123.png')."""
    ext = original_filename.rsplit(".", 1)[-1].lower() if "." in original_filename else "bin"
    key = f"{folder}/{uuid.uuid4().hex}.{ext}"
    _client().put_object(Bucket=_bucket(), Key=key, Body=data, ContentType=content_type)
    return key


def delete_file(object_key: str) -> None:
    """Delete an object from R2. Silently succeeds if the key does not exist."""
    _client().delete_object(Bucket=_bucket(), Key=object_key)
