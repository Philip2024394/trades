# ADR-0010: Every paid feature clears Stripe margin, both directions

Status: Accepted
Date: 2026-07-13

## Context

eBay can offer 1 video per listing free (and a suite of other "free" features) because they take **15% commission on every sale** plus **£24/month per business account**. Free video drives conversion, and conversion feeds the commission engine. eBay has a compounding revenue lever independent of the feature itself.

Trade Center's revenue model is fundamentally different, established by ADR-0003:
- **Zero sale commission.** We do not take a percentage of any transaction, ever.
- **Zero lead resale.** We do not sell leads to competing merchants.
- **Fixed monthly subscription only** — £7.99 (Canteen) / £11.99 (Marketplace) / £15.99 (The Works). See ADR-0006.

That means **every paid feature must self-fund** because there is no downstream revenue to subsidise it. Applied naively, we would set feature prices at "just cover our cost." But **money flows through Stripe both directions** — money in (merchant paying us for the pack) and money out (us paying merchants their revenue via Stripe Connect payouts). Both incur Stripe fees. If we don't price for that, the smallest add-ons lose money once Stripe takes its cut.

**Stripe UK fees (as of 2026):**
- Money IN (card charge, domestic UK): **1.5% + £0.20** per successful charge
- Money IN (EEA / AMEX / international): 2.5% + £0.20
- Money OUT (Stripe Connect payout to merchant): additional per-transfer fee (typically 25p / $0.25) and a % on cross-border payouts

The fixed £0.20 charge fee is the killer at low price points. A £4 pack pays £0.26 in Stripe fees — a 7% drag. A £1 tip would be 22% drag. Below ~£3 the fee dominates and add-ons become loss-leaders.

## Decision

**Every paid feature is priced so that after Stripe fees (in AND out), it clears ≥95% net-to-us at the money-in step and remains margin-positive after storage / bandwidth marginal cost.** Concretely:

- **Minimum add-on price: £4.99.** Below this the 20p fixed fee eats too much of the margin. If we want a "small" price point, we bundle two small features rather than sell one micro-price.
- **All pack prices end in .99.** Standard psych-pricing plus mathematical headroom above the 20p Stripe fee.
- **Every add-on price is validated at commit time** with the fee math in a leading comment, so future edits can't accidentally drop a price below the margin-safe line.
- **We do not use "free" as a growth lever for storage-intensive features** (video, high-frequency uploads). The eBay pattern doesn't work for us — see Context.

**The specific implication for video packs** (the trigger for this ADR): pack prices moved from round-number £4/£7/£10/£16/£29/£39/£49/£69/£99 to £4.99/£7.99/£10.99/£16.99/£29.99/£39.99/£49.99/£69.99/£99. All clear ≥95% net-to-us at the money-in step (see the fee table in `ProductEditorForm.tsx`).

**The specific implication for the subscription tiers** (already in the £7.99–£15.99 band): they're above the margin-safe threshold by design. £7.99 Canteen tier nets £7.67 after Stripe (~4% drag). £15.99 Works nets £15.55 (~2.75% drag). No change needed.

**Money-OUT margin** (Stripe Connect payout to merchants who sell on Trade Center) is separately accounted. If Trade Center adds a Safe Trade checkout that routes money through us, the settlement math is:
- Buyer pays merchant £X
- Stripe fee IN: 1.5% + £0.20 (deducted from £X)
- Stripe Connect fee OUT to merchant: 25p per payout (batched daily, so this is amortised across the day's sales)
- We add **no take-rate on top** — the merchant keeps everything after Stripe. Our revenue is the subscription, not the transaction.

The above stays true even after we ship Safe Trade — see ADR-0003. We are NOT to add a %-of-sale fee "quietly" to cover Stripe out-fees. If we ever need to fund Stripe out-fees at scale, we adjust the subscription tier, not add commission.

## Consequences

- **Positive:** Every add-on we ship is intrinsically profitable, not dependent on downstream volume. No compounding losses from a viral free-tier feature.
- **Positive:** Merchants trust the pricing model — the price they see is close to what we actually collect. eBay's "15% commission + insertion fee + upgrade fees + promoted listings" opacity is a competitive vulnerability for us.
- **Positive:** Forces us to bundle small features rather than nickel-and-dime with £1 add-ons. Better UX outcome.
- **Positive:** A £4.99 minimum is still low-friction — well below the "annoyance threshold" for trades used to £10+ for anything.
- **Negative:** We cannot offer "free video" as a growth hook the way eBay does. Video is tier-gated + pack-topped. Mitigated by: paid tiers get generous base allocation (5/15/200), so the merchant who pays £7.99/mo already gets video "included" without a separate purchase.
- **Negative:** Subscription tier changes require re-validating every add-on's margin math, because a lower tier price shifts the "acceptable margin" curve. Documented as an addition to the session-end habits in CLAUDE.md.
- **Neutral:** Cross-border payments (EEA/US buyers → UK merchant) have thinner margins (2.5% Stripe fee vs 1.5% domestic). Watching this once international sales materialise; may need geo-priced add-ons.

## Alternatives considered

- **Take a small commission (0.5–2%) on Safe Trade transactions to fund the platform** — rejected. Violates ADR-0003 which is a core positioning promise against Checkatrade / MyBuilder / eBay. If commission ever returns, it's a fundamental brand change requiring its own ADR.
- **Free video, capped tightly (e.g. 1 per listing forever)** — rejected. Sounds fair but doesn't match how merchants use video. Trades who post 30 kitchens/year want video on 30 listings; a "1 per listing forever" cap either loses money on storage (if we absorb it) or forces the merchant into a bad choice (which single listing gets the video). Pack model is more honest.
- **Raise the £4.99 pack to £5.99 for extra margin cushion** — rejected. £4.99 is a psychological entry point. Bandwidth cost per 10 videos (~£0.50) plus Stripe fee (£0.28) leaves £4.21 margin, which is 5–8× cost. Sufficient.
- **Route add-ons through Apple/Google in-app purchase to skip Stripe fees** — rejected. Apple/Google take 15–30%. Worse than Stripe.
- **Absorb Stripe fees into the subscription tier so add-ons show "true" prices** — rejected. Ties every add-on's pricing to a subscription forecast that hasn't converged yet. Better to price each add-on standalone.

## Enforcement

Every pricing change to a paid feature must include:

1. The Stripe fee math as a leading comment in the pricing constant (see `VIDEO_PACKS` in `ProductEditorForm.tsx` for the pattern).
2. A ≥95% net-to-us floor at the money-in step for pack prices.
3. A minimum price of £4.99. No exceptions without a new ADR that supersedes this.
