"""Supabase Object Storage implementation."""
import os
import httpx

APP_NAME = "goodcause"
BUCKET_NAME = "goodcause"
SUPABASE_URL = os.environ.get("SUPABASE_URL", "").rstrip("/")
SUPABASE_ANON_KEY = os.environ.get("SUPABASE_ANON_KEY", "")

def init_storage():
    if not SUPABASE_URL or not SUPABASE_ANON_KEY:
        raise ValueError("Missing Supabase credentials for storage")
    return "supabase_storage"

def put_object(path: str, data: bytes, content_type: str) -> dict:
    url = f"{SUPABASE_URL}/storage/v1/object/{BUCKET_NAME}/{path}"
    headers = {
        "Authorization": f"Bearer {SUPABASE_ANON_KEY}",
        "Content-Type": content_type,
        "x-upsert": "true",
    }
    
    with httpx.Client(timeout=30.0) as client:
        resp = client.post(url, content=data, headers=headers)
        
    if resp.status_code >= 400:
        raise RuntimeError(f"Storage upload failed: {resp.status_code} - {resp.text}")
        
    return {"status": "ok", "path": path, "size": len(data)}

def get_public_url(path: str) -> str:
    """Returns the direct CDN URL for the object."""
    return f"{SUPABASE_URL}/storage/v1/object/public/{BUCKET_NAME}/{path}"
