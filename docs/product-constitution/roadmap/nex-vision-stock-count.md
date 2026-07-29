# Future Module Brief · NEX Vision Stock Count

**Status:** Roadmap · not scheduled
**Source:** Philip O'Farrell · 2026-07-28
**Depends on:** Materials v1 (frozen) · Hardwood Calculator (shipped) · at least basic Stock Intelligence
**Also known as:** NEX Timber Bale Scanner

---

## The owner's problem today

> *"I think I have about 30 oak treads left."*

NEX changes it to:

> *"Your oak tread stock was physically counted yesterday. You have 28 pieces."*

## The workflow

**Stock → Scan Material → Take Photo**

The worker takes a picture of a bale, rack, or stack. NEX Vision analyses:

- Timber type
- Number of visible boards
- Board separation
- Dimensions (if known)
- Tags / labels
- Condition
- Possibly damaged pieces

Result:

```
Material:              Red Deal Pine PAR
Estimated count:       47 lengths
Confidence:            96%
Current system stock:  42 lengths
Difference:            +5 lengths
Would you like to update stock?

[Confirm +5]  [Review Image]  [Count Again]
```

## Three counting methods

**Method 1 · End-face counting (best)**

Photograph the end of the bale. NEX counts the visible board ends.

```
Detected:  5 rows · 9 boards per row
Estimated total: 45 boards
```

**Method 2 · Multiple photos**

NEX asks: *"Take one more photo from the other side."* Combines end view + side view + delivery label to raise confidence.

**Method 3 · Delivery intake**

Supplier delivers 50 lengths. Worker scans the bale on arrival.

```
Expected:   50 lengths
Detected:   49 lengths
Difference: 1 length missing

Create delivery issue?
```

This is the highest-value use case — catching short deliveries at the moment of receipt, before the paperwork is signed.

## What NEX must NOT pretend

Timber bales have real problems:

- Boards overlap
- Straps hide layers
- Shadows
- Different sizes mixed together
- Some boards are damaged
- Ends may not all be visible

**NEX must never claim to see every hidden board.** If confidence drops below a threshold, ask for another photo. If still uncertain, present the estimate as a suggestion with clear confidence bands, and let the owner adjust. A yard worker's eye is the ground truth — NEX turns that experienced eye into a measurable digital action, not a replacement.

## Architecture note

```
Camera
   ↓
Vision AI
   ↓
Material Recognition
   ↓
Count Engine
   ↓
Stock Adjustment (proposed · owner approves)
   ↓
Inventory Memory
```

## Quality-gate stance

- **Q1 (feels like ops manager):** Passes — a scan-and-adjust flow mirrors how a yard worker already works.
- **Q7 (confidence > automation):** Critical — the confidence percentage must be visible and honest. Never present a low-confidence count as authoritative.
- **Q8 (uncertain → ask):** Ask for a second photo, or ask the owner to type the count, never guess silently.
- **Q9 (photo as first-class):** This module IS the photo case study.
- **Q11 (workshop manager test):** Passes — a workshop manager already walks past the timber rack and estimates stock daily. NEX just records what their eye sees.
- **Q12 (traceability):** Every count adjustment must record who scanned, when, from which delivery / stock event it originated, and the source images (retained for later dispute). Without image provenance, the count is unauditable.

## Design constraints for the eventual build

- Vision confidence must be visible on every count. Never hide the uncertainty.
- Every count adjustment writes to `nex_materials_audit_log` with the image reference, the confidence, and the delta vs system stock.
- Images retained for a configurable window (default 90 days) — enough for delivery disputes, not forever.
- Never adjust stock silently. The scan produces a **proposal**; the owner clicks Confirm.
- Delivery-intake variant must offer a one-tap *"Create delivery issue"* action that emails the supplier a photo + expected-vs-actual comparison.
