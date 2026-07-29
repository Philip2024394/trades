---
author: Philip O'Farrell
role: Founder · staircase manufacturer · named expert for the Staircase Reference Brain
captured_at: 2026-07-29
type: expert_note
status: layer_1_evidence
intended_module: customer_buying_guide_principles (feeds Payment & Account Intelligence · Installation Readiness Check · Staircase Estimation from the customer-facing side)
rule_b_compliance: authored by named expert · not AI-authored
rule_c_compliance: single named expert · every claim traceable · UK tax context noted qualitatively without asserting current rates
---

# Customer Buying Guide Principles

*Expert principles by Philip O'Farrell · captured 2026-07-29 · Layer 1 evidence. What a customer (not a workshop owner) needs to know before, during, and immediately after a staircase purchase. This is the CUSTOMER-facing counterpart to `business-operations-principles.md`. Every principle here informs the parts of NEX that talk to the customer directly (preliminary estimate · installation readiness · payment status · pre-final-payment inspection).*

**Application note:** every principle here is subject to Product Constitution Principle 0003 — never rigid advice, always composed for the specific case.

---

## Principle A · Tipping is optional in the UK, but appreciation matters

Tipping the staircase installation team is **not expected** in the UK. Installers are normally paid by their employer or their own installation charge — customers do not need to tip.

However, if the installers arrive on time · protect the home · solve unexpected problems · leave everything clean · do excellent craftsmanship, a gesture is appreciated: buy them lunch · provide drinks · small cash tip if the customer genuinely wants to.

The industry attitude: *"a good installer remembers a customer who respects their work."* But it should never feel compulsory.

## Principle B · VAT belongs to the tax system, not the customer

For a private homeowner, VAT is normally a cost — it cannot be reclaimed. Only VAT-registered businesses buying for a qualifying business purpose (or under specific VAT rules) can recover VAT.

### The customer check that matters most

**Always confirm whether the quotation includes VAT.** A professional quotation should state it clearly:

```
Staircase supply:     [amount]
Installation:         [amount]
Subtotal:             [amount]
VAT:                  [amount]
Total:                [amount]
```

Or: `Total price: [amount] including VAT`.

Never assume. The one question every customer should ask:

> *"Is this quotation including VAT, delivery and installation?"*

## Principle C · Bespoke staircase payment is naturally staged

Payment for a bespoke staircase is normally staged, not a single payment on delivery:

1. **Order / deposit** — before manufacture starts · protects the manufacturer's material investment
2. **Manufacturing progress** — some companies request a payment when the staircase is ready for delivery / installation
3. **Final payment** — after installation completed · customer inspection · agreed finishing work completed

The customer should expect this and should not be surprised by a deposit request — it is standard practice for bespoke work.

## Principle D · Cash is not wrong, but it is not paperwork

Cash payment is not automatically a red flag, but it must not mean *"no paperwork."* A proper business always provides:

- ✓ Written quotation
- ✓ Invoice
- ✓ Receipt
- ✓ VAT invoice if VAT registered

Safer approach for both sides: **bank transfer + official invoice + payment record**. This protects both the customer and the workshop.

## Principle E · Inspect before final payment · not after

Before releasing the final balance, a good customer checks three areas:

**Installation:**

- ✓ Staircase secure
- ✓ No excessive movement
- ✓ Handrails fitted correctly
- ✓ Balusters aligned
- ✓ Doors / openings still work

**Finish:**

- ✓ Correct timber supplied
- ✓ Correct colour / stain
- ✓ No major damage from installation

**Documentation:**

- ✓ Invoice received
- ✓ Warranty information
- ✓ Care instructions

### The runtime message NEX should present to the customer

```
Ready to release final payment?

Before final balance, we recommend a 5-minute inspection:

Installation: staircase secure · handrails fitted · balusters aligned
Finish:       correct timber · correct colour · no install damage
Documents:    invoice · warranty · care instructions

All good?         [Confirm and pay]
Small snag?       [Contact workshop first]
```

## The deeper trade lesson (worth remembering across all five principles)

> **Do not judge a staircase only by the timber and design. The installation team is where the finished staircase becomes a quality product.**
>
> **A £20,000 staircase poorly installed can disappoint. A well-installed staircase with good materials can become one of the best features of the home.**

## Structured summary for the eventual Reference Brain module

```json
{
  "principle_group": "customer_buying_guide",
  "trade": "staircase",
  "principles": [
    { "name": "tipping_optional", "rule": "Tipping is not expected in the UK · appreciation matters when quality is delivered" },
    { "name": "vat_customer_check", "rule": "Always confirm whether the quote includes VAT, delivery, installation" },
    { "name": "payment_staged", "rule": "Bespoke staircase payment is normally staged · deposit + progress + final" },
    { "name": "cash_needs_paperwork", "rule": "Cash acceptable if formal paperwork accompanies it · bank transfer + invoice preferred" },
    { "name": "inspect_before_final_payment", "rule": "5-minute installation + finish + documents check before releasing final balance" }
  ]
}
```

## Governance note

Same lifecycle as sibling files. Rule A · Rule B · Rule C compliant. UK tax context (VAT reclaim eligibility, VAT invoice requirements) discussed qualitatively without specific rate assertions — Rule A compliance.

## Related documents

- `business-operations-principles.md` — the workshop-owner counterpart to this file (Principles A-F cover the workshop side; this file covers the customer side)
- `docs/product-constitution/roadmap/nex-installation-readiness-check.md` — the pre-installation coordination touchpoint
- `docs/product-constitution/roadmap/nex-payment-and-account-intelligence.md` — Payment Plan Intelligence + Payment Protection Assistant compose with these customer principles
- `docs/product-constitution/roadmap/nex-staircase-estimation.md` — customer-facing preliminary estimate uses these principles for the *"is VAT included?"* clarity requirement
