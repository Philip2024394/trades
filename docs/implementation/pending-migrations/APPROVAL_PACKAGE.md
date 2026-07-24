# Pending Migration Approval Package · V1

**Approval artefact · 2026-07-23**
**Purpose:** consolidate every migration held in `docs/implementation/pending-migrations/` into a single approval document for CTO + Backend Lead + Legal Counsel. Each migration is described at the level needed to sign off; the SQL itself is authoritative.

**Ground rule:** no `.sql` in this folder is applied to production until every gate below is Yes AND the migration is promoted to `supabase/migrations/`. Promotion happens as a deliberate PR, not a background action.

---

## 1 · Sequencing (must apply in this order)

```
                        ┌─────────────────────────────┐
1. rbac_v0.sql          │ Independent · unlocks       │
                        │ Team-scoped features        │
                        └─────────────────────────────┘
                                       │
                                       ▼
2. gdpr_requests.sql   ← independent · can land in parallel with rbac_v0
                                       │
                                       ▼
3. ai_provider_status.sql ← independent · can land in parallel
                                       │
                                       ▼
4. brain_content_v0.sql        ← creates hammerex_nex_brains + registry family
                                       │
                                       ▼
5. brain_vision_and_estimate_rules_v0.sql  ← FK-depends on brain_content_v0 (references hammerex_nex_brains(slug))
```

Rationale: brain_content must land before brain_vision_and_estimate_rules because the latter's FK is `REFERENCES public.hammerex_nex_brains(slug)`. All others are independent and can land in parallel.

---

## 2 · Per-migration approval sheet

### 2.1 · `rbac_v0.sql` (117 lines)

**Purpose:** minimal 3-role team RBAC (Owner · Manager · Member) with permission catalog per feature area.

**Tables created:**
- `hammerex_nex_team_members` — merchant × user × role assignment
- `hammerex_nex_permissions` — permission catalog + defaults per role

**Indexes:** merchant lookup, user lookup.

**RLS enabled on:** both tables.

**External FK dependencies:** `auth.users(id)` (Supabase Auth) — already present.

**Rollback plan:**
```sql
DROP TABLE IF EXISTS public.hammerex_nex_permissions;
DROP TABLE IF EXISTS public.hammerex_nex_team_members;
```
Safe rollback: no other table references these at V0.

**Downstream impact:** unlocks Team-scoped feature flags across Studio + Trade Centre. Zero user-visible change until UI wires in.

**Approvals required:**
- [ ] CTO — RLS templates comply with ADR-0016
- [ ] Backend Lead — Table shape + index selectivity acceptable
- [ ] Product Lead — Role names + permission set matches product spec

**Sequencing:** independent · can land Wave 1.

---

### 2.2 · `gdpr_requests.sql` (94 lines)

**Purpose:** GDPR portability + Right-To-Be-Forgotten request orchestrator per ADR-0016 + ES-04 §8.

**Tables created:**
- `hammerex_nex_platform_gdpr_requests` — request state machine (pending → in_progress → completed/rejected)
- `hammerex_nex_platform_gdpr_audit` — immutable audit trail per state transition

**Indexes:** merchant lookup, status lookup, audit-per-request.

**RLS enabled on:** requests table (audit table is service-role-only).

**External FK dependencies:** `auth.users(id)`.

**Rollback plan:**
```sql
DROP TABLE IF EXISTS public.hammerex_nex_platform_gdpr_audit;
DROP TABLE IF EXISTS public.hammerex_nex_platform_gdpr_requests;
```

**Downstream impact:** Legal Counsel confirms GDPR posture. UI surfaces (self-service portability request in Studio; RTBF flow) build against this schema in Phase 1.

**Approvals required:**
- [ ] CTO
- [ ] Backend Lead
- [ ] Legal Counsel — request lifecycle + audit retention meets UK GDPR + UK DPA obligations
- [ ] DPO (if appointed)

**Sequencing:** independent · can land Wave 1.

---

### 2.3 · `ai_provider_status.sql` (114 lines)

**Purpose:** circuit-breaker state + fallback ladder + immutable AI call log per ADR-0021 (context_domains logging) + ES-04 AI-safety fallback ladder.

**Tables created:**
- `hammerex_nex_platform_ai_provider_status` — per-provider health state
- `hammerex_nex_platform_ai_fallback_ladder` — configured fallback chains
- `hammerex_nex_platform_ai_call_log` — parent partitioned table
- `hammerex_nex_platform_ai_call_log_2026_08` — first monthly partition

**Indexes:** merchant × time on call log, provider × time on call log, lookup on provider status.

**External FK dependencies:** `auth.users(id)`.

**Rollback plan:**
```sql
DROP TABLE IF EXISTS public.hammerex_nex_platform_ai_call_log_2026_08;
DROP TABLE IF EXISTS public.hammerex_nex_platform_ai_call_log;
DROP TABLE IF EXISTS public.hammerex_nex_platform_ai_fallback_ladder;
DROP TABLE IF EXISTS public.hammerex_nex_platform_ai_provider_status;
```
NOTE: monthly partitions must be dropped BEFORE parent table.

**Partition maintenance:** monthly partitions must be created ahead of time via a cron job (to be added in Phase 1 with `pg_cron`). See ES-04 §5 for the cron spec.

**Downstream impact:** enables Anthropic → Haiku → OpenAI fallback chain per ADR-0016 §7. Every `/api/brain/*` call once flag ON writes one row to the call log with `context_domains: string[]`.

**Approvals required:**
- [ ] CTO — circuit breaker semantics acceptable
- [ ] Backend Lead — partitioning scheme + retention plan acceptable

**Sequencing:** independent · can land Wave 1.

---

### 2.4 · `brain_content_v0.sql` (283 lines) — includes ADR-0017 §8 tables

**Purpose:** Brain registry + module content + correction chain + version history + Field Learning Loop outcomes/signals per ADR-0017 §1-§8.

**Tables created:**
- `hammerex_nex_brains` — Brain registry (slug PK)
- `hammerex_nex_brain_content` — module content per Brain × module × country
- `hammerex_nex_brain_corrections` — merchant-submitted corrections per ADR-0017 §5
- `hammerex_nex_brain_versions` — semver history per ADR-0017 §6 (includes `change_kind` for §8 attribution)
- **`hammerex_nex_brain_field_outcomes`** — per ADR-0017 §8 · prediction vs actual
- **`hammerex_nex_brain_learning_signals`** — per ADR-0017 §8 · aggregated + K-anonymised

**Indexes:** brain × status, brain × content scoping, correction × status, outcome × subject × time, outcome × merchant × time, outcome × region × subject, learning-signal pending-review.

**RLS enabled on:** brains, content, corrections, versions (outcomes + signals TBC below).

**External FK dependencies:** `auth.users(id)`.

**Rollback plan:**
```sql
-- Reverse dependency order: signals depend on brains, outcomes on brains, versions on brains, corrections on content, content on brains
DROP TABLE IF EXISTS public.hammerex_nex_brain_learning_signals;
DROP TABLE IF EXISTS public.hammerex_nex_brain_field_outcomes;
DROP TABLE IF EXISTS public.hammerex_nex_brain_versions;
DROP TABLE IF EXISTS public.hammerex_nex_brain_corrections;
DROP TABLE IF EXISTS public.hammerex_nex_brain_content;
DROP TABLE IF EXISTS public.hammerex_nex_brains;
```
Rollback IS possible pre-Brain-content-load; becomes destructive once Author-authored content lands.

**Downstream impact:**
- Substrate feature flag remains gate: `NEX_BRAIN_RUNTIME_ENABLED` still OFF post-migration.
- `/api/brain/learn` starts returning 200 (was 503 `learning_loop_table_missing`).
- `/api/brain/[slug]/confidence` reads real `hammerex_nex_brain_learning_signals` instead of empty state.
- Brain loader boot audit can register live entries.

**Open items requiring approval before apply:**
- [ ] RLS policy for `hammerex_nex_brain_field_outcomes` — proposed: merchants can insert own outcomes; only service-role can read cross-tenant.
- [ ] RLS policy for `hammerex_nex_brain_learning_signals` — proposed: Author read-only for own Brain's signals; Panel members read via signed URL.
- [ ] Confirm `hammerex_nex_brains.status` enum matches Zod BrainStatusSchema in substrate.

**Approvals required:**
- [ ] CTO — ADR-0017 §1-§8 schema alignment
- [ ] Backend Lead — index selectivity + RLS enforceability
- [ ] Product Lead — status lifecycle matches Author + Panel workflow
- [ ] Trade Brain Program Lead — Author authoring workflow lands cleanly against this
- [ ] Legal Counsel — Learning Loop outcome capture consent language covered in Consent UX

**Sequencing:** Wave 2 · MUST land before `brain_vision_and_estimate_rules_v0.sql`.

---

### 2.5 · `brain_vision_and_estimate_rules_v0.sql` (78 lines)

**Purpose:** vision-example ground-truth capture + Author-authored pricing rules per Consolidation Reference Gap 3.

**Tables created:**
- `hammerex_nex_brain_vision_examples` — Author-labelled ground truth per Brain × category
- `hammerex_nex_brain_estimate_rules` — Author-authored pricing rules with structured formula JSONB (no arbitrary code)

**Indexes:** vision-examples per Brain × category × status, vision-examples per author, estimate-rules active lookup, estimate-rules per author.

**External FK dependencies:**
- `hammerex_nex_brains(slug)` — **hard dependency on migration 2.4 being applied first**
- `auth.users(id)`

**Rollback plan:**
```sql
DROP TABLE IF EXISTS public.hammerex_nex_brain_estimate_rules;
DROP TABLE IF EXISTS public.hammerex_nex_brain_vision_examples;
```

**Downstream impact:**
- Author Tooling can start ingesting vision-example uploads (per `TRADE_BRAIN_AUTHOR_TOOLING_SPEC.md`).
- Estimator engine can start reading Brain-scoped pricing rules once Author lands content.
- Vision integration (`analyseImageWithBrain`) can start referencing example-based ground truth in a follow-on wire-up.

**Open items requiring approval before apply:**
- [ ] Confirm image-storage paths follow ADR-0021 domain prefix `trade-brains/<slug>/images/`.
- [ ] Confirm `formula` JSONB schema is documented (not arbitrary code — structured expression only).

**Approvals required:**
- [ ] CTO
- [ ] Backend Lead
- [ ] Trade Brain Program Lead

**Sequencing:** Wave 2 · MUST land after `brain_content_v0.sql`.

---

## 3 · Application procedure (per Wave)

1. Signoff sheet in this document fully ticked
2. PR opens against main copying the migration file from `docs/implementation/pending-migrations/` → `supabase/migrations/<timestamp>_<name>.sql`
3. PR runs test suite + Supabase migration dry-run in a preview branch
4. CTO reviews the promotion PR (not just the underlying content — the promotion PR is a distinct signoff)
5. Merge to main triggers Supabase CLI apply to production
6. Verification query per table (row count = 0 for all except any seed data) run within 15 minutes of apply
7. `docs/DB_SCHEMA.md` regenerated (`node scripts/scan-db-schema.mjs`)
8. `docs/DECISIONS/INDEX.md` updated with a small "migration N applied YYYY-MM-DD" line
9. This file's per-migration checkbox for that migration is manually flipped

**No rollback without CTO signoff.** Rollback is a distinct PR that includes verification of no dependent live data.

---

## 4 · Cross-migration risks

- **RLS-first ordering** — Every table above enables RLS. If policies are added in a subsequent PR (not this migration), there is a window where the table is protected but not queryable by the intended role. Recommendation: add policies in the same migration or immediately-following migration, not after real writes begin.

- **Author-workflow readiness** — Migrations 2.4 + 2.5 unblock the Brain registry, but the Author Tooling (per `TRADE_BRAIN_AUTHOR_TOOLING_SPEC.md`) must be shipping before the tables are used in anger. Don't apply Wave 2 until Author Tooling MVP is at least on staging.

- **Feature flag remains gate** — Even after all 5 migrations apply, `NEX_BRAIN_RUNTIME_ENABLED` MUST stay OFF until:
  - ADR-0017 + ADR-0021 Accepted
  - First Author under contract
  - First Author has authored at least the Craft + Regulations modules (M2 milestone in Author Contract §2)
  - Merchant Advisory Panel has convened at least once

See `PHASE_0_UNLOCK_CONDITIONS_V1.md` for the complete gate list.

---

## 5 · Approval sheet · final CTO sign-off

Before any Wave applies to production:

- [ ] Every per-migration signoff sheet in §2 is complete (all boxes ticked)
- [ ] Legal Counsel has reviewed 2.2 (GDPR) and 2.4 (Learning Loop consent)
- [ ] Backend Lead has verified partitioning cron in 2.3 is set up in staging first
- [ ] Author Tooling MVP is at least on staging before Wave 2 applies
- [ ] Merchant Advisory Panel is at least seated (per Charter §8) before Wave 2 Brain content lands
- [ ] This document is committed alongside the promotion PR so the review record is traceable

CTO signature: _______________________ Date: ____________

---

**End of Pending Migration Approval Package · V1.**
