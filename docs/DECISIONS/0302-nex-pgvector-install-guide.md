# ADR-0302 — pgvector install guide (Windows / local Postgres 17)

**Status:** GUIDE · manual operator install required
**Author:** Master AI Engineer
**Date:** 2026-09-10

---

## Why pgvector

- Enables **vector similarity search** on the local Postgres cutover
- Required for: semantic search over knowledge_records, embedding-backed LTM, semantic cache hits
- Currently unavailable → these paths silently degrade to deterministic-only

## Why manual install

pgvector does NOT publish pre-built Windows binaries. Every Windows install requires either:
- Building from source with Visual Studio + PG dev headers, OR
- Using WSL2 with Ubuntu Postgres + pgvector-apt package

## Recommended path: Build from source (30 min)

### Prerequisites
1. **Visual Studio 2022 Build Tools** (free) — https://aka.ms/vs/17/release/vs_BuildTools.exe
   - Install "Desktop development with C++"
2. **PostgreSQL 17 with dev headers** — already installed at `C:\Program Files\PostgreSQL\17\`

### Build steps
```powershell
# 1. Open x64 Native Tools Command Prompt for VS 2022 (elevated)
# 2. Set env
set "PGROOT=C:\Program Files\PostgreSQL\17"
set "PATH=%PGROOT%\bin;%PATH%"

# 3. Clone + build
cd %USERPROFILE%\src
git clone --branch v0.8.0 https://github.com/pgvector/pgvector.git
cd pgvector
nmake /F Makefile.win
nmake /F Makefile.win install
```

### Enable in Postgres
```sql
-- Via psql:
CREATE EXTENSION vector;
-- Verify:
SELECT extname, extversion FROM pg_extension WHERE extname = 'vector';
```

### Alternative: WSL2 (5 min)
```bash
# Inside WSL2 Ubuntu:
sudo apt install postgresql-17-pgvector
# But this uses WSL Postgres, not the Windows install.
# Only useful if migrating to Postgres-in-WSL entirely.
```

### Alternative: Cloud Postgres
- Neon, Supabase (already had it), Railway all ship pgvector pre-installed
- Contradicts founder mandate of "no third party" but easiest path

## What NEX uses vector for today

Grep confirms these code paths reference pgvector-shaped types but tolerate its absence:
- `src/lib/nex/knowledge-brain/` — falls back to BM25-only if vector extension missing
- `src/lib/nex/live-chat-completion/memory/` — LTM works without vector, semantic recall degraded
- `src/lib/nex/live-chat-completion/llm-rescue/alignment.ts` — has deterministic + optional NLI, no vector dependency

**Verdict:** NEX is fully functional WITHOUT pgvector. Installing it enables faster semantic search + better LTM recall, but is not blocking.

## Recommendation

Deferred to founder authorization. When ready:
1. Install Visual Studio Build Tools
2. Run build steps above (30 min)
3. `CREATE EXTENSION vector;` in nex_dev
4. Re-run this line to verify: `SELECT extname FROM pg_extension WHERE extname='vector';`
5. Restart NEX dev server to pick up availability

No code changes needed on the NEX side — the extension is detected at runtime by the knowledge-brain and LTM layers.
