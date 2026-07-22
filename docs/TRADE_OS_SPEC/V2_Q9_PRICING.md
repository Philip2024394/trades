# Trade Operating System · Volume 2 · Question 9
## Pricing Architecture — Sell Outcomes, Not Images

**Audience:** Product Architects, Commercial Strategy Engineers, Platform Designers
**Source:** ChatGPT design-brief architecture series, V2 Q9.

---

## Philosophy

Most AI companies price generations: `1 image = $X`. **That is a commodity.**

**Trade OS never sells images. Trade OS sells business outcomes.**

The merchant isn't buying "a PNG". They're buying **"a professional business identity that wins more work."**

That changes everything.

---

## The Commercial Pyramid

```
                    Business Growth
              (Recurring Subscription)

                 Brand Management

             Business Assets Bundle

          Capability Bundles

      Individual Studios (Entry Point)
```

**Revenue increases as merchants climb.**

---

## Never Sell This

`Van Wrap £6.99`

Instead sell:

```
Vehicle Branding Kit
  Van · Rear · Front · Fleet · Trailer · Pickup · Reflective Kit · Printer Files
£29.99
```

Customer perceives far greater value.

---

## The Eight Commercial Bundles

### Bundle 1 — Brand Foundation (£19.99)
For new businesses.
Logo · Brand Guide · Colour Palette · Typography · Brand Voice · Icons · Social Avatar · Email Signature · Favicon.
Very low generation cost. Huge perceived value.

### Bundle 2 — Vehicle Branding ⭐ (£29.99)
**Best seller.**
Transit · Vivaro · Trafic · Custom · Pickup · Lorry · Trailer · Magnetic Signs · Reflective Kit · Fleet Version · Printer Pack.
Customer thinks *"I'm buying branding"* not *"I'm buying one van"*.

### Bundle 3 — Print Essentials (£19.99)
Business Card · Letterhead · Invoice · Quote · Receipt · Compliment Slip · Folders · Document Templates.

### Bundle 4 — Workwear Pack (£24.99)
Polo · T-shirt · Hoodie · Hi-Vis · Soft Shell · Cap · Beanie · Helmet Stickers · Embroidery Files.

### Bundle 5 — Site Branding (£24.99)
Yard Signs · Fence Banners · Scaffold Banners · Office Sign · Vehicle Stickers · Window Graphics · Safety Boards · Reception Signage.

### Bundle 6 — Digital Presence (£24.99)
Website Hero · Service Graphics · Social Media · Profile Images · Cover Photos · Google Business Assets · Email Headers · Blog Graphics.

### Bundle 7 — Marketing Campaign Kit (£29.99)
Facebook Ads · Instagram Ads · Flyers · Leaflets · Posters · Seasonal Promotions · Referral Cards · Offer Graphics.
Recurring every season.

### Bundle 8 — Complete Brand OS ⭐⭐⭐ (£99-149)
**Everything.** Identity · Vehicles · Print · Website · Social · Workwear · Marketing · Photography · Office · Documents · Growth Assets.
Highest margin.

---

## Subscription Layer (recurring revenue)

Not everything is one-time. Some capabilities improve over time:

- Seasonal Marketing — **£7.99/mo**
- Social Content — **£9.99/mo**
- Brand Health Monitoring — **£4.99/mo**
- Website Optimisation — **£9.99/mo**

---

## Commercial Psychology

Never ask *"Buy Van Wrap?"* Ask *"Brand your whole fleet."*
Never ask *"Buy Business Card?"* Ask *"Professional Print Pack."*

**Always sell outcomes.**

---

## Bundle Upgrade Logic

- Merchant buys Logo → suggest **Complete Brand Foundation** (Save 38%)
- Merchant buys Van → suggest **Vehicle Branding Pack** (Includes Fleet)
- Merchant buys Website → suggest **Digital Presence Pack**

**Cross-selling automatic.**

---

## Dynamic Pricing Engine

Price by complexity:

- One Van → **£9.99**
- Fleet (10 Vehicles) → **£39.99**
- Enterprise Fleet → **Custom Quote**

---

## Capability Pricing Metadata

```ts
interface PricingMetadata {
  basePrice:      number;
  bundle:         string;
  subscription:   boolean;
  estimatedCost:  number;
  estimatedTime:  number;
  upsellTargets:  string[];
}
```

Platform uses this automatically.

---

## Cost Awareness

Every generation knows its AI cost:

```
GPT-5 Reasoning     £0.02
GPT Image           £0.08
Vectorisation       £0.03
QA                  £0.01
Export              £0.00

Total Cost          £0.14
Sell                £29.99
```

**Gross margin extremely high.**

---

## Smart Upsells (after approval)

> Your van branding is ready.
> Would you like matching:
> ✓ Workwear
> ✓ Business Cards
> ✓ Site Boards
> ✓ Website
> ✓ Social Media

One click. No redesign. Everything already uses Brand DNA.

---

## Loyalty System — Brand Completion

Every purchase increases Brand Vault completeness.

```
42% → 65% → 91% → 100%
```

Unlock rewards. Complete Brand OS → Free Seasonal Marketing Pack.

---

## Team & Multi-User Pricing

- **Solo Trader** — 1 user, £0/mo
- **Growing Business** — 5 users, £19/mo
- **Company** — 20 users, £49/mo
- **Enterprise** — Unlimited, Custom

---

## Marketplace Revenue (future)

Approved partners publish premium templates:

`Luxury Joinery Pack — £14.99 · Designed by Studio X`

Revenue split. Expands ecosystem without internal development.

---

## AI Credit System (optional)

Avoid exposing API costs. Use credits:

- Starter: 100 Credits
- Professional: 500 Credits
- Business: Unlimited Fair Use

Customers understand value, not token accounting.

---

## Merchant Lifetime Journey

```
Day 1     Logo
Day 2     Brand Foundation
Week 1    Vehicle Branding
Week 2    Print Pack
Month 1   Website
Month 2   Marketing
Month 3   Subscription Services
```

Platform grows with the business.

---

## KPI Dashboard

Track: Average Order Value · Bundle Attach Rate · Upgrade Rate · Subscription Conversion · Merchant Lifetime Value · Generation Cost · Gross Margin · Renewal Rate.

Metrics drive product decisions.

---

## The Strategic Insight

**The real product is not AI generation. The real product is Brand Ownership.**

A plumber doesn't wake up wanting an image. They wake up wanting:
- More trust
- More enquiries
- Better first impressions
- Higher-value customers
- A business that looks established

Every bundle answers: *"How does this help the merchant win more work?"*

**When pricing is organised around business outcomes instead of individual assets, competitors can copy a feature — but they cannot easily copy the complete commercial system that grows with the merchant over years.**

---

## Networkers-specific implementation notes

- **Alignment with existing tier catalog** (`src/lib/tierCatalog.ts`) — the 8 bundles slot alongside the existing Free/Starter/Professional/Business/Works subscription. Bundles unlock at tier thresholds (Vehicle Branding available at Starter+, Complete Brand OS at Business+).
- **Washer wallet integration** — the "washers as generation cost" pattern from earlier (10 washers per van gen) is explicitly flagged as an anti-pattern by ChatGPT. Recommend keeping washers for WhatsApp lead metering (their original purpose) and pricing bundles in £ direct. Merchants understand £29.99 more easily than "300 washers".
- **Bundle definitions** live in `src/lib/design/pricing/bundles.ts` — one entry per bundle with `id`, `name`, `contents[]`, `price_pence`, `estimated_cost_pence`, `margin_target_pct`.
- **Cross-App upsell engine** = new Mate tool `suggest_next_bundle` reading merchant's purchased bundles + brand-completion percentage → recommends the next bundle.
- **Cost tracker per bundle** = extends `hammerex_van_generations.usd_cost` pattern across all Studios. Every generation tags its bundle for margin analytics.
- **Brand Completion widget** on `/studio/vault` (from V2 Part 5) reads bundle purchases + generated assets → shows the progress bar.
