# Xrated Trades / Trade Off — App Foundation

> Source-of-truth map of the entire codebase. Five domain-specific reference docs
> sit under `docs/foundation/`; this index summarises them, flags what's actually
> load-bearing, and records the engineering feedback after a full scan on
> 2026-06-28.

---

## Domain reference docs (read these for detail)

| # | Domain | File |
|---|--------|------|
| 01 | Public surfaces (every page a visitor can reach) | `docs/foundation/01-public-surfaces.md` |
| 02 | Tradesperson editor + dashboard | `docs/foundation/02-editor-dashboard.md` |
| 03 | Trade Center / commerce | `docs/foundation/03-trade-center-commerce.md` |
| 04 | Data layer + API routes + migrations | `docs/foundation/04-data-and-api.md` |
| 05 | Monetisation, billing & add-ons | `docs/foundation/05-monetisation-billing.md` |

When updating a feature, update the matching reference doc too — these are the
canonical "where does X live" map.

---

## Architecture TL;DR

- **Stack**: Next.js 16 (App Router) + Supabase (Postgres + Storage) + Tailwind CSS + TypeScript end-to-end.
- **Supabase project**: ref `msdonkkechxzgagyguoe` — **shared with the Hammerex side project**. Every table is `hammerex_*` prefixed. Cross-repo dependency on `C:\Users\Victus\hammer\.env.tools.local` for access token.
- **Hosting**: Vercel (per user memory — Cloudflare → Vercel migration in progress for the wider stack).
- **Auth model** *(fact)*: tradesperson edits use a UUID `edit_token` in a magic link, constant-time compared in every API route. **No Supabase Auth.** No email/OTP. The magic link IS the password.
- **Trade taxonomy**: 106 trades across 5 sections — Service / Installation / Manufacture / Sales / Hire. Defined in `src/lib/tradeOff.ts` and `src/lib/tradeTemplateSections.ts`.
- **Demo profiles**: 106 in production (39 core in `src/lib/demoTradeSeeds.ts` + 67 phase-2 spread across 5 split files). All have 3 reviews + gender-matched avatars + team rosters from `src/lib/demoTeamSeeds.ts`.
- **Banner art system**: explicit map in `src/lib/tradeOffHeroes.ts` with a fallback chain so phase-2 trades inherit on day one.
- **Routes**: 99 API route handlers under `src/app/api/`. 19+ Supabase tables documented.
- **Code volume**: ~45k LoC public surfaces, ~16.7k LoC commerce, ~5-6k LoC editor dashboard (rough — measured via agent scan).

---

## Pricing model (fact, from `PricingTierCards.tsx` + `xratedAddons.ts`)

**Three base tiers**
| Tier | Monthly | Annual | Notes |
|------|---------|--------|-------|
| Free | £0 | £0 | hammerexdirect.com URL, basic widgets, forever |
| Paid | £14.99 | £139.99 (save £40) | brandable xratedtrade.com URL, white-label, 14-day premium trial without card |
| Verified | £19.99 | £199.99 (save £40) | Companies House check + optional Insured / On-site checked add-on badges. **Currently `WAITLIST_MODE = true` → waitlist until Q3 2026 launch.** |

**11 add-ons** (`src/lib/xratedAddons.ts`)
| Slug | Name | £/mo |
|------|------|------|
| trusted_trades | Trusted Trades | free |
| trade_center (slug=`shop_mode`) | Trade Center | £5 |
| services_grid | Services Prices | £4 |
| downloads | Downloads | £2 |
| job_diary | Job Diary | £4 |
| wholesale_mode | Wholesale Mode | £7 |
| custom_domain | Custom domain | £5 |
| lead_alerts | Lead Alerts | £4 |
| materials_network | Materials Network | £3 |
| quote_pipeline | Quote Pipeline | £5 |
| faq_page | FAQ Page | £2 |

ARPU math (descriptive, not predictive):
- Solo electrician on Verified + Lead Alerts + FAQ Page ≈ £25.99/mo
- Merchant on Paid + Trade Center + Wholesale Mode + Custom Domain ≈ £31.99/mo

---

# Engineering feedback — what's actually load-bearing

Honest assessment after the full scan. Critical findings first, ordered by blast radius.

## 🔴 Critical — load-bearing issues that could bite at launch

### C1. Stripe is not wired anywhere
- **Fact**: zero Stripe imports across `src/`. Single grep hit is a marketing FAQ line.
- **What "paid" actually does today**: `request-upgrade/route.ts` posts a WhatsApp deep link to admin → admin manually flips `tier='app_paid'` in Postgres.
- **Impact**: every paid surface (3 tiers + 10 paid add-ons) is theoretical at code level. ARPU = £0 until Stripe lands.
- **What needs to happen**: Stripe Checkout + webhooks → updates `tier` and `addons_enabled` columns → `paid_expires_at` automation. Add-on toggles need per-slug subscription items, not a single flat sub.

### C2. Verified tier has no DB column
- **Fact**: `tier` enum is `standard | app_trial | app_paid | app_expired`. There is no `app_verified` value (`src/lib/supabase.ts`).
- **Impact**: when `WAITLIST_MODE` flips to `false` in Q3 2026, there's nowhere for the upgrade to land.
- **What needs to happen**: schema migration to extend the enum + UI badge wiring + verification ops queue.

### C3. Two contradictory pricing surfaces in production
- **Fact**:
  - `src/lib/xratedTrades.ts:25-31` still says **£8/mo, £80/yr, 30-day trial**.
  - `src/app/trade-off/pricing/page.tsx` advertises **£14.99/mo, £139.99/yr, 14-day trial**.
  - `src/app/trade-off/upgrade/page.tsx` (existing tradies' dashboard) reads the stale constants → shows £8.
  - New signups also get 30 days because `startTrialFor()` reads the same constants.
- **Impact**: existing tradesperson upgrades for £8, marketing converts at £14.99 — bookings break revenue model. Trial length mismatch is a customer-trust issue.
- **What needs to happen**: single source of truth. Delete the constants in `xratedTrades.ts` or re-point `pricing/page.tsx` and `PricingTierCards.tsx` to read from there.

### C4. Massive schema drift — code writes to columns/tables that don't exist in migrations
**Columns referenced in code without a migration**:
- `twitter`, `snapchat`, `reddit`, `google` socials on `hammerex_trade_off_listings`
- `payment_methods text[]` (written by `/api/trade-off/payment-methods`)
- `retail_shipping_uk_pence` / `_uk_areas` / `_international`
- `terms_url`, `privacy_url`, `returns_url`, `about_url` (legal-links route)
- `paid_expires_at`, `last_payment_plan` on listings
- `recommendations jsonb` (Trusted Trades)
- `product_kind`, `warranty_header`, `warranty_text`, `returns_text` on products
- `customer_avatar_url` on reviews (added today — patched via backfill, no migration)

**Whole tables referenced by routes with no `CREATE TABLE` migration**:
- `hammerex_xrated_quotes`
- `hammerex_trade_off_verified_plus_applications`
- `hammerex_trade_off_yard_posts`
- `hammerex_trade_off_yard_reactions`

**Best-case explanation**: these live in the Hammerex side repo's migrations (shared Supabase project). **Worst-case**: prod is one fresh deploy away from runtime failure.
- **What needs to happen**: audit which side owns each migration. Write a "trades-side" migration set that codifies what trades depends on. Run `pg_dump --schema-only` to reality-check.

### C5. 10 TypeScript errors in commerce code
All pre-existing, all in the merchant-facing paid surface where ARPU is highest:
1. `src/app/trade-off/edit/[slug]/page.tsx:162` — starter-product slot 4 missing `gallery_urls`, `faq`
2. `src/app/trade-off/signup/TradeOffForm.tsx:165` — starter-product slot 4 missing 5 fields
3. `src/app/trade/[slug]/shop/[productSlug]/page.tsx:394` — `retail_shipping_mode` includes `"pickup" | "uk_over_threshold"` but downstream prop doesn't accept them
4. `src/components/xrated/profile/ProductModal.tsx:116` — variant axis widened to `model | material | custom`, renderer typed `"size" | "colour"`
5. `src/components/xrated/profile/ProductPageAddToCart.tsx:49` — same
6. `src/components/xrated/profile/ServiceModal.tsx:79` — same
7-10. `src/lib/demoTradeSeeds.ts:67-71` — `.ts` import-path extensions need a tsconfig flag (used so Node ESM can resolve at runtime — TypeScript flag fix is `--allowImportingTsExtensions` or `moduleResolution: bundler`)

- **What needs to happen**: schema-first rebuild of the variant + shipping type — propagate the widened union types down to every renderer. 2-4 hours of focused TS work.

### C6. `paid_expires_at` has no enforcement helper
- **Fact**: `maybeExpireListingTier()` only handles `app_trial → app_expired`, not `app_paid → app_expired`.
- **Impact**: when paid subscriptions lapse, profiles don't auto-revert to free. The "silent downgrade to hammerexdirect.com" promise in the marketing copy isn't enforced.
- **What needs to happen**: extend `maybeExpireListingTier()` + a daily cron (pg_cron or Vercel cron) to scan + downgrade.

---

## 🟡 Important — should fix before scaling

### I1. Dead code in `trade/[slug]/page.tsx`
- File is 1389 lines. `StandardLayout` (lines 1099-1388) appears unused per the page's own "Single render path" comment at line 439.
- **Risk**: contains the only QR-download link — removing blindly will break that surface.
- **Action**: extract QR link to a small component, delete the dead 290-line block.

### I2. Unmounted but exported components in the editor
- `FirstRunChecklist`, `WelcomeKnifeCard`, `TierStatusCard`, `SecondaryTradesPicker` are all exported and built but never mounted (`edit/[slug]/page.tsx:423-577`, `TradeOffForm.tsx:380-382`).
- **Action**: either mount them or delete them. Drift creates "is this used?" confusion every time someone reads the editor.

### I3. `UPDATABLE_STRING_FIELDS` whitelist silently drops fields
- `update/route.ts:49-95` — any field name not in the explicit array is silently ignored, no error returned.
- **Risk**: every new editor that posts a new field needs a manual whitelist update. Silent failures are the worst kind.
- **Action**: either log/return when an unknown field arrives, or generate the whitelist from the schema.

### I4. Slug change has no old-slug redirect
- `TradeOffForm.tsx:681-685` warns the user but the redirect itself doesn't exist anywhere.
- **Impact**: every printed business card / QR code / WhatsApp share gets 404'd the moment someone changes their slug.
- **Action**: `hammerex_trade_off_slug_redirects` table + `[slug]` middleware lookup.

### I5. Inconsistent trade count across surfaces
- Landing strip says **"30 Trades"** (`TRADES_SUPPORTED` const, `trade-off/page.tsx:73`).
- Gallery says **"100+ trades · 5 categories"** (`TRADE_OFF_TRADES.length`).
- **Action**: single source — pull both from `TRADE_OFF_TRADES.length`.

### I6. Hard-coded `63` floor on "live tradies" counter
- `trade-off/page.tsx:56` — hides cold-start, but no comment trail.
- **Action**: real count from DB, or at minimum a comment explaining the floor and a flip date.

### I7. Multi-currency module ported but not needed
- `src/lib/fx.ts` + `CurrencyDropdown` + `PriceDisplay` — adds complexity for a UK-only product. Ported line-for-line from Hammerex.
- **Action**: either delete (since canonical price is always GBP) or simplify to a display-only badge.

### I8. Add-ons have `editor_path` but the registry has no `coming_soon` items today
- Every add-on is `availability: "ready"`, yet most have no consumer fully wired (e.g. Wholesale Mode, Quote Pipeline, Lead Alerts).
- **Risk**: marketing the add-on hub creates an expectation the editor doesn't meet.
- **Action**: honest `availability` flags + grey-out coming-soon tiles.

---

## 🟢 Strengths — what's genuinely solid

- **The taxonomy**: 106 trades in 5 sections is real content depth. Competitors won't replicate cheaply.
- **Demo profile coverage**: 106 demos with realistic UK 2026 data, gender-matched avatars, team rosters, region-realistic names. Visitor never sees a "coming soon" placeholder.
- **Fallback chains** (banner, demo) — new trades inherit something sensible on day one.
- **Pricing model is layered + sophisticated**: tier ladder + 11 add-ons + 14-day no-card trial + soft downgrade + waitlist scarcity-lock for Verified. The thinking is there even though the Stripe wire-up isn't.
- **Trade Center is a real wedge**: catalogue + cart for merchants is something Checkatrade / MyBuilder don't do.
- **Edit-token magic link** is simple, secure (constant-time compare), and matches how UK tradies actually use email.
- **Composite cart key** (`xrated_cart_v1::<slug>`) means two profiles on one device never merge carts — well thought through.
- **Materials Network** with privacy-walled commission ledger — that's a sophisticated trust play.
- **Seeding discipline** — idempotent on slug, splits across 5 files to avoid bloat, separate backfill for one-shot fixes.

---

## Recommended fix order

If pushed hard, this is what I'd ship in order. P0 = blocks revenue. P1 = embarrasses you in front of a first paying customer. P2 = tech debt that compounds.

### P0 (before charging anyone money)
1. **C3** — collapse the two pricing sources of truth. Either £14.99 everywhere or £8 everywhere. Pick. Today's fix.
2. **C1** — wire Stripe. Checkout + webhooks + tier flip + add-on attach. ~1 week.
3. **C6** — paid expiry enforcement helper + daily cron. ~1 day.
4. **C4** — codify the schema. Audit every drifted column. Write the missing trades-side migrations. ~2 days.

### P1 (before the first 50 paying tradies)
5. **C5** — fix the 10 commerce TS errors. The variant + shipping union types need to propagate. ~half day.
6. **C2** — extend `tier` enum + verified badge wiring + ops queue staffing path.
7. **I3** — fix `UPDATABLE_STRING_FIELDS` silent failure. Future editor work depends on this.
8. **I4** — old-slug redirect. Critical the moment a paying customer changes their slug.

### P2 (cleanup before scaling)
9. **I1** — delete `StandardLayout` dead code.
10. **I2** — mount or delete the unmounted exports.
11. **I5 + I6** — single source for trade count + remove hard-coded floor.
12. **I7** — multi-currency cleanup.
13. **I8** — honest `availability` flags on add-ons.

---

## Future-Claude breadcrumbs

If a future session needs to find something fast:

| You want… | Look in… |
|----------|---------|
| Add a new trade | `src/lib/tradeOff.ts` + `tradeTemplateSections.ts` + `tradeOffHeroes.ts` (banner) + optional seed in one of the 5 `demoTradeSeeds-*.ts` files |
| Add a new add-on | `src/lib/xratedAddons.ts` (registry) → wire into `addons_enabled` consumers |
| Change pricing | `src/app/trade-off/pricing/PricingTierCards.tsx` *and* `src/lib/xratedTrades.ts` (see C3 — these conflict) |
| New API route | `src/app/api/trade-off/<name>/route.ts` — read `update/route.ts` for the edit_token pattern |
| Edit dashboard surface | `src/components/trade-off/<Name>Editor.tsx` — see doc 02 for the full list of 41 |
| New profile section | `src/components/xrated/profile/` — see doc 01 |
| New Supabase column | Write a migration in `supabase/migrations/`. **Do not skip this step.** Drift is already a problem (C4). |
| Seed a new demo | Add to the matching `demoTradeSeeds-<section>.ts` file (don't grow the core file) |
| Verify a deploy | `node scripts/seed-demo-trades.mjs` + `node scripts/backfill-review-avatars.mjs` + `node scripts/apply-team-migration.mjs` |

---

## Bottom line

The build is genuinely strong. The taxonomy + demo coverage + pricing design are ahead of what most pre-revenue UK trades-tech ships with.

**What's blocking revenue**: Stripe (C1) and the two contradictory pricing surfaces (C3). Both fixable in <2 weeks.

**What's blocking trust at scale**: schema drift (C4) and the Verified tier ops queue (C2 + tied to the Q3 2026 timeline).

**What's blocking polish**: the 10 commerce TS errors (C5) live in the highest-ARPU surface. Worth a dedicated half-day before any merchant onboarding.

Everything else is normal pre-launch tech debt.

— Captured 2026-06-28.
