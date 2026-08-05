# NEX Brain — local filesystem store

Runtime data for the NEX Brain workers. Per-machine, gitignored;
only this README is tracked.

## Layout

```
data/nex-brain/
  README.md              (this file)
  records.json           knowledge_records
  record_versions.json   full version history (Constitution Clause 4)
  graph_edges.json       typed relationships (Clause 6)
  worker_jobs.json       the queue (SKIP LOCKED analogue)
  worker_results.json    per-job LLM output + confidence + provenance
  sources.json           Knowledge Source lineage (Clause 7)
  confidence_scores.json per-claim confidence (Clause 2)
  contradictions.json    Memory Guardian findings
  deprecations.json      soft-delete history (Clause 5)
  knowledge_feedback.json  corrections = the moat
  audit_log.json         append-only trail of every write
```

Mirrors the Supabase schema at `db/migrations/001_nex_brain_schema.sql`.

## When this store is active

- Development (default) — always
- Production — only when `NEX_BRAIN_BACKEND` is unset or empty

When `NEX_BRAIN_BACKEND=supabase` is set (and Supabase credentials are
in `.env.local`), the storage layer switches transparently to Postgres.
Files here become stale but harmless.

## Do not commit runtime data

`.gitignore` excludes all `*.json` under this directory. Only this
README should ever appear in git.
