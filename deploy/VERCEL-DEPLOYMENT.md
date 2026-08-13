# Vercel deployment runbook

**Status:** LIVING · update after every deploy-config change
**Date:** 2026-08-10

## What Vercel runs

- All API routes under `src/app/api/**`
- All page routes under `src/app/**/page.tsx`
- All crons defined in `vercel.json`
- Middleware (`src/middleware.ts`) on Edge

## What Vercel does NOT run (post-Wave 1)

- The legacy `nex-brain-worker` (was on Fly · destroyed 2026-08-09; app-shell may still exist until `B5`)

## 1 · First-time project setup

1. Log into https://vercel.com/dashboard
2. Import Git Repository → select this repo
3. Framework Preset: Next.js (auto-detected)
4. Root Directory: `./`
5. Build Command: `next build` (default)
6. Node.js Version: 20.x (matches local dev)
7. Do NOT deploy yet — set env vars first

## 2 · Required environment variables

Set at project scope, then per-environment as needed.

### Production scope (all required)

| Name | Value | Notes |
|---|---|---|
| `NEX_POSTGRES_URL` | production Postgres connection string | With pool params |
| `NEX_BRAIN_BACKEND` | `postgres` (post-Wave 5) | Currently `supabase` pre-Wave 5 |
| `NEX_OBJECT_BACKEND` | `postgres` (post-Wave 6) | Currently `filesystem` |
| `NEX_INBOX_READ_BACKEND` | `postgres` (post-Wave 6a) | Currently `filesystem` |
| `NEX_BRAIN_SHADOW_SUPABASE` | `1` during observation window, then `0` | Only set when `NEX_BRAIN_BACKEND=postgres` |
| `NEX_SUPABASE_URL` | Supabase URL | Read-only reference post-cutover |
| `NEX_SUPABASE_SERVICE_ROLE_KEY` | Supabase service-role JWT | Read-only reference post-cutover |
| `CRON_SECRET` | 32-hex random token | Rotate every 90 days |
| `NEX_BRAIN_CRON_TOKEN` | Same or alt token | Used by external cron callers |
| `GROQ_API_KEY` | Groq API key | |
| `GOOGLE_GEMINI_API_KEY` | Gemini API key | |
| `ANTHROPIC_API_KEY` | Anthropic API key | Preferred (no-training default) |
| `MISTRAL_API_KEY` | Mistral API key | |
| `OPENROUTER_API_KEY` | OpenRouter API key | |
| `SAMBANOVA_API_KEY` | SambaNova API key | Optional |
| `CEREBRAS_API_KEY` | Cerebras API key | Optional |
| `CLOUDFLARE_WORKERS_AI_TOKEN` | CF Workers AI token | Optional |
| `HUGGINGFACE_API_KEY` | HF API key | Optional |
| `LLM_PROVIDER_CHAIN` | comma-separated preference order | Optional; defaults per code |
| `LLM_ALLOW_MOCK_FALLBACK` | `false` | Never `true` in prod |
| `STRIPE_SECRET_KEY` | `sk_live_...` | Confirmed rotated per E5 |
| `NEXT_PUBLIC_STRIPE_PUBLISHABLE_KEY` | `pk_live_...` | Public — safe |
| `NEXT_PUBLIC_NEX_SUPABASE_URL` | Supabase URL | Public — safe |

### Preview scope (recommended)

- Copy production but point `NEX_POSTGRES_URL` at a staging DB
- Use Stripe test keys (`sk_test_...`, `pk_test_...`)
- Use dev LLM keys with lower budgets

### Development scope

- Leave everything unset — `.env.local` takes over locally

## 3 · Cron configuration

Crons are in `vercel.json`. After first deploy:
1. Vercel dashboard → Project → Cron Jobs tab
2. Each cron listed with next run time
3. Confirm all listed crons are enabled

## 4 · CRON_SECRET rotation

Quarterly (every 90 days):
1. Generate new 32-hex token: `openssl rand -hex 32`
2. Update Vercel env `CRON_SECRET` (Production + Preview scopes)
3. Update every external cron caller (if any) with the new token
4. Redeploy
5. Watch `nex.audit_log` for 5 min — no 401s should appear
6. If any 401 appears, revert env and investigate before re-rotating

## 5 · Health-check URLs

After every deploy, verify these:
```
curl -H "Authorization: Bearer $CRON_SECRET" https://<domain>/api/nex/brain/status
curl -H "Authorization: Bearer $CRON_SECRET" https://<domain>/api/nex/brain/llm-health
curl -H "Authorization: Bearer $CRON_SECRET" https://<domain>/api/nex/brain/cloud-status
curl -H "Authorization: Bearer $CRON_SECRET" -X GET https://<domain>/api/nex/brain/cron-tick
```
All should return 200. Last one should return `{ ok: true, scanned: N, dispatched: M }`.

## 6 · Rollback SOP

If the new deploy is broken:
1. Vercel dashboard → Deployments → find last known-good deployment
2. Click "⋯" → "Promote to Production"
3. Wait ~30s for propagation
4. Verify health-check URLs above return 200
5. Post an incident update (severity per `INCIDENT-RESPONSE.md`)
6. Investigate the failed deploy in a preview branch before re-deploying

**Never** delete the broken deployment before rollback completes — you may need to reference the logs.

## 7 · Env-var change SOP

Small changes:
1. Update env var(s) in Vercel dashboard
2. Trigger a redeploy (env changes don't auto-redeploy)
3. Follow health-check URLs

Large / risky changes (backend flip, cron secret rotation):
1. Update in Preview scope first
2. Verify Preview deploy works end-to-end
3. Then update Production scope
4. Manual redeploy Production
5. Watch for 30 min

## 8 · Logging & observability

Currently: Vercel dashboard logs only, evaporate at 24h.

**When F3 lands** (log drain): logs flow to Better Stack / Papertrail / Datadog. Add drain URL under Project → Settings → Log Drains.

## 9 · Known gaps

- `next.config.mjs:13-14` currently ignores TypeScript + ESLint errors during build. Fix pending (refactor plan C3).
- Post-deploy smoke-test automation not wired (refactor plan D3).
- Log drain not wired (refactor plan F3).

## 10 · Deployment history

Maintain here after every prod deploy:
| Date | Commit | Deployer | Notes |
|---|---|---|---|
| — | — | — | (fill on first prod deploy) |
