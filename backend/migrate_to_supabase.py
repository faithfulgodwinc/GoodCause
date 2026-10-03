"""Test Supabase connection and run initial schema migration."""
import asyncio
import os
import asyncpg
import psycopg

POOLER_URLS = [
    os.environ.get("DATABASE_URL", "postgresql://postgres:postgres@localhost:5432/goodcause"),
]

def run():
    with open("backend/schema.sql", "r", encoding="utf-8") as f:
        sql = f.read()

    connected_url = None
    for url in POOLER_URLS:
        print(f"Attempting connection to: {url.split('@')[-1]}...")
        try:
            with psycopg.connect(url, connect_timeout=10) as conn:
                with conn.cursor() as cur:
                    cur.execute("SELECT version();")
                    ver = cur.fetchone()[0]
                    print(f"Connected successfully! Server version: {ver}")
                    print("Executing schema.sql...")
                    cur.execute(sql)
                    conn.commit()
                    
                    # Verify tables
                    cur.execute("""
                        SELECT table_name 
                        FROM information_schema.tables 
                        WHERE table_schema = 'public'
                        ORDER BY table_name;
                    """)
                    tables = [r[0] for r in cur.fetchall()]
                    print(f"Created {len(tables)} tables in Supabase: {', '.join(tables)}")
                    connected_url = url
                    break
        except Exception as e:
            print(f"Failed with {url.split('@')[-1]}: {e}")

    if connected_url:
        print(f"\nMIGRATION_SUCCESS_URL={connected_url}")
    else:
        print("\nCould not connect to any Supabase host.")

if __name__ == "__main__":
    run()
