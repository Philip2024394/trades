# NEX · Next Build-Readiness Plan

**Programme:** Headquarters Production Readiness
**Authorisation:** Philip · build-planning documentation pass · no code · no probes · no fixes
**Date:** 2026-08-10
**Locked verdict:**

> **NEX has more customer-facing surface than the Headquarters programme reports imply.**
> The merchant + homeowner + community + chat product is materially complete. The 12 remaining weeks are dominated by INFRASTRUCTURE PROVISIONING, not new-code-writing.
> **CFGA2 does NOT block launch. 021/048 does NOT block launch IF supervisor remains DISABLED.**

Companion documents: `NEX-LOCAL-PRODUCTION-READINESS-BASELINE.md` (evidence) · `docs/product-constitution/README.md` (launch principles) · `deploy/VERCEL-DEPLOYMENT.md` (provisioning runbook) · `WAVE-3-STEP-3-021-048-COLLISION-REPORT.md` (open architecture decision).

---

## 1 · What is actually BUILT and usable today

### Merchant surface · ✅ complete end-to-end

- `/trade-off/signup/wizard` · multi-step onboarding (trade → location → contact → hours) · fully wired to `hammerex_trade_off_listings`
- `/trade-off/edit/[slug]` · merchant dashboard hub (tier · subscription · referrals · notifications)
- `/trade-off/edit/[slug]/{products, services-prices, washers, insights, payments}` · full CRUD dashboards
- `{slug}.thenetworkers.app` · subdomain routing via middleware (rewrites to `/trade/{slug}`)
- `/trade/[slug]` · public merchant profile (portfolio · services · reviews · contact CTA)
- Tier gating enforced end-to-end via `src/lib/os/billing/entitlements.ts`
- Stripe integration live (needs production account · not code work)

### Homeowner surface · ✅ complete end-to-end

- `/home` · authenticated hub with properties · projects · documents
- `/home/sites`, `/home/sites/[siteId]`, `/home/vault` · site tracker + document vault
- `/find` + `/find/[city]` · trade directory · 100 UK cities · SEO-optimised
- `/find/beacon` · project broadcast to 3 nearest trades (2 h SLA · 4-wave escalation)
- Magic-link auth via Resend

### Community surface · ✅ complete

- `/trade-off/yard` · main community feed (posts, likes, comments)
- `/trade-off/yard/canteens` · directory
- `/trade-off/yard/canteens/[slug]` · per-merchant canteen (Feed / Products / Designs / Reviews / Contact / Jobs)

### NEX chat surface · ✅ shipped (chat only)

- `/nex` · merchant AI assistant · daily briefing · intent resolution → `/api/nex/chat`
- `/staircase-chat` · homeowner staircase planning → `/api/nex/staircase-chat`
- `NexChat.tsx` · `MerchantAssistantChat.tsx` · `StaircaseChatUI.tsx` all wired

### Auth · ✅ three clean session models

- `homeowner_session` (HMAC) — gates `/home/*`
- `hammerex_edit_token` (HMAC) — gates `/trade-off/edit/*`
- `admin_session` (HMAC) — gates `/admin/(authed)/*`
- Cleanly separated · never cross-mix

### Billing · ✅ Stripe integration + tier catalogue

- Canonical tier definitions at `src/lib/tierCatalog.ts` (Free · Starter · Professional · Business · The Works)
- Webhook handler · subscription lifecycle · washer-pack purchases live
- Needs production Stripe live-key rotation (operational, not engineering)

### Headquarters reliability layer · ✅ locally verified

Every Wave 1 · Phase 6 · H1-H6 · Wave 4 batch closed at LOCAL scope (per `NEX-LOCAL-PRODUCTION-READINESS-BASELINE.md`). Full evidence catalogued there. Not repeated here.

---

## 2 · What is INCOMPLETE but required before first real customer

### None that blocks a minimum-viable launch.

The customer-facing surfaces named in §1 constitute a launchable product for the initial cohort. Every "gap" identified below (§3) is optional post-MVP work.

**The exception:** if the initial cohort is expected to use one of the deferred flows (newsletter send from platform · team invites · CRM · advanced analytics), then that specific flow becomes launch-blocking for that cohort. If the initial cohort is scoped to merchant profile + homeowner beacon + community + chat, nothing else is required.

---

## 3 · What is OPTIONAL hardening / post-MVP · SHOULD NOT block launch

### Product-side deferrable

- **Newsletter in-platform send** — `/trade-off/edit/[slug]/newsletter` currently offers CSV export only. Full Resend send + scheduler + audience picker is scaffolding-only. Post-MVP.
- **Team management** — `/trade-off/edit/[slug]/team` sub-user invites are stubbed. Post-MVP.
- **CRM** — `src/apps/crm/` scaffolding exists · no working contact/project/follow-up UI. Post-MVP.
- **Advanced analytics** — growth playbook references auto-defaults + analytics · not in code yet. Post-MVP.
- **NEX intelligence UI (contacts · campaigns · segments · composer · knowledge inbox)** — ~40 API routes exist under `src/app/api/nex/**` with no matching UI. Chat UI ships as-is. Rest defer.

### Engineering-side deferrable

- **CFGA2 fix** · one-line allowlist addition · non-critical · trivial when authorised
- **021/048 collision resolution** · REQUIRES separate authorisation · does not block launch IF supervisor stays DISABLED (see §6 below for the argument)
- **H1.c CI wiring** · non-blocking CI hook · matches R-3 open item
- **H2 R-3 log-drain vendor pick** · production observability polish · post-launch
- **H2 Class C route CID broadening** · ~40 additional brain routes · per-route authorisation
- **H3 per-worker P99 measurement** · requires `pg_stat_statements` on prod · post-launch tuning
- **H3 10 subsystem pools T-3 coverage** · per-subsystem work · post-launch
- **H3 T-5b mutation timeouts** · needs per-adapter idempotency design · deferred by design
- **H4 production 049 application** · when async rollup mode is enabled (currently OFF · not needed at launch)
- **H5 Subsystem B dispatcher / R-4 literal** · blocked by 021/048 · not needed at launch
- **H6 · 191-table Supabase legacy RLS remediation** · defence-in-depth · safe because `service_role` uses BYPASSRLS · not needed at launch
- **R3 lock-probe port fix** · already closed
- **W4-1 · W4-2** · both closed

---

## 4 · What depends on PRODUCTION INFRASTRUCTURE (not code)

Every item in this list is a non-engineering task. None of them require writing code · every one requires an operator/organisational decision or credential.

### Must exist before first real customer

- **Vercel production project** provisioned + linked to this repo
- **Production Postgres** (managed instance · Supabase or Render · reachable from Vercel Functions)
- **Domain + TLS** (subdomain routing per `middleware.ts` requires `*.thenetworkers.app` cert)
- **Production Stripe account** with live keys (`STRIPE_SECRET_KEY`, `NEXT_PUBLIC_STRIPE_PUBLISHABLE_KEY`, `STRIPE_WEBHOOK_SECRET`)
- **Production Supabase project** (or continued use of the existing NEX Supabase at `ijvqdvsvwtwxzcqmoqit.supabase.co` · already reachable per STEP 4)
- **Production env vars** set in Vercel dashboard per `deploy/VERCEL-DEPLOYMENT.md §2` (25+ required · full list in that runbook)
- **Production migrations applied** — every `deploy/postgres/init/*.sql` file applied to the production NEX Postgres (H1.a work · currently OPEN)
- **Resend production API key** (magic-link email delivery)
- **LLM provider production keys** (Groq · Gemini · Anthropic · Mistral · OpenRouter — the LLM_PROVIDER_CHAIN)
- **Cron secrets rotated for production** (`CRON_SECRET`, `NEX_BRAIN_CRON_TOKEN`)

### Should exist before public launch (soft blockers · post-MVP)

- Log drain vendor (F3 · Better Stack / Papertrail / Axiom / Datadog · unblocks H2 R-3 and H5 dispatcher production-proving)
- `pg_stat_statements` extension on production Postgres (unblocks H3 P99 tuning)
- Restore rehearsal target (unblocks V-10b)

---

## 5 · What should be BUILT NEXT · priority order

Given §1 shows the product is ~90% complete for a minimum-viable launch and §4 shows the remaining work is infrastructure, the build queue is short and sharply prioritised:

### P0 · absolute must (before any real customer sees NEX)

1. **Provision production infrastructure** (§4 must-list). This is the entire critical path. Estimated 2-4 weeks depending on operator availability. **Not an engineering task.**
2. **First production deploy** to Vercel with all env vars set. Follow `deploy/VERCEL-DEPLOYMENT.md`. Verify health via `/api/nex/brain/status` and existing crons. **Uses existing code.**

### P1 · high value pre-launch (small-scoped BUILD work)

3. **Production readiness verification pass** — the moment production Postgres exists, run `scripts/prove-production-schema-readonly.ts` via the STEP 4C Tier-1 helper. Produces real evidence for all 8 currently-UNKNOWN rows. **Uses existing code · no writing.**
4. **CFGA2 allowlist entry** — one line in `src/lib/nex/config/tests/adoption-drift.test.mjs`. Gets local test sweep to 241/241. **Trivial.**
5. **First-run merchant polish sweep** — quickly walk the merchant onboarding in a browser and confirm no dead links / missing images / unclear copy. Fix only what a customer would notice. **Not engineering redesign.**

### P2 · soon after launch (post-MVP)

6. **Newsletter in-platform send** — completes `/trade-off/edit/[slug]/newsletter`. Value: retention · monetisation. Estimated 1-2 weeks. **BUILD.**
7. **Log-drain vendor pick + wiring** (F3 → H2 R-3 closure). **INFRASTRUCTURE.**
8. **021/048 architectural decision** — required only if we want to enable the supervisor (which we do not, immediately). Follow `WAVE-3-STEP-3-021-048-COLLISION-REPORT.md §8` operator decision points. **ARCHITECTURAL DECISION · not code · until direction chosen.**
9. **NEX intelligence UI · phased** — pick ONE of {contacts management · campaigns composer · knowledge inbox} to build a customer-visible surface for. Each is ~2 weeks. **BUILD.**

### P3 · downstream

10. Team management · CRM · advanced analytics · H6 RLS per-subsystem policy pass · H3 P99 tuning · Class C CID broadening · Supabase → NEX Storage cutover programme. All post-launch. All well-scoped in the existing baseline document.

---

## 6 · Do the existing OPEN items block launch?

### CFGA2 · **NO · does not block**

The failure is in `src/lib/nex/config/tests/adoption-drift.test.mjs::CFGA2`, flagging `src/lib/nex/brain/adapters/postgres.wc-companion.test.ts` (line 37 · direct `process.env.NEX_POSTGRES_URL` read). The flagged file is a **test-only file · does not ship to production**. Fix is one line: add its path to `CFGA2_KNOWN_EXCEPTIONS` with a justification. Precedent exists in Wave 11 F28. No operational risk. Not a launch blocker.

### 021/048 · alert-rules collision · **NO · does not block IF supervisor stays DISABLED**

- Live schema on both dev and production Supabase is 021's shape (per STEP 4 evidence · `nex.alert_rules` returns 021 columns · Subsystem A works · Subsystem B is dead-on-arrival)
- Supervisor is currently DISABLED (`NEX_KJOB_SUPERVISOR_ENABLED` unset) · has been throughout Wave 3-4
- Alert dispatch gate is OFF (`NEX_ALERTS_DISPATCH_ENABLED` unset) · H5's dispatch loop is inert until the operator opts in
- No production alert evaluation is happening today · no code path exercises the incompatible Subsystem B
- **Practical consequence:** the collision is INERT at launch. Ship as-is. Add an operational note to the runbook: *"Do NOT enable `NEX_KJOB_SUPERVISOR_ENABLED` or `NEX_ALERTS_DISPATCH_ENABLED` in production until 021/048 is resolved per WAVE-3-STEP-3-021-048-COLLISION-REPORT.md §8."*
- Post-launch, when we DO want to enable those flags, pick a resolution path from §9 of the collision report (2-4 weeks of authorised design + code + migration work)

### Everything else (H2 Class C · H3 subsystem pools · H4 production 049 · H5 Subsystem B · H6 RLS · Wave 4 production-only rows · Cohort A/B) · **NO · none block launch**

Every one either (a) requires the supervisor to be enabled (deferred safely) OR (b) is post-launch tuning that improves reliability without being pre-launch-critical.

---

## 7 · Minimum path from CURRENT LOCAL STATE to a USABLE CUSTOMER-FACING NEX

### The 12-week critical path

**Weeks 1-4 · INFRASTRUCTURE ONLY**
- Provision production Postgres · Vercel project · domain · TLS
- Set Vercel env vars per `deploy/VERCEL-DEPLOYMENT.md §2`
- Rotate Stripe · Resend · LLM keys for production
- Apply `deploy/postgres/init/*.sql` migrations to production Postgres
- First Vercel deploy · verify health endpoints

**Weeks 5-6 · PRODUCTION VERIFICATION (mostly using existing code)**
- Populate `NEX_PROD_READONLY_URL` in operator's shell
- Run `scripts/prove-production-schema-readonly.ts` · convert STEP 4 UNKNOWNs → VERIFIED
- Fix anything genuinely broken in production that local verification did not catch
- Add CFGA2 allowlist entry (2 minutes)
- Manual walk-through of merchant · homeowner · community · chat flows in production

**Weeks 7-10 · CLOSED-BETA COHORT**
- 10-50 merchants + 50-100 homeowners
- Monitor via existing dashboards (F5 alert engine · Subsystem A · dispatch still OFF · alerts open/resolve in-DB for admin visibility)
- Fix real customer-reported issues only · resist the temptation to expand scope
- **Do NOT enable supervisor** during beta · document as operational rule

**Weeks 11-12 · PUBLIC LAUNCH**
- Domain rollout · marketing wave
- Ongoing: post-MVP items P2 (newsletter send · log drain · phased NEX intelligence UI)

### No new engineering is required to reach a launchable state.

Every line of code needed for the beta cohort already exists. The path is dominated by provisioning credentials, applying migrations, and operational cutover.

---

## 8 · Obvious missing customer-facing surfaces

Based on the survey · a first-time visitor / merchant / homeowner has all the essential entry points. No missing pages BLOCK launch. Items worth polishing pre-launch (not blocking):

- **Landing/marketing page** — `/` uses `AudienceGateBright` face-detect routing. Verify the copy actually explains what NEX is (survey did not evaluate copy quality). May need a straight marketing page for cold-traffic conversion.
- **NEX intelligence UI** — the merchant sees `/nex` chat but does not (yet) have visible surfaces for the contacts · campaigns · knowledge inbox systems that exist in the backend. Chat covers this at MVP; UI comes post-MVP.
- **Onboarding continuity** — after merchant signup completes, the flow ends at `/trade-off/signup/done`. Confirm this transitions naturally into a "first product / first canteen post / first calculator use" first-run experience. Survey suggests this exists via the dashboard prompt · verify in a real browser walk-through.
- **Homeowner first-property claim** — `/home` prompts for first-property claim if none exists. Confirm this flow is smooth in a real browser walk-through.
- **Deployment monitoring dashboard** — Vercel dashboard covers this for engineers. No customer-facing equivalent needed.

None of these are net-new code. All are polish items to catch during weeks 5-6 verification.

---

## 9 · Separation · BUILD vs INFRASTRUCTURE vs FUTURE HARDENING

### BUILD (new customer-visible code required · post-MVP)

- Newsletter in-platform send · CRM UI · Team management · Advanced analytics · Phased NEX intelligence UI (contacts / campaigns / knowledge inbox)

### INFRASTRUCTURE (no code · operator/organisational tasks)

- Vercel project · production Postgres · domain · TLS · Stripe live keys · Resend key · LLM keys · cron secrets · env var setup · production migration application · log drain vendor pick · `pg_stat_statements` extension · restore rehearsal target · `NEX_PROD_READONLY_URL` provisioning

### FUTURE HARDENING (code exists · defer to post-launch cycles)

- 021/048 resolution · H2 Class C CID broadening · H3 subsystem pool coverage · H3 T-5b idempotency-key design · H4 production 049 application (only if async mode enabled) · H5 Subsystem B dispatcher · H6 191-table RLS remediation · CFGA2 allowlist · R3 (already fixed) · Supabase → NEX Storage cutover programme

---

## 10 · Summary

**NEX is closer to launch than the Headquarters reports imply.** The customer-facing product is materially complete. The remaining 12 weeks are dominated by INFRASTRUCTURE PROVISIONING — Vercel · production Postgres · Stripe live keys · domain · env vars · migration application — not new-code writing.

**No open engineering item blocks launch under the current operational constraints** (supervisor DISABLED · alert-dispatch gate OFF · async-rollup flag OFF). Every item on the OPEN list is either an inert architectural decision that can be deferred, or post-MVP feature work.

**The single unblocking action for the whole programme is provisioning production infrastructure.** Once that exists, weeks 5-12 flow naturally from the existing codebase.

---

## NEXT BUILD:
No new engineering required for the minimum-viable launch. The critical path is operational.

## BLOCKERS:
None on the engineering side. The only blocker is INFRASTRUCTURE provisioning (Vercel project · production Postgres · domain · TLS · Stripe live account · Resend key · LLM keys · cron secrets · production env vars · production migration application). This is an operator decision, not an engineering task.

## INFRASTRUCTURE NEEDED:
Vercel production project · production NEX Postgres (managed instance) · production domain + TLS · production Stripe account with live keys · production Resend account · production LLM provider keys (Groq · Gemini · Anthropic · Mistral · OpenRouter) · rotated `CRON_SECRET` + `NEX_BRAIN_CRON_TOKEN` · `NEX_PROD_READONLY_URL` for post-provision verification · Vercel env vars per `deploy/VERCEL-DEPLOYMENT.md §2` · production application of all `deploy/postgres/init/*.sql` migrations.

## NOT A BLOCKER:
CFGA2 (test-only failure · one-line allowlist fix · defer) · 021/048 collision (inert while supervisor DISABLED · deferrable until we want to enable the supervisor) · H2 Class C · H3 subsystem pool T-3 · H3 T-5b · H4 production 049 (only relevant if async mode enabled) · H5 Subsystem B · H6 legacy RLS · Wave 4 production-only rows (become testable once infrastructure exists) · Cohort A/B recovery · Supabase → NEX Storage cutover programme (long-term architectural work).

## FIRST THING TO BUILD:
**Nothing new to build first — first thing is to PROVISION production infrastructure.** If a single engineering deliverable must be picked, it is the two-minute **CFGA2 allowlist entry** in `src/lib/nex/config/tests/adoption-drift.test.mjs` to bring the local regression sweep to 241/241. Everything else is either shipped or genuinely post-MVP.
