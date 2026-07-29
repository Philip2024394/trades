# Future Module Brief · NEX Stock Intelligence

**Status:** Roadmap · not scheduled
**Source:** Philip O'Farrell · 2026-07-28
**Depends on:** Materials v1 (frozen) · Hardwood Calculator (shipped)

---

## The core principle

> **NEX never automatically purchases materials. NEX detects, recommends, and asks for approval.**

Stock Intelligence is an intelligent workshop assistant that monitors stock levels, understands owner-defined rules, and recommends when materials should be reordered — while keeping the final decision with the business owner.

## The workflow

### 1 · Material setup

Owner defines each material's stock rules:

- Name · Category · Supplier · Agreed supplier price
- Normal stock holding level
- Low stock warning level
- Reorder quantity
- Preferred supplier

Example:

```
Material:              Red Deal Pine PAR
Normal stock level:    50 lengths
Low stock trigger:     15 lengths
Recommended reorder:   back to 50 lengths
Supplier:              ABC Timber
Agreed price:          £8.50 per length
```

Setup follows the Standard NEX Workflow (Principle 0002) — owner speaks their rules, NEX drafts the setup card, owner approves.

### 2 · Stock monitoring

NEX continuously tracks stock movement as production consumes material:

```
Starting stock:  50 lengths
     ↓
Machining used:  50 → 35 → 20 → 14 lengths
```

When stock reaches the owner-defined warning level, NEX generates an alert.

### 3 · Smart stock alert

```
Stock Low

Red Deal Pine PAR is below your minimum level.

Current stock:        14 lengths
Your normal level:    50 lengths
Recommended reorder:  36 lengths
Supplier:             ABC Timber
Agreed price:         £8.50 per length

Would you like to reorder?

[Yes, Order Recommended Quantity]  [Change Quantity]  [Remind Me Later]
```

### 4 · Owner approval

If approved, NEX drafts a purchase order:

```
Purchase Order
Supplier:  ABC Timber
Material:  Red Deal Pine PAR
Quantity:  36 lengths
Price:     £8.50
Status:    Awaiting Delivery
```

### 5 · Stock update on delivery

```
Previous:   14 lengths
Delivered:  36 lengths
New:        50 lengths
Status:     Stock Restored
```

## Intelligence layer

Over time NEX learns:

- Frequently-used materials
- Seasonal demand
- Production schedules
- Supplier relationships
- Agreed prices
- Normal stock behaviour

Future recommendations become possible:

- *"Based on your next 6 staircase projects, you may need additional oak tread blanks within 3 weeks."*
- *"Your normal Red Deal Pine usage has increased. Would you like to raise your reorder level from 50 to 75?"*

## Permission model

**Workshop owner:**
- Controls stock rules
- Approves orders
- Controls supplier access

**Supplier** (later):
- Only sees approved purchase requests
- Can receive delivery opportunities
- Does not see private business information

## Architecture note

```
Materials Library
        ↓
Stock Engine
        ↓
NEX Intelligence Layer
        ↓
Low Stock Detection
        ↓
Recommendation Engine
        ↓
Owner Approval
        ↓
Purchase Order
        ↓
Stock Updated
```

## Quality-gate stance

- **Q1–Q6:** Passes — the alert card, the approval flow, and the stock-update card all fit the Standard NEX Workflow.
- **Q7 (confidence > automation):** Passes only if reorder quantities never fire without approval. If we ever let a "recurring order" bypass the alert, we've broken this. Design must forbid it.
- **Q8:** Passes — every recommendation is a proposal, not a fact.
- **Q11 (workshop manager test):** The trigger sentence is *"Your timber is getting low. You normally keep 50 lengths. Shall I reorder from your usual supplier at the agreed price?"* — that's exactly what an experienced yard manager would say to the owner.
- **Q12 (traceability):** Every reorder recommendation must link back to (a) the stock rule that fired it, (b) the delivery events that consumed the stock, (c) the supplier + agreed price provenance. Reorder without a visible chain fails.

## Design constraints for the eventual build

- No automated purchasing. Ever. Every order is an owner-approved action.
- Stock rules are owner-defined, not NEX-inferred. NEX can *suggest* changes (based on usage) but never *change* them silently.
- Alerts must be quiet — no bells, no pop-ups, no email spam. A tile on the Materials landing with a subtle indicator is enough.
- The reorder card must show the supplier and price prominently — the owner should always know what they're approving before they read the quantity.
- The "Remind Me Later" action must record a real remind-at date, not just dismiss.
