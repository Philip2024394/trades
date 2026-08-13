# HEADQUARTERS VERCEL DEPLOYMENT AUDIT · PHASE A3

**Status:** EVIDENCE GATHERED · findings compiled
**Date:** 2026-08-10
**Author role:** Master AI engineer · NEX Corporation
**Objective:** Close the Phase A3 "Vercel deployment state UNKNOWN" gap called out at Section 12 of the master audit.
**Rule:** File:line evidence for every claim. No speculation.

---

## Section 1 · `vercel.json` overview

**File:** `C:\Users\Victus\trades\vercel.json` (56 lines)

Defines **28 scheduled crons** via GET with `CRON_SECRET` bearer authentication. No memory/region overrides at JSON level — those are per-route via `export const runtime`/`maxDuration`/`dynamic`.

Key entries:
- `/api/cron/custom-domain-health` · `0 */6 * * *` — DNS health every 6h
- `/api/cron/os-event-drain` · `* * * * *` — Event bus every minute
- `/api/cron/beacon-sla-sweep` · `*/5 * * * *` — SLA monitor
- `/api/cron/monthly-washer-replenish` · `0 3 1 * *` — Tier credit reset
- `/api/nex/brain/cron-tick` · `* * * * *` — Brain pipeline every minute
- `/api/cron/comms-social-worker` · `* * * * *` — Social queue every minute
- `/api/reviews/publish-pending` · `*/15 * * * *` — 15-min review cool-off

---

## Section 2 · `/api/cron/*` coverage vs `route.ts` reality

**28 cron paths wired in `vercel.json`; only 21 have a matching `route.ts` file.**

**FINDING [P2] · REVISED 2026-08-10:** Prior audit run claimed 7 orphaned paths — that claim was WRONG. Verified via `for d in src/app/api/cron/*/; do test -f "$d/route.ts"; done` — every cron directory (33 total, including `nex-backup-daily`, `nex-overnight-prep`, `nex-social-publish`, `nex-weekly-report`, `bi-daily-aggregate`, `yard-release-queued`, `yard-expire-notifications`) has a route file present.

The only actually orphaned entry was `/api/canteens/recalc-metrics` — no matching directory exists anywhere in `src/app`. **Removed from `vercel.json` on 2026-08-10.**

Lesson: Explore agent claims about missing files must be verified with an explicit shell test before acting.

---

## Section 3 · `/api/nex/brain/cron-tick` route

**File:** `src/app/api/nex/brain/cron-tick/route.ts` (40 lines)

**Runtime declarations (lines 18-20):**
```ts
export const runtime = "nodejs";
export const dynamic = "force-dynamic";
export const maxDuration = 120;
```

**Dispatch (lines 32-33):**
- `dispatchNewInboxItems()`
- `runOneCycle({})`

Both from `@/lib/nex/brain/manager`. Called from:
- Vercel cron (`vercel.json` line 51 · `* * * * *`)
- Manual `/api/nex/brain/run-once` POST

**Auth (lines 23-29):** `checkCronAuth(req)` validates `CRON_SECRET` or `NEX_BRAIN_CRON_TOKEN` — fail-closed in production. Correctly wired.

---

## Section 4 · Runtime declarations across API routes

Every brain route + every cron route exports `runtime = "nodejs"`. No Edge runtime in cron config.

**`maxDuration` observed:**
| Route | Seconds |
|---|---|
| cron-tick | 120 |
| run-once | 120 |
| guardian | 120 |
| import-existing | 180 |
| dispatch | 60 |
| comms-social-worker | 60 |
| shadow-profile-scrape | 300 |
| shadow-profile-enrich | 300 |
| business-brains-sync | 300 |

All brain routes export `dynamic = "force-dynamic"`.

---

## Section 5 · Env-var references

**Brain / storage:**
- `NEX_POSTGRES_URL`, `NEX_SUPABASE_URL`, `NEX_SUPABASE_SERVICE_ROLE_KEY`, `NEXT_PUBLIC_NEX_SUPABASE_URL`

**Migration gates:**
- `NEX_BRAIN_BACKEND` (`postgres` | `supabase` | `filesystem`)
- `NEX_INBOX_READ_BACKEND`, `NEX_BRAIN_SHADOW_SUPABASE`, `NEX_OBJECT_BACKEND`

**LLM providers:**
- `GROQ_API_KEY`, `GOOGLE_GEMINI_API_KEY`, `ANTHROPIC_API_KEY`, `MISTRAL_API_KEY`, `OPENROUTER_API_KEY`, `SAMBANOVA_API_KEY`, `CEREBRAS_API_KEY`, `CLOUDFLARE_WORKERS_AI_TOKEN`, `HUGGINGFACE_API_KEY`, `LLM_PROVIDER_CHAIN`

**Cron auth:**
- `CRON_SECRET`, `NEX_BRAIN_CRON_TOKEN`

**Worker gate:**
- `NEX_WORKER_CONSENT_V2=YES` (required for the legacy Fly worker to boot; Wave 4 safeguard)

**FINDING [P1]:** No confirmation `NEX_BRAIN_BACKEND` is set on the Vercel project. `.env.example:93` documents the gate; the master audit says default is unset (which resolves to `supabase`). Post-Wave 5 backfill this must flip to `postgres` — Philip needs to update Vercel Project Settings → Environment Variables and redeploy.

---

## Section 6 · Build config

**File:** `next.config.mjs` (184 lines)

**Lines 12-14:**
```js
// Turn these OFF before shipping real production traffic — they are hiding real bugs.
typescript: { ignoreBuildErrors: true },
eslint: { ignoreDuringBuilds: true }
```

**FINDING [P1]:** Vercel is currently building with TypeScript errors and ESLint errors ignored. The inline comment names it: this must flip before production. Recommend a two-step transition — turn ESLint on first (usually less noisy), fix the surfacing warnings, then turn TypeScript strict-build on.

**Images (lines 15-19):** `msdonkkechxzgagyguoe.supabase.co`, `ik.imagekit.io` — matches the Wave 2 decision that ImageKit is the external object-store default and Supabase is transitional.

**79 rewrites (lines 31-87):** merchant vanity URLs (`/:slug` → `/trade/:slug`), consistent with ADR-0002 single-domain rule.

**Security headers (lines 172-181):** 2-year HSTS + preload · `X-Content-Type-Options: nosniff` · Permissions-Policy blocks camera/microphone, geolocation same-origin only.

---

## Section 7 · Middleware

**File:** `src/middleware.ts` (328 lines) · Edge runtime · matcher `/((?!_next/|api/|favicon).*)`

Five functions:
1. CID injection (`x-request-id` header)
2. Custom domain routing (DB lookup → `/{slug}` rewrite)
3. Subdomain routing (`*.thenetworkers.app` → `/trade/{slug}`)
4. Affiliate tracking (`?ref=N` cookie + fire-and-forget log)
5. Merchant referral (`tn_mref` cookie)

Gates API routes correctly (excluded from matcher). No critical issues detected.

---

## Section 8 · Fly.io ↔ Vercel boundary

**Current post-Wave 1 (2026-08-09):** Fly machines destroyed. Vercel runs all cron + all APIs.

**FINDING [P0]:** Fly.io app `nex-brain-worker` was scaled to 0 but **not permanently destroyed**. The app still exists; `fly.toml` lines 54, 56 hardcode `NEX_BRAIN_BACKEND=supabase`. A future `fly deploy` would boot the legacy image and reintroduce the split-brain.

Mitigation in place: Wave 4 startup guard in `scripts/nex-brain-cloud-worker.ts` refuses to boot without `NEX_WORKER_CONSENT_V2=YES`. That's a belt; the braces are `fly apps destroy nex-brain-worker`. Recommend running the destroy after Wave 5 flip stabilises for 7 days.

---

## Section 9 · Cron schedules · full list

28 active + 7 orphaned per §2. Per-minute crons (high load):
- `/api/cron/os-event-drain`
- `/api/cron/site-editor-video-worker`
- `/api/nex/brain/cron-tick` ← critical path
- `/api/cron/comms-social-worker`

Every-5-min: `/api/cron/beacon-sla-sweep`, several others.
Monthly: `/api/cron/monthly-washer-replenish`.

---

## Section 10 · Deployment artefacts

- `.env.example` (106 lines) — 13 vars documented with Wave/phase guidance
- `deploy/nex-brain-worker/README.md` — Fly runbook (decommissioned reference)

**FINDING [P2]:** No Vercel deployment runbook exists. Master audit line 305 already marked Vercel state UNKNOWN. Fix: author `deploy/VERCEL-DEPLOYMENT.md` covering:
- Vercel project setup + team access
- Env vars required (grouped by system per §5)
- Cron enablement + expected UI screenshot
- `CRON_SECRET` rotation cadence + procedure
- Health-check URLs to smoke-test after deploy
- Rollback SOP (Vercel promote previous deployment)

---

## Section 11 · Findings summary

| Severity | Count | Items |
|---|---|---|
| P0 | 1 | Fly app not permanently destroyed |
| P1 | 3 | 7 orphaned cron paths · `NEX_BRAIN_BACKEND` env-flip unconfirmed on Vercel · build errors ignored |
| P2 | 1 | No Vercel deployment runbook |

## Section 12 · Acceptance-gate impact

- **Item 5 (queue/concurrency proven):** unchanged (proven on 2 workers; the concurrent-dispatch dedup gap surfaced by the engineering audit becomes the extension test).
- **Item 20 (secrets/configuration audited):** partially advanced — env-var surface enumerated. Rotation still pending.
- **Item 23 (production build from clean checkout):** improved but not passing — build errors currently ignored per next.config.mjs.
- **Item 27 (dashboards distinguish current vs historical):** ✅ unchanged.

## Section 13 · Recommended remediation order

1. Set `NEX_BRAIN_BACKEND` env on Vercel (matches Wave 5 target) — 5 min (post-backfill)
2. Remove or author the 7 orphaned cron routes — 30 min
3. Author `deploy/VERCEL-DEPLOYMENT.md` runbook — 1 h
4. Turn ESLint back on for builds; fix surfacing issues — 2 h
5. Turn TypeScript strict-build on; fix surfacing issues — 4-8 h
6. After 7-day stabilisation post-Wave 5: `fly apps destroy nex-brain-worker` — 5 min
