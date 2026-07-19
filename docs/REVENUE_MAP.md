# Revenue Map — Thenetworkers

**Purpose.** Every way the platform makes money, ordered by margin + strategic weight. Complements `docs/features/index.md` (what) and `docs/BLUEPRINT.md` (where).

**Constitutional rules that shape every line item:**
- **ADR-0003** — Never sell leads. No commission. Ever.
- **ADR-0010** — Every paid feature ≥95% net-to-us at money-in, min £4.99, `.99` suffix.
- **ADR-0006** — Vehicle-metaphor tier pricing (Push bike → Motor bike → Van → Jeep).
- **`project_evidence_or_silence.md`** — No fabricated stats or fake pricing anchors.
- **`project_stripe_margin_safe_pricing.md`** — Video packs are the reference add-on shape.

---

## 1 — Merchant subscriptions (core recurring)

Path to Philip's €2k/mo retirement target: 170 paying merchants.

**CANONICAL TIER CATALOGUE** — source of truth is `src/lib/tierCatalog.ts`.
Any doc/UI drift from there is a bug. Regenerated 2026-07-17 launch.

| Tier | Monthly | Annual | Washers/mo | Products | Beacon slots | AI Vis /mo | Store disc. |
|---|---:|---:|---:|---:|---:|---:|---:|
| Free | £0 | — | 10 signup only | 10 cap | 3 | 0 | 0% |
| Starter | £9.99 | £99.99 | 50 (£4.99 value) | unlimited | 3 | 0 | 0% |
| Professional | £14.99 | £140 | 200 (£14.99 value) | unlimited | 3 (priority) | 5 | 20% |
| Business | £24.99 | £240 | 1,000 (£49.99 value) | unlimited | 5 | 20 | 40% |
| The Works | £39.99 | £399 | unlimited | unlimited | 5 | unlimited | 100% (free) |

Every tier from Starter up includes a **monthly washer credit** replenished on the 1st via `/api/cron/monthly-washer-replenish`. Washer credit is the biggest single value lever — Professional's £14.99/mo tier includes £14.99 of washers so the subscription effectively pays for itself.

Free tier: Linktree-style "Powered by The Network — build your own free" CTA appears on every Free canteen footer (viral acquisition loop). Also carries every prospective-visitor via `?mref=` param so referrer merchant earns the 50-washer signup reward.

Waitlist status (2026-07-17): all 5 tiers **live**. Starter + Business off waitlist per launch spec.

**Margin:** Stripe fee ~2.9% + 20p. £7.99 → net ~£7.55. £15.99 → net ~£15.34. All clear ADR-0010 (≥95%).

**Growth levers:** Merchant referral loop (`?mref=<slug>`) queues 50/200-washer rewards for both sides — self-fund, no cash. Third-party affiliate program pays £10/referral cash — parallel channel.

---

## 2 — Washers (WhatsApp lead monetization)

1 washer = 1 verified WhatsApp lead delivered to a merchant. See `project_washers_lead_gen_model.md`.

| Pack | Price | Per lead | Volume for | Status |
|---|---:|---:|---|---|
| Free | £0 | £0 | 10 one-off leads at signup | live |
| 50 | £4.99 | £0.10 | Small trades | live |
| 200 | £14.99 | £0.075 | Regular trades | live |
| 1,000 | £49.99 | £0.050 | Merchants + volume trades | live |

**Auto-topup default-on.** When washer bag hits zero on a paid tier, next-pack purchases fire automatically. Refund via `/admin/(authed)/red-zone`.

**Margin:** Fixed cost per lead is ~£0 (deep-link only, no WhatsApp Business API). Net effectively 97%+ after Stripe.

**Why the model works:** Homeowner→trade contact CTAs use FORM friction (name+email+description ≥60 chars) as the qualifier — not washers (`feedback_form_gate_not_washer_for_contact.md`). 10:1 tyre-kicker ratio is normal. Washers only fire on serious WhatsApp intent.

---

## 3 — Site Interest (B2B image store)

Standalone B2B channel selling hand-curated UK trade imagery. See `project_image_tier_routing_rule.md`.

| Purchase | Price | Notes | Status |
|---|---:|---|---|
| Single image | £10 | 4 crops (Instagram/Website/Mobile/Full) | live |
| Pack (5 img) | £39 | £7.80/img | live |
| Pack (10 img) | £69 | £6.90/img | live |
| Pack (30 img) | £149 | £4.97/img | live |
| Monthly membership | £29/mo | Unlimited downloads | live |
| Annual membership | £249/yr | Save 28% vs monthly | live |

**Anti-theft:** Layer 1-5 preview protection (canvas render, 720px cap, subject watermark, right-click blockers) + Layer 4 stego (LSB payload + IPTC + aHash registry) on every paid download. Traceable to buyer email.

**Margin:** Zero marginal cost (AI-generated + hosted on ImageKit CDN). Net ~£9.71 per single, ~£28.14 per monthly sub after Stripe.

**Current library:** ~100 tier-2/3 images. Tier-4 archive (~50) held for Studio App Builder future use.

**Growth lever:** SEO surface (`store` gets `/store`, `/store/browse`, image detail pages). Also target designers via `SmartVisitorHook` `b2b-image` face on root landing.

---

## 4 — Xrated Trades done-for-you service

Setup + retainer tiers for merchants who don't want to self-serve. See `project_xratedtrade_done_for_you_service.md`.

| Tier | Setup (one-off) | Retainer (monthly) | What's included | Status |
|---|---:|---:|---|---|
| Starter | £297 | £29 | Profile setup, hero, up to 20 products | live |
| Pro | £597 | £79 | Starter + AI banners (3 revisions), review flywheel | live |
| Verified | £997 | £149 | Pro + Companies House verification, custom domain, priority slot | live |

**Delivery:** WhatsApp intake, 3-5 day SLA, 3-revision cap, AI banners at 2:1 aspect.

**Positioning:** Undercuts UK competitors 45–83% on 3-year cost. Retainer keeps merchant in the ecosystem long-term.

**Margin:** Bulk of setup is my time × hourly rate. Retainer is ~90% margin after Stripe if <2h/mo per merchant.

---

## 5 — App add-ons (per-app upsells)

Per-merchant paid features. See `/trade-off/edit/[slug]/add-ons` + ADR-0010 (Stripe-margin-safe).

**Note:** Apps + templates are currently **tier-inclusive** (merchant pays subscription tier → unlocks the bundle for that tier). NOT an a-la-carte "buy this template for £4.99" marketplace. That's a future build waiting on a real sellable catalogue. Don't scaffold the marketplace into empty shelves.


| Category | Examples | Price band | Status |
|---|---|---|---|
| Content | Video packs, AI banners | £4.99–£14.99 one-off | live |
| Interactive | AI Visualiser renders | £4.99+/render or subscription | live |
| Bureaucratic | Custom domain | monthly recurring | live |
| Bulk | Bulk-tier pricing | one-off setup | live |
| Bureaucratic | Trade Connections carousel | monthly recurring, default-on | live |
| Bureaucratic | Compare section on PDPs | default-on, may switch to paid | live |
| Discovery | Trusted Trades cross-promo | free (leg gen wedge) | live |

**All clear ADR-0010** — min £4.99 with `.99` suffix, ≥95% net.

---

## 6 — Boosts (one-off post promotion)

Merchant pays to boost a specific Yard post to a wider audience for N hours. Handled in Stripe webhook (`kind: "boost"`, metadata carries post_id + hours + unit_amount_pence).

Prices vary by duration. Status: live.

---

## 7 — Trade Center (marketplace)

**Zero commission** (ADR-0003). Merchants keep 100% of every sale.

Revenue for us comes from:
- **The Van/Jeep subscription tier** (paid recurring to list in Trade Center)
- **App add-ons** (bulk-tier pricing, compare section, etc.)
- **Merchant Pro tier** — £14.99/mo bundles all paid add-ons for building-merchant + builders-supplies trades only

Checkout path: cart = multi-merchant, Safe Trade (Stripe/PayPal/escrow) recommended, WhatsApp handoff demoted. Quote path is trade-only, in-platform structured messages (never WhatsApp).

---

## 8 — Third-party affiliate program

Cash referral program at `/admin/(authed)/affiliates` (campaigns / commissions / payouts / marketing / review-queue / tokens / landing pages).

- Cookie: `xrated_affiliate_ref` (numeric affiliate_id, 30-day)
- Commission: £10 per successful merchant paid-tier upgrade (campaign-configurable via `resolveActiveCampaign()`)
- Self-referral guard: matches WhatsApp — if the affiliate refers themselves, commission is cancelled (`self_referral` reason)
- Payouts: monthly, manual admin action at `/admin/(authed)/affiliates/payouts`

**Coexists with merchant-to-merchant referral** (in-kind washers, no cash). Different cookie, different reward.

---

## 9 — Homeowner side (currently zero direct revenue)

`/home`, Notebook, project vault, quote workspace — all **free forever**. Revenue is indirect via:
- More homeowners = more washer purchases on the merchant side
- Homeowner data feeds trade recommendations
- Long-tail: potential paid tiers for property professionals (letting agents, surveyors) — not built

Status: intentional. See ADR-0003 + `project_networkers_linktree_growth_playbook.md`.

---

## Revenue projections at 170 paid merchants

Ballpark assumptions:
- 40% on Canteen (£7.99), 40% on Van (£11.99), 20% on Jeep (£15.99)
- Blended ARPU ≈ £10.75/mo
- 170 × £10.75 = **£1,827/mo from subscriptions alone**

Add-on revenue (washers + apps + boosts + store):
- Assume £3.50/mo average per merchant on top of subs → 170 × £3.50 = **£595/mo**

Site Interest (independent of merchant count):
- 20 image sales/mo @ £10 = £200
- 5 monthly memberships @ £29 = £145
- **~£345/mo at low volume**

Done-for-you (independent):
- 2 setup/mo × £597 = £1,194 (one-off, not recurring)
- 15 active retainers @ £79 = **£1,185/mo**

**Total steady-state at 170 merchants + modest ancillary:** ~£3,950/mo (~€4,700/mo). Comfortably above the €2k/mo target with room for a bad month.

**All numbers assumption-labelled. Not "shipping" stats — planning estimates only.**

---

## Where money leaks vs where it grows

**Money leaks (fix these):**
- Free tier storage cost — capped via `lib/tierGates.ts` (`project_storage_cost_safety.md`). Enforced server-side.
- Chargebacks on store single-image purchases — mitigated by 4-crop delivery + watermark evidence trail.

**Money grows (invest here):**
- SEO city × trade grid (10,800 pages) — traffic multiplier for merchant acquisition + store discovery
- Merchant referral loop — compounds every joined merchant
- Studio App Store — every new app is another add-on revenue line
- Site Interest catalog expansion — every tier-2/3 image = evergreen inventory
