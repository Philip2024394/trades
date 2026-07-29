---
author: Philip O'Farrell
role: Founder · staircase manufacturer · named expert for the Staircase Reference Brain
captured_at: 2026-07-28
type: expert_note
status: layer_1_evidence
intended_module: business_operations_principles (distinct from wood_intelligence — this is the BUSINESS side of running a staircase workshop, not the timber-craft side)
rule_b_compliance: authored by named expert (Philip O'Farrell) · not AI-authored · eligible to enter the Reference Brain through the governed authoring workflow
rule_c_compliance: single named expert · every claim traceable · UK-specific legal references presented qualitatively without asserting specific rates or thresholds that would need external evidence
---

# Business Operations Principles for Staircase Workshops

*Expert principles by Philip O'Farrell · captured 2026-07-28 · Layer 1 evidence. Distinct from the wood/timber craft principles in `wood-intelligence-principles.md` — this file covers how the BUSINESS of a staircase workshop actually runs: payment terms, credit risk, cash-flow protection, and dispute resolution. All are exposed to the same failure mode wood is exposed to (silent risk becomes real loss), and NEX must reason about them with the same craft as it reasons about timber.*

**Application note:** every principle in this file is subject to **Product Constitution Principle 0003** — never a rigid rule. NEX composes them with the specific customer, order, and history in context.

**Legal note:** references to UK-specific processes (small claims track, late-payment legislation) are qualitative — thresholds and rates change over time, and NEX must always refer to authoritative current sources when advising on specific numbers. Rule A compliance.

---

## Principle A · Custom manufactured products require payment structures that protect both sides

A staircase is different from a bag of cement. Cement can be resold to the next customer; a bespoke curved oak staircase built to a specific house's dimensions cannot. This asymmetry is the entire justification for how staircase companies structure payment.

The core rule:

> **The more customised the staircase, the more important deposits, written approvals, and payment milestones become.**

### Structured form (for eventual Reference Brain module)

```json
{
  "principle": "custom_product_payment_structures",
  "trade": "staircase",
  "rule": "Payment terms for a bespoke staircase must protect both the supplier's material investment and the customer's confidence. Neither side should be exposed to the other's failure.",
  "reason": "A staircase manufacturer typically commits timber, machining time, workshop hours, and installation labour before receiving final payment. Without structured payment, a single non-paying customer can absorb weeks of production capacity."
}
```

### Why staircase companies are careful with credit

A staircase company is not just selling timber — it is managing:

- Material cost (already paid to the timber supplier)
- Workshop time (already paid to staff)
- Installation labour
- Cash flow across the production cycle

A staircase may sit in production for weeks before the company receives final payment. Good payment terms protect the workshop.

### The typical bespoke payment sequence

```
Order placed
      ↓
Design approval  (written · signed)
      ↓
30–50% deposit paid
      ↓
Manufacturing begins
      ↓
Installation completed
      ↓
Remaining balance due
```

The deposit exists because the company has already purchased timber · stair parts · machining time · labour hours before the customer receives anything.

---

## Principle B · Payment terms are as much about cash-flow protection as customer service

Different customer types warrant different terms. A skilled staircase business tunes terms to the risk profile of each relationship.

### Typical UK trade payment terms

| Term | Meaning | Common use |
|---|---|---|
| Payment upfront | Customer pays before production or delivery | New customers · private homeowners · very bespoke work |
| Deposit + balance | Part paid before manufacture, remainder on completion | Most bespoke staircases |
| 7 days | Payment due within one week | Small suppliers · smaller jobs |
| 14 days | Two-week payment period | Common with smaller trade accounts |
| **30 days (Net 30)** | Payment due 30 days after invoice | Very common trade account term |
| 60 days | Payment due 60 days after invoice | Larger builders / developers |
| 90 days | Payment due 90 days after invoice | Large construction contracts · harder on suppliers |

### The "normal" position for many staircase manufacturers

- **Private customer:** deposit + balance
- **Small builder:** deposit or 14–30 days
- **Established contractor:** 30 days
- **Large developers:** 60+ days negotiated

### Structured form

```json
{
  "principle": "payment_terms_reflect_relationship_and_risk",
  "trade": "staircase",
  "rule": "Match payment terms to the customer's trade history, order size, and product customisation. Never apply one payment policy across all customer types.",
  "trade_note": "The staircase company is usually financing the production period. Payment structure is a risk instrument as much as a customer service."
}
```

### What NEX does with this at runtime

When a quote is generated, NEX proposes terms appropriate to the customer:

```
Payment Plan Suggestion

New customer:              Deposit required (30-50%) · balance on completion
Established trade account: 30-day terms available
Large developer:           Monthly account arrangement · agreed in advance
```

Never applies terms silently — always presents them for the owner (workshop) to review and approve. Principle 0003 in action: judgement, not a lookup.

---

## Principle C · Late payment handling protects cash flow without damaging relationships

A staircase company should not think *"how do I punish late payment?"* It should think *"how do I protect cash flow while keeping valuable customers?"*

### The reminder progression

**Before due date** — professional invoice reminder:

> *"Your invoice is due on [date]."*

**Shortly overdue** — courteous escalation:

> *"Your account is now overdue. Please arrange payment."*

**Longer overdue** — formal notice:

> *"Your account remains unpaid. Late payment charges may now apply."*

**Sustained non-payment** — stronger action:

- Late fees
- Stop further work
- Credit account suspension
- Require payment before new orders

### Late-payment interest and charges (UK context)

Many countries have legislation allowing businesses to charge interest on late commercial debts. In the UK there are specific rights under late-payment legislation for commercial debts. **NEX must never assert specific rates or thresholds from this file** — those change over time and are the kind of thing that needs current authoritative sourcing (Rule A · no fabrication). NEX should point owners to check current UK late-payment legislation when configuring their standard terms.

### The relationship judgement

Not every late payer deserves the same response.

- **Good long-term builder customer:** first contact personally · understand the issue · agree a payment date. A reliable builder may provide years of work — protect the relationship where the risk is genuinely low.
- **Customer ignoring invoices:** stronger action is reasonable — late fees · stopping further work · credit-account suspension.

That's a judgement call, not a rule. Structured form:

```json
{
  "principle": "late_payment_response_is_relationship_specific",
  "trade": "staircase",
  "rule": "Match the response to the customer's history — first contact personally with reliable long-term customers · escalate quickly with unresponsive or first-time defaulters.",
  "reason": "A rigid late-payment process damages good relationships and lets bad ones drift. Both cost money."
}
```

---

## Principle D · Small claims is available for staircase disputes — documentation is what wins them

A staircase company can use the small-claims process for unpaid invoices, but the exact process and maximum amount depend on the country and legal system. For UK staircase companies (England and Wales specifically), the small-claims track is generally used for smaller commercial disputes — **NEX should not assert specific thresholds** as these change; owners should confirm current limits before proceeding.

### What can be claimed

- Unpaid staircase invoices
- Unpaid installation work
- Unpaid materials supplied
- Agreed additional work

### Evidence that wins staircase disputes

Because staircases are bespoke, **documentation is critical**. A good staircase company keeps:

- ✓ Signed quotation
- ✓ Approved drawings
- ✓ Customer measurements approval
- ✓ Material specification
- ✓ Installation sign-off
- ✓ Invoice records
- ✓ Emails / messages agreeing the work
- ✓ Payment terms explicitly stated

### Before going to court · the escalation path

Most businesses follow this sequence:

1. **Payment reminder** — *"invoice overdue · please arrange payment within 7 days"*
2. **Formal demand** — stronger letter with amount owed · invoice details · deadline · possible court action
3. **Court claim** — only if still unpaid after the formal demand

### Structured form

```json
{
  "principle": "documentation_wins_bespoke_disputes",
  "trade": "staircase",
  "rule": "Because bespoke staircases have limited resale value, dispute defense depends on written proof at every stage — signed quotation, approved drawings, agreed measurements, installation sign-off, invoice records. Missing documentation is missing defense.",
  "reason": "A bespoke curved oak staircase cannot be resold to another customer. A supplier facing non-payment has already committed materials and labour. The evidence chain is what turns a lost sale into a recoverable claim."
}
```

### Extension · The "staircase doesn't fit" dispute pattern

The same evidence discipline that wins a payment dispute also resolves a fitting dispute. When a bespoke staircase reaches site and doesn't fit, the first question is **who was responsible for the measurements**.

- **Company measured** → company normally responsible for making the staircase to the agreed measurements. Expect inspect · correct · remake. Refund may be possible if the problem can't be reasonably fixed.
- **Customer supplied measurements** → if the company manufactured exactly to those figures, they may argue the issue came from customer information.

Not every fit issue is a full-refund situation. NEX must help classify:

- **Minor adjustment** (small gap · trimming needed · final fitting) — usually normal during installation
- **Serious failure** (won't install safely · wrong size · wrong layout · incorrect rise/going · unsafe handrail height · major structural mismatch) — inspection required · remedy discussion

The correct sequence when a problem appears:

1. Take photos · record measurements · keep emails/messages · **stop further work if it may make the problem worse**
2. Give the company a chance to inspect and fix it before removing anything
3. Write a professional message: *"The staircase supplied does not fit the agreed dimensions. Please inspect the issue and confirm how you intend to correct it."*
4. If final balance is unpaid, don't ignore the invoice but you can request the issue be resolved first
5. If already paid, still raise formally and request repair · replacement · or remedy

The workshop's protection is the same as for payment disputes: signed survey notes · signed drawings · customer approval records · manufacturing records · installation records. NEX's Installation Quality Record captures these automatically as the workflow runs.

```json
{
  "principle": "fit_dispute_first_establishes_responsibility",
  "trade": "staircase",
  "rule": "A staircase problem is not automatically a refund situation. First establish whether it is a design error, measurement error, manufacturing error, installation issue, or a normal adjustment — each has a different remedy.",
  "reason": "Bespoke staircases have limited remedies. Confusing minor adjustments with serious failures damages relationships; treating serious failures as minor adjustments damages the customer's home."
}
```

---

## Principle E · Staircase companies rarely fail because they cannot make stairs

The public numbers do not isolate staircase manufacturers (they sit under joinery · woodworking · timber products · building construction) — but the pattern from wider construction insolvency data is consistent: business failures come from **business pressure**, not lack of craft skill.

The core rule:

> **A staircase company rarely fails because it cannot make stairs. It often fails because the business around making stairs was not controlled.**

### Five most common failure causes

1 · **Cash flow problems (biggest reason)** — customer delays payment while wages + timber bills are due · a profitable company can still fail if cash flow breaks.
2 · **Timber price increases** — squeezes margins on quoted work already in production.
3 · **Too much competition on price** — online + standardised competitors undercut traditional workshops (which is why Specification Intelligence and Buying Intelligence matter).
4 · **Skilled craftsmen retiring** — succession gap closes businesses.
5 · **Undercharging** — forgetting machinery maintenance · workshop rent · design time · waste · rework · warranty risk in the price.

### What survivors do differently

✓ Strong supplier relationships · ✓ Accurate estimating · ✓ Good deposits & payment terms · ✓ Skilled installation · ✓ Reputation · ✓ Waste control · ✓ Repeat builder/developer work.

### Structured form (for eventual Reference Brain module)

```json
{
  "principle": "staircase_business_fails_from_business_pressure",
  "trade": "staircase",
  "rule": "Business survival depends on cash flow, pricing discipline, succession planning, and estimating accuracy — never on craft skill alone.",
  "reason": "The bespoke nature of staircases means one non-paying customer, one mispriced quote, or one weeks-long delay can absorb weeks of production capacity. Craft cannot recover from a business failure quickly."
}
```

### The NEX Workshop Risk Intelligence feature this enables

```
Workshop Risk Intelligence

Material prices:      ↑ rising (see Material Watch)
Customer payments:    Average delay increasing
Stock:                High-value timber sitting longer than usual
Margins:              Trending down over last 3 months

NEX recommendation:
  Review pricing on active quotes.
  Confirm payment terms on next 3 open orders.
```

Never automated action. Signals surfaced · owner decides · Principle 0003 in action.

---

## Principle F · VAT is not income · protect the VAT cash

For a VAT-registered staircase manufacturer (UK context assumed), VAT is not profit — it is money collected on behalf of the tax system, then paid to HMRC.

The core rule:

> **VAT collected from customers is not the workshop's money. Separate it, protect it, and treat the VAT payment deadline with the same discipline as a wages run.**

### Structured form (for eventual Reference Brain module)

```json
{
  "principle": "vat_is_not_income",
  "trade": "staircase",
  "rule": "Separate VAT cash from operating cash. VAT collected from customers is a liability to HMRC, not workshop margin. Treat the VAT payment deadline as inviolable.",
  "reason": "Many workshops fail because they spend VAT-inclusive customer payments as if the whole amount were revenue. When the VAT return comes due, the money is gone. This is a business-controls failure, not a tax problem."
}
```

### How the VAT lifecycle actually runs for a staircase workshop

**Buying timber (input VAT):**

```
Oak timber invoice:    £5,000
VAT:                   £1,000
Total paid:            £6,000
```

The £1,000 VAT is *input VAT* — recoverable through your VAT return if the purchase relates to your taxable business activity.

**Selling a staircase (output VAT):**

```
Staircase:             £15,000
VAT:                    £3,000
Customer pays:         £18,000
```

You record the £3,000 as *output VAT* — a liability to HMRC.

**Filing the VAT return:**

```
VAT collected:         £8,000
VAT paid on purchases: £5,000
Amount due to HMRC:    £3,000
```

If VAT paid on purchases exceeds VAT collected in a period, a VAT repayment is due to the business.

### Where VAT applies in workshop purchases

Depending on circumstances:

- ✓ Timber · stair parts · consumables · finishes · fixings
- ✓ Machinery · CNC equipment · tools
- ✓ Workshop equipment · vehicles used for business
- ✓ Software · professional services

Key requirement: the purchase must relate to the taxable business activity.

### Registration + return cycle (UK)

- **Register with HMRC** — receive VAT registration number + return periods (most businesses file quarterly)
- **Keep records** — every purchase (input VAT) and every sale (output VAT) with dates + supplier + amount
- **Complete return** at end of period · calculate VAT to pay (or claim)
- **Submit + pay by deadline** — typically **1 month and 7 days after the end of the VAT period** (example: period ends 31 March → deadline 7 May)
- **Late = penalties** — HMRC uses a points-based system for late submissions · late payment can add charges. **NEX must never assert specific rates or thresholds** — these change (Rule A · no fabricated figures). Owner should verify current HMRC rules.

### The critical business habit

```
Customer payment received
        ↓
Separate the VAT amount immediately (into a dedicated pot)
        ↓
Use the remaining cash for wages · timber · overheads
```

Do NOT run wages or supplier invoices out of VAT-inclusive customer receipts as if the full amount were revenue.

### Should VAT change the price you quote?

**No** — never treat VAT as extra profit or extra cost. Your **net selling price must already be profitable**. Add VAT on top for the invoice. Example:

```
True staircase cost:       £8,000
Required profit:           £3,000
Selling price before VAT:  £11,000
VAT added on invoice:      Customer pays VAT-inclusive total
```

Undercharging is a bigger risk than mispricing VAT. Many small workshops price from *"what competitors charge"* — the correct starting point is **true manufacturing cost + craftsmanship value + sustainable profit**, then VAT on top.

### The NEX VAT Cash Protection feature this enables

```
VAT Cash Protection

Your VAT payment is due in 14 days.
Current VAT liability estimate:  [amount]

Cash reserved:                    [amount]
Shortfall:                        [amount if any]

Ensure sufficient cash is reserved before further discretionary spending.
```

Never processes payments · never files returns · just surfaces the risk against the deadline. Signals + owner decides. Same discipline as everywhere else on the platform.

---

## Why these six principles matter as a set

Alone, each principle is useful. Together they define **NEX's judgement about business risk**:

- **Principle A** stops NEX from proposing a "just send an invoice" pattern for bespoke work — deposits and staged milestones protect the workshop.
- **Principle B** stops NEX from applying one-size-fits-all payment terms — terms match customer type and relationship.
- **Principle C** stops NEX from treating every late payer the same — the response depends on history and value of the relationship.
- **Principle D** stops NEX from advising a customer into a dispute they can't win — evidence chain is captured before it's needed · same discipline covers both payment disputes and fitting disputes.
- **Principle E** stops NEX from thinking business survival is about craft alone — business controls (cash flow · pricing · succession · estimating) are what turn skill into longevity.
- **Principle F** stops NEX from treating VAT-inclusive customer receipts as revenue — VAT cash must be separated and protected against the HMRC deadline.

A generic AI advising a staircase workshop will fail all six. An experienced workshop owner holds all six in composition (Principle 0003).

## Governance note

Same lifecycle as sibling files.

- **Layer 1 (this document):** collected · not yet entered the Reference Brain
- **Layer 2:** enters `hammerex_nex_brain_drafts` when Philip drafts it through the platform's authoring UI · this evidence maps to a new `business_operations_principles` Brain module (distinct from wood/timber content)
- **Layer 3:** enters `hammerex_nex_brain_versions` when reviewed and approved
- Runtime composition serves these principles alongside the wood principles for a complete answer

Rule B compliant (authored by named expert Philip O'Farrell). Rule C compliant (traceable to Philip). Rule A compliant (no specific legal thresholds or interest rates asserted — NEX will always direct owners to current authoritative UK legal sources when specifics are needed).

## Related documents

- `wood-intelligence-principles.md` — the nine trade rules about wood (parallel domain · separate concern)
- `purchasing-principles.md` — the package-comparison rule (business-adjacent · buying side)
- `docs/product-constitution/roadmap/nex-payment-and-account-intelligence.md` — the module that consumes these business operations principles at runtime
- `docs/product-constitution/roadmap/nex-staircase-estimation.md` — Estimation reads these principles to attach payment-term suggestions to every quote
- `docs/product-constitution/roadmap/nex-buying-intelligence.md` — the cash-flow side of Buying Intelligence composes with these principles

## Adjacent business principles worth authoring later

- **Deposit sizing by customisation level** — how deposit percentage relates to how bespoke the staircase is
- **Retention holdback for developers** — the industry convention of holding a small % after installation for defect-fix period
- **VAT reverse-charge scenarios** — construction-industry VAT rules that affect quote structure
- **Warranty and after-installation defect windows** — what NEX should carry as the standard trade expectation
- **Insurance requirements for installation liability** — public-liability + product-liability essentials
