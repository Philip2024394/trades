# Monetisation, Billing & Add-ons — Foundation Reference

> The complete paid surface. How tiers work, how add-ons stack, how billing flows, what happens on expiry.

---

## 1. Tier ladder

Three public tiers + a fourth ("Verified Plus") teased as application-only. **Pricing copy** lives in two places that currently disagree — flagged in §9.

### Public tier pricing (canonical — pricing page)

Defined in `src/app/trade-off/pricing/PricingTierCards.tsx:45-54`:

| Tier        | Monthly  | Annual    | Annual savings | URL                      |
|-------------|----------|-----------|----------------|--------------------------|
| Free        | £0       | £0        | —              | `hammerexdirect.com/trade/<slug>` |
| Paid        | £14.99   | £139.99   | £40 (~2.7 mo)  | `xratedtrade.com/<slug>`          |
| Verified    | £19.99   | £199.99   | £40            | `xratedtrade.com/<slug>` + ★ badge |
| Verified Plus | £29.99 | —         | (coming soon, by application) | same                  |

- **.99 psychological pricing** explicit at `PricingTierCards.tsx:42-44` ("`.99` endings for psychological-price impact").
- Annual default selected: `useState<Billing>("annual")` at `PricingTierCards.tsx:57`.
- Annual on Paid works out at **~£11.67/mo** displayed at `PricingTierCards.tsx:197`.
- Annual on Verified works out at **~£16.67/mo** displayed at `PricingTierCards.tsx:306`.

### Goldilocks / centre-stage logic

Confirmed at `PricingTierCards.tsx:20-22`:
> "Goldilocks / centre-stage effect pulls eyes from Paid → Verified because the £5 delta buys real trust differentiation."

The Verified card is the only one with a black background + glowing yellow shadow + "Recommended" pill (`PricingTierCards.tsx:260-277`). Visual weight is intentional and asymmetric: Free is plain white, Paid is white with thin yellow border, Verified is full black gradient + 4px outer ring.

### Trial (14-day) — code reality vs marketing reality

- **Marketing copy** says **14-day** trial, no card on signup (pricing page hero `page.tsx:159`, trial assurance bar `PricingTierCards.tsx:418-424`).
- **Code constant** in `src/lib/xratedTrades.ts:28` says `trialDays: 30` — **STALE** (see §9).
- The trial is auto-started by the create route at `src/app/api/trade-off/create/route.ts:182-190`, calling `startTrialFor(insert.data.id)` from `src/lib/xratedTier.ts:51-77`. That helper currently writes `now + trialDays * DAY_MS` using the **30-day** constant.

So on signup today:
1. Row inserts with `tier='app_trial'`, `trial_started_at=now`, `trial_expires_at=now+30d` (`xratedTier.ts:55-66`).
2. The customer-facing page tells them they have **14 days**.
3. The dashboard add-on hub treats them as paid (`AddOnsHub.tsx:27` — `isPaid = tier === "app_trial" || tier === "app_paid"`).

### Silent downgrade on expiry

`maybeExpireListingTier()` at `src/lib/xratedTier.ts:20-43` is the lazy expiry gate. Every dashboard render route (e.g. `src/app/trade-off/edit/[slug]/add-ons/page.tsx:51`, `src/app/trade-off/upgrade/page.tsx:78`) calls it inline. When `tier === 'app_trial'` AND `trial_expires_at <= now`, it flips `tier='app_expired'`. No cron — cron-less by design ("safe to call inline before render at <100-listing scale" — `xratedTier.ts:5`).

`effectiveTier()` at `src/lib/xratedTrades.ts:52-60` does the same collapse in the render path so an expired trial reads as `app_expired` even if the DB column hasn't been flipped yet.

---

## 2. Verified tier specifics

### WAITLIST_MODE confirmed

`src/app/trade-off/pricing/PricingTierCards.tsx:38`:
```ts
const WAITLIST_MODE = true;
```

When true (current), the Verified CTA goes to `/trade-off/verified-waitlist` (`PricingTierCards.tsx:327`). When flipped to false, it goes to `/trade-off/signup?tier=verified&billing=…` (`PricingTierCards.tsx:346`).

### Launch target — Q3 2026

- `src/app/trade-off/pricing/PricingTierCards.tsx:25-27`: "ships in WAITLIST_MODE: copy reads 'Verification launching Q3 2026 — locked at £19.99/mo for early subscribers'."
- `src/app/trade-off/verified-waitlist/page.tsx:88`: "Verified launches Q3 2026. Waitlist members get the price locked at £19.99/mo for life…"
- Pricing FAQ: `src/app/trade-off/pricing/page.tsx:154-156` answer "When does Verified launch?" → "Q3 2026".

### Required check + optional add-on badges

Defined in card copy `PricingTierCards.tsx:368-394`:
- **Required**: active company registration (Companies House or local registry). Verifies company exists, in good standing, applicant is director/named owner.
- **Optional badge 1**: "Insured for private work" — upload PL / EL certificate. Skip if covered by site principal contractor.
- **Optional badge 2**: "On-site checked" — for gas / electrical / structural / scaffolding. Credentials verified at work address.

The trust stack ("✓ Verified, ✓✓ Verified + Insured, ✓✓✓ Verified + Insured + On-site checked") is described at `PricingTierCards.tsx:14-23`.

### Pricing-lock scarcity messaging

- "**£19.99/mo locked for life** as a founding Verified member" — `verified-waitlist/page.tsx:55, 73`.
- "Locked for life" repeated on form confirmation `VerifiedWaitlistForm.tsx:72`.
- Same lock referenced on the pricing card hover text `PricingTierCards.tsx:340`.

### Waitlist API + storage

- `src/app/api/trade-off/verified-waitlist/route.ts` writes to `hammerex_verified_waitlist` table.
- Hardcoded `price_locked_gbp: 20` at `route.ts:66` — **fact-check flag**: copy says £19.99, lock value persists as `20`. This is the GBP integer of the lock-amount, not the price string.
- Falls back to console-log admin notification if table missing (`route.ts:74-78, 102-105`). No outbound WhatsApp yet (`route.ts:102-104` comments "Hooking in Twilio / WA Cloud is a separate task and out of scope").

### Verified tier in the listing schema

**Observation**: there is no `app_verified` value in the `tier` enum. The Verified tier is described in marketing as "everything in Paid + a badge" — at code level it must be expressed via a separate field once shipped. Currently no such column exists on the listing row (grep for `verified_status`, `verified_tier`, `is_verified` found nothing on listings — only the Verified Plus application table).

---

## 3. Add-on registry

Single source of truth: `src/lib/xratedAddons.ts`. The dashboard hub, public marketing page, and public-profile renderer all import from this file (`xratedAddons.ts:2-10`).

**Total catalogued: 11 add-ons. All availability: "ready". Zero "coming_soon".**

| Slug | Name | Monthly (pence / £) | Availability | includedWithPaid | hasEditor | editorPath | One-line effect |
|---|---|---|---|---|---|---|---|
| `trusted_trades` | Trusted Trades | free | ready | **true** | true | `trusted-trades` | 12-card recommendation directory + dedicated /trusted-trades page (`xratedAddons.ts:94-115`) |
| `shop_mode` | Trade Center | 500 / £5 | ready | false | true | `shop-mode` | Swaps services carousel for product catalogue + cart → WhatsApp enquiry. Auto-on for merchant-grade trades regardless of tier (`xratedAddons.ts:116-137`, `isShopModeOn()` at `xratedAddons.ts:370-382`) |
| `services_grid` | Services Prices | 400 / £4 | ready | false | true | `services-prices` | Priced service grid w/ unit picker (hour/sqm/tree/day) + dedicated /services-prices page (`xratedAddons.ts:138-159`) |
| `downloads` | Downloads | 200 / £2 | ready | false | true | `downloads` | PDF/Word brochures + email-gate option, auto-grouped by category (`xratedAddons.ts:160-181`) |
| `job_diary` | Job Diary | 400 / £4 | ready | false | true | `job-diary` | Live project updates + social share + auto-archived past-projects strip (`xratedAddons.ts:182-203`) |
| `wholesale_mode` | Wholesale Mode | 700 / £7 | ready | false | true | `wholesale-mode` | Bulk pricing tiers + distance-based delivery quote widget. **Auto-includes Storefront** (`xratedAddons.ts:204-225`, `isStorefrontOn()` at `xratedAddons.ts:390-397`) |
| `custom_domain` | Custom domain | 500 / £5 | ready | false | true | `custom-domain` | Point yourtrade.co.uk at profile; SSL handled. First 30 days free per `custom_domain_addon_active` flag (`xratedAddons.ts:226-247`, `supabase.ts:180`) |
| `lead_alerts` | Lead Alerts | 400 / £4 | ready | false | true | `lead-alerts` | PWA push the moment a customer taps WhatsApp; per-device subs in `hammerex_xrated_push_subscriptions` (`xratedAddons.ts:248-269`) |
| `materials_network` | Materials Network | 300 / £3 | ready | false | true | `materials-network` | Pick 12 merchants; earn referral fee; trust-based fulfilment ledger (`xratedAddons.ts:270-291`) |
| `quote_pipeline` | Quote Pipeline | 500 / £5 | ready | false | true | `quote-pipeline` | 4-column kanban CRM (Sent/Chasing/Accepted/Lost) + follow-up nudges (`xratedAddons.ts:292-313`) |
| `faq_page` | FAQ Page | 200 / £2 | ready | false | true | `faq-page` | Visual KB w/ ref-numbered images on dedicated /<slug>/faq page (`xratedAddons.ts:314-335`) |

### Hidden / unregistered add-on flags

Per-listing toggles that live in `addons_enabled` JSONB but are **not** in `XRATED_ADDONS` (so they don't appear on the marketing page or hub). Implemented as free per-profile preferences:

| Key | Default | Purpose |
|---|---|---|
| `compare_section` | ON | Compare-3 strip on PDP (`isCompareSectionOn()` at `xratedAddons.ts:486-491`) |
| `qa` | OFF | Q&A block on PDP (`isQAOn()` at `xratedAddons.ts:496-500`) |
| `warranty_returns` | ON | Warranty & Returns block on PDP (`isWarrantyReturnsOn()` at `xratedAddons.ts:507-512`) |
| `spec_tab` | ON | Spec tab on PDP details panel (`isSpecTabOn()` at `xratedAddons.ts:520-525`) |
| `delivery_tab` | ON | Delivery Details tab on PDP details panel (`isDeliveryTabOn()` at `xratedAddons.ts:532-537`) |

---

## 4. Add-on hub UX

### Where it lives

- Dashboard sub-page: `src/app/trade-off/edit/[slug]/add-ons/page.tsx` (off the main edit flow so "the create / edit flow stays focused on essentials" — `page.tsx:1-4`).
- Reachable via `DashboardDrawer` from any dashboard page.

### Toggle behaviour

- `AddOnsHub.tsx:36-67` — optimistic update, POST to `/api/trade-off/addons/toggle`.
- Coming-soon add-ons silently no-op on toggle (`AddOnsHub.tsx:37`). Currently none are coming-soon, so dead code.
- Paid add-ons toggling ON for non-paid listings silently no-op on the client (`AddOnsHub.tsx:38`) and explicitly 403 on the server (`addons/toggle/route.ts:75-80`).
- `includedWithPaid: true` add-ons render as "Included" + skip the toggle (`xratedAddons.ts:74-78`). Only `trusted_trades` matches this today.

### Marketing surface

`src/app/trade-off/add-ons/page.tsx` iterates `XRATED_ADDONS` into a 2-column card grid. Server-rendered, no client state. Each card shows:
- Hero image (or phone-frame illustration fallback when `image_url=null` — currently all null per registry inspection).
- Top-left editorial badge (`ADDON_BADGE_LABEL` from `xratedAddons.ts:84-91` — controlled vocab: most_flexible / best_for_solos / built_for_merchants / viral_growth / premium_credibility / any_trade).
- Top-right status pill (Available now / Coming soon — `add-ons/page.tsx:438-454`).
- Persona chips (`personas` array, rendered as outline pills `add-ons/page.tsx:357-366`).
- "What it does" summary + 3 benefit bullets.
- Bottom yellow "Included with paid" pill when `includedWithPaid && isReady` (`add-ons/page.tsx:423-432`).

### Editorial-badge philosophy

`xratedAddons.ts:21-30`: "Editorial badge — **honest categorisation we set ourselves, not a fabricated popularity number**. Real 'X tradies use this' counter is Phase 2 when we have 50+ paying users to source from."

---

## 5. Stripe integration

**Stripe is NOT wired.** No.

- Grep for `stripe|STRIPE|Stripe` across `src/` matched **one file only**: `src/app/trade-off/pricing/page.tsx` (a single FAQ line at `page.tsx:179` mentions "Stripe handles the FX at checkout" — purely marketing copy).
- No webhook handler, no subscription object, no checkout session, no Stripe SDK import.

### What IS wired in place of Stripe

**Manual WhatsApp confirmation flow.** From `src/app/api/trade-off/request-upgrade/route.ts:1-7`:
> "Returns a pre-formatted WhatsApp deep link the tradie can open to confirm they want to pay. We do NOT flip the row to `app_paid` here — that's admin-driven after payment is verified by hand. Manual review is fine at the scale we're at (<100 listings) and avoids us touching card data."

Flow:
1. Dashboard hits POST `/api/trade-off/request-upgrade` with `{ slug, edit_token, plan }`.
2. Server returns `whatsapp_url = wa.me/<adminDigits>?text=<pre-filled-upgrade-request>` (`request-upgrade/route.ts:71-83`).
3. Customer opens WhatsApp, sends the canned message.
4. Admin manually verifies payment (off-platform) and flips `tier='app_paid'` in Supabase by hand.

### Where webhooks WOULD land

No `/api/stripe/*` route exists. If/when Stripe ships, the natural landing zone would be `src/app/api/stripe/webhook/route.ts` mirroring other webhook patterns in the repo. The flip target is `tier='app_paid'` + `paid_expires_at = period_end` + `last_payment_plan = 'monthly'|'annual'`.

---

## 6. Listing-record tier columns

All in `src/lib/supabase.ts:75-80, 129`:

```ts
tier: "standard" | "app_trial" | "app_paid" | "app_expired";
trial_started_at: string | null;
trial_expires_at: string | null;
paid_expires_at: string | null;
last_payment_plan: "monthly" | "annual" | null;
// …
addons_enabled: Record<string, boolean>;
```

### Field semantics

| Column | Purpose |
|---|---|
| `tier` | Stored state. Four values; `app_expired` is the silent-downgrade landing. **No `app_verified` exists.** |
| `trial_started_at` | Timestamp of trial start (used for analytics + nudges). |
| `trial_expires_at` | Drives `effectiveTier()` and `maybeExpireListingTier()`. |
| `paid_expires_at` | Used by `xratedMember.ts:42-54` to gate annual-member-only perks (Hammerex discount). Currently nullable; treated as "no expiry" when null. |
| `last_payment_plan` | `'monthly' \| 'annual' \| null`. Used by `tradeAppBanners.ts:33` to surface the "5% Hammerex" annual perk. |
| `addons_enabled` | JSONB `{ slug: bool }`. Single source of toggle state. Defaults to `{}`; helpers read with `?? {}` everywhere. |

### Verified-related

No `verified_status`, `verified_at`, `verified_badge_count`, `insured_badge`, or `onsite_checked_badge` columns exist on `hammerex_trade_off_listings`. Verified is **schema-incomplete** — the marketing/waitlist surface exists; the persisted-listing surface does not.

### Verified Plus

`HammerexTradeOffVerifiedPlusApplication` type at `supabase.ts:756-779` — separate application table (`status: 'applied' | 'in_review' | 'approved' | 'rejected'`). Does not back a tier-column value.

### Custom Domain billing

`custom_domain_addon_active` at `supabase.ts:208`: "free first 30 days, then auto-charge. Drives the billing reconciliation job — not the route gate."

---

## 7. Expiry + downgrade behaviour

### When `trial_expires_at` passes

1. Next dashboard render calls `maybeExpireListingTier()` (`xratedTier.ts:20-43`).
2. Row flips `tier='app_expired'`. Idempotent — guarded by `.eq("tier", "app_trial")` so concurrent flips no-op.
3. Render path collapses anything still showing `app_trial` to `app_expired` via `effectiveTier()` (`xratedTrades.ts:52-60`) — covers the race window before the DB write lands.

### When `paid_expires_at` passes

Not eagerly enforced in code — `paid_expires_at` is consulted by `xratedMember.ts:42-54` for the annual-member Hammerex-discount check only. There is **no helper that flips `app_paid → app_expired`** when `paid_expires_at` elapses. Implicit observation: this gap doesn't matter today because there are no real `app_paid` rows (no Stripe → admin flips them by hand).

### URL redirect on downgrade

Marketing copy promise (`pricing/page.tsx:163`):
> "the URL flips from xratedtrade.com to hammerexdirect.com (with a 301 redirect so old shared links still work)"

**Observation**: routing logic for this 301 redirect lives in middleware / Vercel host config — not verified in this scan.

### Data preservation

`PricingTierCards.tsx:253-256` ("On expiry" footer):
> "Silently downgrades to Free on hammerexdirect.com. Old links 301-redirect. Re-upgrade any time."

Pricing-page FAQ `pricing/page.tsx:163`:
> "Your reviews, photos, services, opening hours and team grid all stay. What changes: the URL flips… the Xrated header appears, and the paid-only widgets hide (video, contact form, Meet-the-team, service prices)."

No `DELETE` paths fire on downgrade — only the render gates change. Re-upgrade restores everything because data is preserved in place.

### Re-upgrade path

`UpgradePage` at `src/app/trade-off/upgrade/page.tsx`:
- Renders tier explainer, current-tier badge, and `UpgradeActions` when token is valid.
- `canStartTrial` is true when `tier === 'standard' || effective === 'app_expired'` (`upgrade/page.tsx:94-97`) — note this lets an expired trial start a NEW trial. Likely unintentional.

---

## 8. ARPU math (descriptive, not predictive)

These are **literal arithmetic sums** of registry prices + tier prices. They are facts about what code charges, not market predictions.

### Solo electrician on Verified + Lead Alerts + FAQ Page

| Line | £/mo |
|---|---|
| Verified tier | 19.99 |
| Lead Alerts add-on | 4.00 |
| FAQ Page add-on | 2.00 |
| **Total monthly** | **£25.99** |

Annual equivalent: Verified £199.99 + (Lead Alerts £4 × 12) + (FAQ £2 × 12) = **£199.99 + £48 + £24 = £271.99** if add-ons are billed at face-value monthly on top. The pricing copy does not state whether annual Verified extends annual savings to add-ons; current marketing displays add-on prices as `£X/mo` only.

### Merchant on Paid + Trade Center + Wholesale Mode + Custom Domain

Trade Center (Shop Mode) is **auto-on at no add-on charge** for merchant-grade trades (`xratedAddons.ts:357-382` — `isMerchantGradeTrade()` covers kitchen-fitter, stair-fitter, building-merchant, builders-supplies, tool-hire, heavy-machinery, window-fitter, security-installer). For these trades the £5 Trade Center fee does **not** apply.

For a merchant on Paid:

| Line | £/mo |
|---|---|
| Paid tier | 14.99 |
| Trade Center | 0 (auto-on for merchant-grade trade) |
| Wholesale Mode (also auto-includes Storefront — `isStorefrontOn` at `xratedAddons.ts:390-397`) | 7.00 |
| Custom Domain | 5.00 (first 30 days free per `custom_domain_addon_active`) |
| **Total monthly** (after 30d) | **£26.99** |

Annual equivalent: Paid £139.99 + Wholesale £84 + Custom Domain £60 = **£283.99** post-30d-free-period (face value of add-ons × 12).

### Annual savings preserved

Annual savings apply at tier level only — flat £40 saving on both Paid (£139.99 vs £179.88) and Verified (£199.99 vs £239.88). Confirmed at `PricingTierCards.tsx:45-54` and "Save £40" pill at `PricingTierCards.tsx:93-95`. Add-on annual pricing is not implemented.

---

## 9. Known gaps

### Pricing/copy inconsistencies

1. **Trial-length mismatch** — marketing copy says **14 days** everywhere customer-facing (`pricing/page.tsx:138-158`, `PricingTierCards.tsx:170` trial pill, `pricing/page.tsx:6-7` page-level comment). Code constant in `src/lib/xratedTrades.ts:28` is `trialDays: 30`. New signups today get 30 days, not 14. Either copy is wrong or the constant is stale.
2. **Stale `XRATED_PRICING`** — `xratedTrades.ts:22-31` still says `monthlyGbp: 8, annualGbp: 80`. These constants are consumed by `src/app/trade-off/upgrade/page.tsx:129, 184, 192-214, 220` — so the in-dashboard upgrade page advertises **£8/mo, £80/yr** while the public pricing page advertises **£14.99/mo, £139.99/yr**. Two prices live in the app at once.

### Paid surfaces that don't actually charge

3. **Stripe is not wired at all.** Every paid tier and every paid add-on is theoretically billable but functionally relies on `request-upgrade/route.ts` shipping a WhatsApp deep link to the admin for hand-flipping. Net: nothing in the app moves money. `pricing/page.tsx:179` even mentions "Stripe handles the FX" as if it's wired — it isn't.
4. **`custom_domain_addon_active`** — `supabase.ts:208` says "free first 30 days, then auto-charge. Drives the billing reconciliation job". No billing reconciliation job exists.
5. **`paid_expires_at` has no enforcement helper.** `maybeExpireListingTier()` only handles `app_trial → app_expired`. An `app_paid` row whose `paid_expires_at` passes never auto-downgrades.

### Schema gaps

6. **No Verified persistence.** `tier` enum is `'standard' | 'app_trial' | 'app_paid' | 'app_expired'` — no `app_verified`. No `verified_status`, no `is_verified`, no badge columns. When WAITLIST_MODE flips false, there is no column for the upgrade to land in.
7. **Verified Plus application table exists** (`HammerexTradeOffVerifiedPlusApplication`) but has no UI surface scanned — only the £29.99 teaser card on the pricing page.
8. **Waitlist persistence is conditional** — `verified-waitlist/route.ts:54-82` will silently fall back to console.log if the `hammerex_verified_waitlist` table is missing (migration unverified). The `price_locked_gbp` insert uses integer `20` while customer copy says £19.99.

### Coming-soon / consumer drift

9. **Every entry in `XRATED_ADDONS` is `availability: "ready"`.** Coming-soon code paths in `AddOnsHub.tsx:37`, `add-ons/page.tsx:442-454`, and `addons/toggle/route.ts:49-54` are dead today. Not a bug — just dead code.
10. **No `app_verified` or "Verified" tier filter** wired into the dashboard / addons gate. The `isPaid` check at `addons/toggle/route.ts:73` and `AddOnsHub.tsx:27` would need updating once Verified ships so Verified members can toggle paid add-ons.

### Top 3 gaps (priority order)

1. **Stripe is missing end-to-end.** Every "paid" surface is hand-flipped via WhatsApp. ARPU is theoretical at code level until this ships.
2. **Verified tier has no DB shape.** Marketing copy + waitlist exists; nothing in `hammerex_trade_off_listings` can persist Verified state. WAITLIST_MODE→false requires schema work first.
3. **Two contradictory pricing surfaces.** `xratedTrades.ts` constants say £8/mo + 30-day trial; `PricingTierCards.tsx` says £14.99/mo + 14-day. The dashboard `/trade-off/upgrade` page advertises the old £8 number while the public `/trade-off/pricing` page advertises £14.99. Same signup, two prices.
