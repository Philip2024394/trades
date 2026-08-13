# Wave 3 · H6 · Legacy Supabase RLS Audit + Design

**Programme:** Headquarters Production Readiness · Wave 3 · Batch H6
**Authorisation:** Philip · 2026-08-10 · Q1(a) + Q2(iii) + Q4-limited (audit + design surface only · underlying RLS policy gap remains OPEN)
**Date opened:** 2026-08-10.
**Final state (locked at end of this batch):**

> **H6 — IMPLEMENTED · VERIFIED — LOCAL LIVE**
> Legacy Supabase RLS audit and policy-design surface completed.
> **Underlying RLS policy gap — OPEN / NOT REMEDIATED.**
> Supabase migration modification/application requires separate explicit authorisation.

Related sources of truth:
- `WORLD-CLASS-OPS-REMEDIATION-PLAN.md §3.2 (Batch H6)` — deferred by plan author, this batch honours that deferral
- `WORLD-CLASS-OPS-FINAL-GAP-AUDIT.md §R-7` — "~20 files" lower bound (actual gap is larger, see §3)
- Previous closures: `WAVE-3-H5-DISPATCHER.md` · `WAVE-3-H4-MIGRATION-049-GATE.md` · `WAVE-3-H3-TIMEOUT-BUDGETS.md` · `WAVE-3-H2-CID-LOGGER.md` · `WAVE-3-H1-MIGRATION-HYGIENE.md`

---

## 0 · Prohibitions honoured

Per the Q1(a) + Q4-limited authorisation:

- ⛔ Not modifying any `supabase/migrations/*.sql`
- ⛔ Not applying any new Supabase policies
- ⛔ Not running Supabase production migrations
- ⛔ Not altering Supabase RLS state (dev or prod)
- ⛔ Not inventing policy semantics
- ⛔ Not declaring the underlying RLS gap closed
- ⛔ Not touching the 10 preserved KJs
- ⛔ Not altering supervisor behaviour
- ⛔ Not beginning Wave 4
- ⛔ Not touching NEX-side RLS (out of scope; NEX side is broadly healthy per §3.2)

---

## 1 · Why H6 shrank to audit + design

The plan's H6.a proposed adding CREATE POLICY statements to legacy Supabase migration files (one subsystem at a time). Every prior batch this session (H1-H5) has enforced `Do not touch Supabase legacy migrations` as a standing prohibition. That prohibition is load-bearing:

- The legacy migration set is the source of truth for what Supabase looks like when re-provisioned
- Adding a policy in a new migration file requires a Supabase apply — Philip has explicitly withheld production migration authorisation across every batch
- Getting the policy semantics wrong can silently lock out legitimate readers (anon/authenticated in the future)

Q1(a)+Q2(iii)+Q4-limited resolves the collision without violating the standing prohibition:
- **Q2(i)** · read-only audit surface identifying every RLS-on-no-policy table
- **Q2(ii)** · design document with risk-ranked target list + per-subsystem policy shape proposals for future authorised implementation
- **Drift-catcher** · prevents the gap from silently growing when future legacy migrations land
- **Q4** · H6 ledger closes for `audit + design`; the underlying gap remains OPEN

The plan author already anticipated this — `§3.3` records H6 as `deferred (per-subsystem design pass, tracked separately)`. This batch delivers the design surface the plan deferred.

---

## 2 · Audit method

### 2.1 · Scope

Files scanned: `supabase/migrations/*.sql` (excluding names starting with `_` such as `_ROLLBACK_V2_ECOSYSTEM.sql`).

Case-insensitive matching. Both `ALTER TABLE X ENABLE ROW LEVEL SECURITY` and `alter table X enable row level security` variants are captured.

### 2.2 · Signals extracted per file

- **RLS-enabled targets** · `ALTER TABLE [schema.]table ENABLE ROW LEVEL SECURITY`
- **Policy targets (create)** · `CREATE POLICY [name] ON [schema.]table`
- **Policy targets (drop)** · `DROP POLICY [IF EXISTS] name ON [schema.]table`
- **Table declarations** · `CREATE TABLE [IF NOT EXISTS] [schema.]table` (used to disambiguate policy targets)

### 2.3 · Coverage determination

A table is **covered** if it appears as the target of at least one `CREATE POLICY` anywhere in the migration set AND the corresponding policy is not later removed by an unmatched `DROP POLICY`.

A table is a **gap** if it is enabled for RLS anywhere AND no active policy targets it.

### 2.4 · Risk ranking (deliberate heuristic, not policy semantics)

Per plan §H6, first target being "billing / consent / project-workflow." Ranking heuristic:

| Tier | Signal | Rationale |
|---|---|---|
| P0 | table name matches `/payment|billing|invoice|charge|stripe|price|checkout/i` | financial · direct revenue impact |
| P1 | table name matches `/consent|gdpr|privacy|subscription|unsubscribe|newsletter/i` | regulatory exposure |
| P2 | table name matches `/order|quote|lead|contact|job|project|listing|profile/i` | customer-facing workflow · reputational impact |
| P3 | everything else | infrastructure / metadata · lower impact |

This is **not policy design**. It orders the gaps for future authorised work. Actual policy shapes require per-subsystem review.

### 2.5 · Excluded from the gap set (legitimate exceptions)

- Files with names prefixed `_` (rollback / operations scripts, not real migrations)
- Any table where RLS is enabled but the enable statement appears immediately followed by a `USING (true) WITH CHECK (true)` policy for `service_role` (this IS a policy · counts as covered · but noted as "service_role-only" tier in the report so future readers see the current shape)

---

## 3 · Findings

**Date captured:** 2026-08-10 · run of `scripts/verify-supabase-legacy-rls-coverage.mjs` against the repository at HEAD.

### 3.1 · Aggregate

| Metric | Value |
|---|---|
| Files scanned | 330 |
| Tables that enable RLS anywhere | 331 |
| Tables covered by at least one `CREATE POLICY` | 140 |
| **Tables in gap** (RLS enabled · no policy anywhere) | **191** |

Compared to the audit's "~20" lower bound: the real gap is **9.5× larger**. R-7 as originally stated significantly understated the exposure.

### 3.2 · Gap distribution by risk tier

| Tier | Rationale | Count |
|---|---|---|
| **P0** | financial · direct revenue impact (`/payment\|billing\|invoice\|charge\|stripe\|price\|checkout\|receipt\|payout\|wallet/i`) | **9** |
| **P1** | consent · regulatory exposure (`/consent\|gdpr\|privacy\|subscription\|unsubscribe\|newsletter\|dpa/i`) | **5** |
| **P2** | customer-facing workflow · reputational impact (`/order\|quote\|lead\|contact\|job\|project\|listing\|profile\|customer\|user\|account\|application\|referral\|affiliate/i`) | **32** |
| **P3** | infrastructure / metadata · lower impact | **145** |

### 3.3 · P0 gap tables (financial · highest priority)

| Table | 1st enable statement |
|---|---|
| `public.hammerex_sitebook_cost_payments` | one file |
| `public.hammerex_xrated_payments` | one file |
| `public.os_billing_customers` | one file |
| `public.os_billing_entitlements` | one file |
| `public.os_billing_subscriptions` | one file |
| `public.os_billing_webhook_events` | one file |
| `public.os_project_payment_schedule_items` | one file |
| `public.os_project_payment_schedules` | one file |
| `public.os_project_payments` | one file |

These are the highest-value targets for the first Q3-authorised policy-application batch. Full source file list is in the audit script's `--json` output.

### 3.4 · P1 gap tables (consent · regulatory)

| Table |
|---|
| `public.hammerex_gdpr_requests` |
| `public.hammerex_site_subscriptions` |
| `public.os_consent_grants` |
| `public.os_consent_purposes` |
| `public.os_homeowner_subscriptions` |

### 3.5 · P2 gap tables (32 · customer workflow)

Domain summary (full list in JSON output):
- Project workflow (`os_project_*`) · 12 tables (bundle_exports, dispute_evidence, disputes, milestones, participants, quote_line_items, quotes, reviews, signoffs, status_events, videos, warranties) + `os_projects`
- Business listings + endorsements (`os_business_*`) · 3 tables (listings, portfolio_projects · plus more in P3)
- User personalisation (`os_user_*`) · 4 tables (compare_sets, favourites, follows, recently_viewed)
- NEX-namespaced legacy (`nex_projects*`, `nex_bk_accounts*`) · 3 tables
- Studio + memory · 4 tables
- Hammerex site-book · 3 tables

### 3.6 · P3 gap tables (145 · infrastructure/metadata)

Not enumerated here (full list in the JSON output). Domain summary: bookkeeping/accountancy (`nex_bk_*`), materials (`nex_materials_*`), themes (`nex_themes_*`), site-book (`hammerex_sitebook_*`), site editor (`hammerex_site_editor_*`), OS event log / dead letter / rate limits, endorsement rings, dashboard notices, property registry, storage quotas, and various OS operational metadata.

### 3.7 · Currently safe? · Yes

`service_role` uses `BYPASSRLS`. Every NEX/Supabase adapter today connects with the service-role key. No anon/authenticated reader is currently active against these tables. **The gap is a defence-in-depth issue, not a live exploit.** But the moment a non-service-role connection is added (e.g. a public API querying via `anon`), 191 tables silently return zero rows.

### 3.8 · Policy semantics are OUT of scope for this batch

H6 records the gap and the risk ranking. It does NOT propose the shape of the policies. Correct policy semantics depend on:
- What relationship the row has to the caller (owner? member? admin?)
- Which claims the caller carries (JWT sub? role? tenant?)
- Whether the operation is a read, write, delete
- Whether service-role should retain a covering "USING (true)" policy for internal automation

Each subsystem's policies need per-subsystem review by the operator. Any policy authored without that review risks either locking out a legitimate reader OR leaving a partial exposure that looks safe but isn't.

---

## 4 · Drift-catcher

`src/lib/nex/config/tests/legacy-rls-coverage-drift.test.mjs` asserts:

- **CD1** · The gap count reported by `scripts/verify-supabase-legacy-rls-coverage.mjs --json` does not exceed the baseline recorded in an allowlist in the test file itself
- **CD2** · New tables introduced to the legacy migration set may not silently enter the gap · they must either have a policy in the same migration set OR be explicitly waived in the allowlist with a documented reason

Baseline recorded in the test = exact gap count captured by the first script run under this batch (§3). Future migrations that add another RLS-on-no-policy table fail the drift-catcher and require author to either (a) add a policy in the same file or (b) update the allowlist with a justification. This makes the gap visible in code review rather than silently growing.

---

## 5 · What H6 does NOT do

- Does NOT modify any `supabase/migrations/*.sql`
- Does NOT apply new Supabase policies (dev or prod)
- Does NOT propose specific policy SQL (that requires per-subsystem policy semantics — a design conversation Philip must lead)
- Does NOT close the R-7 gap. R-7 (RLS coverage on Supabase legacy schema) remains OPEN.
- Does NOT touch NEX-side RLS (broadly healthy · 39 files enable RLS · 41 create policies · out of R-7 scope)

---

## 6 · Files touched

- **NEW** · `scripts/verify-supabase-legacy-rls-coverage.mjs` — read-only audit surface
- **NEW** · `src/lib/nex/config/tests/legacy-rls-coverage-drift.test.mjs` — drift-catcher
- **NEW** · `docs/headquarters-production-readiness/WAVE-3-H6-RLS-DESIGN.md` (this file)
- **MODIFIED** · `package.json` — new `nex:verify-supabase-legacy-rls-coverage` script

Zero modifications to `supabase/migrations/*.sql`. Zero touches to Supabase (dev or prod). Zero NEX-side runtime changes.

---

## 7 · Test plan

- **CD1-CD2** · drift-catcher assertions in the new test file
- **Live 1** · execute `verify-supabase-legacy-rls-coverage.mjs` against the current repository · capture the exact gap count · record risk-ranked table list in §3
- **Regression sweep** · run existing test suites; report any changes

Preservation invariant: 10 KJs `claimed / 0 / null` pre and post.

---

## 8 · Results

**Date executed:** 2026-08-10.

### 8.1 · Deliverables

| Component | State | Evidence |
|---|---|---|
| Audit script `scripts/verify-supabase-legacy-rls-coverage.mjs` | ✅ IMPLEMENTED · VERIFIED — LOCAL LIVE | Scans 330 files · reports 191 gap tables ranked P0-P3 · zero writes · zero DB touches |
| Drift-catcher `src/lib/nex/config/tests/legacy-rls-coverage-drift.test.mjs` (CD1-CD2) | ✅ IMPLEMENTED · VERIFIED — LOCAL LIVE | Baseline locked at 191 total / P0=9 / P1=5 / P2=32 / P3=145 · CD1+CD2 pass · fails loudly if any new legacy migration adds another RLS-no-policy table without waiver |
| Design document (this file) | ✅ IMPLEMENTED | Records method, findings, tier ranking, legitimate exceptions, what's explicitly out of scope |
| npm script `nex:verify-supabase-legacy-rls-coverage` | ✅ IMPLEMENTED | Added to `package.json` |
| Underlying R-7 RLS policy gap | 🔴 **OPEN / NOT REMEDIATED** | 191 tables await per-subsystem authorised policy pass · separate Philip authorisation required |

### 8.2 · Regression sweep

- **NEW tests** (CD1, CD2) · 2 pass · 0 fail
- **Regression sweep** (obs + workers + config + db + analytics + alerts + new h6) · 152 pass · 1 pre-existing fail (`CFGA2` on `postgres.wc-companion.test.ts` · unrelated to H6)
- Preservation invariant · 10/10 preserved KJs still `claimed / 0 / null` (verified pre + post)

### 8.3 · What H6 delivers vs what remains OPEN

| Item | Delivered by H6? | Notes |
|---|---|---|
| In-repo audit surface for legacy RLS gaps | ✅ | The script is the canonical source of truth for the count · rerun any time |
| Risk-ranked target list for future work | ✅ | P0-P3 tiers · P0/P1 named explicitly in §3.3 / §3.4 |
| Drift protection · gap cannot silently grow | ✅ | CD1 + CD2 in CI-runnable test file |
| Actual policy application to `supabase/migrations/*.sql` | ⛔ | Standing prohibition · requires separate authorisation |
| Actual RLS policy semantics per subsystem | ⛔ | Requires per-subsystem operator design pass · not H6's authority |
| Supabase production migration apply | ⛔ | Explicit prohibition |
| Closure of R-7 as an audit finding | ⛔ | R-7 remains OPEN · H6 delivers only the visibility surface |

### 8.4 · Files touched

- **NEW** · `scripts/verify-supabase-legacy-rls-coverage.mjs`
- **NEW** · `src/lib/nex/config/tests/legacy-rls-coverage-drift.test.mjs`
- **NEW** · `docs/headquarters-production-readiness/WAVE-3-H6-RLS-DESIGN.md` (this file)
- **MODIFIED** · `package.json` (+1 script entry)

**Zero `supabase/migrations/*.sql` modifications. Zero Supabase touches (dev or prod). Zero NEX-side runtime changes.**

### 8.5 · Final H6 verdict

> **H6 — IMPLEMENTED · VERIFIED — LOCAL LIVE** (audit + design + drift-catcher only)
> **Underlying R-7 RLS policy gap — OPEN / NOT REMEDIATED** · 191 tables await per-subsystem authorised policy pass
> **Supabase migration modification / application — requires separate explicit authorisation**
> **PRODUCTION — NOT PROVEN** (nothing in this batch touches production)
