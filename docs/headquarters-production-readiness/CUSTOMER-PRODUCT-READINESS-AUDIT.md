# NEX · Customer Product Readiness Audit

**Programme:** Headquarters Production Readiness
**Authorisation:** Philip · read-only audit · no code · no probes · no fixes
**Date:** 2026-08-10
**Locked verdict:**

> **The reliability infrastructure is done. The customer commercial layer is not.**
> A cold visitor can browse merchant profiles, read yard posts, run the staircase-chat testing surface, and view public search results today.
> A paying customer cannot yet complete a subscription lifecycle end-to-end: Stripe checkout wiring, subscription webhook handling, tier enforcement, and billing management are not wired.
> Security · GDPR · rate-limiting · session-management surfaces are absent for a customer-safe launch.

This audit is deliberately more skeptical than the prior `NEXT-BUILD-READINESS-PLAN.md`. The prior plan surveyed what exists; this audit asks whether a real customer can complete an end-to-end journey. Both are honest views. Where they diverge, the reasons are noted.

Classification legend:
- 🟢 **BUILT** · a customer can use this today
- 🟡 **PARTLY BUILT** · exists but incomplete · needs polish OR blocked in production
- 🔴 **MISSING** · not there yet
- ⚫ **BLOCKED BY INFRASTRUCTURE** · code exists · waiting on production provisioning
- ⚪ **OPTIONAL / POST-LAUNCH**

---

## 0 · Correction to the survey · CFGA2 is not a pricing issue

The Explore agent misidentified CFGA2 as "pricing constant drift." That is wrong. CFGA2 is `src/lib/nex/config/tests/adoption-drift.test.mjs::CFGA2` — a Wave 11 F28 drift-catcher that ensures HQ files reading `process.env.NEX_POSTGRES_URL` directly are on a documented allowlist. The current failure flags one test file (`src/lib/nex/brain/adapters/postgres.wc-companion.test.ts`) that was overlooked when the allowlist was created. It has **zero customer impact** (test-only file · does not ship to production). Fix is a one-line allowlist entry.

The audit below reflects this correction. Pricing constant drift (`xratedTrades.ts` vs `pricing/page.tsx` vs `tierCatalog.ts`) IS a separate concern the Explore agent surfaced — but that is not CFGA2. It is recorded below under §8 with a new tag.

---

## 1 · Customer-facing pages + navigation

| Item | Status | Evidence |
|---|---|---|
| Landing page `/` · face-detect audience gate + smart visitor hook | 🟢 BUILT | `src/app/page.tsx` · `AudienceGateBright` + `SmartVisitorHook` |
| Subdomain routing (`*.thenetworkers.app` → `/trade/<slug>`) | 🟢 BUILT | `src/middleware.ts:269-287` · DNS wildcard supported · custom domain resolution via Supabase index |
| `/find` + `/find/[city]` · homeowner discovery · 100 UK cities SEO | 🟢 BUILT | evidence in prior build-readiness survey |
| `/trade/[slug]` · public merchant profile | 🟢 BUILT | subdomain-routed · reachable |
| `/trade-off/yard` + canteens · community feed | 🟢 BUILT | routing consolidated recently · `/community` redirects to `/trade-off/yard/canteens` |
| Explicit "what is NEX" value-prop page for cold visitors | 🔴 MISSING | landing routes to cohorts but no "start here / what is NEX" pitch page |
| Unified navigation across `/trade-off/*` · `/find` · `/home` · `/nex` · `/staircase-chat` | 🟡 PARTLY BUILT | Multiple competing surfaces · recent `/nex-app/centre` consolidation · dead-link risk if visitor lands on retired route |
| Homeowner subdomain support | ⚪ OPTIONAL | Not required for MVP |

**Assessment:** a cold visitor can find something · but the "what is this product" answer is scattered across cohort landings, not stated once cleanly.

---

## 2 · Authentication + user accounts

| Item | Status | Evidence |
|---|---|---|
| Magic-link sign-in (Resend email) for homeowners + store | 🟢 BUILT | `/magic-link` route · session cookie · `docs/APP_FOUNDATION.md:30` |
| Merchant auth via edit-token (UUID · constant-time compare) | 🟢 BUILT | `hammerex_edit_token` cookie · admin issues token · WhatsApp fallback |
| Merchant sign-up wizard | 🟢 BUILT | `/trade-off/signup/wizard` · multi-step · writes to `hammerex_trade_off_listings` |
| Password recovery for affiliate accounts | 🟢 BUILT | `/affiliates/set-password` + recovery flow |
| Admin session (`admin_session` HMAC) | 🟢 BUILT | Gates `/admin/(authed)/*` |
| Sign-up flow variant conflicts (`/join` vs `/trade-off/signup` vs `/trade-off/signup/wizard`) | 🟡 PARTLY BUILT | Three entry points · risk of drift · confirm the canonical route pre-launch |
| Session duration / refresh / expiry documented | 🔴 MISSING | No documented session TTL · no visible refresh logic |
| Account settings / profile management surface for merchants | 🔴 MISSING | No `/account/settings` route · merchants edit their listing but no unified "manage my account" |
| GDPR-compliant customer data deletion + export | 🔴 MISSING | No `/account/delete` or `/account/export` route · no deletion endpoint · required before EU/UK launch |
| Trial-length ambiguity (14 vs 30 days across constants) | 🟡 PARTLY BUILT | `pricing/page.tsx` says 14 days · `xratedTrades.ts` says 30 days · `docs/APP_FOUNDATION.md:C3` flags the conflict · will cause billing disputes if unresolved |

---

## 3 · NEX main experience (the AI product)

| Item | Status | Evidence |
|---|---|---|
| `/nex` page renders for authenticated merchants | 🟢 BUILT | `src/app/nex/page.tsx` gated by `loadStudioSession()` |
| Daily briefing greeting on landing | 🟢 BUILT | `buildDailyBriefing()` composes pending reviews · posts awaiting approval · scheduled posts · gaps |
| 6 quick-action buttons (Van · Cards · Post · Research · Brand · New) | 🟢 BUILT | Rendered in `NexChat` component |
| Chat send handler + LLM turn wiring | 🟡 PARTLY BUILT | UI exists · client-side excerpt reviewed had no visible send handler; `/api/nex/chat` route exists · full end-to-end conversational turn not verified in this audit |
| `/staircase-chat` (Philip's admin testing surface) | 🟢 BUILT | Explicitly admin-only per code comment · not a customer surface |
| System-prompt / brain roster documentation | 🟡 PARTLY BUILT | `brain_roster.ts` imported · actual brains (staircase · merchant-assistant · kitchen · etc.) loaded · doc surface for operators not verified |
| Conversation history persistence + retrieval | 🔴 MISSING | No `/nex/history` route · no obvious conversation table · each visit renders fresh · violates one of NEX's founding principles |
| Customer-facing view of prior conversations | 🔴 MISSING | Same |
| First-run onboarding inside `/nex` (empty-state · guided starter) | 🟡 PARTLY BUILT | Starter prompts appear when no briefing signals · not a formal onboarding |

**Assessment:** the chat surface exists and renders greetings and quick actions. Whether the conversational loop actually replies with LLM-generated substance for a real customer today is not verified in this audit and should be manually walked through in a browser before launch.

---

## 4 · Projects / Studio / SiteBook / Trade Centre / Yard

| Item | Status | Evidence |
|---|---|---|
| Merchant dashboard hub `/trade-off/edit/[slug]` | 🟢 BUILT | Layout + child routes for products · services-prices · washers · insights · payments · newsletter |
| Products CRUD | 🟢 BUILT | Route exists · schema exists · CRUD implied |
| Services + prices CRUD | 🟢 BUILT | Same shape |
| Washer bag purchase | 🟡 PARTLY BUILT | UI exists · Stripe checkout wiring is the gap (see §8) |
| Insights / analytics | 🟡 PARTLY BUILT | Basic dashboard · advanced analytics deferred |
| Newsletter | 🟡 PARTLY BUILT | CSV export only · in-platform Resend send is scaffolded but not shipped |
| Team management (sub-user invites) | 🟡 PARTLY BUILT | Stub |
| Canteen (per-merchant social feed) | 🟢 BUILT | Feed · Products · Designs · Reviews · Contact · Jobs |
| Yard (community feed · posts · likes · comments) | 🟢 BUILT | Public feed live |
| Homeowner projects `/home` + `/home/sites/*` | 🟢 BUILT | 29k-LoC `HomeHub.tsx` · claim property · new project · entity grid |
| Beacon (project broadcast) `/find/beacon` | 🟡 PARTLY BUILT | Form UI exists · claim: "3 nearest paid trades · they WhatsApp you direct" · **dispatch wiring depends on H5 alert engine which is DISABLED by default flag** · would need `NEX_ALERTS_DISPATCH_ENABLED=1` in prod to actually broadcast · needs manual walk-through |

**Assessment:** the display surfaces are largely complete. The transactional flows (checkout · beacon dispatch · in-platform newsletter send) need targeted verification before customer use.

---

## 5 · Staircase product journey

| Item | Status | Evidence |
|---|---|---|
| `/staircase-chat` UI | 🟢 BUILT (admin only) | Explicitly no-auth by code comment · "Philip uses this to verify Brain content is queryable" |
| Staircase brain content · configurator inputs | 🟢 BUILT | Referenced across memory · Wave 3 briefings · staircase brain roster documented |
| Customer-facing staircase journey (quote / spec / order / save / share) | 🔴 MISSING | No customer entry point · no output artefact · no save/share/order mechanism · **the staircase product is not customer-launchable in its current form** |
| Staircase configurator UI (component-driven per staircase roadmap phase D) | 🔴 MISSING | Roadmap references it (`project_nex_staircase_phase_abcd_roadmap`) but the phase-D Configurator has not been built |

**Assessment:** despite being a flagship named NEX product across memory + brain content, the staircase journey does NOT exist as a customer flow today. It is an admin testing surface + brain content. Building this properly is a distinct 6-12 week phase-D initiative, not launch-critical.

---

## 6 · Data persistence + database usage

| Item | Status | Evidence |
|---|---|---|
| Contacts data model + adapter | 🟡 PARTLY BUILT | Backend at `nex.contacts` (Wave 6-era) · UI: none · scaffolding only |
| Projects data (`os_projects` · `os_properties`) | 🟢 BUILT | Homeowner projects durable on Supabase |
| Materials journal | 🟡 PARTLY BUILT | Property-level stub · full material history not built |
| Comms · campaigns · segments | 🟡 PARTLY BUILT | Full tables at `nex.comms_*` (029-039 migrations) · UI: none |
| Knowledge · brain memories | 🟡 PARTLY BUILT | Backend at `nex.brain_*` (041 migration) · UI: none |
| Object storage (files · images · uploads) | ⚫ BLOCKED BY INFRASTRUCTURE | `NEX_OBJECT_BACKEND` default in code is `filesystem` for dev · in `deploy/VERCEL-DEPLOYMENT.md` marked as "post-Wave 6 → postgres" but Wave 6 not fully flipped in production · **`filesystem` on Vercel serverless is ephemeral · customer uploads would be lost on every redeploy** |
| Brain backend (`NEX_BRAIN_BACKEND`) | ⚫ BLOCKED BY INFRASTRUCTURE | Local `.env.local` = `supabase` · production requires decision · Wave 5 flip planned but not executed |
| Inbox read backend (`NEX_INBOX_READ_BACKEND`) | 🟢 BUILT (as `postgres`) | Local = `postgres` · Wave 6a complete · production requires same env-var |
| Preservation invariant · 10 KJs `claimed / 0 / null` | 🟢 BUILT | Verified 18× in the session · zero drift |

**Critical durability finding:** if `NEX_OBJECT_BACKEND` is left at `filesystem` in production, every customer upload (photos · documents · exports) is lost on the next Vercel deploy. This must be flipped to `postgres` (or an equivalent durable object store) before customers upload anything real. Confirmed by `deploy/VERCEL-DEPLOYMENT.md §2` which lists `NEX_OBJECT_BACKEND=postgres` as required for production scope.

---

## 7 · Production deployment requirements

| Item | Status | Evidence |
|---|---|---|
| `deploy/VERCEL-DEPLOYMENT.md` runbook exists | 🟢 BUILT | Comprehensive · 32+ env vars enumerated · post-deploy verification steps included |
| `vercel.json` cron declarations | 🟢 BUILT | 31 crons defined · `/api/nex/brain/cron-tick` at every-minute cadence |
| Post-deploy health-check smoke script | 🟡 PARTLY BUILT | `scripts/prod-smoke.mjs` exists · needs `NEX_APP_URL` · unexercised until production URL exists |
| Log-drain vendor wiring (F3 / H2 R-3) | 🔴 MISSING | Vercel dashboard logs only · 24 h expiry · no drain configured |
| First-time deployment record | 🔴 MISSING | `deploy/VERCEL-DEPLOYMENT.md §10` table is blank · nobody has done first deploy yet |
| Rollback drill | ⚪ OPTIONAL | Documented · never rehearsed · pre-launch rehearsal recommended |
| CI checks (typecheck · lint · smoke) | 🟡 PARTLY BUILT | Runbook notes TS + ESLint errors ignored during build · needs remediation before public launch |

---

## 8 · Commercial / payment requirements

**This is the biggest gap between what documentation implies and what is actually wired.**

| Item | Status | Evidence |
|---|---|---|
| Tier catalogue exists (5 tiers · pricing · feature matrix) | 🟢 BUILT | `src/lib/tierCatalog.ts` canonical · sole source of truth per `CLAUDE.md` |
| Stripe env-var slots reserved | 🟢 BUILT | `.env.local` has `STRIPE_SECRET_KEY` + `STRIPE_PUBLISHABLE_KEY` + 12 price-ID slots + webhook secret |
| Stripe integration wired end-to-end (checkout → webhook → subscription lifecycle → tier flip → paid_expires_at automation) | 🔴 MISSING | Per `docs/APP_FOUNDATION.md:C1` and Explore-agent grep: paid tier currently uses **WhatsApp fallback** · operator manually flips `tier='app_paid'` in Postgres · no webhook handler for `checkout.session.completed` · `subscription.updated` · `subscription.deleted` · **NO real customer can pay £14.99/month and receive their tier features automatically today** |
| Stripe products created in live Stripe dashboard (12 required: 2 tier products with monthly+annual prices + 10 add-ons) | 🔴 MISSING · operator work | Documented but not done |
| Tier feature enforcement (free-tier product cap · washer credit throttling · AI Visualiser monthly limits · beacon slot count · custom-domain gating) | 🟡 PARTLY BUILT | Tier definitions exist · UI enforcement per surface varies · a determined free-tier user may bypass limits via direct API calls without visible throttling |
| Billing history / invoices / receipts UI | 🔴 MISSING | No `/account/billing` route |
| Stripe Customer Portal integration (cancel · update card · view invoices) | 🔴 MISSING | Standard Stripe feature · not wired |
| Refund / cancel flow | 🔴 MISSING | Admin-only refund panel at `/admin/payments` per prior survey · no customer-facing cancel |
| Trial-length ambiguity | 🟡 PARTLY BUILT | 14 vs 30 days constant drift · WILL cause refund requests and churn on day 15 if unresolved |
| Washer-credit monthly replenishment cron | 🟢 BUILT | `/api/cron/monthly-washer-replenish` at `0 3 1 * *` |
| Free-slug expiry cron (30-day inactivity) | 🟢 BUILT | `/api/cron/free-slug-expiry` |
| Auto-expiry when subscription lapses (`paid_expires_at` update on webhook) | 🔴 MISSING | Depends on webhook handler existing |

**Bottom line:** the commercial layer has infrastructure (tier definitions · webhook secret slot · price-ID slots · Stripe SDK importable) but not integration. A merchant cannot subscribe · pay · get tier features automatically today. £0 in real customer revenue can flow through the current code path.

---

## 9 · Security + customer-data protection

| Item | Status | Evidence |
|---|---|---|
| CID correlation-ID logging (Wave 3 H2) | 🟢 BUILT | `src/middleware.ts:29-57` · every request carries `x-request-id` · verified locally |
| Structured logger adoption in 9/9 workers (Wave 3 H2.b) | 🟢 BUILT | Verified in HQ baseline |
| Timeout budgets (Wave 3 H3) | 🟢 BUILT | Statement · pool acquire · idle-in-transaction all set · live-verified with SQLSTATE 57014 |
| Migration 049 gate (Wave 3 H4) | 🟢 BUILT | Fail-closed with typed error |
| RLS coverage on `nex.*` schema | 🟢 BUILT | 39 files enable RLS · 41 CREATE POLICY · broadly healthy |
| RLS coverage on Supabase legacy `hammerex_*` + `os_*` (H6 gap) | 🔴 MISSING | **191 tables have RLS enabled with zero policies** · 9 P0 (financial · payment · billing) · 5 P1 (consent · GDPR) · 32 P2 (customer workflow) · 145 P3 (metadata) · **the moment any non-`service_role` connection is added, every table returns zero rows to that role · today's safety is only that `service_role` uses BYPASSRLS** |
| Rate limiting on public endpoints | 🔴 MISSING | No visible throttling · no per-IP quota · public `/api/*` open to DDoS |
| Secret rotation SOP for production | 🔴 MISSING | Docs mention what to set but not what to rotate from what · `.env.local` contains a live `sk_live_...` Stripe key which must NEVER be reused in Vercel without rotation |
| HTTPS · TLS · security headers (CSP · HSTS · X-Frame-Options) | 🟡 PARTLY BUILT | Vercel provides HTTPS · security headers not audited in this pass |
| GDPR compliant deletion + export | 🔴 MISSING | No customer-facing surface · legal blocker for EU/UK launch |
| Admin password strength (currently `ADMIN_PASSWORD=12345` in `.env.local` per Explore) | 🔴 MISSING · operator hygiene | Must never reach production; must be rotated to a proper high-entropy value in Vercel env |
| CFGA2 (F28 direct-env-read allowlist test) | 🟡 PARTLY BUILT | Test-only file `postgres.wc-companion.test.ts` line 37 · one-line allowlist entry needed · **zero customer impact** · **not a security issue** (contrary to Explore-agent misidentification) |
| 021/048 alert-rule collision | 🟡 PARTLY BUILT (inert) | Live schema is 021's · Subsystem B (048's intended target) is dead-on-arrival · **INERT while supervisor DISABLED + alert-dispatch OFF** · zero customer impact today · MUST be resolved before supervisor enable |

**Bottom line on security:** the reliability infrastructure is strong. The customer-data-protection surface has serious gaps that block a real public launch: no RLS on 191 legacy tables · no rate limiting · no GDPR deletion · weak admin secrets in `.env.local`. A closed-cohort private beta is acceptable with these gaps documented as known-open. A public launch is not.

---

## 10 · Known OPEN issues · customer impact assessment

### CFGA2

- **What it is:** F28 drift-catcher · one test file reads `process.env.NEX_POSTGRES_URL` directly and isn't on `CFGA2_KNOWN_EXCEPTIONS`
- **Customer impact:** 🟢 **ZERO** · test-only file · does not ship to production · fix is one line
- **Launch blocker?** No

### 021/048 alert-rule collision

- **What it is:** Two migrations (`021_alerts.sql` · `048_alert_rules.sql`) both `CREATE TABLE IF NOT EXISTS nex.alert_rules` with hard-incompatible schemas. 021 wins alphabetically; 048's create is a silent no-op. Subsystem B (observability/alert-evaluator) cannot function against live schema.
- **Customer impact today:** 🟢 **ZERO** as long as `NEX_KJOB_SUPERVISOR_ENABLED` stays unset AND `NEX_ALERTS_DISPATCH_ENABLED` stays unset · both are OFF by default · verified in HQ baseline
- **Launch blocker?** No · but add operational rule: "Do NOT enable supervisor or alert-dispatch in production until 021/048 is resolved" (documented in `WAVE-3-STEP-3-021-048-COLLISION-REPORT.md §8`)

### Wave 6 partial state (`NEX_OBJECT_BACKEND`)

- **What it is:** default routes to filesystem in dev · production must flip to postgres
- **Customer impact:** 🔴 **HIGH** if left as filesystem in prod · every uploaded photo/doc lost on next redeploy
- **Launch blocker?** Yes · operational · flip env var before letting customers upload

### Trial-length constant drift (14 vs 30 days)

- **What it is:** `pricing/page.tsx` says 14 · `xratedTrades.ts` says 30 · `docs/APP_FOUNDATION.md:C3` records the conflict
- **Customer impact:** 🔴 **HIGH** · customers signing up believing 30-day trial will be charged on day 15 · refund requests + churn certain
- **Launch blocker?** Yes · trivial fix (pick one canonical value) but MUST be done before any real customer signs up

### H6 · 191-table Supabase legacy RLS gap

- **What it is:** 191 tables have RLS enabled but zero policies · relies entirely on `service_role` BYPASSRLS
- **Customer impact if any non-service-role connection is added:** every table returns zero rows to non-service-role callers · silent data loss
- **Customer impact today with service_role only:** zero
- **Launch blocker?** No for closed beta with service_role-only architecture · Yes for public launch where anon/authenticated roles matter

---

## 11 · Final launch checklist · honest ordering

### Phase 0 · infrastructure provisioning (operator · 1-3 days · single decisions)

- Vercel production project · domain · TLS
- Production Postgres (managed instance)
- Production Supabase (or use existing NEX Supabase reference)
- Production Stripe LIVE account
- Rotate all `.env.local` secrets · none may reach Vercel unchanged

### Phase 1 · commercial layer (engineering · 5-7 days · required for paid customers)

- Wire Stripe checkout · webhook · subscription lifecycle · tier flip · `paid_expires_at` automation
- Create 12 Stripe products (2 tiers × monthly/annual + 10 add-ons)
- Wire Stripe Customer Portal (cancel · update card · view invoices)
- Add `/account/billing` route (invoices · subscription state)
- Resolve trial-length constant drift (14 vs 30 · pick one)
- Add tier enforcement middleware for any API path that gates on tier
- Add `/account/settings` route (name · email · notification prefs)
- Add `/account/delete` route (GDPR)

### Phase 2 · data durability (engineering · 1-2 days · required for customer uploads)

- Flip `NEX_OBJECT_BACKEND=postgres` in production
- Apply migration `044_nex_object_blobs.sql` to production Postgres
- Backfill any dev-side filesystem assets that must persist (if any)
- Verify a real upload persists across a redeploy

### Phase 3 · security minimum (engineering · 3-5 days · required for closed beta)

- CFGA2 allowlist entry (2 minutes)
- Rate limiting on public `/api/*` endpoints (e.g. 30 req/min unauthenticated)
- Session TTL policy + refresh + expiry logic + documented
- Rotate `ADMIN_PASSWORD` to high-entropy value in Vercel env only
- Security headers audit (CSP · HSTS · X-Frame-Options)
- Verify no public API leaks internal state (spot check)

### Phase 4 · production verification pass (engineering · 1-2 days · uses existing code)

- Set `NEX_PROD_READONLY_URL` in a scoped shell
- Run `scripts/prove-production-schema-readonly.ts`
- Convert every STEP 4 UNKNOWN row to VERIFIED · document dated evidence
- Run `scripts/prod-smoke.mjs` against the production URL

### Phase 5 · closed beta cohort (operator + engineering · 2 weeks)

- 10-50 merchants + 50-100 homeowners · invitation only
- **Supervisor stays DISABLED** · alert-dispatch stays OFF · 021/048 resolution deferred safely
- Monitor via H5's Subsystem A alert engine (in-DB alerts visible to admin · outbound notifications suppressed)
- Fix real customer-reported issues only · resist scope expansion

### Phase 6 · public launch (operator + engineering · 1 week)

- Marketing wave · domain rollout · public signup opened
- **Before opening:** H6 RLS remediation on the P0 tables (payment · billing · consent) MUST be done · anon-connection safety required
- **Before opening:** GDPR deletion + export routes live

### Deferrable indefinitely (post-launch tuning)

- H2 Class C CID route broadening
- H3 P99 measurement + T-6/T-7 tuning
- H3 10 subsystem pool T-3 coverage
- H3 T-5b mutation-timeout adoption (per-adapter idempotency work)
- H5 Subsystem B dispatcher (blocked on 021/048)
- H6 P2/P3 RLS remediation (145 low-risk metadata tables)
- Newsletter in-platform send · Team management · CRM · Advanced analytics
- NEX intelligence UI (contacts · campaigns · segments · knowledge inbox)
- Staircase customer journey (phase-D configurator · 6-12 weeks)
- Supabase → NEX Storage cutover programme (separate major initiative)

---

## WHAT WE HAVE

- Full merchant profile + dashboard + canteen + yard (🟢 built)
- Full homeowner discovery + beacon form + home hub + projects (🟢 built · beacon dispatch depends on H5 flag being on)
- NEX chat surface for merchants + staircase-chat admin surface (🟢 UI · 🟡 conversational-loop end-to-end verification recommended)
- Magic-link auth · merchant edit-token · admin session · affiliate password (🟢 built)
- Tier catalogue + Stripe env-var slots (🟢 definitions · 🔴 not wired end-to-end)
- 30+ crons defined in vercel.json · Vercel deployment runbook comprehensive (🟢 built · 🔴 first deploy not done)
- Complete Wave 1 · Phase 6 · H1-H6 · Wave 4 reliability engineering · 240/241 local tests passing · 10/10 preserved KJs intact (🟢 built · locally verified)
- Face-detect audience gate · subdomain routing · SEO-optimised 100-city landings (🟢 built)

## WHAT IS MISSING

- Stripe checkout webhook → subscription lifecycle → tier flip automation
- Stripe Customer Portal (cancel · update card · invoices)
- `/account/billing`, `/account/settings`, `/account/delete` routes
- Session TTL policy + refresh + expiry documentation
- Trial length constant reconciliation (14 vs 30 days)
- NEX conversation history persistence + retrieval UI
- Customer-facing staircase journey (quote · spec · order · save · share)
- Rate limiting on public `/api/*` endpoints
- GDPR deletion + export routes
- H6 P0/P1 RLS policies (14 tables covering payment · billing · consent)
- Security headers audit
- Log-drain vendor wiring
- `NEX_OBJECT_BACKEND=postgres` flip in production
- 12 Stripe products created in live Stripe dashboard
- Production infrastructure (Vercel · Postgres · domain · TLS · rotated secrets · live LLM keys)

## WHAT BLOCKS A CUSTOMER LAUNCH

**Absolute blockers · a paying customer cannot exist without these:**

1. **Stripe end-to-end wiring** — no real subscription can complete today
2. **Trial-length constant reconciliation** — will cause billing disputes on day 15
3. **`NEX_OBJECT_BACKEND=postgres` in production** — customer uploads lost on redeploy otherwise
4. **Production infrastructure provisioning** — Vercel · Postgres · domain · Stripe live account · rotated secrets · LLM keys
5. **Production migrations applied** — every `deploy/postgres/init/*.sql` file
6. **`/account/settings` + `/account/delete`** — GDPR requirement for EU/UK customers

**Public-launch blockers (fine for closed beta with disclosure):**

7. **H6 P0/P1 RLS policies** — payment · billing · consent tables must have policies before any anon/authenticated role is introduced
8. **Rate limiting on public `/api/*`** — DDoS + abuse prevention
9. **Log-drain vendor** — cannot debug production incidents without it
10. **Security headers audit** — standard hygiene

## WHAT DOES NOT BLOCK LAUNCH

- CFGA2 · test-only · one-line fix · zero customer impact
- 021/048 collision · INERT while supervisor DISABLED + alert-dispatch OFF · zero customer impact today
- H2 Class C CID broadening · post-launch observability tuning
- H3 P99 measurement · H3 subsystem pool coverage · H3 T-5b · post-launch tuning
- H5 Subsystem B dispatcher · blocked on 021/048 · not needed at launch
- H6 P2/P3 RLS remediation (145 metadata tables) · post-launch
- Newsletter in-platform send · team management · CRM · advanced analytics · post-MVP
- NEX intelligence UI (contacts · campaigns · segments · knowledge inbox) · post-MVP
- Staircase customer journey · phase-D initiative · post-MVP
- Supabase → NEX Storage cutover · long-term architectural work

## WHAT SHOULD BE BUILT FIRST

**In this exact order:**

1. **Stripe end-to-end wiring** (Phase 1 of §11) — the single biggest gap between "code exists" and "customer can pay"
2. **Trial-length constant reconciliation** — same file · same session as Stripe work · 15 minutes
3. **`/account/settings` + `/account/delete`** (Phase 1 of §11) — GDPR requirement · unblocks EU/UK customers
4. **Data durability flip** (`NEX_OBJECT_BACKEND=postgres` · Phase 2 of §11) — cannot accept customer uploads without this
5. **H6 P0/P1 RLS policies** (Phase 3 of §11 · required for public launch) — 14 tables · protects payment + consent data
6. **Rate limiting on public `/api/*`** (Phase 3 of §11) — abuse prevention
7. **CFGA2 allowlist entry** — cosmetic · 2 minutes · gets local sweep to 241/241 green
8. **First production deploy + verification pass** (Phase 4 of §11)

Steps 1-4 are the **minimum viable commercial + durability path**. Step 5-6 are **required for public launch** but a closed beta with disclosure can accept the gap. Step 7 is cosmetic. Step 8 is where the previously-blocked STEP 4C production verification finally runs.

## MINIMUM VERSION WE CAN LAUNCH

**Closed-beta MVP · 10-50 merchants + 50-100 homeowners · invitation only · 3-4 weeks of engineering + 1-3 days of operator infrastructure provisioning:**

- Landing page + face-detect audience gate ✅
- Merchant signup wizard → dashboard → canteen → yard ✅
- Homeowner find → beacon → home hub (beacon dispatch requires H5 flag decision at launch time)
- NEX chat for merchants ✅ (verify end-to-end response substance in browser first)
- Stripe subscription (Phase 1 built) · trial-length fixed
- `/account/settings` + `/account/delete` (GDPR) · account TTL documented
- `NEX_OBJECT_BACKEND=postgres` in production · uploads durable
- Rate limiting on public `/api/*` (basic)
- CFGA2 allowlist entry
- Supervisor DISABLED · alert-dispatch OFF · 021/048 deferred safely
- Production infrastructure provisioned + STEP 4C production verification passed

**Explicit disclosures to closed-beta cohort:**

- "H6 RLS remediation in progress · your data is protected by service_role BYPASSRLS · you will not be exposed to other cohort members"
- "Log-drain not yet configured · incident response may be delayed while we monitor via Vercel dashboard directly"
- "The staircase configurator is not yet a customer product · the current staircase-chat is an admin testing surface"
- "NEX intelligence UI beyond chat is coming in the next release · contacts · campaigns · knowledge tools are backend-only today"

**Public launch adds:**

- H6 P0/P1 RLS policies
- Security headers audit
- Log-drain vendor wiring
- Newsletter in-platform send (if marketing depends on it)
- Public marketing "what is NEX" page

---

**End of audit.** Awaiting your review and next explicit authorisation.
