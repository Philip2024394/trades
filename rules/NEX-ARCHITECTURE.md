# NEX ARCHITECTURE CONSTITUTION · IMMUTABLE

Founder 2026-09-10 · v1.0

This document is machine-readable via `rules/architecture.json`. Every
proposal produced by any Nex Agent (nex1 · nex2 · nex3) is checked against
these rules at the **Architecture Guardian** verification gate. A change
that violates any rule below is REJECTED before it can be shown to the
founder as an approvable plan.

## MANDATORY

1. NEX uses its own PostgreSQL infrastructure at `localhost:5433/nex_dev`
   (env: `NEX_TAXONOMY_POSTGRES_URL` or `NEX_POSTGRES_URL`).
2. NEX does **NOT** use Supabase for data · storage · auth · realtime.
3. NEX does **NOT** introduce another database engine without explicit
   founder approval.
4. NEX GB Storage is the authoritative object/file store.
5. PostgreSQL is the authoritative relational data layer.
6. Truth Engine rules (see `src/lib/nex/truth-engine/*` if it exists,
   otherwise doctrine files under `docs/DECISIONS/`) cannot be bypassed.
7. LLM output is NEVER automatically considered authoritative truth.
   Every LLM-generated statement must be verified via a deterministic tool
   before it can be surfaced to a real user.
8. Every database schema modification requires a migration file under
   `db/migrations/` OR `supabase/migrations/` (both directories exist and
   are historically used by NEX; the agent must not invent a third).
9. Every feature requires automated verification (typecheck + lint +
   unit + integration + architecture scan) before it may be marked shipped.
10. No Nex Agent may claim a feature is complete until verification passes.
11. No third-party image copy at any tier (ADR-0022). Only merchant-provided
    or open-license (Wikimedia Commons ODbL/CC) images may enter NEX.
12. Seed rows are text-only, `status=listed · claimed=false · verified=false
    · visibility=public` (ADR-0023).
13. NEX never sells leads · never takes commission · fixed subscription only
    (ADR-0003).

## AGENT AUTHORITY BOUNDARY

- The Nex Agent (nex1/nex2/nex3) may READ any file, ANY table, ANY log.
- The Nex Agent may WRITE to `nex_agent.*` tables (its own memory).
- The Nex Agent may PROPOSE a plan + a diff.
- The Nex Agent may NOT apply a diff to `src/`, `db/`, `supabase/`, or any
  code directory without founder approval.
- The Nex Agent may NOT delete any file, table row, or migration.
- The Nex Agent may NOT push to any git remote.
- The Nex Agent may NOT modify `rules/*` — the constitution is immutable.

## VERIFICATION GATE ORDER (nex2 · nex3 apply in this order)

1. Typecheck (`tsc --noEmit`)
2. Lint (`next lint` or repo equivalent)
3. Unit tests (`vitest run` or repo equivalent)
4. Build (`next build`) · only for release-candidate diffs
5. Architecture scan — `rules/architecture.json`
6. Security scan — forbidden strings, secrets in diff
7. Doctrine scan — ADR compatibility
8. Founder approval — the FINAL gate for any change

A change that fails any gate returns to nex1 for revision. After 5 failed
revision attempts, the task HALTS and pings the founder. No autonomous
descent into destruction (per V1.5 spec principle).

## THE HARD RULE

> The agent does not own NEX. It is an engineer operating under NEX's rules.

This sentence is the constitution's north star. If any behaviour of any Nex
Agent contradicts this sentence, that behaviour is a bug.
