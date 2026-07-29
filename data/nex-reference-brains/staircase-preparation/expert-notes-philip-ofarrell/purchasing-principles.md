---
author: Philip O'Farrell
role: Founder · staircase manufacturer · named expert for the Staircase Reference Brain
captured_at: 2026-07-28
type: expert_note
status: layer_1_evidence
intended_module: purchasing_principles
rule_b_compliance: authored by named expert (Philip O'Farrell) · not AI-authored · eligible to enter the Reference Brain through the governed authoring workflow (Layer 1 → draft → review → approved → published)
---

# Purchasing Principles for Staircase Manufacturers

*Expert note by Philip O'Farrell · captured 2026-07-28 · Layer 1 evidence · does NOT yet enter the Staircase Reference Brain (Layer 2) until it goes through the drafting / review / approval workflow.*

## Principle · Compare complete material packages

**Rule:** Never optimise one component price without checking related components.

**Reason:** Suppliers may compensate pricing across quantities and product groups. Pushing prices in one area can push prices up in another area where smaller quantities are overlooked.

### Structured form (for eventual Reference Brain module)

```json
{
  "principle": "compare_complete_material_packages",
  "trade": "staircase",
  "rule": "Never optimise one component price without checking related components",
  "reason": "Suppliers may compensate pricing across quantities and product groups"
}
```

### Worked example from the field

Two suppliers quote for a traditional oak staircase. The buyer is focused on baluster price because balusters are the highest-quantity item.

**Supplier A:**
- Balusters: £3.90 each (looks cheapest — buyer's attention lands here)
- Handrail:  £95
- Newels:    £120 each

**Supplier B:**
- Balusters: £4.30 each (looks more expensive)
- Handrail:  £70
- Newels:    £85 each

Full package for a 40-baluster staircase:

| Line | Supplier A | Supplier B |
|---|---:|---:|
| 40 balusters | £156 | £172 |
| 1 handrail   | £95  | £70  |
| 2 newels     | £240 | £170 |
| **Total**    | **£491** | **£412** |

The "cheaper baluster" supplier is £79 more expensive for the complete staircase. An experienced buyer sees this immediately. An inexperienced buyer or a naive software system does not.

### How NEX should apply this

Before an order goes out, if NEX has enough package composition data (from the Staircase Reference Brain) and enough supplier price data (from Materials Memory), it presents a **package comparison card**:

- What the owner is about to order
- What the alternative supplier would total
- Which line items caused the price difference

The comparison never blocks the order. Owner remains in control. NEX behaves like a senior buyer looking over the owner's shoulder — asking one good question, then stepping back.

### Where this shows up in the platform

1. **Staircase Reference Brain** — this principle enters as a purchasing rule module once Philip drafts and approves it through the governed authoring workflow.
2. **NEX Buying Intelligence** (roadmap) — reads the principle from the Brain and applies it whenever an order is drafted. Feature brief: `docs/product-constitution/roadmap/nex-buying-intelligence.md`.
3. **Hardwood Calculator** — when calculating requirements for a staircase, the calculator's "what to buy" recommendation should already be package-aware.

### Related principles worth authoring later

Philip has flagged these adjacent concepts but not yet formalised them:

- **Preferred supplier vs cheapest supplier** — long-term supplier relationships often carry hidden value (delivery reliability, credit terms, quality consistency) that a per-order price comparison misses.
- **Seasonal pricing awareness** — some timber types move price predictably through the year; a buying decision made in September should consider what December's price is likely to be.
- **Package granularity for different staircase styles** — Traditional / Contemporary / Winder / Cut string all have different component-package shapes. Comparison logic must know the shape before it can compare.

Each of the above will be captured as a separate expert note when Philip is ready to formalise it.

## Governance note

This document is Layer 1 evidence per the Three-Layer Knowledge Architecture:

- **Layer 1 (this document):** collected · not yet entered Reference Brain
- **Layer 2:** enters `hammerex_nex_brain_drafts` when Philip drafts it through the platform's authoring UI
- **Layer 3:** enters `hammerex_nex_brain_versions` when reviewed and approved
- Runtime composition then serves it back to Buying Intelligence workflows

The principle above is expert-authored (Rule B compliant) and traceable to a named expert (Rule C compliant). It is ready for promotion to Layer 2 at any time.
