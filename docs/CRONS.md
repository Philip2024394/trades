# Cron Catalog — Thenetworkers

_Every scheduled job in the platform. When you touch a cron, update this file._

**Snapshot:** 19 crons total · 17 Vercel · 4 pg_cron (one Vercel cron is also mirrored by pg_cron as a belt-and-braces backup, and one pg_cron migration only documents an existing Vercel cron with a `comment on column` — no actual scheduled job).

Docs cross-ref: `docs/BLUEPRINT.md` reports **17 crons** — that counts the Vercel entries only. The pg_cron jobs below are additional (some backup Vercel routes, some are pure-SQL sweeps with no HTTP endpoint).

Auth: every HTTP cron requires `Authorization: Bearer $CRON_SECRET` (Vercel Cron injects this automatically). pg_cron jobs run as the DB owner and don't need auth.

---

## By cadence

### Every minute
- [`/api/cron/os-event-drain`](#apicronos-event-drain) — Retries pending/failed OS event deliveries.

### Every 5 minutes
_(none)_

### Every 10 minutes
- [`/api/cron/yard-release-queued`](#apicronyard-release-queued) — Promotes queued Yard posts to `live` when their `scheduled_release_at` passes.

### Every 15 minutes
- [`/api/cron/publish-due`](#apicronpublish-due) — Drains scheduled channel publications for every active merchant.
- [`/api/reviews/publish-pending`](#apireviewspublish-pending) — Flips reviews from `pending` → `published` after the 72h cool-off.
- [`publish-pending-xrated-reviews`](#pg_cron-publish-pending-xrated-reviews) (pg_cron) — Pure-SQL variant that flips `hammerex_xrated_reviews` `pending` → `live` when `goes_live_at` passes.

### Hourly
- [`/api/cron/social-link-health`](#apicronsocial-link-health) — HEAD-checks affiliate social links, sets `active | broken | removed`.
- [`/api/canteens/recalc-metrics`](#apicanteensrecalc-metrics) — Recomputes denormalized `member_count` + `posts_last_30d` per canteen.
- [`xrated_affiliate_social_health`](#pg_cron-xrated_affiliate_social_health) (pg_cron) — Backup pg_net HTTP call to `/api/cron/social-link-health` for belt-and-braces coverage.

### Every 6 hours
- [`/api/cron/custom-domain-health`](#apicroncustom-domain-health) — Polls Vercel for custom-domain DNS/verification state; 3 fails → `dns_lost`.

### Daily
- [`/api/cron/ai-visualiser-rollover`](#apicronai-visualiser-rollover) — 03:00 UTC. Rolls over expired AI-visualiser billing periods + resets homeowner rate-limit windows.
- [`/api/cron/yard-expire-notifications`](#apicronyard-expire-notifications) — 03:00 UTC. Hard-deletes expired targeted notifications.
- [`/api/cron/free-slug-expiry`](#apicronfree-slug-expiry) — 03:00 UTC. Runs the 30-day inactive-free-slug state machine (`ok → warn-15 → warn-25 → warn-29 → expired`).
- [`xrated-paid-expiry-daily`](#pg_cron-xrated-paid-expiry-daily) (pg_cron) — 03:00 UTC. Sweeps `hammerex_trade_off_listings` for `app_paid` rows past `paid_expires_at` → `app_expired`.
- [`xrated-affiliate-pending-to-approved`](#pg_cron-xrated-affiliate-pending-to-approved) (pg_cron) — 03:30 UTC. 14-day cool-off promotion for affiliate commissions.
- [`/api/cron/affiliate-fraud-check`](#apicronaffiliate-fraud-check) — 04:00 UTC. Runs the four click-pattern fraud rules over the last 30 days.
- [`/api/cron/sweep-idle-arcs`](#apicronsweep-idle-arcs) — 06:00 UTC. Closes story arcs idle > 21 days per merchant.
- [`/api/cron/verify-credentials`](#apicronverify-credentials) — 08:00 UTC. Re-verifies studio brand credentials stale > 20h.

### Weekly
- [`/api/cron/compute-insights`](#apicroncompute-insights) — Mon 04:00 UTC. Recomputes trade-wide anonymised composer insights.
- [`/api/cron/predict-gold-path`](#apicronpredict-gold-path) — Mon 07:00 UTC. Runs the predictive Gold Path pass per merchant for the week.

### Monthly
- [`/api/cron/send-monthly-digests`](#apicronsend-monthly-digests) — 1st of month, 09:00 UTC. Composes and sends per-merchant monthly digest emails.
- [`/api/cron/affiliate-monthly-payment-alerts`](#apicronaffiliate-monthly-payment-alerts) — 28th of month, 09:00 UTC. Sends "complete payment details" emails to affiliates with ≥ £50 approved.
- [`xrated-affiliate-monthly-alert`](#pg_cron-xrated-affiliate-monthly-alert) (pg_cron) — 28th of month, 09:00 UTC. Sets `payment_alert_flag = true` on eligible affiliates (idempotency source for the email runner).

---

## Full catalog

### `/api/cron/os-event-drain`
**Cadence:** `* * * * *` (every minute)
**Source:** `src/app/api/cron/os-event-drain/route.ts`
**Registered in:** `vercel.json`
**Purpose:** Drains pending + failed event deliveries from `os_event_deliveries` where `next_attempt_at <= now()`. Rehydrates each event from `os_event_log` and calls `attemptDelivery()` which handles success + retry + dead-letter transitions. Bounded to 200 deliveries per run.
**Tables touched:** `os_event_deliveries` (read/write), `os_event_log` (read)

---

### `/api/cron/yard-release-queued`
**Cadence:** `*/10 * * * *` (every 10 min)
**Source:** `src/app/api/cron/yard-release-queued/route.ts`
**Registered in:** `vercel.json`
**Purpose:** Promotes Yard posts whose `scheduled_release_at` has passed from `status='queued'` to `status='live'`. Capped at 200 posts per run.
**Tables touched:** `hammerex_trade_off_yard_posts` (read/write)

---

### `/api/cron/publish-due`
**Cadence:** `*/15 * * * *` (every 15 min)
**Source:** `src/app/api/cron/publish-due/route.ts`
**Registered in:** `vercel.json`
**Purpose:** For every active merchant, drains due scheduled publications and dispatches to the appropriate channel handler. Marks each row `posted` or `failed`.
**Tables touched:** Merchant publications + channel-connection tables via `@/lib/publications/loader` (writes are guarded by the channel registry).

---

### `/api/reviews/publish-pending`
**Cadence:** `*/15 * * * *` (every 15 min)
**Source:** `src/app/api/reviews/publish-pending/route.ts`
**Registered in:** `vercel.json`
**Purpose:** The 72h cool-off gate. Flips network reviews from `pending` → `published` when `publish_at` has passed and admin hasn't frozen or removed them. Idempotent.
**Tables touched:** `hammerex_network_reviews` (read/write), `hammerex_network_review_events` (write)

---

### `pg_cron: publish-pending-xrated-reviews`
**Cadence:** `*/15 * * * *` (every 15 min)
**Source:** `supabase/migrations/20260625300000_hammerex_xrated_reviews_publish_cron.sql`
**Registered in:** pg_cron (Supabase)
**Purpose:** Pure-SQL variant of the review cool-off. Flips `hammerex_xrated_reviews` from `pending` → `live` when `goes_live_at <= now()`. Runs entirely inside Postgres — no HTTP hop.
**Tables touched:** `hammerex_xrated_reviews` (read/write)

---

### `/api/cron/social-link-health`
**Cadence:** `0 * * * *` (hourly)
**Source:** `src/app/api/cron/social-link-health/route.ts`
**Registered in:** `vercel.json` (+ pg_cron backup, see below)
**Purpose:** HEAD-checks every affiliate-claimed social link with a 5s timeout. Sets `status` to `active | broken | removed`. Capped at 200 links per run, ordered oldest-checked first.
**Tables touched:** `hammerex_affiliate_social_links` (read/write)

---

### `/api/canteens/recalc-metrics`
**Cadence:** `0 * * * *` (hourly)
**Source:** `src/app/api/canteens/recalc-metrics/route.ts`
**Registered in:** `vercel.json`
**Purpose:** Recomputes denormalized `member_count` + `posts_last_30d` per canteen so list/detail pages don't run aggregates on every render. Reconciles drift from best-effort write-time bumps.
**Tables touched:** `hammerex_canteens` (read/write), `hammerex_canteen_members` (read), `hammerex_canteen_posts` (read)

---

### `pg_cron: xrated_affiliate_social_health`
**Cadence:** `0 * * * *` (hourly)
**Source:** `supabase/migrations/20260630102000_xrated_affiliate_social_health_cron.sql`
**Registered in:** pg_cron (Supabase, guarded by pg_cron + pg_net availability)
**Purpose:** Belt-and-braces backup for `/api/cron/social-link-health`. Uses `pg_net.http_get` to hit the same route hourly if Vercel Cron misses. Skipped silently if pg_cron or pg_net isn't installed.
**Tables touched:** Delegates to the HTTP handler — same rows as above.

---

### `/api/cron/custom-domain-health`
**Cadence:** `0 */6 * * *` (every 6 hours)
**Source:** `src/app/api/cron/custom-domain-health/route.ts`
**Registered in:** `vercel.json`
**Purpose:** For every listing with `custom_domain_status='live'`, polls Vercel for verification + misconfiguration flags. Three consecutive failures flips the row to `dns_lost`. Capped at 100 domains per run.
**Tables touched:** `hammerex_trade_off_listings` (read/write), `hammerex_custom_domain_events` (write)

---

### `/api/cron/ai-visualiser-rollover`
**Cadence:** `0 3 * * *` (daily 03:00 UTC)
**Source:** `src/app/api/cron/ai-visualiser-rollover/route.ts`
**Registered in:** `vercel.json`
**Purpose:** Rolls over expired AI-visualiser billing periods on `app_ai_visualiser_credits` (fresh period + reset counters). Also closes expired rate-limit windows on the homeowners table.
**Tables touched:** `app_ai_visualiser_credits` (read/write), `app_ai_visualiser_homeowners` (read/write)

---

### `/api/cron/yard-expire-notifications`
**Cadence:** `0 3 * * *` (daily 03:00 UTC)
**Source:** `src/app/api/cron/yard-expire-notifications/route.ts`
**Registered in:** `vercel.json`
**Purpose:** Hard-deletes Yard targeted notifications whose `expires_at` has passed. Single bounded DELETE statement, no cursor.
**Tables touched:** `hammerex_yard_targeted_notifications` (delete)

---

### `/api/cron/free-slug-expiry`
**Cadence:** `0 3 * * *` (daily 03:00 UTC)
**Source:** `src/app/api/cron/free-slug-expiry/route.ts`
**Registered in:** `vercel.json`
**Purpose:** Enforces the 30-day inactive-free-slug policy. State machine: `ok → warn-15 (15d) → warn-25 (25d) → warn-29 (29d, final warning) → expired (30d, slug archived + released)`. Any login mid-cycle resets to `ok`.
**Tables touched:** `hammerex_trade_off_listings` (read/write)
**Related ADR / memory:** `docs/DECISIONS/0004-free-slug-expiry-policy.md`

---

### `pg_cron: xrated-paid-expiry-daily`
**Cadence:** `0 3 * * *` (daily 03:00 UTC)
**Source:** `supabase/migrations/20260628070000_paid_expiry_cron.sql`
**Registered in:** pg_cron (Supabase)
**Purpose:** Nightly bulk sweep: any `hammerex_trade_off_listings` row with `tier = 'app_paid'` and `paid_expires_at < now()` flips to `app_expired`. Belt-and-braces to the render-time `maybeExpireListingTier()` helper.
**Tables touched:** `hammerex_trade_off_listings` (read/write)

---

### `pg_cron: xrated-affiliate-pending-to-approved`
**Cadence:** `30 3 * * *` (daily 03:30 UTC)
**Source:** `supabase/migrations/20260629210000_xrated_affiliates_monthly_alert_cron.sql`
**Registered in:** pg_cron (Supabase)
**Purpose:** Auto-approves affiliate commissions past the 14-day cool-off (`status = 'pending' AND created_at < now() - '14 days'`). Admin can still manually approve sooner.
**Tables touched:** `hammerex_affiliate_commissions` (read/write)

---

### `/api/cron/affiliate-fraud-check`
**Cadence:** `0 4 * * *` (daily 04:00 UTC)
**Source:** `src/app/api/cron/affiliate-fraud-check/route.ts`
**Registered in:** `vercel.json` (+ SQL paper-trail in `supabase/migrations/20260701106000_xrated_affiliate_fraud_cron.sql` — a `comment on column` only, no `cron.schedule` call)
**Purpose:** Walks every active affiliate, runs the click-pattern fraud rules over the last 30 days, appends NEW flags to `fraud_flags` (dedup by flag) and sets `requires_review` when at least one flag is present.
**Tables touched:** `hammerex_affiliates` (read/write), `hammerex_affiliate_audit_log` (write)

---

### `/api/cron/sweep-idle-arcs`
**Cadence:** `0 6 * * *` (daily 06:00 UTC)
**Source:** `src/app/api/cron/sweep-idle-arcs/route.ts`
**Registered in:** `vercel.json`
**Purpose:** Closes story arcs idle > 21 days across every active merchant. Delegates to `/api/story-arcs/sweep-idle` per merchant so idempotency + case-study emission behaviour stays identical.
**Tables touched:** Delegates — story-arc tables via the per-merchant sweep endpoint.

---

### `/api/cron/verify-credentials`
**Cadence:** `0 8 * * *` (daily 08:00 UTC)
**Source:** `src/app/api/cron/verify-credentials/route.ts`
**Registered in:** `vercel.json`
**Purpose:** Walks studio brand credentials that haven't been checked in 20+ hours, runs the appropriate verifier, updates status. Capped at 300 per run, oldest-first.
**Tables touched:** `studio_brand_credentials` (read/write)

---

### `/api/cron/compute-insights`
**Cadence:** `0 4 * * 1` (weekly Mon 04:00 UTC)
**Source:** `src/app/api/cron/compute-insights/route.ts`
**Registered in:** `vercel.json`
**Purpose:** Recomputes trade-wide anonymised insights (best time, caption length, material mentions, baseline) so composer prompts stay fresh. Delegates to `computeTradePatterns()`.
**Tables touched:** Anonymised trade-pattern aggregates via `@/lib/insights/tradePatterns`.

---

### `/api/cron/predict-gold-path`
**Cadence:** `0 7 * * 1` (weekly Mon 07:00 UTC)
**Source:** `src/app/api/cron/predict-gold-path/route.ts`
**Registered in:** `vercel.json`
**Purpose:** Runs the predictive Gold Path pass per merchant. Populates each merchant's weekly guide before they open the app on Monday.
**Tables touched:** Delegates — Gold Path tables via `@/lib/gold-path/predictive`.

---

### `/api/cron/send-monthly-digests`
**Cadence:** `0 9 1 * *` (monthly, 1st at 09:00 UTC)
**Source:** `src/app/api/cron/send-monthly-digests/route.ts`
**Registered in:** `vercel.json`
**Purpose:** Composes and sends the monthly digest for every merchant with a subscriber email. MVP: only fires if `NEWSLETTER_FROM` env override + service-role Supabase are configured; production wires this to a merchants table with newsletter columns.
**Tables touched:** `merchants` (read) + delegates to `composeMonthlyDigest` / `deliverMonthlyDigest`.

---

### `/api/cron/affiliate-monthly-payment-alerts`
**Cadence:** `0 9 28 * *` (monthly, 28th at 09:00 UTC)
**Source:** `src/app/api/cron/affiliate-monthly-payment-alerts/route.ts`
**Registered in:** `vercel.json`
**Purpose:** For every active affiliate whose approved-commission total ≥ £50 AND `payment_details_completed_at IS NULL`, sends a "complete your payment details" email via Resend. Same logic as `scripts/send-monthly-payment-alerts.mjs`, but server-side and auth-gated.
**Tables touched:** `hammerex_affiliates` (read/write), `hammerex_affiliate_commissions` (read)

---

### `pg_cron: xrated-affiliate-monthly-alert`
**Cadence:** `0 9 28 * *` (monthly, 28th at 09:00 UTC)
**Source:** `supabase/migrations/20260629210000_xrated_affiliates_monthly_alert_cron.sql`
**Registered in:** pg_cron (Supabase)
**Purpose:** Complements the Vercel email cron above — sets `payment_alert_flag = true` on any affiliate row where approved commissions ≥ £50 AND payment details are missing. The flag lets the email runner pick up only fresh rows (idempotency).
**Tables touched:** `hammerex_affiliates` (read/write), `hammerex_affiliate_commissions` (read)

---

## Cross-reference with `docs/BLUEPRINT.md`

BLUEPRINT reports **17 crons** — that is the exact count of entries in `vercel.json`. All 17 have handler files present at the expected paths (verified via glob). No orphan Vercel registrations, no orphan handler files.

pg_cron adds **4 more scheduled jobs** on top (2 backup / mirror the Vercel jobs, 2 are pure-SQL sweeps with no HTTP endpoint). One additional migration (`20260701106000_xrated_affiliate_fraud_cron.sql`) documents the fraud-check cron via a `comment on column` but does not schedule anything — the cron itself lives entirely in Vercel.
