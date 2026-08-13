# Wave 3 · STEP 4 · Production Evidence · READ-ONLY

**Programme:** Headquarters Production Readiness
**Authorisation:** Philip · STEP 4 · production evidence · read-only pass
**Date executed:** 2026-08-10
**Locked verdict:**

> **STEP 4 — PRODUCTION EVIDENCE PASS COMPLETE (READ-ONLY)**
> 2 rows VERIFIED — PRODUCTION · 4 rows UNKNOWN (production surface-limited) · 11 rows NOT TESTABLE (production surface unavailable) · 10/10 preserved KJs invariant intact pre + post · zero writes · zero migrations · zero flag flips · zero remediation

This document records only what was proven and what could not be proven. Nothing was fixed.

Related sources:
- `WAVE-4-VERIFICATION-MATRIX.md` — the local V-1..V-13 pass
- `WAVE-3-STEP-3-021-048-COLLISION-REPORT.md` — 021/048 factual report (still OPEN)
- Wave 3 batches H1-H6 · Phase 6 closure

---

## 0 · Prohibitions honoured

Per Philip's STEP 4 directive:

- ⛔ No production writes
- ⛔ No migration application
- ⛔ No Supabase schema change
- ⛔ No feature-flag flip
- ⛔ No supervisor enable
- ⛔ No alert-dispatch enable
- ⛔ No 021/048 modification
- ⛔ No severity-policy invention
- ⛔ No load test / destructive test / restore rehearsal
- ⛔ No production migration work
- ⛔ No Supabase → NEX Storage cutover
- ⛔ No fix of anything discovered
- ⛔ No local-evidence substitution when production surface is unavailable

---

## 1 · Reachable production surface inventory

From `.env.local` (values redacted, only hostnames extracted):

| Surface | State | Notes |
|---|---|---|
| **NEX Supabase project** (`ijvqdvsvwtwxzcqmoqit.supabase.co`) | ✅ Reachable · service_role key present | PostgREST responds · `public` schema exposed · **`nex` schema NOT exposed** (PGRST106) |
| **Hammerex Supabase project** (`msdonkkechxzgagyguoe.supabase.co`) | ✅ Reachable · service_role key present | PostgREST responds · `public` schema exposed |
| **Production NEX Postgres · direct pg** | ❌ **NOT AVAILABLE** | No `NEX_PROD_POSTGRES_URL` or equivalent in `.env.local` · only `NEX_POSTGRES_URL=localhost:5433/nex_dev` |
| **Production HTTP deployment URL** | ❌ **NOT AVAILABLE** | No `NEX_APP_URL` / Vercel URL / staging URL in `.env.local` |
| **Supabase Management API access-token** | ❌ **NOT AVAILABLE** (in-scope files) | `scripts/audit-migration-state.mjs` reads a token from `C:\Users\Victus\hammer\.env.tools.local` · out-of-scope for this batch |

---

## 2 · Method

- Wrote `scripts/prove-production-evidence-readonly.ts` · read-only Supabase JS client probes only · zero mutations
- Probed via `select("*").limit(1)` (not `head:true count-exact`, which silently returns null with empty-error object on Supabase JS · confirmed via a one-shot diagnostic that was created + deleted in the same shell command)
- For each probe recorded exact PostgREST return code + message
- Preservation invariant verified before and after via `scripts/prove-preservation-invariant.mjs`
- No probe left persistent state on any host

---

## 3 · Per-row evidence

| # | Check | Verdict | Evidence |
|---|---|---|---|
| 1 | NEX Supabase · service_role reachability (public schema) | 🟢 **VERIFIED — PRODUCTION** | `SELECT record_id FROM public.knowledge_records LIMIT 1` → 1 row returned · service_role auth OK · PostgREST(public) exposed |
| 2 | Hammerex Supabase · service_role reachability (public schema) | 🟢 **VERIFIED — PRODUCTION** | `head:true count-exact` on `public.hammerex_trade_off_listings` → **123 rows** · service_role auth OK · PostgREST(public) exposed |
| 3 | H4 · `nex.analytics_rollup_queue` on production NEX Supabase | 🔵 **UNKNOWN** | `PGRST106 · Invalid schema: nex` — PostgREST does not expose the `nex` schema · **cannot conclude table existence from REST alone** · direct pg required |
| 4 | H1 · `nex.worker_jobs` on production NEX Supabase | 🔵 **UNKNOWN** | Same `PGRST106 · Invalid schema: nex` |
| 5 | 021 · `nex.alert_rules` on production NEX Supabase | 🔵 **UNKNOWN** | Same `PGRST106 · Invalid schema: nex` |
| 6 | `nex.knowledge_records` on production NEX Supabase | 🔵 **UNKNOWN** | Same `PGRST106 · Invalid schema: nex` |
| 7 | V-2b prod · F5 rule catalogue populated on production | ⚫ **NOT TESTABLE** | Requires HTTP endpoint `/api/nex/observability/alert-rules` + prod URL (unavailable) |
| 8 | V-2c prod · F5 evaluator observable on production | ⚫ **NOT TESTABLE** | Requires HTTP endpoint `/api/nex/brain/llm-health` + prod URL · also blocked by 021/048 collision |
| 9 | V-4a-prod · HMAC valid signature accepted on production route | ⚫ **NOT TESTABLE** | Requires HTTP endpoint + CRON_SECRET verification in prod runtime |
| 10 | V-5a-prod · scoped-token hit against production supervisor-sweep | ⚫ **NOT TESTABLE** | Requires HTTP endpoint + supervisor to be enabled (which is prohibited) |
| 11 | V-8a · production smoke via `scripts/prod-smoke.mjs` | ⚫ **NOT TESTABLE** | Requires `NEX_APP_URL` / Vercel deployment URL (unavailable) |
| 12 | V-9a · load test | ⚫ **NOT TESTABLE** | Requires staging URL · deliberately excluded from this batch |
| 13 | V-10b · restore rehearsal | ⚫ **NOT TESTABLE** | Requires separately-hosted target |
| 14 | H1 · migration index verification on production (046 · 047 · 048 · 049) | ⚫ **NOT TESTABLE** | Requires direct pg access to production NEX Postgres · REST does not expose `pg_indexes` |
| 15 | H2 R-3 · production log-drain observation | ⚫ **NOT TESTABLE** | No log-drain vendor pick yet |
| 16 | H3 · production P99 measurement | ⚫ **NOT TESTABLE** | Requires `pg_stat_statements` on prod · not exercisable from REST |
| 17 | H6 · production RLS policy coverage per `pg_policies` | ⚫ **NOT TESTABLE** | REST cannot query `pg_policies` · direct pg access required |

---

## 4 · The most consequential production finding

**`PGRST106 · Invalid schema: nex`** on the production NEX Supabase project.

The NEX runtime (with `NEX_BRAIN_BACKEND=supabase`) writes to a `nex.*` schema on the production NEX Supabase project. The PostgREST layer on that project only exposes the `public` schema, so:

- Every one of our production-migration-state / production-schema / production-row-count checks against `nex.*` returns `PGRST106` when attempted over REST
- The runtime path that DOES write to `nex.*` in production must be using either (a) direct-pg (via a Postgres connection string this shell does not have), (b) a `public`-schema RPC helper we haven't inventoried, or (c) an alternative production NEX Supabase project we haven't been told about
- **Verifying H1 / H4 / 021 / Subsystem A schema state on production is NOT POSSIBLE from the surface available to this shell** without either:
  - a production Postgres connection string (`NEX_PROD_POSTGRES_URL` or equivalent), or
  - a Supabase Management API token authorising SQL queries against project `ijvqdvsvwtwxzcqmoqit`, or
  - PostgREST configuration to expose the `nex` schema on the production project

This is honest evidence, not a failure. It defines what the operator must provide before the next production-evidence pass can add rows to the VERIFIED bucket.

---

## 5 · Aggregate

| Classification | Count | Rows |
|---|---|---|
| 🟢 VERIFIED — PRODUCTION | **2** | NEX Supabase reachability (public) · Hammerex Supabase reachability (public) |
| 🔵 UNKNOWN — production surface limited | **4** | H4 · H1 · 021 · nex.knowledge_records — all blocked by `PGRST106 · Invalid schema: nex` |
| ⚫ NOT TESTABLE — production surface unavailable | **11** | HTTP-endpoint checks · direct-pg checks · staging/target-dependent checks · vendor-dependent checks |
| 🔴 FAILED / regression | **0** | none |

---

## 6 · What's needed for the NEXT authorised production-evidence pass

Recorded for planning · NOT proposing to do them:

1. **Direct Postgres access to production NEX Supabase** — either a `NEX_PROD_POSTGRES_URL` connection string OR PostgREST configuration allowing `db-schemas="public,nex"` OR a Supabase Management API access token.
2. **Production HTTP deployment URL** — `NEX_APP_URL` pointing at the Vercel/staging deployment · unblocks V-2b · V-2c · V-4a-prod · V-8a.
3. **Staging URL for load test** — V-9a.
4. **Separately-hosted PG target** — V-10b restore rehearsal.
5. **Log-drain vendor pick** — H2 R-3.
6. **`pg_stat_statements` on prod** — H3 P99 tuning.

None of these are actionable from this shell today. Each requires an operator/production authorisation.

---

## 7 · Preservation invariant

| Check | Result |
|---|---|
| Pre-STEP-4 · 10 preserved KJs | ✅ `claimed / 0 / null` · violations=0 |
| Post-STEP-4 · 10 preserved KJs | ✅ `claimed / 0 / null` · violations=0 |

---

## 8 · Prohibitions confirmed honoured

- ✅ Only SELECT operations executed against Supabase REST
- ✅ Zero writes · zero DELETE · zero UPDATE · zero INSERT
- ✅ Zero migration application
- ✅ Zero flag flips
- ✅ Zero supervisor state change
- ✅ Zero 021/048 modification
- ✅ Zero severity-policy invention
- ✅ Zero destructive tests / load tests / restore tests
- ✅ Zero substitution of local evidence for production rows (every UNKNOWN row is honestly labelled UNKNOWN — none rebranded as VERIFIED)
- ✅ 10 preserved KJs untouched · verified pre + post

---

## 9 · Files touched

- **NEW** · `scripts/prove-production-evidence-readonly.ts` (read-only Supabase JS probe)
- **NEW** · `docs/headquarters-production-readiness/STEP-4-PRODUCTION-EVIDENCE-READONLY.md` (this file)
- **Temporary + deleted** · `scripts/_diagnose-nex-supabase.mjs` (one-shot connectivity diagnostic · created + removed in the same shell command · zero repo footprint)

Zero modifications to any existing code, migration, test, doc, or configuration file.

---

## 10 · Final ledger state

**Baseline (unchanged from pre-STEP-4):**
- Wave 1 · Phase 6 · H1–H6 · Wave 4 · W4-1 · W4-2 · V-1b — **VERIFIED — LOCAL LIVE**
- 021/048 collision — **OPEN** (§WAVE-3-STEP-3-021-048-COLLISION-REPORT.md · no changes made)
- Supervisor — DISABLED
- Every default feature flag — OFF
- 10 preserved KJs — 10/10 `claimed / 0 / null`

**Added by STEP 4:**
- **STEP 4 — PRODUCTION EVIDENCE PASS COMPLETE (READ-ONLY)**
- 2 rows VERIFIED — PRODUCTION (Supabase reachability on both projects · public schema)
- 4 rows UNKNOWN — production surface limited (`PGRST106 · Invalid schema: nex`)
- 11 rows NOT TESTABLE — surface unavailable
- 0 rows FAILED

**PRODUCTION — STILL NOT PROVEN** for the H1-H6 / Wave 4 body of work. The gap is real, honest, and now precisely characterised: it hinges on obtaining direct-pg or Management-API access to the production NEX Supabase project (`ijvqdvsvwtwxzcqmoqit`) and a deployment HTTP URL.

**No further work is being taken.** Awaiting the next explicit authorisation.
