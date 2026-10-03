"""Google OAuth audience configuration shared by authentication routes."""

import os


# Web OAuth 2.0 client used by the GoodCause web app
APP_GOOGLE_WEB_CLIENT_ID = (
    "41685285658-qss2q8eqeldj3mnega5mnovoo1i4qgb0.apps.googleusercontent.com"
)


def _split_client_ids(value: str | None) -> list[str]:
    if not value:
        return []
    return [
        client_id.strip()
        for client_id in value.replace("\n", ",").split(",")
        if client_id.strip()
    ]


def google_client_ids() -> list[str]:
    """Return every trusted token audience, always including the app audience."""
    candidates = [
        APP_GOOGLE_WEB_CLIENT_ID,
        *_split_client_ids(os.environ.get("GOOGLE_CLIENT_IDS")),
        os.environ.get("GOOGLE_CLIENT_ID"),
        os.environ.get("GOOGLE_ANDROID_CLIENT_ID"),
        os.environ.get("GOOGLE_IOS_CLIENT_ID"),
    ]
    return list(dict.fromkeys(
        client_id
        for client_id in candidates
        if client_id and "your_" not in client_id
    ))
