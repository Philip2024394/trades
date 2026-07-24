# ES-06 · Nex DevOps & Production Infrastructure v1.0

**Infrastructure blueprint · 2026-07-23**
**Purpose:** the operational playbook for running Nex in production. Every deploy, every alert, every disaster-recovery drill, every scaling milestone specified.

**Related:** ES-01 Engineering Bible (wins on infrastructure decisions) · ES-02 Data Architecture · ES-03 API Architecture · Master Architecture v1.0.

**Critical framing from ES-01:** Nex runs on **Vercel + Supabase serverless infrastructure**. Kubernetes is explicitly rejected until scale forces it. Containers are only relevant for niche workloads. Multi-region defers to Year 4+. This document specifies the actual honest answer: serverless-first, cost-conscious, boring by design.

---

## Section 1 — Cloud Architecture

### 1.1 The stack decision

**Frontend + API:** Vercel (Next.js 16 native)
**Database + Storage + Auth + Realtime:** Supabase (managed Postgres 16 + object storage)
**AI providers:** Anthropic API + OpenAI API + Google Document AI
**Payments:** Stripe
**Redis:** Upstash (serverless, edge-close)
**Error + performance monitoring:** Sentry + Vercel Analytics
**Uptime monitoring:** BetterUptime (or Pingdom)
**Log aggregation:** Vercel Logs + Sentry breadcrumbs (upgrade to Datadog at 500k+ merchants)

### 1.2 Why not Kubernetes

At Nex's target scale (100k merchants Y1-2, 1M by Y5), Kubernetes adds massive operational overhead without proportional benefit. Vercel + Supabase abstract the container layer. Engineering time saved by NOT running k8s can be spent shipping product.

**When Kubernetes would become relevant:**
- Custom workloads that don't fit Vercel functions (long-running batch, GPU workloads)
- Vendor risk requires escape hatch
- Enterprise customers require dedicated deployments

None of these apply Y1-3.

### 1.3 Why not AWS/GCP/Azure directly

- Higher engineering cost per unit of capability delivered
- Requires SRE hire earlier
- Vendor lock-in via 100+ services
- Vercel + Supabase provide equivalent primitives with lower operational cost at this scale

**When to reconsider:** enterprise customer demands physical isolation, or Nex crosses 5M merchants and cost model shifts.

### 1.4 Regional strategy

- **Y1-3:** single Vercel region (Europe · fra1 or lhr1) · single Supabase project (EU-West)
- **Y4:** add second Vercel region for latency (US or AU as expansion targets emerge)
- **Y4+:** consider regional Supabase projects for data residency compliance

---

## Section 2 — Environment Strategy

### 2.1 Four environments

| Environment | Vercel deployment | Supabase project | Purpose                                                |
| ----------- | ----------------- | ---------------- | ------------------------------------------------------ |
| Development | Local             | Local Supabase   | Individual engineer work                                |
| Testing     | Preview per PR    | Ephemeral        | CI test runs · PR review · integration testing         |
| Staging     | staging.thenetworkers.app | staging Supabase | Pre-production dogfooding · full data seed           |
| Production  | thenetworkers.app | production Supabase | Live merchants                                       |

### 2.2 Data isolation

- **Prod → staging:** anonymised sync monthly (PII stripped)
- **Staging → dev:** engineers pull anonymised subsets on demand
- **Never:** any dev/staging environment writes to prod

### 2.3 Environment variables

- Managed via Vercel Environment Variables + Supabase Vault
- Never committed to code
- Rotation policy: 90 days for API keys · 24 hours for temp tokens · annually for encryption keys
- Access audited

### 2.4 Feature parity

- Every environment runs the same code
- Feature flags gate risky features per environment
- Config differences: only endpoint URLs + secrets

---

## Section 3 — Hosting Strategy

### 3.1 Frontend + API

Vercel with:

- Edge-first routing where cache-friendly
- Serverless functions for API routes (default runtime: Node.js 22)
- Vercel Edge Functions for latency-critical reads (feature-flag reads, session validation)

### 3.2 Static assets

- Next.js build artifacts served via Vercel Edge Cache
- Media (photos, videos, PDFs) served via Supabase Storage + Vercel CDN cache
- Merchant tradesites: ISR (Incremental Static Regeneration) with 60-minute revalidation

### 3.3 Custom domains

- Merchant custom domains handled via Vercel Domains API
- SSL auto-provisioning via Let's Encrypt
- Domain verification via CNAME or A record

### 3.4 Regional edge

- Vercel Edge Network handles routing to nearest region
- Serverless functions run in configured regions (fra1 primary Y1-3)
- Realtime channels served by Supabase (globally distributed)

---

## Section 4 — CI/CD Pipeline

### 4.1 Overview

```
git push
  ↓
GitHub Actions (or Vercel-native)
  ↓
Lint + typecheck + Vitest + build
  ↓
Preview deployment (per PR)
  ↓
Human review
  ↓
Merge to main
  ↓
Production deployment (staged rollout)
  ↓
Post-deploy verification
  ↓
Live for all merchants
```

### 4.2 Pipeline stages

**On every PR:**

1. Install dependencies (cached)
2. ESLint (fail on error)
3. TypeScript compile check
4. Vitest test suite
5. Build check (Next.js production build)
6. Deploy preview to Vercel
7. Run integration tests against preview
8. Post PR comment with preview URL + test results

**On merge to main:**

1. Same as PR
2. Deploy to staging first
3. Automated smoke tests against staging
4. Promote to production (staged rollout, §7)

### 4.3 Test parallelisation

- Vitest workers run in parallel per file group
- Integration tests split across CI runners
- Target CI runtime: <5 minutes for typical PR

### 4.4 Cache strategy

- Node modules cached per lockfile hash
- Next.js build cache preserved between runs
- Test database templates cached

---

## Section 5 — Git Branch Strategy

### 5.1 Simplicity wins

- `main` — production-ready · protected
- `<engineer>/<feature-desc>` — feature branches
- Long-lived release branches rejected · adds coordination overhead without benefit

### 5.2 Branch protection

- Direct pushes to `main` forbidden
- Every merge requires: 1 review · passing CI · linear history (rebase before merge)
- No force pushes to `main`

### 5.3 Commit convention

- Conventional Commits format: `feat:`, `fix:`, `refactor:`, `chore:`, `docs:`, `test:`
- Referenced ticket in body (`Fixes NEX-123`)
- Signed commits encouraged, not required

### 5.4 PR conventions

- Description must include: what changed · why · testing done · rollback plan
- Screenshots for UI changes
- Migration file for schema changes
- Reviewer required to have not authored the code

### 5.5 Merge strategy

- Rebase + fast-forward preferred (linear history)
- Squash acceptable for small feature branches
- Merge commits forbidden (breaks bisect)

---

## Section 6 — Feature Flags

### 6.1 Rules

- Every risky feature ships behind a flag
- Default off in production for new features
- Documented sunset date within 90 days of GA
- Flag removal is a chore ticket

### 6.2 Storage

- `hammerex_nex_platform_feature_flags` table
- Fields: `flag_key`, `merchant_slug` (nullable for global), `enabled`, `metadata`, `expires_at`
- Read path: cached in Redis with 60-second TTL
- Toggle propagation: <60 seconds globally

### 6.3 Client-side vs server-side

- Server-side: all business logic gates go here
- Client-side: UI gates only (never security-critical)
- Never trust client claims about flag state

### 6.4 Kill switch flags

Certain flags are emergency-only:

- `emergency_workforce_halt` — halts all agents platform-wide
- `emergency_ai_disable` — falls back all AI to canned responses
- `emergency_write_disable` — read-only mode

Kill switch flags require executive approval to flip.

---

## Section 7 — Deployment Strategy

### 7.1 Vercel-native blue/green

Vercel's default deployment model IS blue/green:

- New deployment goes live at a preview URL
- Alias promotes to production
- Old deployment stays warm for instant rollback (via alias revert)

No additional blue/green tooling needed.

### 7.2 Staged rollout

For high-risk changes, staged rollout via feature flags:

1. Ship code with flag off
2. Enable for 1% of merchants (canary)
3. Monitor for 24 hours
4. Enable for 10%
5. Monitor for 24 hours
6. Enable for 50%
7. Monitor for 24 hours
8. Enable for 100%

Automated rollback triggers on:

- Error rate > 1% higher than baseline
- p95 latency > 2× baseline
- Manual pause via Ops on-call

### 7.3 Database migrations

Every migration must be:

- **Additive** (add new column, don't drop old until app is fully migrated)
- **Backward compatible** (old app version can still run against new schema)
- **Reversible** (rollback SQL provided alongside)

Pattern for renaming a column:

1. Add new column with backfill trigger
2. Deploy app that reads both, writes new
3. Backfill old data
4. Deploy app that reads only new
5. Drop old column

Every migration reviewed by 2 engineers.

### 7.4 Rollback

- Code: alias revert in Vercel (instant)
- Schema: reverse migration (if additive, no rollback needed)
- Feature flag: toggle off
- Data: from Supabase PITR if data-corrupting bug

Every deploy must have documented rollback plan.

---

## Section 8 — Infrastructure as Code

### 8.1 What's in code

- Vercel project config: `vercel.json`
- Environment variables: managed via Vercel CLI + committed keys (not values)
- Supabase migrations: `supabase/migrations/*.sql`
- RLS policies: SQL alongside table migrations
- pg_cron schedules: SQL migrations
- Vercel Cron: `vercel.json` cron block
- Third-party integrations config: Terraform where APIs exist

### 8.2 What's not in code

- Merchant data
- Content
- Secrets (managed by Vercel/Supabase Vault)

### 8.3 Environment replication

An engineer can replicate staging from scratch:

1. Clone repo
2. `supabase db reset` runs all migrations
3. `pnpm seed:test` seeds test data
4. `vercel dev` runs local Vercel-equivalent
5. Ready in <5 minutes

---

## Section 9 — Containers

### 9.1 Not the primary runtime

Vercel abstracts the container layer. Engineering never sees a Dockerfile in the primary path.

### 9.2 Where containers appear

- **AI worker specialised runtimes** (V3+): if we need long-running inference workloads, Docker container on Vercel or dedicated compute
- **Analytics batch processing** (V3+): dedicated container for hourly rollups if pg_cron becomes insufficient
- **Regional deployments** (V4+): container images for regional Supabase-alternative if needed

Docker Compose available for local dev (Supabase local uses it).

---

## Section 10 — Kubernetes

Explicitly rejected until Year 4-5. Reasons in ES-01 and Section 1.2.

**Triggers for reconsidering:**

- Vercel serverless function cold-start hits SLA
- Long-running workflows exceed 15-minute Vercel function timeout
- Custom GPU inference workloads
- Enterprise customer contractual requirement

If any trigger fires, evaluate GKE / EKS / AKS with SRE hired first.

---

## Section 11 — CDN

### 11.1 Vercel Edge Network (default)

- Static assets cached at edge
- API responses NOT cached at CDN (dynamic per merchant)
- Merchant tradesites cached with tenant-specific cache keys

### 11.2 Cache invalidation

- On deploy: automatic
- On content change: manual purge via Vercel API
- ISR with revalidation prevents most manual purges

---

## Section 12 — Object Storage

Per ES-02 Section 8. Supabase Storage buckets with tiered retention:

- **Hot:** 90 days · Supabase Storage default tier
- **Warm:** 12 months · Supabase Storage default tier (lower access frequency)
- **Cold:** thereafter · Supabase Storage cold tier OR S3-compatible external (Cloudflare R2)

Signed URLs for access control. Content-addressed paths where possible.

### 12.1 Bucket lifecycle rules

Automated via Supabase Storage lifecycle policies:

- After 90 days: move to warm tier
- After 12 months: move to cold tier
- After 7 years: archive per legal retention rules (varies by content type)

### 12.2 Cost management

- Photos: transcoded to WebP, quality 85 (reduces size 60% typical)
- Videos: H.264, 720p max for web variants (originals preserved)
- Deduplication via checksums (same file uploaded twice = one storage row)

---

## Section 13 — Database Scaling

### 13.1 Y1-3: single Supabase Postgres

Sufficient for 100k merchants. Compute size scales vertically via Supabase dashboard.

### 13.2 Y3+: read replicas

At 500k merchants, add read replicas for:

- Analytics queries
- Regional dashboard reads
- Historical Twin timeline queries

Application code uses primary for writes, replica for reads (Supabase built-in support).

### 13.3 Y4-5: partitioning + specialised stores

- Twin event log: consider ClickHouse for analytics-heavy queries
- Memory rollups: consider TimescaleDB extension for time-series analytics
- Photos + videos metadata: move to purpose-built cache if hot data grows

Every migration path rehearsed 3 months before triggering scale threshold.

### 13.4 Connection pooling

- Supabase built-in pgBouncer
- Transaction mode for API routes
- Session mode for long-running workers

---

## Section 14 — Redis (Upstash)

### 14.1 Uses

- Rate limiting (sliding window per merchant per endpoint)
- Feature flag cache (60s TTL)
- Twin state snapshot cache
- LLM prompt-response cache (30-day TTL)
- Trade Brain module hot cache

### 14.2 Why Upstash

- Serverless (charges per request, not per hour)
- Edge-close (multi-region reads)
- No ops overhead
- Costs scale linearly with usage

### 14.3 Fallback

If Upstash fails, application degrades gracefully:

- Rate limiter: pass-through (log warning)
- Feature flags: default to disabled
- Caches: recompute from source

---

## Section 15 — Message Queues

### 15.1 Postgres-backed queue

Reject: Kafka, RabbitMQ, SQS (per ES-01).

Adopt: `hammerex_nex_platform_task_queue` table with:

- `SELECT ... FOR UPDATE SKIP LOCKED` for consumer acquisition
- `LISTEN/NOTIFY` for realtime wake-up
- Delivery per ES-02 Section 4

### 15.2 Worker categories

Per ES-03 Section 12:

- Media workers · AI workers · Ingest workers · Rollup workers · Notification workers · Webhook workers

### 15.3 Scaling triggers

If queue depth grows persistently:

- Add worker concurrency
- Add worker categories to isolate hot workloads
- Only after this: consider Kafka/similar

### 15.4 Monitoring

- Queue depth per category (alerts at threshold)
- Processing latency per category
- Failure rate per task type
- Dead-letter queue size (any accumulation = alert)

---

## Section 16 — Cron Jobs

### 16.1 Two mechanisms

- **pg_cron** — DB-native aggregations (memory rollups, materialized view refresh)
- **Vercel Cron** — external feed ingest, notification batches, GDPR export delivery

### 16.2 pg_cron jobs

- Nightly at 02:00 UTC: memory trade rollup + region rollup
- Nightly at 03:00 UTC: memory decay pass
- Hourly: platform events archival (older than 7 days move to cold table)
- Weekly (Sunday 04:00): market signal weekly rollup
- Daily (05:00): materialized view refresh

### 16.3 Vercel Cron jobs

- Daily (08:00 UTC): Companies House registration diff
- Daily (09:00 UTC): planning applications ingest (per LA)
- Hourly: weather forecast update
- Every 5 minutes: notification batch delivery
- Every 15 minutes: webhook delivery retry sweep

### 16.4 Monitoring

- Every scheduled job logs start + end + row count affected
- Alert on job missing (no run in expected window)
- Alert on job exceeding SLA duration

---

## Section 17 — AI Worker Scaling

### 17.1 Per-provider concurrency

- **Anthropic API:** 100 concurrent requests soft cap (tune based on rate limits)
- **OpenAI Vision:** 50 concurrent
- **OpenAI Embeddings:** 200 concurrent (cheap + high throughput)
- **Google Document AI:** 20 concurrent

### 17.2 Budget enforcement

Per-merchant per-day spend cap enforced at ai/ orchestration layer:

- Soft warn at 80% of daily cap
- Hard block at 100% (customer sees graceful "daily limit reached, resets at midnight UTC")
- Emergency override available for team members with `ai:override-budget` permission

### 17.3 Model routing

Per ES-01 §7.2:

- Claude Opus for high-stakes reasoning
- Claude Haiku for high-volume classification
- OpenAI for Vision + embeddings

Router uses simple rules; no learned routing until V3+.

### 17.4 Fallback

If Anthropic API down:

- 5s timeout on primary call
- Fallback: Claude via alternate route (Bedrock/similar) if available
- Ultimate fallback: canned degraded response with apology

Every fallback logged; alert on fallback rate > 1%.

---

## Section 18 — Background Processing

Per Section 15. Task queue drives all durable async work.

### 18.1 Timeout policy

- Vercel serverless functions: 15 minutes max (Pro plan)
- Long-running tasks split into multiple smaller tasks with checkpoint state
- If a task can't be split, escalate to alternate compute (dedicated container)

### 18.2 Dead-letter handling

- After 3 failed retries: move to dead-letter table
- Weekly review by on-call engineer
- Manual replay available via admin endpoint

---

## Section 19 — Serverless Components

Almost everything in Y1-3. Serverless-first is the architecture.

### 19.1 What's serverless

- Every API endpoint
- Every background worker
- Every scheduled job
- Media transcoding
- AI orchestration calls

### 19.2 What's not

- Supabase Postgres (managed, but not serverless)
- Redis (Upstash serverless)
- Vercel Edge Network (managed)

### 19.3 Cold start mitigation

- Critical paths use Vercel Edge Functions (near-zero cold start)
- Background workers acceptable to cold-start (latency non-critical)
- Warmup pings avoided (waste money without solving)

---

## Section 20 — Monitoring

### 20.1 Stack

- **Application errors:** Sentry
- **Performance metrics:** Vercel Analytics
- **Business KPIs:** Custom dashboards fed by analytics events
- **Uptime:** BetterUptime (external monitoring)
- **Database:** Supabase Dashboard + custom queries
- **AI cost:** custom dashboard fed from ai/ orchestration layer audit log

### 20.2 Key metrics tracked

- Uptime per service (target 99.9%)
- Chat p95 latency
- Estimator generation p95 latency
- Twin timeline reconstruction p95 latency
- API request rate + error rate per endpoint
- Queue depth per category
- LLM cost per merchant per day
- Storage growth per merchant per day
- Merchant DAU + MAU

### 20.3 Dashboard hierarchy

- **Executive dashboard:** merchant count, ARPU, uptime, top 3 alerts
- **Product dashboard:** feature adoption per tier, conversion funnels
- **Engineering dashboard:** error rate, latency, cost, queue health
- **Merchant dashboard:** their own KPIs (Section 20.4 in Playbook)

---

## Section 21 — Logging

### 21.1 Structured logs

Every log entry:

```json
{
  "level": "info",
  "message": "quote issued",
  "request_id": "<uuid>",
  "merchant_slug": "phil",
  "user_id": "<uuid>",
  "duration_ms": 234,
  "trace_id": "<uuid>"
}
```

### 21.2 Log destination

- Vercel Logs (default, 7-day retention)
- Sentry breadcrumbs (attached to error events)
- Datadog upgrade at 500k merchants for aggregation + long retention

### 21.3 What's logged

- Every request (structured)
- Every LLM call (prompt hash, model, tokens, cost)
- Every workforce action (permanent audit log)
- Every error (with context)

### 21.4 What's NEVER logged

- API keys, JWTs, passwords
- PII in raw form (customer names, addresses, phone numbers)
- Merchant secrets
- Full LLM prompts if they contain merchant-confidential data (hash logged instead)

---

## Section 22 — Alerting

### 22.1 Alert routing

- PagerDuty for on-call escalation
- Slack for team awareness
- Email for daily digest

### 22.2 Alert tiers

- **P0 (page immediately):** platform-wide outage, data loss, security breach
- **P1 (page within 30 min):** critical feature broken, major merchant impact
- **P2 (Slack + on-call ack within 4 hours):** performance degradation, non-critical failures
- **P3 (Slack review within 24 hours):** anomalies, quality signals

### 22.3 Alert examples

- P0: uptime < 99.5% over 5-minute window · database connection exhaustion · Anthropic API fully unavailable
- P1: chat p95 > 15s · payment success rate < 95% · Sev-1 error rate spike
- P2: queue depth > threshold · cost per merchant spike · storage growth spike
- P3: unusual traffic pattern · new error kind appearing

### 22.4 Runbooks

Every alert has a runbook. Runbook includes: what the alert means · likely causes · mitigation steps · rollback options · who to escalate to.

---

## Section 23 — Uptime Targets

### 23.1 SLA per surface

| Surface                | Target | Consequence of miss                              |
| ---------------------- | ------ | ------------------------------------------------ |
| Public tradesites      | 99.95% | Merchant credits · reputation risk               |
| Chat + core API        | 99.9%  | Merchant credits at 99.0% breach                 |
| Workforce actions      | 99.9%  | Merchant credits                                 |
| Digital Twin state     | 99.9%  |                                                  |
| Estimator generation   | 99.5%  | Retry acceptable                                 |
| Marketing site         | 99.5%  |                                                  |
| Admin surfaces         | 99.0%  |                                                  |

### 23.2 Error budget

Every service has an error budget = (100% - SLA). When budget is spent, feature deploys halt until reliability catches up.

### 23.3 Uptime monitoring

BetterUptime external checks every 30 seconds against:

- Marketing homepage
- Chat API endpoint (with test JWT)
- Twin API endpoint (with test project)
- Stripe webhook endpoint

---

## Section 24 — Disaster Recovery

Per ES-02 Section 11.

### 24.1 RTO 4 hours · RPO 15 minutes

### 24.2 Runbook

Documented at `/docs/dr-runbook.md`. Covers:

- Supabase primary failure
- Vercel region failure
- Anthropic API extended outage
- Massive data corruption
- Security breach

Rehearsed quarterly with tabletop exercise.

---

## Section 25 — Backups

### 25.1 Layers

- **Supabase PITR:** 24-hour default · 90-day extended for Business+ merchants
- **Daily full snapshots:** to independent Supabase Storage bucket (cross-region)
- **Weekly encrypted exports:** to Cloudflare R2 or Backblaze B2
- **Monthly archives:** to long-term cold storage
- **Yearly:** compliance-driven retention (7-year cold storage)

### 25.2 Backup validation

- Weekly automated restore test to staging environment
- Alert on any restore failure

---

## Section 26 — Multi-Region

Not needed Y1-3.

### 26.1 Y4 triggers

- International expansion demands data residency
- Latency SLAs missed in specific regions
- Regulatory requirements

### 26.2 Implementation approach

- Vercel supports multi-region natively for serverless functions
- Supabase multi-region requires separate projects with cross-project replication (complex)
- Alternative: regional Postgres instances with application-layer routing

Decision deferred to Year 4 with dedicated architectural review.

---

## Section 27 — Cost Optimisation

### 27.1 Budget targets

Per merchant per month, gross infrastructure cost:

| Tier         | Merchant fee | Infra cost target | Margin |
| ------------ | ------------ | ----------------- | ------ |
| Free         | £0           | £0.50             | -£0.50 |
| Starter      | £9.99        | £2.00             | £7.99  |
| Professional | £14.99       | £4.00             | £10.99 |
| Business     | £24.99       | £7.00             | £17.99 |
| Works        | £39.99       | £12.00            | £27.99 |

Free-tier loss subsidised by paid tiers per ADR-0004 (viral loop).

### 27.2 Cost drivers

- LLM API (variable, dominant)
- Storage (grows over time)
- Bandwidth (moderate)
- Compute (serverless — low unless heavy)
- Redis (low)

### 27.3 Optimisation levers

- LLM prompt caching (30-day TTL on identical prompts)
- Model routing (Haiku vs Opus per stakes)
- Vision AI only on merchant-uploaded photos (not URL scrapes)
- Media compression aggressively
- Cold storage tiering

### 27.4 Monitoring

- Daily cost report per merchant per component
- Alert on cost spike per merchant (>3× 30-day average)
- Weekly executive summary

---

## Section 28 — Capacity Planning

### 28.1 Quarterly review

Every quarter, review:

- Actual merchant count vs projection
- Actual LLM cost vs projection
- Actual storage vs projection
- Compute utilisation vs limits
- Database size + growth rate

Adjust budgets + scaling plans accordingly.

### 28.2 Growth signals to watch

- Merchant DAU growth > 20% quarter-over-quarter
- Chat requests per merchant growing 15%+ (workforce adoption signal)
- Storage per merchant growing 25%+ (Twin adoption signal)

---

## Section 29 — Security Hardening

Per ES-01 Section 8.

### 29.1 Layers

- Network: Vercel + Supabase managed edge security
- Application: RLS + application-layer scope checks + Zod validation
- API: rate limiting + CORS + CSRF tokens
- Auth: Supabase Auth + JWT + 2FA
- Secrets: Vercel + Supabase Vault
- Encryption: TLS 1.3 + AES-256 at rest + application-layer for PII columns
- Audit: immutable log per merchant
- Adversarial: quarterly red team exercise

### 29.2 Compliance milestones

- Y1: GDPR-compliant workflows in production
- Y2 end: SOC2 Type 1
- Y3 end: SOC2 Type 2
- Y4+: ISO 27001 if enterprise demands

---

## Section 30 — Infrastructure Roadmap

### 30.1 Y1 (2026-Q3 → 2027-Q3)

- Vercel + Supabase + Upstash baseline
- Sentry + BetterUptime + Slack alerts
- CI/CD via Vercel-native + GitHub Actions
- 5 pg_cron jobs · 5 Vercel Cron jobs
- Cost tracking dashboard live

### 30.2 Y2 (2027-Q3 → 2028-Q3)

- Add PagerDuty for on-call rotation
- Formalise runbooks (20+)
- SOC2 Type 1 audit
- Add second Vercel region (US) for expansion prep
- Database read replicas evaluation

### 30.3 Y3 (2028-Q3 → 2029-Q3)

- Read replicas live for analytics workloads
- Twin event log partitioning
- Datadog upgrade for log aggregation
- SOC2 Type 2 audit
- DR runbook mature + rehearsed

### 30.4 Y4-5

- Multi-region Supabase evaluation
- Regional deployments (IE + AU)
- Consider specialised stores (ClickHouse for Twin analytics)
- ISO 27001 if demanded

---

## Section 31 — On-Call

### 31.1 Rotation

- Y1: single engineer on-call in-hours only (no 24/7 until we have paying enterprise customers)
- Y2: rotating on-call across engineering team
- Y3+: dedicated SRE hire

### 31.2 Runbook expectations

Every service has a runbook. On-call engineer follows runbook first, escalates when runbook doesn't cover the situation.

### 31.3 Post-mortem

Every P0/P1 incident triggers blameless post-mortem within 48 hours. Findings feed runbook updates + regression prevention.

---

## Section 32 — Ready for Operations

DevOps engineers can begin infrastructure setup on Day 1 of engineering:

1. Vercel account + team setup
2. Supabase projects (dev/staging/prod)
3. Upstash Redis instance
4. Sentry account + project
5. BetterUptime monitors
6. GitHub repo + branch protection + PR templates
7. CI/CD pipeline (Vercel + GitHub Actions)

Every subsequent scaling decision has a documented trigger and plan.

---

**End of ES-06 · DevOps & Production Infrastructure v1.0.**
