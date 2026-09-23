"""Google OAuth audience configuration shared by authentication routes."""

import os


APP_GOOGLE_WEB_CLIENT_ID = (
    "121930938754-9hkno5bktltbrbj18b4m1jrvd1319l99.apps.googleusercontent.com"
)


def google_client_ids() -> list[str]:
    """Return every trusted token audience, always including the app audience."""
    candidates = [
        "121930938754-nl8j2do29bevndokl82prr5fe1dgq7du.apps.googleusercontent.com",
        APP_GOOGLE_WEB_CLIENT_ID,
        os.environ.get("GOOGLE_CLIENT_ID"),
        os.environ.get("GOOGLE_ANDROID_CLIENT_ID"),
        os.environ.get("GOOGLE_IOS_CLIENT_ID"),
    ]
    return list(dict.fromkeys(
        client_id
        for client_id in candidates
        if client_id and "your_" not in client_id
    ))
