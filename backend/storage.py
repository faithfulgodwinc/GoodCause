"""Direct file storage with persistent local filesystem and MIME handling."""
import os
import mimetypes

BASE_DIR = os.path.dirname(os.path.abspath(__file__))
UPLOADS_DIR = os.path.join(BASE_DIR, "uploads")
os.makedirs(UPLOADS_DIR, exist_ok=True)
APP_NAME = "goodcause"


def init_storage():
    os.makedirs(UPLOADS_DIR, exist_ok=True)
    return "local_storage"


def put_object(path: str, data: bytes, content_type: str) -> dict:
    file_path = os.path.join(UPLOADS_DIR, path)
    os.makedirs(os.path.dirname(file_path), exist_ok=True)
    with open(file_path, "wb") as f:
        f.write(data)
    return {"status": "ok", "path": path, "size": len(data)}


def get_object(path: str) -> tuple[bytes, str]:
    file_path = os.path.join(UPLOADS_DIR, path)
    if not os.path.exists(file_path):
        raise FileNotFoundError(f"File not found: {path}")
    ctype, _ = mimetypes.guess_type(file_path)
    if not ctype:
        if path.endswith(".jpg") or path.endswith(".jpeg"):
            ctype = "image/jpeg"
        elif path.endswith(".png"):
            ctype = "image/png"
        elif path.endswith(".webp"):
            ctype = "image/webp"
        elif path.endswith(".mp4"):
            ctype = "video/mp4"
        elif path.endswith(".mov"):
            ctype = "video/quicktime"
        else:
            ctype = "application/octet-stream"
    with open(file_path, "rb") as f:
        content = f.read()
    return content, ctype
