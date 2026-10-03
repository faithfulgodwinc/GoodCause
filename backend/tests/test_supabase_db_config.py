import importlib


def test_supabase_db_url_accepts_supabase_db_url_env(monkeypatch):
    monkeypatch.delenv("DATABASE_URL", raising=False)
    monkeypatch.setenv("SUPABASE_DB_URL", "postgresql://example/supabase")

    import supabase_db

    importlib.reload(supabase_db)

    assert supabase_db.DATABASE_URL == "postgresql://example/supabase"


def test_database_url_takes_precedence(monkeypatch):
    monkeypatch.setenv("DATABASE_URL", "postgresql://example/database")
    monkeypatch.setenv("SUPABASE_DB_URL", "postgresql://example/supabase")

    import supabase_db

    importlib.reload(supabase_db)

    assert supabase_db.DATABASE_URL == "postgresql://example/database"


def test_database_url_metadata_redacts_credentials(monkeypatch):
    monkeypatch.setenv(
        "DATABASE_URL",
        "postgresql://postgres.secretref:secret-password@aws-0-region.pooler.supabase.com:6543/postgres",
    )
    monkeypatch.delenv("SUPABASE_DB_URL", raising=False)

    import supabase_db

    importlib.reload(supabase_db)

    assert supabase_db.database_url_metadata() == {
        "source": "DATABASE_URL",
        "host": "aws-0-region.pooler.supabase.com",
        "port": 6543,
        "database": "postgres",
        "is_pooler": True,
        "is_localhost": False,
    }
