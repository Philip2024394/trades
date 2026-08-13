---
authored_by: Philip O'Farrell (directive) · Master AI Engineer (architecture)
authored_role: Founder directive + Master AI Engineer runtime design
captured_at: 2026-08-03
capture_medium: written contribution (evening)
governance:
  rule_a_anti_fabrication: pass
  rule_c_attributable_origin: named_expert = Philip O'Farrell 2026-08-03
architecture_layer: L2 · Phase D.6 · extension of the End-to-End Pipeline
document_version: 1.0
document_type: MEGA_DOCTRINE · governs the transformation from Q→A to Q→A→Recommendations
composes_with:
  - docs/brains/nex-end-to-end-pipeline-philip-2026-08-03.md (extends Stage 8)
  - docs/brains/nex-foundation-brain-06-recommendations-decisions-philip-2026-08-03.md (Brain 6 · Recommendations)
  - _shared/design-coordination/ (source of cross-domain recommendation rules)
  - _shared/trade-business/ (source of process recommendations · site visits · quotes · warranties)
---

# The Nex Recommendation Engine

## The Directive

Philip 2026-08-03: *"Instead of only answering questions, NEX should begin making recommendations."*

**Example:**

> User asks: *"I want a shaker kitchen."*
>
> Nex should automatically think:
>
> Kitchen → Shaker → Recommend:
> - Oak staircase
> - Oak flooring
> - Four-panel doors
> - Satin brass handles
> - Tongue & groove panelling
> - Quartz worktops
> - Heritage lighting
> - Utility room matching kitchen
> - Pantry
> - Boot room
> - Dining table style
> - Paint colours
>
> **The user didn't ask. Nex volunteered the recommendations.**

That becomes **The Nex Design Engine**.

## The New Response Shape

Instead of:

```
Question → Answer
```

It becomes:

```
Question
    ↓
Answer
    ↓
Recommendations
    ↓
Future ideas
    ↓
Things to consider
    ↓
Related products
    ↓
Budget guidance
    ↓
Timeline
    ↓
Common mistakes
    ↓
Maintenance
    ↓
Images
    ↓
Professionals required
    ↓
Planning checklist
    ↓
Next project
```

**That's an experience rather than a chatbot.**

## The 14 Recommendation Categories

Every substantive response can carry up to 14 categories of volunteered recommendations. Each is optional — surfaced when knowledge is available AND relevant.

| # | Category | Populates From | When to Fire |
|---|---|---|---|
| 1 | **Answer** | Retrieved knowledge (existing pipeline Stage 8) | Always |
| 2 | **Design recommendations** | `_shared/design-coordination/` + cross-domain retrieve | When query has a design/style dimension |
| 3 | **Future ideas** | `_shared/design-coordination/staircase-is-the-spine.md` + workspace context | When user is planning a project |
| 4 | **Things to consider** | Foundation Brain 4 (Asking Right Questions) + domain sub-areas | When decisions are being made |
| 5 | **Related products** | Cross-domain retrieve (kitchen → staircase → doors → flooring) | When query is product-focused |
| 6 | **Budget guidance** | `kitchen-vs-staircase-budget-allocation.md` + typical price ranges | When budget is relevant |
| 7 | **Timeline** | `_shared/trade-business/articles/quotation-workflow.md` + lead times | When user is planning to buy |
| 8 | **Common mistakes** | Domain "top mistakes" articles | When user is early in planning |
| 9 | **Maintenance** | `_shared/joinery-finishes/` + domain-specific maintenance | When purchase commitment is imminent |
| 10 | **Images** | A+ manifest specimens filtered by tags | Always when confidence ≥0.85 |
| 11 | **Professionals required** | `_shared/trade-business/` + domain-specific trade lists | When project needs multiple trades |
| 12 | **Planning checklist** | Domain-specific step-by-step articles | When user is starting a project |
| 13 | **Next project** | Workspace projects table + design coordination rules | When current project is nearing completion |
| 14 | **Sources** | Every cited item's provenance (Evidence Quality metric) | Always |

## The Composition Rules

**Rule 1 · Never overwhelm.** Surface a maximum of 5 recommendation categories per response · fewer for novice users (Brain 13 · Match User Knowledge). Homeowner_novice sees Design + Images + Timeline; Architect sees Design + Related products + Common mistakes + Planning checklist + Sources.

**Rule 2 · Every recommendation has evidence.** Each recommendation cites its source (Evidence Quality metric). No fabrication.

**Rule 3 · Every recommendation has a WHY.** Following Brain 6, each recommendation carries a one-line reason.

**Rule 4 · Every recommendation has an actionable next step.** Following Brain 15, each recommendation carries an optional next-step offer.

**Rule 5 · Cross-domain recommendations FIRE when the query touches a coordination-relevant domain.** A kitchen query fires staircase + doors + flooring + panelling recommendations because `_shared/design-coordination/` says these are always coordinated.

**Rule 6 · Recommendation depth matches user Identity Register.** Novices see 3-4 items per category; experts see 6-8. Depth is a Register signal, not a fixed rule.

## The Recommendation Trigger Table

| Query Type | Fires These Categories |
|---|---|
| *"I want a shaker kitchen"* | Design (staircase + flooring + doors + panelling) · Related products (handles · lighting) · Budget · Timeline · Images |
| *"How do I choose a worktop?"* | Answer · Design (matching cabinets) · Things to consider · Budget · Maintenance · Common mistakes |
| *"Stairs are squeaking"* | Answer · Things to consider (call joiner) · Professionals required · Maintenance |
| *"Design my kitchen"* | Design (full whole-home) · Future ideas · Things to consider · Planning checklist · Budget · Timeline · Professionals required · Images · Next project |
| *"Compare oak vs walnut"* | Answer · Design (which suits which home) · Related products · Maintenance · Images |
| *"When should I fit my kitchen?"* | Answer · Timeline · Planning checklist · Professionals required · Common mistakes |

## The Recommendation Data Structure

```typescript
type RecommendationCategory =
  | "design"
  | "future_ideas"
  | "considerations"
  | "related_products"
  | "budget"
  | "timeline"
  | "common_mistakes"
  | "maintenance"
  | "images"
  | "professionals"
  | "planning_checklist"
  | "next_project";

type Recommendation = {
  category: RecommendationCategory;
  item: string;              // "Oak staircase"
  reason: string;            // "Matches your shaker kitchen · repeats the oak flooring · classic pairing"
  source: string;            // "_shared/design-coordination/staircase-and-kitchen-relationship.md"
  next_step?: string;        // "Want to see 3 oak staircase reference images?"
  confidence: number;        // 0..1 · below 0.75 → suppress
};

type RecommendationSet = {
  categories: Record<RecommendationCategory, Recommendation[]>;
  total_count: number;
  register_adapted_for: string;
};
```

## The Pipeline Integration

The Recommendation Engine is a NEW pipeline stage — **Stage 8b** — inserted between Stage 8 (Assemble Response) and Stage 9 (Attach Sources):

```
1. User opens Nex
2. Identity recognised
3. Goal selected
4. Intent classified
5. Knowledge retrieved
6. Coverage checked
7. Confidence calculated
8. Response assembled
8b. RECOMMENDATIONS generated       ← NEW
9. Sources attached
10. Learning captured
11. Dashboard updated
```

## The Design Coordination Rule Engine

The Recommendation Engine reads coordination rules from `_shared/design-coordination/`:

- **Kitchen query** → auto-consult `matching-your-kitchen-with-the-rest-of-your-home.md` → recommend coordinated staircase + doors + flooring + panelling + skirting + handles.
- **Staircase query** → auto-consult `staircase-design-dos-and-donts.md` + `staircase-and-kitchen-relationship.md` → recommend coordinated kitchen + doors + flooring + handrail-matching-worktop.
- **Whole-home query** → auto-consult `staircase-is-the-spine.md` → recommend spine-based layout + sight-line-coordinated features.

## What This Changes for the User

**Before (Q→A):**

> User: *"I want a shaker kitchen."*
> Nex: *"Great. Shaker doors are timeless — here are some reference images."*

**After (Q→A→Recommendations):**

> User: *"I want a shaker kitchen."*
> Nex: *"Great. Shaker is one of the most versatile kitchen styles — it works in traditional and modern homes and is a safe long-term choice.*
>
> *💡 Design ideas you might want to consider (shaker kitchens work beautifully when paired with):*
> - *Oak staircase (matches the shaker joinery language · classic pairing)*
> - *Oak or engineered oak flooring (creates visual continuity from hallway to kitchen)*
> - *Four-panel internal doors (share the framed-panel language)*
> - *Satin brass handles (adds warmth · works on cabinets AND doors AND light fittings for coordination)*
> - *Tongue & groove wall panelling (in hallway or dining area · echoes cottage/farmhouse feel)*
>
> *💰 Typical UK cost: £15k-£40k for a bespoke shaker kitchen · £8k-£15k additional if you also do the coordinated staircase.*
>
> *⏱ Typical timeline: 12-22 weeks from first design meeting to fully finished kitchen · 6-10 weeks manufacturing lead.*
>
> *⚠️ Common mistakes to avoid: mixing too many timber colours · using different metal finishes throughout the house · ignoring how the kitchen and staircase look together.*
>
> *📸 Reference images: [4 A+ shaker specimens · click to view]*
>
> *🎯 Next step: Want me to design a coordinated shaker kitchen + staircase package for your home? I can put together a full whole-home joinery proposal."*

**That's the difference between a chatbot and an operating system for completing work.**

## Governance

- Every recommendation must cite `_shared/design-coordination/` OR the sourced domain's articles.
- Every recommendation is logged to `data/nex-learning-log.jsonl` so we can measure which recommendations users act on (User Success metric · Phase F).
- Recommendations that consistently produce zero user engagement → surface to Philip for review and possible removal.

## Enhancement Opportunity

Every AI competitor stops at "answer the question." Nex volunteers what the user didn't know to ask. That is what turns Nex from a search tool into a design consultant. Combined with the whole-home design coordination doctrine, this is what lets a customer walk into their new home 4 months later and feel like every element was designed by the same hand — because it was.

## Composition

- **Foundation Brain 6 (Recommendations)** — the conversational discipline for making recommendations · every recommendation follows its reason + trade-off + alternative rule.
- **Foundation Brain 15 (End With Value)** — every recommendation ends with an offered next step.
- **Knowledge Layer retrieve()** — the retrieval mechanism · Recommendation Engine calls retrieve() with cross-domain queries.
- **Coverage Score** — recommendations are only offered from domains at ≥Bronze maturity.
- **5-Metric Quality Model** — recommendation quality is measured on Evidence Quality (does it cite a source?) and User Success (does the user act on it?).
- **Existing pipeline** — extends Stage 8 without breaking the 11-stage flow.

## The Untouchable Effect

When Nex recommends the coordinated staircase + doors + flooring + panelling on a shaker kitchen query, the customer thinks: *"How did it know I'd want that?"*

The answer: Nex knew because Philip's Design Coordination doctrine says these things ARE coordinated. That doctrine is authored under Rule c, retrievable through the Knowledge Layer, and surfaced through the Recommendation Engine — three layers working together to make one thoughtful volunteered suggestion.

**That's what turns knowledge into experience. That's the untouchable difference.**
