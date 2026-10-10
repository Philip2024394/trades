# NEX Supabase · authoritative NEX-native migrations

This directory holds NEX-native migrations targeting the **NEX Supabase project** (`ijvqdvsvwtwxzcqmoqit`).

## What this is NOT

- **NOT `supabase/migrations/`** — that directory holds 350 legacy thenetworkers/hammerev migrations. Those must never be replayed against NEX Supabase.
- **NOT applied via `supabase db push` from the repo root.** The repo root's Supabase config would try to run legacy migrations. Use `psql` directly.

## What this is

- **The authoritative NEX-native schema.** NEX Supabase is a clean slate; these are its first-ever migrations. Once applied, `nex_migration_history` records their application.
- **Doctrine-compliant.** Every FK is a UUID. Never phone-keyed. Immutable where doctrinal (messages · order events · ledger entries). Reversal-safe ledger pattern.

## Doctrine references

- `project_nex_reframed_wave_2_native_foundation_storage_audit_2026_09_24.md` — the Founder-authored directive that created this directory
- `project_nex_identity_doctrine_phone_is_credential_not_identity_system_2026_09_23.md` — UUID identity anchoring · never phone-keyed
- `project_nex_commercial_doctrine_free_participation_premium_infrastructure_2026_09_23.md` — no lead marketplace · four-layer economics
- `project_nex_build_order_nervous_system_first_founder_test_acceptance_2026_09_23.md` — nervous system first · Honest Baseline · Founder Test

## Migration order

Apply in strict numerical order. Each migration is transactional (`BEGIN`/`COMMIT`) and records itself in `nex_migration_history` on success.

| # | File | Creates |
|---:|---|---|
| 001 | `001_nex_migration_history_and_account.sql` | `nex_migration_history` · `nex_account` |
| 002 | `002_nex_business.sql` | `nex_business` |
| 003 | `003_nex_product.sql` | `nex_product` |
| 004 | `004_nex_conversation_and_message.sql` | `nex_conversation` · `nex_conversation_participant` · `nex_message` |
| 005 | `005_nex_order.sql` | `nex_order` · `nex_order_event` |
| 006 | `006_nex_ledger.sql` | `nex_ledger_entry` · `nex_ledger_line` |

## Applying migrations

1. Confirm `DATABASE_URL` (postgres connection string with real password) is set in `.env.local` — pointing at NEX Supabase
2. Confirm `NEX_SUPABASE_SERVICE_ROLE_KEY` is set for row-level writes from application code later
3. Apply each migration with `psql "$DATABASE_URL" -f nex-supabase/migrations/00X_*.sql`
4. After each, verify: table exists · row count = 0 · RLS policies present · migration recorded in `nex_migration_history`
5. Report per-migration result

## Rollback

Every migration is additive-only (no DROPs of pre-existing objects). To roll back a single migration, drop the objects it created and delete its row from `nex_migration_history`. Rollback SQL is documented in the header comment of each file.

## Never do this

- Never `DROP` tables from prior migrations while other tables FK to them
- Never modify a migration file after it's been applied (write a new migration instead)
- Never apply migrations from `supabase/migrations/` here
- Never fabricate migration history rows
- Never bypass RLS by removing policies without explicit Founder authorisation
