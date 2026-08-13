# NEX Refacing Trade Member · Entitlement Specification

**Status:** DRAFT · awaiting Philip's acceptance
**Author:** Philip (via Claude, 2026-08-13)
**Purpose:** Define exactly what £29.99/month unlocks, how the post-payment
journey works, and how a paid member becomes eligible for NEX Chat enquiries —
BEFORE any Stripe / payment code is wired.

> Payment code MUST NOT be built until this spec is accepted. Business rules
> must be defined in words first, then Stripe becomes a mechanism that
> implements them — never the other way round.

---

## 1. Load-bearing principles

1. **One company · one listing_id · one lifecycle.** A business is discovered,
   claimed, paid, and served enquiries under a SINGLE canonical
   `directory_seeds.id`. Payment success MUST NEVER create a new record — it
   updates the existing one in place.

2. **Access ≠ delivery.** Paid membership unlocks the enquiry channel + puts the
   member in the eligible pool. It does NOT guarantee every paid member
   receives enquiries. Suitability is determined per-enquiry by the Trade
   Exchange (service match · geography · availability · qualification rank).

3. **NEX is a matching + enquiry platform, not a lead marketplace.** Wording,
   pricing, and payment copy all reflect this. Never "pay to get leads."

4. **Qualification (A+/A/B/C) affects ranking · never gate.** Every paid member
   is eligible; ranking determines who surfaces first for a given enquiry.

5. **Discovery is free · relationship is paid.** Unclaimed listings appear on
   the public directory for discovery only. Direct phone numbers, NEX Chat
   enquiry access, and Trade Exchange routing all require a paid membership.

---

## 2. What £29.99/month unlocks

Four distinct, testable entitlements. Every downstream surface reads these from
`src/lib/nex/centre-publishing/paidMemberEntitlements.ts` — never re-implements
the rule.

| # | Entitlement | Predicate | Meaning |
|---|-------------|-----------|---------|
| E1 | **Professional trade listing** | `paidMember(seed)` | Public card renders `merchant_verification_level = "partner"` badge + full profile control. |
| E2 | **NEX Trade Chat access** | `canAccessNexTradeChat(seed)` | The trade receives and can reply to routed enquiries inside NEX Chat. This is the ACCESS entitlement — the trade's inbox is open. |
| E3 | **Trade Exchange eligibility** | `canReceiveRefacingRouting(seed)` | The trade is included in the routing pool the Exchange picks from when a homeowner enquiry arrives. Being in the pool ≠ being selected for every enquiry. |
| E4 | **Enhanced profile + Refacing category visibility** | `paidMember(seed)` | Card shows richer information · sits above unclaimed listings in category browse. |

### Deliberately NOT unlocked

- ❌ Guarantee of enquiry volume. Volume depends on homeowner demand + suitability.
- ❌ Priority queue over other paid members. Ranking uses qualification + local availability.
- ❌ Access to raw homeowner contact details. Enquiries flow inside NEX Chat.
- ❌ Any A/A+ gate. Qualification is ranking evidence · never access.

---

## 3. Post-payment listing update (SAME record, forward-only)

**Rule:** Payment success updates the existing `directory_seeds` row identified
by `listing_id`. Never inserts a new record. Never creates a parallel entity.

```
BEFORE payment                    AFTER payment
─────────────                     ────────────
id           = rf_xxx             id           = rf_xxx        (SAME)
slug         = acme-stairs-leeds  slug         = acme-stairs-leeds (SAME)
directory_state = claimed         directory_state = paid_member
claimed      = true               claimed      = true          (SAME)
verified     = false/true         verified     = same
lifecycle_status = claimed        lifecycle_status = verified_partner
```

**Transactional outbox events emitted** (schema TBD when event bus lands):

- `membership.activated` — carries `listing_id`, `activated_at`, plan id.
- `directory_state.changed` — old + new, with actor = `stripe_webhook`.

**Idempotency:** Stripe webhook may fire twice for the same subscription. Every
handler MUST check `directory_state === "paid_member"` first and NO-OP if
already active for the given period.

**Downgrade (cancel / lapse):** `directory_state` returns to `claimed`, NOT to
`listed`. The trade keeps their profile control; only entitlements E2/E3 flip
off. Optional grace-period + read-only lapse behaviour to be specified in a
follow-up.

---

## 4. Enquiry-eligibility flow (post-payment)

The homeowner NEVER lands on a specific trade "cold." Every enquiry passes
through the Trade Exchange, which decides suitability.

```
Homeowner types intent in NEX
   e.g. "refacing my staircase in LS17, oak treads, keep existing structure"
        │
        ▼
NEX Brain parses intent
   → job_type: staircase_refacing
   → services_needed: [refacing, tread_replacement]
   → geography: LS17
        │
        ▼
Trade Exchange filters the paid_member pool:
   ├─ paidMember(seed)               = true
   ├─ services covers job intent     (capabilities match required services)
   ├─ geographic coverage includes LS17
   ├─ capacity/availability signal   (future: on-holiday, at-capacity)
   └─ not-suppressed by HQ           (dispute-freeze etc.)
        │
        ▼
Ranked short-list (qualification A+ > A > B > C · then proximity · then freshness)
        │
        ▼
NEX Chat enquiry opens INSIDE NEX
   Homeowner starts a thread · trade receives + replies in-app
```

**What being a paid member gets you:**

- You are IN the pool. Non-members are NEVER routed to.

**What being a paid member does NOT get you:**

- Every enquiry regardless of fit. Suitability is evaluated per-enquiry.
- Bypass on qualification ranking. A+ evidence still ranks above B for the same
  service+area match.
- Bypass on the 8-hour SLA (see § 4A). Ignoring enquiries loses your turn.

---

## 4A. 8-hour SLA rotation (standing rule · applies to every trade card across NEX)

Cross-reference: `project_nex_trade_card_rule_2026_08_13.md` · Rule 4.

Every routed enquiry carries an 8-hour response window per trade. This applies
UNIFORMLY across every trade directory NEX builds (Refacing, Manufacture,
Kitchens, and all future categories) — the routing engine is category-agnostic.

```
Homeowner → NEX Chat → first eligible trade (rank 1)
                          │
                8-hour response window
                          │
              ┌───── no reply ─────┐
              ▼                    ▼
      status stays pending    next eligible trade (rank 2)
                                    │
                                    ▼
                          8-hour response window
                                    │
                            ...continue until reply or pool exhausted...
```

**Rules:**

- 8 hours is measured from the moment the enquiry lands in the trade's inbox
  (not from homeowner submit time).
- A "response" is a message BACK from the trade inside NEX Chat. Read receipts,
  saved-for-later flags, or non-message activity do NOT satisfy the SLA.
- On expiry, the enquiry rolls to the next eligible trade in ranked order
  (qualification A+ > A > B > C · then proximity · then freshness).
- The homeowner is notified when the enquiry rolls (transparency), but the
  homeowner does not choose the rotation — NEX owns the enquiry journey.
- If the entire eligible pool is exhausted, NEX offers the homeowner an
  extended-timeline option or expands the geographic radius. The homeowner is
  never left with a dead-end.
- Ignoring enquiries is a signal the routing engine learns from · repeated
  non-response demotes a trade's rank order.

**Unclaimed / non-member listings in the routing model:**

Contacting an unclaimed listing from its public card DOES trigger NEX Chat, but
the enquiry does NOT land in that trade's inbox (their inbox is closed until
they hold the required membership). Instead:

- NEX invites the unclaimed trade to claim + activate their subscription.
- In parallel, NEX routes the homeowner to the next eligible Refacing Trade
  Member in the area, under the same 8-hour SLA rotation.

This preserves the two invariants: (1) unclaimed listings are discoverable,
(2) homeowners never dead-end and never see raw trade contact details.

---

## 5. Trade journey (canonical seven steps)

Kept in sync with the public claim journey page (`/nex-app/claim`) + the
membership catalog (`src/lib/nex/centre-publishing/refacingMembership.ts`).

| Step | Surface | State | UI |
|------|---------|-------|----|
| 1 | Directory card (unclaimed) | `directory_state = listed` | "Is this your business? Claim it" |
| 2 | Claim form | `lifecycle_status → claim_requested → claimed` | ClaimForm |
| 3 | Post-claim confirmation | `directory_state = claimed` | ✓ Business claimed banner |
| 4 | Membership upsell | `claimed && !paid_member` | £29.99/mo package card |
| 5 | Checkout (NOT YET BUILT) | link target `/nex-app/membership?listing_id=…` | Stripe subscription flow |
| 6 | Stripe webhook | `directory_state → paid_member` on SAME record | server-side |
| 7 | Homeowner enquiry | `canReceiveRefacingRouting(seed) === true` | NEX Chat opens inside NEX |

Payment (step 5) and webhook wiring (step 6) MUST wait until this spec is accepted.

---

## 6. Wording rules (mandatory copy discipline)

Every surface that presents the Refacing Member offer follows these rules. The
canonical strings live in `refacingMembership.ts` — no surface may hard-code
alternate wording.

### Approved

- "Get homeowner enquiries directly through NEX Chat." (the top-of-page promise)
- "Eligible to receive suitable homeowner enquiries via NEX Chat."
- "Trade Exchange participation" (not "guaranteed leads")
- "NEX Chat access — reply to routed enquiries inside NEX"
- "NEX qualification affects ranking and quality signals · never a gate."

### Prohibited

- "Pay to get leads." · "Buy leads." · "Lead fees." · "Per-lead pricing."
- "Every paid member receives enquiries." (over-promise)
- "Guaranteed £X in enquiry volume." · Any implied volume commitment.
- "A/A+ trades only." · Any qualification-as-gate wording.

---

## 7. What Claude will build next (only after Philip accepts this spec)

1. **`POST /api/nex/membership/activate`** — internal endpoint the Stripe
   webhook calls. Idempotent. Updates `directory_state` on the SAME
   `listing_id`. Emits the two outbox events.
2. **`/nex-app/membership?listing_id=…`** — the checkout page. Loads the seed,
   confirms identity, presents the £29.99 package, then hands off to Stripe.
3. **Stripe wiring** — Price object + subscription webhook handler. Env var
   `STRIPE_PRICE_REFACING_TRADE_MEMBER_MONTHLY` (name already reserved in
   `refacingMembership.ts`, value not yet populated).
4. **Grace / lapse handling** — separate spec once #1-3 are proven.

**Explicitly held back until the above spec is accepted:**

- No Stripe SDK call added anywhere.
- No env var read anywhere.
- No `directory_state === "paid_member"` write from any test / demo path.

---

## 8. Change log

- **2026-08-13 · draft** — captured after Philip's warning that "paid
  membership IS the enquiry channel" over-promises. Corrects the model to
  "membership provides ACCESS + ELIGIBILITY; Trade Exchange determines
  suitability per enquiry."
