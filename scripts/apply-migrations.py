#!/usr/bin/env python3
"""Apply Supabase migrations via the Management API.

Reads token + project ref from .env.tools.local, POSTs each SQL file
to https://api.supabase.com/v1/projects/{ref}/database/query, and
reports outcome per file.
"""
import json
import sys
import urllib.request
import urllib.error
from pathlib import Path

def load_env(path: Path) -> dict:
    out = {}
    if not path.exists():
        return out
    for line in path.read_text().splitlines():
        line = line.strip()
        if not line or line.startswith("#") or "=" not in line:
            continue
        k, v = line.split("=", 1)
        out[k.strip()] = v.strip().strip('"').strip("'")
    return out

def apply_migration(token: str, ref: str, sql_path: Path) -> tuple[bool, str]:
    sql = sql_path.read_text()
    url = f"https://api.supabase.com/v1/projects/{ref}/database/query"
    body = json.dumps({"query": sql}).encode("utf-8")
    req = urllib.request.Request(
        url,
        data=body,
        headers={
            "Authorization": f"Bearer {token}",
            "Content-Type": "application/json"
        },
        method="POST"
    )
    try:
        with urllib.request.urlopen(req, timeout=60) as resp:
            data = resp.read().decode("utf-8")
            return True, data
    except urllib.error.HTTPError as e:
        return False, f"HTTP {e.code}: {e.read().decode('utf-8')}"
    except Exception as e:
        return False, f"{type(e).__name__}: {e}"

def main() -> int:
    env = load_env(Path(".env.tools.local"))
    token = env.get("SUPABASE_ACCESS_TOKEN")
    ref = env.get("SUPABASE_PROJECT_REF")
    if not token or not ref:
        print("Missing SUPABASE_ACCESS_TOKEN or SUPABASE_PROJECT_REF in .env.tools.local")
        return 1

    migrations = sys.argv[1:] if len(sys.argv) > 1 else [
        "supabase/migrations/20260710120000_reviews.sql",
        "supabase/migrations/20260710130000_canteens.sql",
        "supabase/migrations/20260710140000_uploads_usage.sql",
        "supabase/migrations/20260710150000_merchant_recovery.sql"
    ]

    failures = 0
    for m in migrations:
        p = Path(m)
        print(f"── {p.name}")
        ok, out = apply_migration(token, ref, p)
        status = "✓" if ok else "✗"
        print(f"  {status} {out[:400]}")
        if not ok:
            failures += 1
        print()

    print(f"Done. {len(migrations) - failures}/{len(migrations)} succeeded.")
    return 0 if failures == 0 else 1

if __name__ == "__main__":
    sys.exit(main())
