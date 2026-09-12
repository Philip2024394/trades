# NEX CODING DOCTRINE · v1.0

Founder 2026-09-10 · this file collects **specific coding lessons** that NEX Agent (nex1 · nex2 · nex3) has been taught. Each entry originates from `nex_agent.doctrine_entries` (a training-lesson attempt reviewed and promoted by the mentor). When a lesson gets promoted, its text lands here **and** its enforcement is mirrored in `rules/architecture.json` where possible.

This file is READ by nex3 during doctrine review. It is APPEND-ONLY. Nothing gets deleted, only superseded by a new entry that references the old one.

## D-001 · Every new file starts with a leading `//` (or `--` for SQL) summary comment
- **Severity**: mandatory
- **Source**: `CLAUDE.md` · repo-wide convention
- **Text**: The first line inside any new file must be a comment naming the file path, followed by a one-line summary of its purpose. Two blank lines separate the comment block from the code. This lets reviewers understand a file in 2 seconds.

## D-002 · No `@supabase/*` imports in new NEX code
- **Severity**: forbidden
- **Source**: ADR-0300 (`docs/DECISIONS/0300-nex-own-storage-migration.md`)
- **Text**: New features must route to `pg` (PostgreSQL direct) + MinIO/S3 for storage. Existing `@supabase/supabase-js` usage is phase-out only. Any new `import { createClient } from '@supabase/*'` in a diff is REJECTED at the architecture gate.

## D-003 · Migrations are append-only · never modify an existing numbered file
- **Severity**: mandatory
- **Source**: `rules/architecture.json.protected_directories`
- **Text**: A new schema change means a NEW file in `db/migrations/` with the next unused number. To roll back, add another numbered migration with the inverse SQL. Never edit `0001_*.sql` once it has been applied to production.

## D-004 · No third-party image copy at any merchant tier
- **Severity**: forbidden
- **Source**: ADR-0022 (`docs/DECISIONS/0022-merchant-images-no-third-party-copy.md`)
- **Text**: Only merchant-uploaded images or open-licence (Wikimedia Commons ODbL/CC) are allowed. No Google Business Profile, no Facebook CDN, no Instagram CDN. Linking to a merchant's official site is fine · copying pixels into NEX is forbidden.

## D-005 · No commission, no lead sales, fixed subscription only
- **Severity**: forbidden
- **Source**: ADR-0003 (`docs/DECISIONS/0003-never-sell-leads.md`)
- **Text**: Merchant monetization uses fixed subscription tiers only (see `src/lib/tierCatalog.ts`). No commission on transactions, no per-lead fee, no shortlist charge. Insurance/service-margin add-ons that are ORTHOGONAL to leads are permitted only with founder review.

## D-006 · Nex1 must never claim a feature is complete before verification passes
- **Severity**: mandatory
- **Source**: `rules/NEX-ARCHITECTURE.md`
- **Text**: When nex1 finishes an implementation, it MUST run `run_typecheck` + `run_lint` + `run_tests` and only then mark the task as "verified". A green step in the stream does not mean "done" — it means "next stage".

## D-007 · Every step nex1 takes must produce a durable step-row
- **Severity**: mandatory
- **Source**: `src/lib/nex-agent/core/orchestrator.ts::emitStep`
- **Text**: Every thought, tool call, tool result, question, plan, review, revision, handoff writes a row to `nex_agent.task_steps`. This is nex1's memory across sessions and the founder's evidence trail. Skipping emissions is a bug.

## D-008 · Never bypass the founder stop-override
- **Severity**: mandatory
- **Source**: `src/lib/nex/agent-runtime/registry.ts::readFounderStopOverride`
- **Text**: Every long-running nex1 workflow checks `readFounderStopOverride()` at task start and before any tool call. If true, the workflow halts without side effects and emits a `system · handoff` step naming the override.

---

## How new entries land here

1. Founder curates a training lesson in `nex_agent.lessons`.
2. nex1 attempts the lesson · deterministic scorer emits pass/partial/fail.
3. Mentor (founder or Claude) reviews the attempt with `POST /api/nex/agent/training` (`action: "review"`).
4. If the mentor identifies a general principle worth preserving, they extract it as a doctrine entry.
5. Mentor calls `POST /api/nex/agent/training` (`action: "promote"`) with `doctrine_key`, `doctrine_text`, `severity`.
6. The row lands in `nex_agent.doctrine_entries`.
7. A separate step (manual for now, automated in V1.2+) transcribes the row into this file with a new `D-NNN` id.
8. When possible, the enforcement is mirrored in `rules/architecture.json` (e.g., a new forbidden_string_pattern or protected_file).

## Doctrine ID format

`D-NNN` where NNN is the next unused integer, zero-padded to 3 digits. IDs are permanent. If a doctrine is later refined, the old ID stays and gets marked `superseded_by: D-YYY` in the DB.
