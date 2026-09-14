"""Apply one checked-in SQL migration to the configured PostgreSQL database."""

import argparse
import asyncio
import os
from pathlib import Path

import asyncpg
from dotenv import load_dotenv


async def apply() -> None:
    parser = argparse.ArgumentParser()
    parser.add_argument("migration", type=Path)
    args = parser.parse_args()

    root = Path(__file__).resolve().parent
    load_dotenv(root / ".env")
    database_url = os.environ.get("DATABASE_URL") or os.environ.get("SUPABASE_DB_URL")
    if not database_url:
        raise RuntimeError("DATABASE_URL or SUPABASE_DB_URL is required")

    migration = args.migration.resolve()
    migrations_root = (root / "migrations").resolve()
    if migrations_root not in migration.parents:
        raise ValueError("Migration must be inside backend/migrations")

    connection = await asyncpg.connect(
        database_url, timeout=15, statement_cache_size=0
    )
    try:
        await connection.execute(migration.read_text(encoding="utf-8"))
    finally:
        await connection.close()
    print(f"Applied {migration.name}")


def main() -> None:
    asyncio.run(apply())


if __name__ == "__main__":
    main()
