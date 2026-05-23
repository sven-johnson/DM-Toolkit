import os
from fastapi import APIRouter, Depends, File, Form, HTTPException, UploadFile, status
from pydantic import BaseModel

from ..auth import verify_token
from ..database import get_db  # noqa: F401  kept so the dependency chain is importable
from .. import r2

router = APIRouter()

_ALLOWED = {"image/jpeg", "image/png", "image/gif", "image/webp"}
_MAX_BYTES = 10 * 1024 * 1024  # 10 MB


class ImageUploadOut(BaseModel):
    object_key: str
    url: str


@router.post("/", response_model=ImageUploadOut, status_code=status.HTTP_201_CREATED)
async def upload_image(
    file: UploadFile = File(...),
    folder: str = Form("uploads"),
    _: str = Depends(verify_token),
):
    if file.content_type not in _ALLOWED:
        raise HTTPException(
            status_code=status.HTTP_415_UNSUPPORTED_MEDIA_TYPE,
            detail="Only JPEG, PNG, GIF, and WebP images are accepted.",
        )

    data = await file.read()
    if len(data) > _MAX_BYTES:
        raise HTTPException(
            status_code=status.HTTP_413_REQUEST_ENTITY_TOO_LARGE,
            detail="File must be 10 MB or smaller.",
        )

    try:
        object_key = r2.upload_file(data, file.filename or "upload", file.content_type, folder)
    except Exception as exc:
        raise HTTPException(
            status_code=status.HTTP_502_BAD_GATEWAY,
            detail=f"Storage upload failed: {exc}",
        )

    public_base = os.environ.get("R2_PUBLIC_URL", "").rstrip("/")
    return ImageUploadOut(object_key=object_key, url=f"{public_base}/{object_key}")


@router.delete("/{object_key:path}", status_code=status.HTTP_204_NO_CONTENT)
def delete_image(
    object_key: str,
    _: str = Depends(verify_token),
):
    try:
        r2.delete_file(object_key)
    except Exception as exc:
        raise HTTPException(
            status_code=status.HTTP_502_BAD_GATEWAY,
            detail=f"Storage delete failed: {exc}",
        )
