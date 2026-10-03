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
