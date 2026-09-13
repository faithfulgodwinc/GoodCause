import importlib
import importlib.util
import json
from pathlib import Path


APP_WEB_CLIENT_ID = (
    "121930938754-9hkno5bktltbrbj18b4m1jrvd1319l99.apps.googleusercontent.com"
)
REPOSITORY_ROOT = Path(__file__).resolve().parents[2]


def test_google_token_validation_always_accepts_the_app_web_client(monkeypatch):
    """A stale deployment variable must not exclude tokens issued to the app."""
    monkeypatch.setenv(
        "GOOGLE_CLIENT_ID",
        "legacy-client.apps.googleusercontent.com",
    )
    monkeypatch.delenv("GOOGLE_ANDROID_CLIENT_ID", raising=False)
    monkeypatch.delenv("GOOGLE_IOS_CLIENT_ID", raising=False)

    assert importlib.util.find_spec("google_oauth_config") is not None, (
        "Google OAuth audience policy must be available without importing the API stack"
    )
    google_oauth_config = importlib.import_module("google_oauth_config")

    assert google_oauth_config.google_client_ids() == [
        APP_WEB_CLIENT_ID,
        "legacy-client.apps.googleusercontent.com",
    ]


def test_android_build_profiles_and_google_services_use_the_app_web_client():
    """Every Android build profile must request tokens for the backend audience."""
    eas = json.loads((REPOSITORY_ROOT / "frontend/eas.json").read_text())
    google_services = json.loads(
        (REPOSITORY_ROOT / "frontend/android/app/google-services.json").read_text()
    )

    profile_client_ids = {
        profile["env"]["EXPO_PUBLIC_GOOGLE_WEB_CLIENT_ID"]
        for profile in eas["build"].values()
    }
    web_oauth_clients = {
        client["client_id"]
        for client in google_services["client"][0]["oauth_client"]
        if client["client_type"] == 3
    }

    assert profile_client_ids == {APP_WEB_CLIENT_ID}
    assert web_oauth_clients == {APP_WEB_CLIENT_ID}
