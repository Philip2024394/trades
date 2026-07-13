# Trade Center — Design Principles (Constitution)

**Owner:** Philip O'Farrell
**Status:** Canonical constitution — every feature must pass this gate
**Version:** 1.0 · 2026-07-11
**Parent doc:** `TRADE_CENTER_2_SPEC.md`

---

## 0. Purpose

This document is the **constitution** for Trade Center.

Every future feature — proposed by Philip, by an engineer, by an AI, by a customer — MUST be validated against the ten principles below **before implementation begins**.

If a feature scores "no" on the majority of principles, it does not ship. If a feature scores "no" on any of the three foundational principles (workspace, professional-first, non-replicable-by-Amazon), it is rejected outright regardless of the others.

This is not a checklist for taste. It is the gate that ensures every line of code, every pixel, every migration reinforces the vision of Trade Center as **the Construction Operating System** — not just another marketplace.

---

## 1. The Ten Principles

Every proposed feature answers these ten questions. Answer format: `yes` / `no` / `n/a` with a one-sentence justification.

### 1.1 Does it reduce work?

Does this feature save the tradesperson time, effort, or mental load in their working day? Or does it add clicks, decisions, or attention cost?

**Passing example:** "Reorder last month's plaster in one click" — reduces 6 clicks to 1.
**Failing example:** "Add a Wishlist tab beside Favourites" — duplicates existing primitive.

### 1.2 Does it reduce clicks?

Can the user complete the intended task in fewer interactions than before? Count clicks, taps, keystrokes, and screen transitions from intent to result.

**Passing example:** "⌘K → 'quote kitchen' → draft quote" — 2 keystrokes to a working draft.
**Failing example:** "Filter drawer with 12 nested sub-filters before showing results" — trades don't need consumer-grade discovery.

### 1.3 Does it increase trust?

Does it surface verification, transparency, merchant identity, or evidence that a construction professional would rely on when making a business decision?

**Passing example:** "Show the merchant's trust score + verified layers on every product card."
**Failing example:** "Sponsored badge on top-of-search results without disclosure."

### 1.4 Does it strengthen merchant identity?

Merchants are the moat. Does this feature make merchants more visible, more distinctive, or more discoverable? Or does it flatten them into interchangeable "sellers"?

**Passing example:** "Merchant logo + name on every product card; distance chip if within local radius."
**Failing example:** "Aggregate reviews across all merchants selling the same SKU" — erases identity.

### 1.5 Does it belong in the workspace shell?

The shell is inviolate. Does this feature fit into an existing module, or does it require a new module and a new primary rail slot? If the latter, is it worth evicting an existing module for?

**Passing example:** "Estimator tool" — its own module, worth a rail slot.
**Failing example:** "Newsletter signup modal on every page" — belongs nowhere in a workspace.

### 1.6 Does it improve muscle memory?

Does it use existing patterns (⌘K, `g h` / `g m` navigation, `j` / `k` list movement, right-panel drawers) or does it invent a new one? New patterns MUST be justified as fundamentally new interactions, not variants of existing ones.

**Passing example:** "New action 'Reorder' added to ⌘K palette" — uses the existing muscle-memory pattern.
**Failing example:** "Reorder button hidden inside an overflow menu on each row" — invisible to power users.

### 1.7 Does it scale internationally?

Does this feature work identically in UK, IE, AU, US, and future markets? Does it respect country-specific data (tax, currency, trade-body verification, shipping providers)?

**Passing example:** "Delivery radius filter with per-country distance units."
**Failing example:** "'Companies House verified' badge hard-coded" — UK-only, breaks in AU/US.

### 1.8 Can AI enhance it?

Not "must include AI." AI is infrastructure, not decoration. But: does this feature have a natural place where the copilot could reduce work further (via ⌘K action, inline recommendation, tool call)?

**Passing example:** "Quote builder — AI can pre-fill from a saved list or estimate."
**Failing example:** "Adding a decorative animation to the loading spinner."

### 1.9 Does it help professionals rather than casual shoppers?

Is this feature something a working construction professional needs, or is it a consumer ecommerce pattern imported reflexively? Consumer patterns (impulse buy nudges, wish-list heart icons, "recommended for you" carousels, dopamine-driven notifications) should be ejected on sight.

**Passing example:** "Bulk pricing tiers surfaced on product card for verified trades."
**Failing example:** "'Frequently bought together' cross-sell carousel below product detail."

### 1.10 Is this something Amazon cannot realistically replicate?

The final and most important test. Does this feature depend on our moat — the merchant network, the trade verification system, the workspace shell, the trade communities, the local supplier layer — such that Amazon would need to rebuild their entire company to match it?

Or is it a feature Amazon already has or could ship in a sprint?

**Passing example:** "Canteen posts from merchants surface as trust signals on their product cards."
**Failing example:** "One-click checkout" — Amazon has owned this for 25 years.

---

## 2. Three foundational principles (any single "no" = rejection)

Of the ten above, three are **foundational**. A feature that fails ANY of these three cannot ship regardless of how it scores on the other seven:

1. **Principle 1.5 — Does it belong in the workspace shell?** (Or is it noise?)
2. **Principle 1.9 — Does it help professionals rather than casual shoppers?** (Or is it consumer pattern-matching?)
3. **Principle 1.10 — Is this something Amazon cannot realistically replicate?** (Or does it commodify us?)

Any feature that gets "no" on one of these three is out. No discussion. Ship something else.

---

## 3. How to run the gate

For every non-trivial feature proposal:

1. Author fills the ten-question table (embed at the top of the design doc or PR).
2. At least one reviewer (Philip or delegated architect) signs off before implementation begins.
3. Score is preserved in the PR body for future audit.
4. If any of the three foundational principles are `no`, the feature is closed with a note pointing here.

**Template to embed in every feature PR:**

```markdown
## Trade Center Design Principles Gate

| # | Principle | Verdict | Justification |
|---|-----------|---------|---------------|
| 1 | Reduces work? | | |
| 2 | Reduces clicks? | | |
| 3 | Increases trust? | | |
| 4 | Strengthens merchant identity? | | |
| 5 | Belongs in workspace shell? *(FOUNDATIONAL)* | | |
| 6 | Improves muscle memory? | | |
| 7 | Scales internationally? | | |
| 8 | Can AI enhance it? | | |
| 9 | Helps professionals not casual shoppers? *(FOUNDATIONAL)* | | |
| 10 | Amazon cannot replicate? *(FOUNDATIONAL)* | | |

**Reviewer sign-off:** _________
```

---

## 4. What this constitution rejects

To make the intent unambiguous, here are patterns explicitly **rejected** by this constitution:

- **Ecommerce dark patterns** — countdown timers, artificial scarcity ("Only 2 left! 47 people viewing!"), false discount anchoring, "Add to cart" language for professional buyers
- **Consumer discovery patterns** — "Because you liked X" carousels, autoplaying video reels, hero banners for seasonal campaigns, gamified badges without operational meaning
- **Notification greed** — pings for anything the user did not explicitly opt into; email digests that don't materially help the business
- **Feature sprawl** — adding a module without evicting one, adding a rail slot without earning it, adding a settings toggle where a smart default would work
- **AI decoration** — sprinkling "✨ AI-powered" chips on features that use no AI; sprinkling AI on features that don't benefit from it
- **Interchangeable-seller UX** — flattening merchants into anonymous rows; hiding the person behind the product; aggregating away identity
- **Country-hardcoding** — assuming UK-only anywhere in code, copy, or UX
- **Consumer navigation** — hero rotators, mega-menus of 60 sub-categories, "Deals" pages as a first-class destination on the shell
- **Studio–Trade Center bleed** — building storefront design tools inside Trade Center or workflow tools inside Studio. The two apps are permanently separate per §19.6.

---

## 5. What this constitution actively encourages

The inverse — patterns that this constitution **loves**:

- **Command palette actions** for every workflow — muscle memory over navigation
- **Merchant chips on every product surface** — moat visible
- **Verified trust layers** displayed granularly, not as a single blob
- **Cross-module state** in the sidebar — a category row that shows "3 in basket · order arriving Tuesday"
- **Real-time updates** via SSE / Supabase Realtime — order status changes without refresh
- **BFF page endpoints** — one round-trip per page, no waterfalls
- **Empty states that teach** — every empty state suggests a workspace action or an AI query
- **Keyboard shortcuts everywhere** with `?` cheat sheet
- **Local supplier chips** driven by user-chosen radius
- **AI as infrastructure** — routing to the cheapest model that answers correctly

---

## 6. Amendment process

This constitution is not fossilised. It amends when Trade Center's strategic posture genuinely shifts.

Amendment process:
1. Philip or the architect proposes an amendment in writing (Slack thread, doc comment, or PR)
2. Explicit rationale required: what strategic shift makes the current principle no longer serve the mission?
3. Amendment lands as a new version bump in the version header
4. Prior version archived at `TRADE_CENTER_DESIGN_PRINCIPLES.archive/v1.0.md`

No feature ships during an in-flight amendment. Stability of the gate matters more than convenience.

---

## 7. Referenced docs

- `TRADE_CENTER_2_SPEC.md` — the architecture spec this constitution governs
- `project_trade_center_is_os_not_ecommerce.md` — the memory that pins the OS thesis for every future AI session

---

**This constitution is the source of truth for Trade Center's soul. The spec doc defines HOW we build. This document defines WHAT deserves to be built at all.**
