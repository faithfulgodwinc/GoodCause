"""Media upload/serve. Campaign photos & videos are public content served without auth."""
import os
import uuid
from fastapi import APIRouter, HTTPException, Depends, UploadFile, File
from fastapi.responses import Response
from starlette.concurrency import run_in_threadpool

from core import db, now_iso, get_current_user, uid
from storage import put_object, get_object, APP_NAME

router = APIRouter(prefix="/api", tags=["media"])

MAX_BYTES = 30 * 1024 * 1024  # 30MB
EXT = {
    "image/jpeg": "jpg", "image/jpg": "jpg", "image/png": "png", "image/webp": "webp",
    "image/heic": "heic", "image/gif": "gif",
    "video/mp4": "mp4", "video/quicktime": "mov", "video/webm": "webm",
}
PUBLIC_BASE = os.environ.get("PUBLIC_BASE_URL", "")


@router.post("/upload")
async def upload(file: UploadFile = File(...), user: dict = Depends(get_current_user)):
    content = await file.read()
    if not content:
        raise HTTPException(status_code=400, detail="The file is empty.")
    if len(content) > MAX_BYTES:
        raise HTTPException(status_code=413, detail="That file is too large. Please keep it under 30MB.")
    ctype = file.content_type or "application/octet-stream"
    is_image = ctype.startswith("image/")
    is_video = ctype.startswith("video/")
    if not (is_image or is_video):
        raise HTTPException(status_code=400, detail="Please upload an image or video.")
    ext = EXT.get(ctype, "bin")
    path = f"{APP_NAME}/uploads/{user['id']}/{uuid.uuid4().hex}.{ext}"
    try:
        await run_in_threadpool(put_object, path, content, ctype)
    except Exception as e:
        msg = str(e)
        if "402" in msg:
            raise HTTPException(status_code=402, detail="Storage limit reached. Please try again later.")
        raise HTTPException(status_code=502, detail="We couldn't upload that file. Please try again.")
    await db.media.insert_one({
        "id": uid("med_"), "owner_id": user["id"], "storage_path": path,
        "content_type": ctype, "kind": "video" if is_video else "image",
        "created_at": now_iso(),
    })
    return {"url": f"/api/files/{path}", "path": path, "content_type": ctype,
            "kind": "video" if is_video else "image"}


@router.get("/files/{path:path}")
async def serve(path: str):
    try:
        content, ctype = await run_in_threadpool(get_object, path)
    except Exception:
        raise HTTPException(status_code=404, detail="File not found.")
    return Response(content=content, media_type=ctype,
                    headers={"Cache-Control": "public, max-age=31536000, immutable"})
