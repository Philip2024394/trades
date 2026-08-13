# STEP 4A · Production Read-Only Access-Path Discovery

**Programme:** Headquarters Production Readiness
**Authorisation:** Philip · STEP 4A · discovery only · no queries · no configuration changes
**Date:** 2026-08-10
**Locked verdict:**

> **STEP 4A · DISCOVERY COMPLETE — NO PRODUCTION QUERIES RUN · NO CONFIGURATION CHANGED**
> Direct-pg production access path **EXISTS** in Vercel project env under the name `NEX_POSTGRES_URL` (Production scope) · **NOT currently available to this shell** · a **safety concern** exists around name-collision with the local dev variable · **read-only-role variant does not exist yet** · **decision required from operator before the next production-verification pass**

No credential value, password, token, connection string, or hostname containing secrets was printed to output or written into any file.

---

## 0 · Prohibitions honoured

- ⛔ Did NOT modify production
- ⛔ Did NOT modify Supabase configuration
- ⛔ Did NOT expose `nex` schema through PostgREST
- ⛔ Did NOT create or modify DB roles
- ⛔ Did NOT create or rotate credentials
- ⛔ Did NOT apply migrations
- ⛔ Did NOT run any INSERT / UPDATE / DELETE / DDL
- ⛔ Did NOT enable any feature flag
- ⛔ Did NOT enable supervisor
- ⛔ Did NOT touch 021/048
- ⛔ Did NOT resolve severity policy
- ⛔ Did NOT begin R-7 remediation or Supabase → NEX Storage cutover
- ⛔ Did NOT run any production query
- ⛔ Did NOT print / log / paste / echo any secret value from env vars, files, or deployment configuration
- ⛔ Did NOT substitute local evidence for production evidence

---

## 1 · Access paths searched

Discovery order matches Philip's priority:

### Path 1 · Existing deployment secret mechanism (Vercel / Fly)

**Vercel** (`vercel.json` + `deploy/VERCEL-DEPLOYMENT.md`):
- `vercel.json` contains only cron declarations · no `env` block · production env vars are stored in the **Vercel dashboard** (Project → Settings → Environment Variables · Production scope)
- `deploy/VERCEL-DEPLOYMENT.md §2` explicitly documents `NEX_POSTGRES_URL` as the *"production Postgres connection string · With pool params"* · Production scope · Required
- The name `NEX_POSTGRES_URL` is the ESTABLISHED, DOCUMENTED variable — no separate `NEX_PROD_POSTGRES_URL` naming exists
- Retrieval mechanism (operator only): Vercel dashboard export OR `vercel env pull` CLI · both require Vercel auth this shell does not have

**Fly** (`deploy/nex-brain-worker/fly.toml` + `deploy/nex-brain-worker/README.md`):
- Header of `fly.toml`: *"DECOMMISSIONED 2026-08-09 · Headquarters Production Readiness · Both machines destroyed via `fly scale count 0 --app nex-brain-worker`"*
- Historical config also used `NEX_POSTGRES_URL` (same name) as a `fly secrets set` value
- Currently zero live machines · not a live production surface

### Path 2 · Current local environment

- Enumerated variable NAMES only in STEP 4 (values redacted) · no production-specific variable name discovered
- `NEX_POSTGRES_URL` exists in `.env.local` but resolves to `localhost:5433/nex_dev` (dev · confirmed via host-only inspection during STEP 4)
- No `NEX_PROD_POSTGRES_URL` · no `PROD_NEX_POSTGRES_URL` · no `NEX_POSTGRES_URL_READONLY` · no equivalent
- Conclusion: **no production Postgres connection variable is currently available to this shell**

### Path 3 · Deployment / configuration documentation

- `deploy/VERCEL-DEPLOYMENT.md §2` — canonical production env-var table names `NEX_POSTGRES_URL` as the production Postgres connection
- No documentation mentions a `NEX_PROD_POSTGRES_URL_READONLY` or scoped read-only variant
- No documentation names a Supabase Management API token as a production-verification path (an ambient token exists at `C:\Users\Victus\hammer\.env.tools.local` per `scripts/audit-migration-state.mjs` but that path is OUT OF SCOPE for this shell + this batch)

---

## 2 · Whether an already-authorised production direct-pg path EXISTS

**Yes, in the deployment environment.** No, in this shell.

| Location | Direct-pg path present? |
|---|---|
| Vercel Production env vars | ✅ `NEX_POSTGRES_URL` set (per §2 of VERCEL-DEPLOYMENT.md) |
| Fly (nex-brain-worker) | Historically yes · currently DECOMMISSIONED (zero machines) |
| This shell's `.env.local` | ❌ Only local dev URL under the same name |
| Supabase Management API | Not in-scope (out-of-repo token file) |

---

## 3 · Whether it is USABLE for READ-ONLY verification

**Not safely as-is.** Two blockers must be resolved before this shell can use it:

### 3.1 · Naming-collision safety concern

The production URL is stored under the exact same variable name as this shell's local URL: `NEX_POSTGRES_URL`. If the production value is dropped into `.env.local` under that name, EVERY script this session has authored — including `prove-preservation-invariant.mjs`, `prove-supervisor-attest.ts`, `prove-timeout-injection-live.ts`, `prove-v3a-rollup-drain.ts`, `prove-rollup-gate-live.ts`, `prove-alerts-dispatch-gate-live.ts`, `verify-migration-state.mjs`, `_investigate-021-048.mjs` (recreatable), `check-migration-declarations.mjs`, etc. — would silently target production. Several of these do writes (burner probes, alert dispatches, feature-flag toggles). **This is a real data-safety risk.**

Mitigation options (recorded, not proposed):
- (α) Provide the production URL under a NEW distinct name (e.g. `NEX_PROD_POSTGRES_URL_READONLY`) and update only the verification probes to read it
- (β) Use a scoped shell session (PowerShell block or subshell) that overrides `NEX_POSTGRES_URL` for a single command and reverts on exit
- (γ) Author a new dedicated probe that accepts the URL as a CLI flag (`--url=$PROD_URL`) rather than reading from environment

Each requires an operator decision.

### 3.2 · Read-only role does not yet exist

`deploy/VERCEL-DEPLOYMENT.md` documents only one production connection string · the runtime uses it for INSERT / UPDATE / DELETE / DDL on `nex.*` tables. Using this same credential for verification would carry write privileges — a violation of the "read-only verification" principle.

A separate read-only Postgres role does not appear in the documented production setup. Creating one would require:
- A CREATE ROLE + GRANT statement (DDL) on production Postgres · **prohibited by STEP 4A scope**
- A new connection string with that role's credentials · **would require operator to create + provide**

Alternative safer path (recorded, not proposed): use the runtime credential ONLY inside a Postgres transaction that starts with `BEGIN READ ONLY` and always ends in `ROLLBACK`. That's a session-level guarantee that no writes can happen, even accidentally. It's less strict than a role-level guarantee but usable today with the existing credential IF the operator authorises it.

---

## 4 · Where the configuration is documented (without exposing secrets)

- **Primary:** `deploy/VERCEL-DEPLOYMENT.md §2` · production env-var table · names `NEX_POSTGRES_URL` as *"production Postgres connection string · With pool params"* · Production scope · Required
- **Retrieval instructions:** same file · §1 references "Vercel dashboard → Project → Settings → Environment Variables" as the storage surface
- **Historical (decommissioned):** `deploy/nex-brain-worker/fly.toml` header · Fly secrets used the same variable name

No secret values were read or printed. The variable NAME is public documentation. The variable VALUE lives only in Vercel's encrypted store.

---

## 5 · What production evidence this access-path would unlock

Once a safe read-only production Postgres connection exists in this shell (per §3), the following STEP 4 UNKNOWN rows become verifiable:

| Row | Currently | Would become |
|---|---|---|
| H4 · `nex.analytics_rollup_queue` on production | UNKNOWN (PGRST106) | VERIFIED via direct pg `SELECT to_regclass('nex.analytics_rollup_queue')` |
| H1 · `nex.worker_jobs` on production | UNKNOWN (PGRST106) | VERIFIED via direct pg |
| 021 · `nex.alert_rules` on production | UNKNOWN (PGRST106) | VERIFIED via direct pg + row-count |
| `nex.knowledge_records` on production | UNKNOWN (PGRST106) | VERIFIED via direct pg |
| H1 · migration index verification (046 · 047 · 048 · 049) | NOT TESTABLE via REST | VERIFIED via `SELECT * FROM pg_indexes WHERE schemaname='nex'` |
| H6 · production RLS policy coverage per `pg_policies` | NOT TESTABLE via REST | VERIFIED via `SELECT * FROM pg_policies WHERE schemaname IN ('public','nex')` |
| Production `nex.knowledge_dump_jobs` state breakdown (including whether the 10 preserved KJs are also preserved on prod) | UNKNOWN | VERIFIED via `SELECT status, COUNT(*) FROM nex.knowledge_dump_jobs GROUP BY status` |
| 021/048 collision state on production | UNKNOWN | VERIFIED via `information_schema.columns` — reveals whether prod also has 021's shape or if 048 landed differently there |

Total unlock: **~8 UNKNOWN rows** could become **VERIFIED**.

---

## 6 · What remains unavailable regardless

Even with production direct-pg access, these STEP 4 rows still need additional surface:

| Row | Additional dependency |
|---|---|
| V-2b prod · F5 rule catalogue populated on production | Production HTTP URL (Vercel deployment URL) |
| V-2c prod · F5 evaluator observable on production | Production HTTP URL + 021/048 collision resolution |
| V-4a-prod · HMAC valid sig accepted on production | Production HTTP URL |
| V-5a-prod · scoped-token supervisor-sweep | Production HTTP URL + supervisor enable (prohibited) |
| V-8a · production smoke | `NEX_APP_URL` |
| V-9a · load test | Staging URL |
| V-10b · restore rehearsal | Separately-hosted target |
| H2 R-3 · production log-drain observation | Log-drain vendor pick + drain configuration |
| H3 · production P99 measurement | `pg_stat_statements` extension installed on prod |

---

## 7 · Preservation invariant

| Check | Result |
|---|---|
| Pre-STEP-4A · 10 preserved KJs | ✅ `claimed / 0 / null` · violations=0 |
| Post-STEP-4A · 10 preserved KJs | ✅ `claimed / 0 / null` · violations=0 |

---

## 8 · Prohibitions confirmed honoured

Every prohibition listed in the authorisation is honoured. In particular:
- ✅ No secret value printed, logged, exported, or copied
- ✅ No production query executed
- ✅ No production configuration change proposed or performed
- ✅ No credential created / rotated / modified
- ✅ No DB role created / modified
- ✅ No PostgREST exposure change
- ✅ No local evidence substituted for production
- ✅ No feature-flag activation

Investigation used only: `ls`, `grep -n` on documentation files, `Read` on committed configuration files, one preservation-invariant probe (pre + post). No probe added a new file to the repo. No script was executed against any production surface.

---

## 9 · Files touched

- **NEW** · `docs/headquarters-production-readiness/STEP-4A-PRODUCTION-ACCESS-PATH-DISCOVERY.md` (this file)

Zero modifications to any existing code, migration, configuration, test, or documentation file.
Zero new scripts.
Zero temporary probes created or deleted.

---

## 10 · Recommended next-step decisions (not proposed as actions)

Presented for the operator to choose from. None will be taken without a new explicit authorisation.

### Decision A · Access-path shape
- **A1** Provide the production URL to this shell under a NEW distinct name (`NEX_PROD_POSTGRES_URL_READONLY`) · requires operator to create + share
- **A2** Use existing `NEX_POSTGRES_URL` value from Vercel via a scoped shell session that never persists to `.env.local` · requires PowerShell + strict discipline
- **A3** Author a probe that accepts the URL as a CLI flag (`--url=...`) · requires operator to hand-invoke with the value
- **A4** Do not provide direct-pg access · keep production UNKNOWN

### Decision B · Read-only guarantee
- **B1** Create a dedicated read-only Postgres role on production · smallest ongoing risk · requires a one-time DDL step (out of STEP 4A scope)
- **B2** Use existing runtime credential but always inside `BEGIN READ ONLY; ...; ROLLBACK;` sessions · usable today with the existing credential
- **B3** Both A1 + B1 combined (safest · highest operator setup cost)

### Decision C · Production HTTP URL for the OTHER unblocking axis
Independent of A/B: providing `NEX_APP_URL` unlocks V-2b · V-2c · V-4a-prod · V-8a irrespective of pg access.

---

## 11 · Final ledger state

**Baseline (unchanged):**
- Wave 1 · Phase 6 · H1–H6 · Wave 4 · W4-1 · W4-2 · V-1b · STEP 4 — VERIFIED — LOCAL LIVE
- 021/048 collision — OPEN
- Production H1–H6 verification — NOT PROVEN (unchanged)
- Supervisor — DISABLED
- Every default feature flag — OFF
- 10 preserved KJs — 10/10 `claimed / 0 / null`

**Added by STEP 4A:**
- **STEP 4A · DISCOVERY COMPLETE**
- Production direct-pg path — **EXISTS** in Vercel env under `NEX_POSTGRES_URL` (Production scope)
- Access to this shell — **NOT PROVIDED**
- Safety concern — **NAME COLLISION with local dev variable** (§3.1)
- Safety concern — **READ-ONLY ROLE DOES NOT EXIST** (§3.2)
- Next-step decision belongs to the operator (§10)

**No further work is being taken.** Awaiting operator decision on §10 or an explicit next authorisation.
