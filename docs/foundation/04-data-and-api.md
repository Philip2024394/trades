# Data Layer & API Routes — Foundation Reference

> The Supabase schema, all `/api/*` routes, and the seed/backfill scripts. The source of truth for "where does X live?"
>
> Repo root: `C:\Users\Victus\trades\`
> Generated: 2026-06-28. Anchored to file paths + line numbers. Facts (F) come from the source; observations (O) are inferences I flag explicitly.

---

## 0. Quick orientation

- **Supabase project ref**: `msdonkkechxzgagyguoe` (shared with Hammerex; every table here is namespaced `hammerex_*`). F — `scripts/seed-demo-trades.mjs:18`.
- **Client**: `src/lib/supabase.ts` exports a single anon `supabase` client (`createClient(NEXT_PUBLIC_SUPABASE_URL, NEXT_PUBLIC_SUPABASE_ANON_KEY)`, `persistSession: false`). F — `src/lib/supabase.ts:1-8`.
- **Server / service-role client**: `src/lib/supabaseAdmin.ts` (used by every `/api/trade-off/*` write route). F — `src/app/api/trade-off/create/route.ts:15`.
- **Migrations folder**: `supabase/migrations/` — 37 SQL files, naming `<UTC-ish-timestamp>_<slug>.sql`. F — `Glob` count.
- **Type catalog**: every table mapped to one or more exported types in `src/lib/supabase.ts`.

---

## 1. Supabase tables

Below: every table referenced in the codebase, the migration that creates it, the columns observed, and the JSONB shapes the renderer assumes.

### 1.1 `hammerex_trade_off_listings` — the master listing row

> Created in `20260625100000_hammerex_trade_off_directory.sql:9-41`.
> Augmented by virtually every later migration. Mapped to TS type `HammerexTradeOffListing` in `src/lib/supabase.ts:10-240`.

**Identity / contact**

- `id uuid pk default gen_random_uuid()` (F — directory migration L10)
- `slug text not null unique` — vanity URL (L11)
- `display_name`, `trading_name`, `email`, `whatsapp`, `phone`, `bio` (L12-28)
- `edit_token uuid not null default gen_random_uuid()` (L37) — **drift**: not surfaced on `HammerexTradeOffListing` type, but every edit route reads it (see §8).

**Trade taxonomy + location**

- `primary_trade text not null`, `secondary_trades text[]` (L15-16)
- `city`, `country`, `postcode_prefix`, `lat numeric`, `lng numeric` (L17-20)
- `service_postcodes text[]` (L22) — legacy
- `service_radius_km integer` — added `20260628030000_xrated_service_radius.sql`. Replaces the postcode list as the primary service-area signal; the legacy column stays.

**Socials** (added by `20260625110000_hammerex_trade_off_v2.sql`)

- `facebook`, `tiktok`, `youtube`
- Type also lists `twitter`, `snapchat`, `reddit`, `google` (`supabase.ts:35-39`). **Drift** — no migration adds these four columns.

**Photos / media**

- `avatar_url text`, `photos text[]` (L30-31)
- `video_url`, `video_cover_url` — added `20260625270000_hammerex_xrated_video.sql`
- `video_caption` — added `20260625280000_hammerex_xrated_video_caption.sql`
- `custom_app_hero_url` — added `20260625240000_hammerex_xrated_custom_hero.sql`

**Status / moderation**

- `status text not null default 'draft' check (status in ('draft','live','hidden'))` (L32)
- `report_count int` (L33) — auto-bumped by trigger `hammerex_trade_off_after_report` (L86-104); 3+ reports auto-hides.

**Hammerex Standard badge**

- `hammerex_standard_verified bool`, `hammerex_standard_products text[]`, `hammerex_standard_blurb text` (L34-36)

**Mini-app theme (added `20260625120000_hammerex_xratedtrades_mini_app.sql`)**

- `theme_color`, `button_text_color`, `cta_button_effect` ('none'|'pulse'|'glow'|'shake')
- `hero_text_line1`, `hero_text_line2`, `hero_text_line2_color`, `hero_text_tagline`
- `hero_text_effect` ('none'|'shimmer'|'dance'|'underline')
- `avatar_frame_style` ('none'|'ring'|'pulse'|'dance')
- `profile_placement` ('center'|'top-left'|'bottom-left')
- `accepting_jobs bool`
- `tier text` ('standard'|'app_trial'|'app_paid'|'app_expired')
- `trial_started_at`, `trial_expires_at timestamptz`
- `running_marquee text`

**Brand Studio (added `20260628020000_xrated_brand_studio.sql`)**

- `font_family text default 'system'`
- `font_scale text default 'normal'`
- `body_text_color text default '#0A0A0A'`

**Phone calls toggle**

- `phone_calls_enabled bool default true` — `20260628010000_xrated_phone_calls_enabled.sql`

**Pricing + features (added `20260625160000_hammerex_xrated_app_features.sql`)**

- `operating_hours jsonb default '{}'` — shape `Record<weekday, {open, close} | null>` (`supabase.ts:81`)
- `faq_items jsonb default '[]'` — shape `Array<{q, a}>` (`supabase.ts:82`)
- `services_offered text[]`
- `contact_form_enabled bool`, `visit_us_enabled bool`

**Rating + priced services (added `20260625170000_hammerex_xrated_rating_priced_services.sql`)**

- `rating_avg numeric(2,1)`, `rating_count int`
- `priced_services jsonb` — shape per item: `{ name, image_url, image_urls?, before_image_url?, price, unit, description? }` (`supabase.ts:88-96`)
- `promo_text text`

**"On Standby" + trust + logistics (`20260625200000` + `20260625210000`)**

- `availability text` ('now'|'tomorrow'|'this_week'|'next_week'|'two_weeks'|'later') — enum enforced in code, NOT in CHECK
- `headline_rate jsonb` — `{ amount, unit, currency }`
- Trust booleans: `is_insured`, `dbs_checked`, `has_own_transport`, `has_own_tools`, `free_site_visits`
- Trust ints: `insurance_cover_gbp`, `minimum_job_gbp`
- Trust arrays: `qualifications text[]`, `trade_memberships text[]`
- Quote process: `quote_availability text`, `quote_turnaround_hours int`
- State: `current_status_note text`, `ready_date date`

**Conversion mechanics (`20260625230000_hammerex_xrated_conversion.sql`)**

- `whatsapp_click_count int default 0`
- `last_whatsapp_click_at timestamptz`
- `upgrade_nudge_dismissed_at timestamptz`

**Trust level (`20260625250000`)**

- `trust_level_override smallint check (between 3 and 5)`

**Add-ons registry**

- `addons_enabled jsonb default '{}'` — added `20260627000000_hammerex_xrated_addons_shop_mode.sql`. Shape: `{ shop_mode: true, downloads: true, ... }` per `src/lib/xratedAddons.ts:93-336`.

**Wholesale Mode origin (added `20260627040000_xrated_wholesale_mode.sql`)**

- `wholesale_origin_address`, `wholesale_origin_postcode`, `wholesale_origin_lat`, `wholesale_origin_lng`
- `wholesale_distance_fudge numeric default 1.4` (range 1.0-3.0)
- `wholesale_allow_pickup bool`, `wholesale_currency text`, `wholesale_prices_ex_vat bool`

**Materials Network commission (added `20260627050000_xrated_materials_network.sql`)**

- `merchant_commission_rate numeric` (% of fulfilled order)
- `merchant_commission_min_pence int`
- `merchant_commission_terms text`
- `materials_network_opted_in_at timestamptz`
- `materials_network_paused bool`

**Custom Domain (added `20260627080000_xrated_custom_domain.sql`)**

- `custom_domain text UNIQUE`, `custom_domain_apex text`
- `custom_domain_status text` enum ('pending'|'dns_pending'|'verifying'|'live'|'ssl_failed'|'dns_lost'|'expired'|'disconnected'|'blocked')
- `custom_domain_verification jsonb`, `custom_domain_vercel_id text`
- `custom_domain_added_at`, `custom_domain_verified_at`, `custom_domain_ssl_verified_at`, `custom_domain_last_check_at timestamptz`
- `custom_domain_last_error text`, `custom_domain_failure_count int`
- `custom_domain_addon_active bool`

**Team Members**

- `team_members jsonb default '[]'` — added `20260628060000_xrated_team_members.sql`. Shape per row: `{ name, role, years_experience, avatar_url, skills[] }`.

**DRIFT — columns in code, no migration:**

- `twitter`, `snapchat`, `reddit`, `google` (socials) — `supabase.ts:35-39`
- `payment_methods text[]` — `supabase.ts:134` + `/api/trade-off/payment-methods/route.ts` writes it. No `payment_methods` migration found.
- `retail_shipping_uk_pence`, `retail_shipping_uk_areas`, `retail_shipping_international` — referenced by `20260628040000_xrated_shipping_modes.sql` (comments only) + `/api/trade-off/listings/retail-shipping/route.ts` writes them. Only `retail_shipping_mode` itself ever appears in an ALTER. No migration adds the pence/areas/intl columns.
- `terms_url`, `privacy_url`, `returns_url`, `about_url` — `supabase.ts:212-215` + `/api/trade-off/listings/legal-links/route.ts`. No migration adds them.
- `paid_expires_at`, `last_payment_plan` — `supabase.ts:79-80`. No migration adds them. (`hammerex_xrated_payments` table exists, see §1.18.)
- `recommendations jsonb` (trusted-trades add-on) — `supabase.ts:99`. No migration. (Schema possibly inherited from Hammerex repo's shared DB.)
- O: The shared Supabase project with Hammerex means earlier migrations may live in the `hammer` repo at `C:\Users\Victus\hammer\`. The `trades` repo's `supabase/migrations/` starts at `20260625100000`, suggesting prior baseline lives elsewhere.

---

### 1.2 `hammerex_trade_off_projects` — verified-work gallery

Created `20260625110000_hammerex_trade_off_v2.sql:8-22`. Type `HammerexTradeOffProject` (`supabase.ts:502-516`).

- `id`, `listing_id` (FK → listings, ON DELETE CASCADE)
- `title`, `description`
- `before_url`, `during_url`, `after_url`
- `location_city`, `completed_at date`, `verified bool`
- `sort_order int`, `created_at`, `updated_at`

Indexes on `(listing_id, sort_order)` and `(verified)`.

---

### 1.3 `hammerex_trade_off_reports` — abuse moderation

Created `20260625100000_hammerex_trade_off_directory.sql:73-79`.

- `id`, `listing_id` (FK CASCADE), `reason text`, `reporter_ip text`, `created_at`
- Trigger `hammerex_trade_off_reports_bump` auto-updates `listings.report_count` and hides at 3+.
- RLS allows public INSERT only.

---

### 1.4 `hammerex_trade_off_messages` — contact-form inbox

Created `20260625160000_hammerex_xrated_app_features.sql:177-186`. Type `HammerexTradeOffMessage` (`supabase.ts:444-453`).

- Core: `listing_id` (FK CASCADE), `sender_name`, `sender_email`, `sender_phone`, `message`, `ip_hash`
- Lead qualification (added `20260625260000_hammerex_xrated_lead_qualification.sql`): `postcode text`, `project_type` (new_build|renovation|repair), `project_stage` (ready_to_book|comparing_quotes|just_researching), `earliest_start text`, `photo_urls text[]`
- RLS: public INSERT only.

---

### 1.5 `hammerex_xrated_views` — page-view analytics

Created `20260625130000_hammerex_xrated_admin.sql:97-110`. Type `HammerexXratedView` (`supabase.ts:455-468`).

- `id`, `listing_id` (FK CASCADE, nullable for non-listing pages)
- `page text`, `session_id`, `ip_hash`, `country`, `city`, `referrer`, `user_agent`
- `viewed_at`, `ended_at`, `duration_seconds`
- RLS: anon INSERT only; reads service-role.

---

### 1.6 `hammerex_xrated_jobs` — customer-side job posts

Created `20260625140000_hammerex_xrated_jobs.sql:131-149`. Type `HammerexXratedJob` (`supabase.ts:470-488`).

- `id`, `slug text unique`, `customer_name`, `customer_whatsapp`
- `trade_slug`, `city`, `country` (added `20260625150000_hammerex_xrated_jobs_country.sql`), `postcode_prefix`
- `description text`, `budget_hint text`, `photos text[]`
- `status` ('pending'|'live'|'completed'|'rejected'|'expired')
- `is_example bool` — seeded sample posts
- `report_count int`, `expires_at` (default 30d), timestamps

---

### 1.7 `hammerex_xrated_payments` — payment audit log

Created `20260625130000_hammerex_xrated_admin.sql` (same file as views). Type `HammerexXratedPayment` (`supabase.ts:490-500`).

- `id`, `listing_id` (FK CASCADE)
- `plan` ('monthly'|'annual'), `amount_gbp`, `paid_at`, `paid_via`, `admin_note`
- `expires_at`, `created_at`

O — admin-curated; no automated payment gateway in v1.

---

### 1.8 `hammerex_xrated_vouchers` — Welcome Knife codes

Created `20260625220000_hammerex_xrated_vouchers.sql:269-280`. Type `HammerexXratedVoucher` (`supabase.ts:518-529`).

- `id`, `listing_id` (FK CASCADE)
- `code text unique`, `product_slug text default 'folding-safety-cutting-knife'`
- `status` ('unused'|'redeemed'|'expired'|'revoked')
- `issued_at`, `expires_at` (default +12 months)
- `redeemed_at`, `redeemed_order_ref`, `admin_note`

Issued from `/api/trade-off/create` when status='live' (`route.ts:200-233`).

---

### 1.9 `hammerex_xrated_reviews` — customer reviews

Created `20260625290000_hammerex_xrated_reviews.sql:387+`. (Type not exported in `supabase.ts` — drift; consumed via raw shape in `ReviewsCarousel` etc.)

- 5-axis ratings: `overall_rating` (1-5 required), `workmanship_rating`, `communication_rating`, `value_rating`, `timeliness_rating`
- Submitter: `customer_name`, `customer_email`, `customer_postcode`
- Context: `project_type`, `project_finish`, `timeframe_quoted_days`, `timeframe_actual_days`, `attempted_resolution bool`
- `status` ('pending'|'live'|'disputed'|'archived')
- `goes_live_at` — 24h cool-down; auto-promoted by pg_cron job `publish-pending-xrated-reviews` (15-min interval) per `20260625300000_hammerex_xrated_reviews_publish_cron.sql`
- `service_name text` — added `20260626100000_hammerex_xrated_reviews_service.sql`
- `product_id uuid` — added `20260627010000_hammerex_xrated_addons_phase1b.sql`
- `customer_avatar_url text` — referenced in code (`scripts/backfill-review-avatars.mjs`, `src/app/trade/[slug]/page.tsx`) but **NO MIGRATION FOUND**. **DRIFT.**

---

### 1.10 `hammerex_xrated_products` — Shop Mode catalog

Created `20260627000000_hammerex_xrated_addons_shop_mode.sql:479-487`. Type `HammerexXratedProduct` (`supabase.ts:259-323`).

- `id`, `listing_id` (FK CASCADE)
- `kind` ('product'|'service') — added phase 1B
- `unit text`, `category text`
- `name`, `description`
- `specs jsonb` (array of `{label, value}`), `features jsonb` (string[]), `faq jsonb` (array of `{q, a}`, max 3), `video_url text` — added `20260628000000_xrated_product_details_tabs.sql` + `20260628050000_xrated_product_faq.sql`
- `price_pence int`, `vat_inclusive bool`, `vat_rate_pct numeric`
- `product_kind` ('stock'|'install') — O: not seen in migrations I read end-to-end; presumed added in same phase.
- `stock_count int`, `cover_url`, `gallery_urls jsonb`
- `dispatch_days int`
- `variants jsonb` — array of `{ axis, axis_label?, label, stock_count?, price_delta_pence? }` (`supabase.ts:285-292`)
- `size_chart_url`, `size_chart_unit`
- `bulk_tiers jsonb` — wholesale tier rows `{min_qty, max_qty?, price_pence}` (added `20260627040000_xrated_wholesale_mode.sql:608-609`)
- `compare_with text[]` — sibling slugs
- `status` ('live'|'archived'), `sort_order`
- Storefront (added `20260627070000_xrated_storefront.sql`): `slug text` (unique per listing live), `featured_at timestamptz`, `search_tsv tsvector GENERATED`
- `warranty_header`, `warranty_text`, `returns_text` — referenced in type; no specific migration found. **DRIFT** (or implicit in storefront migration).
- Timestamps.

---

### 1.11 `hammerex_xrated_shipping_zones` — Shop Mode per-country shipping

Created `20260627000000_hammerex_xrated_addons_shop_mode.sql` (same file). Type `HammerexXratedShippingZone` (`supabase.ts:326-338`).

- `listing_id`, `country_code`, `country_name`
- `air_price_pence`, `sea_price_pence` (nullable — pick one or both)
- `eta_min_days`, `eta_max_days`, `sort_order`, timestamps.

---

### 1.12 `hammerex_xrated_wholesale_zones` — Wholesale Mode delivery zone

Created `20260627040000_xrated_wholesale_mode.sql`. Type `HammerexXratedWholesaleZone` (`supabase.ts:344-359`).

- `listing_id`, `free_radius_km`, `free_postcodes text[]`
- `banded_pricing jsonb` — `[{max_km, price_pence, min_order_pence?}, ...]`
- `min_order_pence`, `max_delivery_km`, `sort_order`, timestamps.

---

### 1.13 `hammerex_xrated_downloads` + `hammerex_xrated_download_leads`

Created `20260627020000_xrated_downloads.sql:539+`. Types `HammerexXratedDownload` / `HammerexXratedDownloadLead` (`supabase.ts:367-394`).

- Downloads: `name`, `description`, `file_url`, `file_type` (CHECK enum), `file_size_bytes`, `category` (CHECK enum: brochure|form|compliance|catalogue|qualification|other), `requires_email bool`, `cover_image_url`, `download_count`, `status` (live|archived), `sort_order`, timestamps.
- Leads: `download_id`, `customer_email`, `customer_name`, `ip_hash`, `downloaded_at`.

---

### 1.14 `hammerex_xrated_projects` + `hammerex_xrated_project_updates` + `hammerex_xrated_project_removal_requests`

Created `20260627030000_xrated_job_diary.sql`. Types `HammerexXratedProject` / `HammerexXratedProjectUpdate` (`supabase.ts:403-442`).

- Projects: `title`, `location_label`, `started_at`, `estimated_complete_at`, `completed_at`, `cover_image_url`, `final_summary`, `status` ('live'|'completed'|'archived'), `privacy_disclaimer_confirmed_at` (NOT NULL), `sort_order`, timestamps.
- Updates: `project_id`, `status_chip` (enum of 8 — on_track / stage_complete / inspection_passed / weather_delay / materials_delay / scope_change / snagging / completed), `image_urls text[]` (CHECK ≤4), `note`, `shared_platforms text[]`, `ip_hash`, `posted_at`, `created_at`.
- Removal requests: append-only public right-to-removal audit table (O — read from migration comment, didn't dump column list).

---

### 1.15 `hammerex_xrated_merchant_picks` + `hammerex_xrated_merchant_referrals` + `hammerex_xrated_tradie_earnings_v`

Created `20260627050000_xrated_materials_network.sql`. Types `HammerexXratedMerchantPick` / `HammerexXratedMerchantReferral` / `HammerexXratedTradieEarnings` (`supabase.ts:549-607`).

- Picks: `tradie_listing_id` (FK), `merchant_listing_id` (FK), `intro_note text` (≤200 chars), `sort_order`, `status` (live|archived), timestamps.
- Referrals: `ref_code text` (e.g., MN-A4F2K7), `tradie_listing_id`, `merchant_listing_id`, `customer_session_id`, `customer_wa_hash`, `customer_name`, `customer_wa_e164`, `cart_items_snapshot jsonb`, `estimated_cart_total_pence`, `status` (pending|fulfilled|declined|expired|disputed), `fulfilled_at`, `fulfilled_order_value_pence`, `commission_rate_at_fulfilment`, `commission_pence`, `fulfilled_note`, `declined_reason`, `declined_note`, `expires_at`, `created_at`.
- `hammerex_xrated_tradie_earnings_v` — VIEW that aggregates the ledger; never reads customer fields (privacy boundary).

---

### 1.16 `hammerex_xrated_push_log` (stub) + `hammerex_xrated_push_subscriptions`

- `hammerex_xrated_push_log` — created `20260627050000_xrated_materials_network.sql`. Type `HammerexXratedPushLog` (`supabase.ts:641-650`). Columns: `listing_id`, `event_type` (CHECK enum: whatsapp_click|commission|review|test|lead|referral_pending|referral_fulfilled), `payload jsonb`, `subscription_id` (nullable for legacy stubs), `delivery_status` (queued|sent|failed|throttled|muted|quiet_hours), `delivery_error`, `created_at`.
- `hammerex_xrated_push_subscriptions` — created `20260627060000_xrated_lead_alerts.sql:664+`. Type `HammerexXratedPushSubscription` (`supabase.ts:615-634`). Columns: `listing_id`, `endpoint text`, `endpoint_hash` (GENERATED, sha256 of endpoint), `p256dh_key`, `auth_key`, `user_agent`, `platform` (ios|android|desktop|unknown), `device_label`, `vibration_pattern int[]`, `muted_events text[]`, `quiet_hours_start int`, `quiet_hours_end int`, `enabled bool`, `last_used_at`, `last_success_at`, `failure_count`, `created_at`.

---

### 1.17 `hammerex_custom_domain_events`

Created `20260627080000_xrated_custom_domain.sql`. Type `HammerexCustomDomainEvent` (`supabase.ts:657-676`).

- `id bigint`, `listing_id`, `domain text`, `event_type` (CHECK enum: attach_attempt|attach_success|attach_failed|verify_attempt|verify_success|verify_failed|ssl_issued|health_check_ok|health_check_failed|dns_lost|disconnect|blocked), `payload jsonb`, `created_at`.

---

### 1.18 `hammerex_xrated_faq_items` + `hammerex_xrated_faq_images`

Created `20260627090000_xrated_faq_page.sql:758+`. Types `HammerexXratedFaqItem` / `HammerexXratedFaqImage` (`supabase.ts:683-717`).

- Items: `listing_id`, `ref_code text` (unique per listing, e.g., FAQ-001), `question text` CHECK 5-200 chars, `answer text` CHECK 5-2000 chars, `category` CHECK enum (general|pricing|process|materials|trust|warranty|aftercare), `status` (live|archived), `sort_order`, `view_count`, timestamps. Trigger enforces ≤50 LIVE rows per listing.
- Images: `faq_id`, `image_url`, `title text` (1-80 chars), `alt_text`, `sort_order`, `created_at`. Trigger enforces ≤3 images per FAQ.

---

### 1.19 Tables in code with no migration in this repo

These types exist in `src/lib/supabase.ts` but I could not find their CREATE TABLE in `supabase/migrations/`. They likely live in the Hammerex repo's migrations (shared DB):

- `HammerexProduct` (`supabase.ts:538-543`) — read-only flagship Hammerex products table (used for Hammerex Standard badge cards).
- `HammerexShippingZone` (`supabase.ts:719-730`) — referenced once; appears to belong to the Hammerex side of the shared DB.
- `HammerexXratedQuote` (Quote Pipeline add-on, `supabase.ts:738-754`) — `/api/trade-off/quotes/*` writes here. **No migration found in trades repo.**
- `HammerexTradeOffVerifiedPlusApplication` (`supabase.ts:764-779`) — `/api/trade-off/verified-waitlist` writes here. **No migration found.**
- `HammerexTradeOffYardPost` + `HammerexTradeOffYardReaction` (`supabase.ts:791-845`) — The Yard board. `/api/trade-off/yard/*` writes here. **No migration found.**

O — Either these live in a baseline that predates this repo's `supabase/migrations/` folder, or they were applied directly via the Management API (the pattern used by `scripts/apply-team-migration.mjs`) without a checked-in SQL file. Treat as **schema drift / undocumented schema**.

---

## 2. Migrations — chronological summary

> All in `C:\Users\Victus\trades\supabase\migrations\`. Timestamps follow `YYYYMMDDHHMMSS_*.sql`.

| # | File | One-line summary |
|---|---|---|
| 1 | `20260625100000_hammerex_trade_off_directory.sql` | Create `hammerex_trade_off_listings`, `_projects`, `_reports`; RLS public-read for live rows. |
| 2 | `20260625110000_hammerex_trade_off_v2.sql` | Add facebook/tiktok/youtube; create projects table. |
| 3 | `20260625120000_hammerex_xratedtrades_mini_app.sql` | App tier theme cols + tier enum + trial timestamps. |
| 4 | `20260625130000_hammerex_xrated_admin.sql` | `hammerex_xrated_views` + `hammerex_xrated_payments`; views RLS. |
| 5 | `20260625140000_hammerex_xrated_jobs.sql` | `hammerex_xrated_jobs` customer-side board. |
| 6 | `20260625150000_hammerex_xrated_jobs_country.sql` | Add country to jobs. |
| 7 | `20260625160000_hammerex_xrated_app_features.sql` | operating_hours/faq_items/services_offered + messages inbox table. |
| 8 | `20260625170000_hammerex_xrated_rating_priced_services.sql` | rating_avg/rating_count + priced_services jsonb + promo_text. |
| 9 | `20260625200000_hammerex_xrated_standby.sql` | availability enum (text) + headline_rate jsonb. |
| 10 | `20260625210000_hammerex_xrated_trust.sql` | All trust + logistics + quote-process + current-status cols. |
| 11 | `20260625220000_hammerex_xrated_vouchers.sql` | Welcome Knife voucher table. |
| 12 | `20260625230000_hammerex_xrated_conversion.sql` | whatsapp_click_count + last_whatsapp_click_at + upgrade_nudge_dismissed_at. |
| 13 | `20260625240000_hammerex_xrated_custom_hero.sql` | custom_app_hero_url. |
| 14 | `20260625250000_hammerex_xrated_trust_level.sql` | trust_level_override smallint (CHECK 3-5). |
| 15 | `20260625260000_hammerex_xrated_lead_qualification.sql` | postcode/project_type/project_stage/earliest_start/photo_urls on messages. |
| 16 | `20260625270000_hammerex_xrated_video.sql` | video_url + video_cover_url. |
| 17 | `20260625280000_hammerex_xrated_video_caption.sql` | video_caption. |
| 18 | `20260625290000_hammerex_xrated_reviews.sql` | `hammerex_xrated_reviews` + 5-axis ratings + dispute states. |
| 19 | `20260625300000_hammerex_xrated_reviews_publish_cron.sql` | pg_cron job auto-publishing pending → live every 15 min. |
| 20 | `20260626100000_hammerex_xrated_reviews_service.sql` | service_name on reviews + index. |
| 21 | `20260627000000_hammerex_xrated_addons_shop_mode.sql` | addons_enabled jsonb + `hammerex_xrated_products` + `hammerex_xrated_shipping_zones`. |
| 22 | `20260627010000_hammerex_xrated_addons_phase1b.sql` | products.kind/unit/category + reviews.product_id. |
| 23 | `20260627020000_xrated_downloads.sql` | Downloads + download_leads tables. |
| 24 | `20260627030000_xrated_job_diary.sql` | xrated_projects + project_updates + project_removal_requests. |
| 25 | `20260627040000_xrated_wholesale_mode.sql` | products.bulk_tiers + listings yard origin cols + wholesale_zones table. |
| 26 | `20260627050000_xrated_materials_network.sql` | merchant_picks + merchant_referrals + push_log stub + commission cols + earnings VIEW. |
| 27 | `20260627060000_xrated_lead_alerts.sql` | push_subscriptions table. |
| 28 | `20260627070000_xrated_storefront.sql` | products.slug + featured_at + search_tsv GIN. |
| 29 | `20260627080000_xrated_custom_domain.sql` | custom_domain_* cols + custom_domain_events audit table. |
| 30 | `20260627090000_xrated_faq_page.sql` | faq_items + faq_images tables (with triggers for caps). |
| 31 | `20260628000000_xrated_product_details_tabs.sql` | products.specs + features + video_url. |
| 32 | `20260628010000_xrated_phone_calls_enabled.sql` | listings.phone_calls_enabled bool. |
| 33 | `20260628020000_xrated_brand_studio.sql` | font_family + font_scale + body_text_color. |
| 34 | `20260628030000_xrated_service_radius.sql` | service_radius_km. |
| 35 | `20260628040000_xrated_shipping_modes.sql` | Extends retail_shipping_mode CHECK enum (pickup/uk_over_threshold). |
| 36 | `20260628050000_xrated_product_faq.sql` | products.faq jsonb (per-product Q&A). |
| 37 | `20260628060000_xrated_team_members.sql` | listings.team_members jsonb. |

**Apparent in-code-only consumers — see §8 for the full drift list.**

---

## 3. API routes — exhaustive table

> Every route under `src/app/api/`. HTTP method inferred from the exported handler names (`GET`/`POST`/`PATCH`/`DELETE`). Auth column: `none` (public), `edit_token` (magic-link constant-time compare against `listings.edit_token`), `cron_secret` (shared bearer), or `service` (only invoked from server contexts).

### 3.1 Listing lifecycle (root)

| Path | File | Method | Purpose | Auth |
|---|---|---|---|---|
| `/api/trade-off/create` | `src/app/api/trade-off/create/route.ts` | POST | Wizard insert. Geocodes, starts 30d trial, issues voucher, recomputes Standard. | none (open signup) |
| `/api/trade-off/update` | `src/app/api/trade-off/update/route.ts` | POST | Magic-link edit; constant-time `edit_token` check. | edit_token |
| `/api/trade-off/slug-available` | `src/app/api/trade-off/slug-available/route.ts` | GET? | Vanity-slug availability check. | none |
| `/api/trade-off/upload-photo` | `src/app/api/trade-off/upload-photo/route.ts` | POST | Multipart photo upload → Supabase Storage. | edit_token (O) |
| `/api/trade-off/report` | `src/app/api/trade-off/report/route.ts` | POST | Insert into reports table; trigger may hide listing. | none |
| `/api/trade-off/start-trial` | `src/app/api/trade-off/start-trial/route.ts` | POST | Promote listing to `app_trial` tier. | edit_token (O) |
| `/api/trade-off/request-upgrade` | `src/app/api/trade-off/request-upgrade/route.ts` | POST | Customer-facing upgrade enquiry. | none |
| `/api/trade-off/dismiss-upgrade-nudge` | `src/app/api/trade-off/dismiss-upgrade-nudge/route.ts` | POST | Stamp `upgrade_nudge_dismissed_at`. | edit_token |
| `/api/trade-off/verified-waitlist` | `src/app/api/trade-off/verified-waitlist/route.ts` | POST | Verified Plus waitlist application. | edit_token (O) |

### 3.2 Tracking / analytics

| Path | File | Method | Purpose | Auth |
|---|---|---|---|---|
| `/api/trade-off/track-view` | `src/app/api/trade-off/track-view/route.ts` | POST | Insert `hammerex_xrated_views` row. | none (anon beacon) |
| `/api/trade-off/track-view-end` | `src/app/api/trade-off/track-view-end/route.ts` | POST | Patch `ended_at`/`duration_seconds`. | none |
| `/api/trade-off/track-whatsapp-click` | `src/app/api/trade-off/track-whatsapp-click/route.ts` | POST | Bump click counter; logs to `push_log`. | none |

### 3.3 Projects (work gallery)

| Path | File | Method | Purpose | Auth |
|---|---|---|---|---|
| `/api/trade-off/projects/create` | `.../projects/create/route.ts` | POST | Add project row. | edit_token |
| `/api/trade-off/projects/update` | `.../projects/update/route.ts` | POST/PATCH | Edit fields. | edit_token |
| `/api/trade-off/projects/delete` | `.../projects/delete/route.ts` | POST/DELETE | Soft/hard delete. | edit_token |
| `/api/trade-off/projects/upload` | `.../projects/upload/route.ts` | POST | Before/during/after image upload. | edit_token |
| `/api/trade-off/projects/upsert` | `.../projects/upsert/route.ts` | POST | Single-row write helper. | edit_token |
| `/api/trade-off/projects/list` | `.../projects/list/route.ts` | GET | Editor list. | edit_token or none |
| `/api/trade-off/projects/close` | `.../projects/close/route.ts` | POST | Mark `completed`. | edit_token |
| `/api/trade-off/projects/reopen` | `.../projects/reopen/route.ts` | POST | Flip back to `live`. | edit_token |
| `/api/trade-off/projects/request-removal` | `.../projects/request-removal/route.ts` | POST | Public right-to-removal. | none |

### 3.4 Project updates (Job Diary posts)

| Path | File | Method | Purpose | Auth |
|---|---|---|---|---|
| `/api/trade-off/project-updates/post` | `.../project-updates/post/route.ts` | POST | New update row. | edit_token |
| `/api/trade-off/project-updates/upload` | `.../project-updates/upload/route.ts` | POST | Image upload (≤4 per update). | edit_token |
| `/api/trade-off/project-updates/list` | `.../project-updates/list/route.ts` | GET | Public + editor list. | none |
| `/api/trade-off/project-beacon/send` | `.../project-beacon/send/route.ts` | POST | Push project to subscribers. | edit_token (O) |

### 3.5 Lead photos + messages

| Path | File | Method | Purpose | Auth |
|---|---|---|---|---|
| `/api/trade-off/lead-photos` | `.../lead-photos/route.ts` | POST | Customer attaches photos at lead-time. | none |
| `/api/trade-off/messages` | `.../messages/route.ts` | POST | Contact-form insert into `_messages`. | none |
| `/api/trade-off/quote-upload` | `.../quote-upload/route.ts` | POST | Customer quote photo upload. | none |

### 3.6 Video

| Path | File | Method | Purpose | Auth |
|---|---|---|---|---|
| `/api/trade-off/video-upload-url` | `.../video-upload-url/route.ts` | POST | Signed upload URL. | edit_token |
| `/api/trade-off/video-save` | `.../video-save/route.ts` | POST | Persist final video URL + caption. | edit_token |

### 3.7 Products (Shop Mode)

| Path | File | Method | Purpose | Auth |
|---|---|---|---|---|
| `/api/trade-off/products/upsert` | `.../products/upsert/route.ts` | POST | Create/update product. | edit_token |
| `/api/trade-off/products/delete` | `.../products/delete/route.ts` | POST | Soft delete. | edit_token |
| `/api/trade-off/products/list` | `.../products/list/route.ts` | GET | Catalog list. | none |
| `/api/trade-off/products/reorder` | `.../products/reorder/route.ts` | POST | Sort-order patch. | edit_token |
| `/api/trade-off/products/siblings` | `.../products/siblings/route.ts` | GET | Compare-with picker source. | none |
| `/api/trade-off/products/search` | `.../products/search/route.ts` | GET | Tsvector search. | none |

### 3.8 Shipping zones

| Path | File | Method | Purpose | Auth |
|---|---|---|---|---|
| `/api/trade-off/shipping-zones/list` | `.../shipping-zones/list/route.ts` | GET | Per-listing zones. | none |
| `/api/trade-off/shipping-zones/upsert` | `.../shipping-zones/upsert/route.ts` | POST | Add/edit zone. | edit_token |
| `/api/trade-off/shipping-zones/delete` | `.../shipping-zones/delete/route.ts` | POST | Remove zone. | edit_token |

### 3.9 Wholesale zones + origin + quote

| Path | File | Method | Purpose | Auth |
|---|---|---|---|---|
| `/api/trade-off/wholesale-zones/upsert` | `.../wholesale-zones/upsert/route.ts` | POST | Banded pricing zone. | edit_token |
| `/api/trade-off/wholesale-zones/list` | `.../wholesale-zones/list/route.ts` | GET | Per-listing zones. | none |
| `/api/trade-off/wholesale-zones/delete` | `.../wholesale-zones/delete/route.ts` | POST | Remove zone. | edit_token |
| `/api/trade-off/wholesale-origin/upsert` | `.../wholesale-origin/upsert/route.ts` | POST | Yard origin lat/lng. | edit_token |
| `/api/trade-off/wholesale-quote` | `.../wholesale-quote/route.ts` | POST | Customer "set my location" → live quote. | none |
| `/api/trade-off/postcode-lookup` | `.../postcode-lookup/route.ts` | GET | Postcode → lat/lng helper. | none |

### 3.10 Reviews

| Path | File | Method | Purpose | Auth |
|---|---|---|---|---|
| `/api/trade-off/reviews` | `.../reviews/route.ts` | POST/GET | Submit + list reviews. | none (POST gated by review form) |
| `/api/trade-off/reviews/product-stats` | `.../reviews/product-stats/route.ts` | GET | Per-product rating aggregate. | none |

### 3.11 Downloads

| Path | File | Method | Purpose | Auth |
|---|---|---|---|---|
| `/api/trade-off/downloads/upload` | `.../downloads/upload/route.ts` | POST | File upload. | edit_token |
| `/api/trade-off/downloads/upsert` | `.../downloads/upsert/route.ts` | POST | Row insert/update. | edit_token |
| `/api/trade-off/downloads/delete` | `.../downloads/delete/route.ts` | POST | Soft delete. | edit_token |
| `/api/trade-off/downloads/list` | `.../downloads/list/route.ts` | GET | Editor + public list. | edit_token (editor scope) |
| `/api/trade-off/downloads/reorder` | `.../downloads/reorder/route.ts` | POST | Sort-order patch. | edit_token |
| `/api/trade-off/downloads/track-download` | `.../downloads/track-download/route.ts` | POST | Bump counter + capture email lead. | none |
| `/api/trade-off/downloads/leads` | `.../downloads/leads/route.ts` | GET | Editor view of leads. | edit_token |

### 3.12 Materials Network

| Path | File | Method | Purpose | Auth |
|---|---|---|---|---|
| `/api/trade-off/materials-network/picks/list` | `.../picks/list/route.ts` | GET | Tradie's curated merchants. | none |
| `/api/trade-off/materials-network/picks/upsert` | `.../picks/upsert/route.ts` | POST | Add/update pick. | edit_token |
| `/api/trade-off/materials-network/picks/delete` | `.../picks/delete/route.ts` | POST | Remove pick. | edit_token |
| `/api/trade-off/materials-network/picks/reorder` | `.../picks/reorder/route.ts` | POST | Drag-reorder. | edit_token |
| `/api/trade-off/materials-network/picks/suggestions` | `.../picks/suggestions/route.ts` | GET | Suggested merchants picker source. | none |
| `/api/trade-off/materials-network/referrals/create` | `.../referrals/create/route.ts` | POST | Customer WA quote → referral row. | none |
| `/api/trade-off/materials-network/referrals/list` | `.../referrals/list/route.ts` | GET | Tradie's earnings ledger. | edit_token |
| `/api/trade-off/materials-network/referrals/decline` | `.../referrals/decline/route.ts` | POST | Merchant declines referral. | edit_token (merchant) |
| `/api/trade-off/materials-network/referrals/fulfil` | `.../referrals/fulfil/route.ts` | POST | Merchant marks fulfilled + commission. | edit_token (merchant) |
| `/api/trade-off/materials-network/commission/upsert` | `.../commission/upsert/route.ts` | POST | Merchant edits rate + min. | edit_token |

### 3.13 Push subscriptions (Lead Alerts)

| Path | File | Method | Purpose | Auth |
|---|---|---|---|---|
| `/api/trade-off/push-subscriptions/subscribe` | `.../subscribe/route.ts` | POST | Register device. | edit_token |
| `/api/trade-off/push-subscriptions/unsubscribe` | `.../unsubscribe/route.ts` | POST | Remove device. | edit_token |
| `/api/trade-off/push-subscriptions/list` | `.../list/route.ts` | GET | Device list. | edit_token |
| `/api/trade-off/push-subscriptions/test` | `.../test/route.ts` | POST | Send test push. | edit_token |
| `/api/trade-off/push-subscriptions/update-settings` | `.../update-settings/route.ts` | POST | vibration/muted/quiet hours. | edit_token |
| `/api/trade-off/push-subscriptions/refresh` | `.../refresh/route.ts` | POST | Refresh credentials. | edit_token |

### 3.14 Custom Domain

| Path | File | Method | Purpose | Auth |
|---|---|---|---|---|
| `/api/trade-off/custom-domain/attach` | `.../attach/route.ts` | POST | Initiate Vercel attach. | edit_token |
| `/api/trade-off/custom-domain/verify` | `.../verify/route.ts` | POST | Re-check DNS. | edit_token |
| `/api/trade-off/custom-domain/disconnect` | `.../disconnect/route.ts` | POST | Detach + clear cols. | edit_token |
| `/api/trade-off/custom-domain/status` | `.../status/route.ts` | GET | Poll current state. | edit_token |
| `/api/cron/custom-domain-health` | `src/app/api/cron/custom-domain-health/route.ts` | GET | 6h health check, ≤100 domains/run. | cron_secret (Bearer) |

### 3.15 FAQ Page add-on

| Path | File | Method | Purpose | Auth |
|---|---|---|---|---|
| `/api/trade-off/faq-items/upsert` | `.../faq-items/upsert/route.ts` | POST | Create/update Q&A. | edit_token |
| `/api/trade-off/faq-items/list` | `.../faq-items/list/route.ts` | GET | Editor + public list. | edit_token (editor) |
| `/api/trade-off/faq-items/delete` | `.../faq-items/delete/route.ts` | POST | Archive Q&A. | edit_token |
| `/api/trade-off/faq-items/reorder` | `.../faq-items/reorder/route.ts` | POST | Sort-order patch. | edit_token |
| `/api/trade-off/faq-items/track-view` | `.../faq-items/track-view/route.ts` | POST | Bump `view_count`. | none |
| `/api/trade-off/faq-images/upsert` | `.../faq-images/upsert/route.ts` | POST | Add/update image. | edit_token |
| `/api/trade-off/faq-images/delete` | `.../faq-images/delete/route.ts` | POST | Remove image. | edit_token |
| `/api/trade-off/faq-images/reorder` | `.../faq-images/reorder/route.ts` | POST | Sort-order patch. | edit_token |

### 3.16 Add-ons toggle + PDP toggles

| Path | File | Method | Purpose | Auth |
|---|---|---|---|---|
| `/api/trade-off/addons/toggle` | `.../addons/toggle/route.ts` | POST | Flip an add-on slug in `addons_enabled`. | edit_token |
| `/api/trade-off/addons/pdp-toggle` | `.../addons/pdp-toggle/route.ts` | POST | Toggle PDP section flags (compare_section/qa/warranty_returns/spec_tab/delivery_tab). | edit_token |

### 3.17 Jobs (customer board)

| Path | File | Method | Purpose | Auth |
|---|---|---|---|---|
| `/api/trade-off/jobs/create` | `.../jobs/create/route.ts` | POST | Customer posts a job. | none |
| `/api/trade-off/jobs/upload-photo` | `.../jobs/upload-photo/route.ts` | POST | Photo upload. | none |
| `/api/trade-off/jobs/report` | `.../jobs/report/route.ts` | POST | Report job post. | none |

### 3.18 Listings sub-config

| Path | File | Method | Purpose | Auth |
|---|---|---|---|---|
| `/api/trade-off/listings/legal-links` | `.../listings/legal-links/route.ts` | POST | terms/privacy/returns/about URLs. | edit_token |
| `/api/trade-off/listings/retail-shipping` | `.../listings/retail-shipping/route.ts` | POST | Retail shipping mode + pence + areas + intl. | edit_token |
| `/api/trade-off/payment-methods` | `.../payment-methods/route.ts` | POST | `payment_methods` array. | edit_token |

### 3.19 The Yard (paid-only marketplace)

| Path | File | Method | Purpose | Auth |
|---|---|---|---|---|
| `/api/trade-off/yard/posts` | `.../yard/posts/route.ts` | GET/POST | Feed + create post. | edit_token (POST) |
| `/api/trade-off/yard/posts/[id]` | `.../yard/posts/[id]/route.ts` | GET/PATCH/DELETE | Single-post CRUD. | edit_token |
| `/api/trade-off/yard/posts/[id]/reactions` | `.../yard/posts/[id]/reactions/route.ts` | POST | Add/toggle emoji reaction. | edit_token |
| `/api/trade-off/yard/posts/[id]/contact` | `.../yard/posts/[id]/contact/route.ts` | POST | WA contact intercept; bumps counter. | none |
| `/api/trade-off/yard/my-products` | `.../yard/my-products/route.ts` | GET | Tradie's products for post-prefill. | edit_token |

### 3.20 Quotes (Quote Pipeline add-on)

| Path | File | Method | Purpose | Auth |
|---|---|---|---|---|
| `/api/trade-off/quotes` | `.../quotes/route.ts` | GET/POST | List + create quotes. | edit_token |
| `/api/trade-off/quotes/[id]` | `.../quotes/[id]/route.ts` | PATCH/DELETE | Update / delete one quote. | edit_token |

### 3.21 Misc

| Path | File | Method | Purpose | Auth |
|---|---|---|---|---|
| `/api/geo` | `src/app/api/geo/route.ts` | GET | Edge geo IP→ISO2 for phone picker. Runs on `runtime = 'edge'`. | none |

---

## 4. Seed data

### 4.1 `DEMO_TRADE_SEEDS` — 106 demo profiles

> Master file: `src/lib/demoTradeSeeds.ts` (2070 lines). Final exported array: `DEMO_TRADE_SEEDS` (line 2063).

**Composition** (`src/lib/demoTradeSeeds.ts:2063-2070`):

```
DEMO_TRADE_SEEDS = [
  ...DEMO_TRADE_SEEDS_CORE,                     // 39 — defined inline (the original trades)
  ...DEMO_TRADE_SEEDS_SERVICE_ADDITIONS,        // 10 — demoTradeSeeds-service-additions.ts
  ...DEMO_TRADE_SEEDS_INSTALLATION,             // 16 — demoTradeSeeds-installation.ts
  ...DEMO_TRADE_SEEDS_MANUFACTURE,              // 14 — demoTradeSeeds-manufacture.ts
  ...DEMO_TRADE_SEEDS_SALES,                    // 17 — demoTradeSeeds-sales.ts
  ...DEMO_TRADE_SEEDS_HIRE                      // 10 — demoTradeSeeds-hire.ts
];
// Total = 106
```

**`DemoTradeSeed` type** (`demoTradeSeeds.ts:12-56`):

- Identity: `trade_slug`, `profile_slug`, `display_name`, `trading_name`, `city`, `postcode_prefix`, `whatsapp` (Ofcom fiction range +44 7700 900XXX), `email`, `bio`
- Career: `years_in_trade`, `start_year`
- `priced_services[]` (`name`, `price`, `unit`, `description`)
- `faq_items[]` (`q`, `a`)
- Trust: `is_insured`, `insurance_cover_gbp`, `qualifications[]`, `trade_memberships[]`, `dbs_checked`, `has_own_transport`, `has_own_tools`
- Logistics: `minimum_job_gbp`, `free_site_visits`, `quote_availability`, `quote_turnaround_hours`, `current_status_note`, `availability`
- `reviews[]` (`customer_name`, `rating`, `title`, `body`, `service_name`, `project_type`, `avatar_url`)

### 4.2 `DEMO_TEAM_SEEDS` — team rosters per trade_slug

> File: `src/lib/demoTeamSeeds.ts`. Keyed by `trade_slug`, each value is a `DemoTeamMember[]` of 3-4 members.

- Type `DemoTeamMember` (`demoTeamSeeds.ts:20-26`): `name`, `role`, `years_experience`, `avatar_url` (randomuser.me portraits), `skills[]`.
- Authorial constraint: aim for ~40% female representation (comment at L9-12).
- Written to `hammerex_trade_off_listings.team_members` by the seed script.

### 4.3 Scripts

| Script | File | Purpose | When to run |
|---|---|---|---|
| `seed-demo-trades.mjs` | `scripts/seed-demo-trades.mjs` | Reads `DEMO_TRADE_SEEDS` + `DEMO_TEAM_SEEDS`, idempotent insert via `ON CONFLICT (slug)` into `hammerex_trade_off_listings` + `hammerex_xrated_reviews`. Hits Supabase Management API (project ref `msdonkkechxzgagyguoe`). | One-shot demo backfill on a fresh DB. Idempotent. |
| `backfill-review-avatars.mjs` | `scripts/backfill-review-avatars.mjs` | UPDATE every existing demo review row's `customer_avatar_url` based on the seed file. Keyed on `(listing_id, customer_name, body)`. | After bumping seeds with avatar URLs, since the main script SKIPS review insert when reviews already exist. |
| `apply-team-migration.mjs` | `scripts/apply-team-migration.mjs` | Reads `20260628060000_xrated_team_members.sql` and POSTs it via the Management API. | One-shot; useful when bypassing the Supabase CLI. |
| `inspectSchema.mjs` | `scripts/inspectSchema.mjs` | Dumps `information_schema.columns` for the two main tables. | Ad-hoc debugging. |

All four scripts read the access token from `C:\Users\Victus\hammer\.env.tools.local` — **note the cross-repo dependency**.

---

## 5. Trade taxonomy

### 5.1 `TRADE_OFF_TRADES` — 106 trades (matches demo count by design)

> File: `src/lib/tradeOff.ts:4-173`. Each entry: `{ slug, label, category_slug }`.

- 39 "core" trades (the original Phase 1 list): drywaller through site-canteen.
- 10 Phase 2 service additions (damp-proofer, drainage-engineer, chimney-sweep, tree-surgeon, pest-control, asbestos-removal, lead-worker, sash-window-restorer, post-construction-cleaner, garden-designer).
- 16 installation additions (door-fitter, flooring-installer, bathroom-fitter, conservatory-installer, solar-installer, ev-charger-installer, heat-pump-installer, smart-home-installer, garage-door-installer, gutter-installer, driveway-installer, fencing-installer, shutter-installer, aerial-satellite-installer, garden-room-installer, awning-installer).
- 14 manufacture additions (kitchen-manufacturer through steel-fabricator).
- 17 sales additions (timber-merchant through insulation-supplies).
- 10 hire additions (plant-hire through storage-container-hire).

**Helpers:** `tradeLabel(slug)`, `tradeOffSlugify(input)`, `buildListingSlug(name, city, suffix?)`, `whatsappDigits(input)`, `whatsappQuoteUrl(wa, name, label)`, `isReservedSlug(slug)`.

**`TRADE_OFF_REQUIRED_FIELDS`** (`tradeOff.ts:267-274`): `['display_name','primary_trade','city','whatsapp','email','bio']` — the completeness check in `/api/trade-off/create` that decides draft→live.

**`TRADE_OFF_RESERVED_SLUGS`** (`tradeOff.ts:284-316`): blocks routes like `signup`, `edit`, `admin`, `done`, `api`, `t`, `trade`, `trade-off`, plus B2B portal collisions (auth, cart, catalogue, checkout, order, settings, login, logout, register, new, search, explore, about, help, support, terms, privacy, report, hammerex, standard, verified).
**Slug rules** (`isReservedSlug`): 5-60 chars, `[a-z0-9-]`, no leading/trailing/double hyphen.

**`MERCHANT_GRADE_TRADES`** (`tradeOff.ts:188-197`) — 8 slugs that auto-get Shop Mode on every tier:
`building-merchant`, `builders-supplies`, `kitchen-fitter`, `stair-fitter`, `window-fitter`, `security-installer`, `tool-hire`, `heavy-machinery`.

**`HAMMEREX_STANDARD_BLURBS`** (`tradeOff.ts:208-221`): 6 product slug → blurb mappings (K9 plastering, K11 drywall, scaffolders kit, electrician pouch, plastering bag, drywall kit). Drives the auto-badge from past Hammerex quote-requests.

### 5.2 `tradeTemplateSections.ts` — 5-section gallery taxonomy

Sections: `service` | `installation` | `manufacture` | `sales` | `hire`.
`SECTION_META` provides display label + eyebrow + blurb per section.
`SECTIONS_BY_TRADE` (`tradeTemplateSections.ts:50-175`) — each trade_slug → array of sections. Defaults to `['service']` for any trade not explicitly listed.
Helpers: `sectionsForTrade(slug)`, `tradesInSection(section)`, `SECTION_ORDER` (`['service','installation','manufacture','sales','hire']`).

### 5.3 `tradeOffHeroes.ts` — banner art + fallback chain

- `TRADE_OFF_HERO_IMAGES` (`tradeOffHeroes.ts:9-108`): 50+ ImageKit URLs keyed by trade_slug.
- `BANNER_FALLBACK_BY_TRADE` (`tradeOffHeroes.ts:120-183`): slug → closest-sibling slug for Phase 2 trades without their own art. Chain-walked (with cycle protection) by `tradeHeroFor(slug)` (`tradeOffHeroes.ts:185-197`).
- Same fallback chain is used by the gallery page to pick the closest LIVE demo profile per Phase-2 card.

### 5.4 `isMerchantGradeTrade()`

`src/lib/tradeOff.ts:199-202`. Returns true if `MERCHANT_GRADE_TRADES` contains the slug. Used by `isShopModeOn()` in `xratedAddons.ts:370-382` to auto-on Shop Mode for catalog-native trades.

---

## 6. Add-on registry

> File: `src/lib/xratedAddons.ts`. `XRATED_ADDONS` array (`xratedAddons.ts:93-336`).

| Slug | Name | Price | Included with paid | Status | Editor path |
|---|---|---|---|---|---|
| `trusted_trades` | Trusted Trades | free | ✅ yes | ready | `trusted-trades` |
| `shop_mode` | Trade Center | £5/mo (500p) | ❌ | ready | `shop-mode` |
| `services_grid` | Services Prices | £4/mo (400p) | ❌ | ready | `services-prices` |
| `downloads` | Downloads | £2/mo (200p) | ❌ | ready | `downloads` |
| `job_diary` | Job Diary | £4/mo (400p) | ❌ | ready | `job-diary` |
| `wholesale_mode` | Wholesale Mode | £7/mo (700p) | ❌ | ready | `wholesale-mode` |
| `custom_domain` | Custom domain | £5/mo (500p) | ❌ | ready | `custom-domain` |
| `lead_alerts` | Lead Alerts | £4/mo (400p) | ❌ | ready | `lead-alerts` |
| `materials_network` | Materials Network | £3/mo (300p) | ❌ | ready | `materials-network` |
| `quote_pipeline` | Quote Pipeline | £5/mo (500p) | ❌ | ready | `quote-pipeline` |
| `faq_page` | FAQ Page | £2/mo (200p) | ❌ | ready | `faq-page` |

**Non-registry per-listing toggles** (helpers but no marketing surface):

- `compare_section` (default ON; `isCompareSectionOn`)
- `qa` (default OFF; `isQAOn`)
- `warranty_returns` (default ON; `isWarrantyReturnsOn`)
- `spec_tab` (default ON; `isSpecTabOn`)
- `delivery_tab` (default ON; `isDeliveryTabOn`)

**Predicate helpers** (`xratedAddons.ts:338-557`): `getAddonBySlug`, `isAddonEnabled`, `isShopModeOn`, `isStorefrontOn`, `isServicesGridOn`, `isDownloadsOn`, `isJobDiaryOn`, `isWholesaleModeOn`, `isLeadAlertsOn`, `isMaterialsNetworkOn`, `isCustomDomainOn`, `isFaqPageOn`, `formatAddonPrice`.

---

## 7. SEO + metadata

> File: `src/lib/seo.ts`.

- `siteUrl()` (`seo.ts:5-11`): reads `NEXT_PUBLIC_XRATED_SITE_URL` ?? `NEXT_PUBLIC_HAMMEREX_SITE_URL`, strips trailing slashes. Fallback `http://localhost:3008` (the dev port).
- `absolute(path)` (`seo.ts:13-17`): pass-through for full URLs, prepends `siteUrl()` otherwise.
- `BRAND` (`seo.ts:23-34`): `{ name: 'Xrated Trades', tagline: 'Your shareable trade profile', logo: supabase storage URL, whatsapp: env-driven (ADMIN_WHATSAPP / NEXT_PUBLIC_HAMMEREX_WHATSAPP, default +6281392000050), locale: 'en_GB' }`.
- `SEO_KEYWORDS` (`seo.ts:36-45`): static keyword list.
- `stripMarkdown(input)` (`seo.ts:50-67`): collapses markdown to plain text for OG/meta-description previews.
- `clampDescription(input, max=160)` (`seo.ts:69-74`).
- JSON-LD builders: `organizationJsonLd()` (`:76`), `websiteJsonLd()` (`:98`), `breadcrumbJsonLd(trail)` (`:108`), `faqJsonLd(faq)` (`:124`), `localBusinessJsonLd(listing, tradeLabelText)` (`:139-171`).
- `escapeXml(input)` (`:173-177`).

**OG image generation** — not in `seo.ts`. (O — likely lives in route-level `opengraph-image.tsx` files; check `src/app/**/opengraph-image*` if needed.)

---

## 8. Known schema drift / gaps

### 8.1 Columns referenced in `src/lib/supabase.ts` (or written by API routes) with NO migration in this repo

| Column / table | Where referenced | Notes |
|---|---|---|
| `twitter`, `snapchat`, `reddit`, `google` (socials) | `supabase.ts:35-39` | Type field only — no migration. **F** |
| `payment_methods text[]` | `supabase.ts:134`; `/api/trade-off/payment-methods/route.ts` | Written by API; no `ALTER TABLE` for it. **F** |
| `retail_shipping_uk_pence`, `retail_shipping_uk_areas`, `retail_shipping_international` | `supabase.ts:234-236`; `/api/trade-off/listings/retail-shipping/route.ts`; comments in `20260628040000` | The shipping-modes migration assumes these exist; only `retail_shipping_mode` itself is ever touched. **F — likely missing migration.** |
| `terms_url`, `privacy_url`, `returns_url`, `about_url` | `supabase.ts:212-215`; `/api/trade-off/listings/legal-links/route.ts` | No migration adds them. **F** |
| `paid_expires_at`, `last_payment_plan` | `supabase.ts:79-80` | No migration. The `hammerex_xrated_payments` table exists but the cached cols on the listing don't have an ALTER. **F** |
| `recommendations jsonb` | `supabase.ts:99` | Powers Trusted Trades; no migration. **F** |
| `product_kind` ('stock'|'install') on products | `supabase.ts:280` | No specific ALTER seen. **O** |
| `warranty_header`, `warranty_text`, `returns_text` on products | `supabase.ts:318-320` | No specific ALTER seen. **O** |
| `customer_avatar_url` on reviews | `scripts/backfill-review-avatars.mjs`; `src/app/trade/[slug]/page.tsx`; carousel/products review blocks | Backfill script explicitly notes "added after seeding" — no migration in this repo. **F** |
| `hammerex_xrated_quotes` (Quote Pipeline) | `supabase.ts:736-754`; `/api/trade-off/quotes/*` | No CREATE TABLE in `supabase/migrations/`. **F** |
| `hammerex_trade_off_verified_plus_applications` | `supabase.ts:764-779`; `/api/trade-off/verified-waitlist` | No CREATE TABLE. **F** |
| `hammerex_trade_off_yard_posts`, `hammerex_trade_off_yard_reactions` | `supabase.ts:791-845`; all `/api/trade-off/yard/*` routes | No CREATE TABLE. **F** |
| `hammerex_xrated_project_removal_requests` columns | Migration `20260627030000` mentions table; full column list not verified here. **O** |

**Hypothesis (O)**: The shared Supabase project also has migrations applied from the parallel `hammer` repo (Hammerex). The `trades` repo's `supabase/migrations/` directory was started fresh at `20260625100000` and tracks only the trade-side feature migrations. The hammer repo at `C:\Users\Victus\hammer\` is the canonical source for `hammerex_products`, `hammerex_quote_requests`, and possibly the missing tables/columns above.

### 8.2 Migrations with no obvious code consumer

None found. Every migration I inspected creates a table or column that is referenced by either a route, a type, or an editor component. The only "purely operational" migration is `20260625300000_hammerex_xrated_reviews_publish_cron.sql` which schedules a pg_cron job — its consumer is the cron job itself, not the app.

### 8.3 Code-side enums vs DB-side CHECK constraints

- `availability` (now/tomorrow/this_week/next_week/two_weeks/later): enforced in the editor + types ONLY (no CHECK constraint per `20260625200000`).
- `font_family`, `font_scale` defaults but no CHECK enum on the DB side — the type narrows them to 6 / 3 values respectively in code.
- `tier` HAS a CHECK constraint (`20260625120000`).
- `cta_button_effect`, `hero_text_effect`, `avatar_frame_style`, `profile_placement` ALL have CHECK enums per `20260625120000`.
- `custom_domain_status` HAS a CHECK enum.
- `retail_shipping_mode` HAS a CHECK enum (extended by `20260628040000`).

### 8.4 Cross-repo coupling

- `scripts/*.mjs` all read `C:\Users\Victus\hammer\.env.tools.local` for the Supabase access token. The `trades` repo cannot run its own seed/migration scripts without the `hammer` checkout.
- `BRAND.whatsapp` default falls back to `+6281392000050` (Indonesian number — likely a Hammerex admin contact carried over from the parent codebase).

---

## 9. Appendix — file inventory snapshot

- `src/lib/supabase.ts` — 845 lines. ~27 exported types.
- `src/lib/seo.ts` — 178 lines.
- `src/lib/tradeOff.ts` — 327 lines. 106 trades.
- `src/lib/tradeTemplateSections.ts` — 194 lines.
- `src/lib/tradeOffHeroes.ts` — 198 lines.
- `src/lib/xratedTrades.ts` — 81 lines.
- `src/lib/xratedAddons.ts` — 557 lines. 11 add-ons.
- `src/lib/countryDialCodes.ts` — 72 lines. 28 countries.
- `src/lib/demoTradeSeeds.ts` — 2070 lines (39 inline + 5 imported chunks).
- `src/lib/demoTradeSeeds-service-additions.ts` — 10 demos.
- `src/lib/demoTradeSeeds-installation.ts` — 16 demos.
- `src/lib/demoTradeSeeds-manufacture.ts` — 14 demos.
- `src/lib/demoTradeSeeds-sales.ts` — 17 demos.
- `src/lib/demoTradeSeeds-hire.ts` — 10 demos.
- `src/lib/demoTeamSeeds.ts` — keyed by trade_slug; 3-4 members each.
- `supabase/migrations/` — 37 SQL files (see §2).
- `src/app/api/` — 99 route files (see §3).
- `scripts/` — 4 `.mjs` scripts (see §4.3).
