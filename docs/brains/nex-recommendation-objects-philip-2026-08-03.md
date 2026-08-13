---
authored_by: Philip O'Farrell (directive · full schema) · Master AI Engineer (formalisation)
authored_role: Founder directive + Master AI Engineer implementation contract
captured_at: 2026-08-03
governance:
  rule_a_anti_fabrication: pass
  rule_c_attributable_origin: named_expert = Philip O'Farrell 2026-08-03
architecture_layer: L2 · extension of Phase D.6 Recommendation Engine
document_version: 1.0
document_type: MEGA_DOCTRINE · structured recommendation object schema
composes_with:
  - docs/brains/nex-recommendation-engine-philip-2026-08-03.md (Phase D.6 base)
  - docs/brains/nex-domain-quality-dashboard-philip-2026-08-03.md (Recommendation Graph refinement)
  - Foundation Brain 6 (Recommendations)
  - Foundation Brain 15 (End With Value)
---

# NEX Recommendation Objects

## The Directive

Philip 2026-08-03: *"Instead of recommendations being just text, every recommendation could become a structured object. Now recommendations become interactive building blocks, not paragraphs."*

This doctrine upgrades the Recommendation type from `{category, item, reason, source}` (Phase D.6 baseline) to a full first-class object with priority · budget · difficulty · timing · pros · cons · images · articles · questions · actions · compatibility.

## The Full Object Schema

```yaml
recommendation:

  id: rec_001                              # unique · sortable · loggable

  title: Match your staircase flooring     # one-line human-readable

  category: design                          # 12-category enum (existing)

  confidence: 0.94                          # 0..1 · sourced from retrieval

  priority: Recommended                     # Essential | Recommended | Optional | Luxury

  why: Oak flooring creates a continuous visual flow from hallway through kitchen to staircase, tying the whole home together.

  related_domains:
    - flooring
    - staircase

  estimated_cost:
    min_gbp: 2000
    max_gbp: 5000
    context: "for a typical 3-bed hallway + landing"

  difficulty: Medium                        # Easy | Medium | Complex | Expert

  best_time: "Before staircase installation"

  can_delay: true                           # whether it can be added later without disruption

  pros:
    - Better appearance
    - Easier installation when staircase is off
    - Increases property appeal

  cons:
    - Higher upfront cost
    - Slower to install if fitting around existing staircase

  images:                                   # specimen references from manifest
    - specimen_214
    - specimen_882

  brain_articles:                           # deep-dive articles to consult
    - _shared/design-coordination/articles/matching-your-kitchen-with-the-rest-of-your-home.md

  next_questions:                           # what to ask next to refine the recommendation
    - Which flooring suits oak?
    - Should skirting match?

  actions:                                  # user-clickable actions
    - id: view_examples
      label: View Examples
      leads_to: image_gallery_filtered_by_tag
    - id: compare_flooring
      label: Compare Flooring Types
      leads_to: comparison_view
    - id: calculate_budget
      label: Calculate Budget
      leads_to: budget_estimator

  compatibility:                            # Compatibility Engine · what pairs/conflicts
    matches:
      - element: oak_flooring
        stars: 5
      - element: white_shaker_kitchen
        stars: 5
      - element: walnut_doors
        stars: 5
      - element: grey_walls
        stars: 4
    conflicts:
      - element: high_gloss_black_kitchen
        stars: 2
      - element: red_laminate_flooring
        stars: 0
        reason: "Colour clashes · disrupts visual continuity"

  budget_impact:                            # Philip's Budget Impact schema
    extra_cost_gbp: 2000-5000
    savings_gbp: 300                        # if any (e.g. simpler installation)
    property_value_uplift_gbp: 4000
    can_delay: true

  ratings:                                  # human-scored quality of the recommendation itself
    priority_stars: 4                       # ★★★★☆
    typical_user_success: 0.87              # fraction of users who acted on this and reported success
```

## Priority Scores (Philip's model)

Every recommendation has a priority tier:

- **★★★★★ Essential** — must-do · project fails without this
- **★★★★ Recommended** — strong best-practice · most users should
- **★★★ Optional** — nice addition · depends on budget/preferences
- **★★ Luxury Upgrade** — premium tier · exceptional homes
- **★ Decorative** — cosmetic · low-impact

Example priority ranking for a kitchen project:

- ★★★★★ Appliances first
- ★★★★★ Electrical layout
- ★★★★ Flooring
- ★★★★ Staircase coordination
- ★★★ Lighting layers
- ★★ Optional wine cooler
- ★ Decorative shelves

**This helps users understand what MATTERS most.**

## Recommendation Packs

**Rule:** related recommendations can be bundled into named "packs" that Nex offers as one-click coordinated packages.

Example: **Modern Oak Home**

Automatically bundles:
- Oak staircase (★★★★★ Essential)
- Oak flooring (★★★★★ Essential)
- Oak internal doors (★★★★ Recommended)
- Oak skirting + architraves (★★★★ Recommended)
- Black handles across kitchen + doors + lighting (★★★★ Recommended)
- Glass balustrade (★★★ Optional)
- Warm-white LED throughout (★★★ Optional)
- White walls · matt paint (★★★ Optional)

**Everything coordinated. One recommendation set. One decision.**

Packs live at `data/nex-knowledge/_shared/design-coordination/packs/{pack-id}.yaml`.

## Budget Impact Contract

Every recommendation answers 4 budget questions:

1. **Extra cost** — how much more does this add?
2. **Savings** — does this reduce any cost elsewhere (bulk buying · shared install · shared warranty)?
3. **Property value uplift** — estimated resale-value contribution.
4. **Can delay** — can this be added later without disruption?

That makes recommendations **practical, not just aesthetic**.

## Image-Driven Recommendations

**Rule:** every recommendation carries specimen references from the image manifest — not just text.

Instead of *"An oak staircase looks nice with oak flooring"*, Nex surfaces:
- **5 coordinated examples** (A+ specimens showing oak staircase + oak flooring)
- **2 contrasting examples** (what NOT to pair with)
- **3 premium examples** (luxury-tier coordinated)
- **2 budget examples** (mid-tier coordinated)

The `images` field on each recommendation is a list of specimen IDs from the manifest. When rendered, Nex expands them into thumbnails + captions + click-to-view.

## Compatibility Engine

**Rule:** every product/element in Nex declares its compatibility matrix — ★★★★★ matches AND ✖ conflicts.

Example: **Oak Staircase**

Matches:
- ★★★★★ Oak flooring
- ★★★★★ White shaker kitchen
- ★★★★★ Walnut doors
- ★★★★ Grey walls
- ★★ High-gloss black kitchen

Conflicts:
- ✖ Red laminate flooring (colour clash)
- ✖ Chrome+black-gloss kitchen (era mismatch)

The compatibility matrix drives:
- Smarter recommendations (only suggest matches ≥★★★★)
- Warnings (surface conflicts BEFORE user commits)
- Explanations ("why is this suggested?" → cite compatibility star rating)

## The Recommendation Network

When every recommendation is a structured object with `related_domains` + `compatibility` + `images` + `packs`, the recommendations form a NETWORK:

```
Kitchen
  ↔ Flooring (★★★★★)
  ↔ Doors (★★★★)
  ↔ Staircase (★★★★★)
  ↔ Lighting (★★★★)
  ↔ Wall Panelling (★★★)
  ↔ Paint (★★★★)
  ↔ Handles (★★★★★)
  ↔ Splashbacks (★★★★)
  ↔ Furniture (★★★)
```

**A single kitchen question expands into an intelligent whole-home plan.**

The Recommendation Network is the runtime form of the Recommendation Graph (from the Domain Quality Dashboard doctrine).

## Pipeline Integration

The upgraded Recommendation type flows through the existing Phase D.6 pipeline (Stage 8b). The pipeline library now:

1. Generates recommendations using the FULL object schema (not just {category, item, reason, source}).
2. Includes priority + budget + images + actions in every recommendation.
3. Groups recommendations into packs when applicable.
4. Returns the RecommendationSet with pack membership annotations.

Downstream API + UI can render the same object as: plain text (compact chatbot) · card (mobile app) · full panel (desktop app) · pack browser (bundled packages).

**One object · many render targets.**

## Backward Compatibility

Existing recommendations shipped in Phase D.6 remain valid. The new fields are OPTIONAL — existing rules with only `{category, item, reason, source}` continue to work. Rules can be upgraded to full objects incrementally.

## Migration Path

1. **Phase D.6 baseline** — simple recommendations (SHIPPED)
2. **Phase D.7** (this doctrine) — object schema + priority + pros/cons + basic images (SHIPPING NOW)
3. **Phase D.8** (future) — Recommendation Packs (bundled sets)
4. **Phase D.9** (future) — Compatibility Engine runtime (matrix retrieval)
5. **Phase F** — Budget Impact + property value uplift (workspace persistence needed for personalisation)
6. **Phase F.5** — Actions execution (click "Calculate Budget" fires a real calculator)

## Composition

- **Phase D.6 Recommendation Engine** — the base engine. This doctrine upgrades the OBJECT SHAPE, not the pipeline stage.
- **Recommendation Graph** — the graph structure. This doctrine adds the OBJECT DEFINITION for graph nodes.
- **Design Pattern Library** — patterns are one kind of Recommendation Object with `category: design`.
- **5-Metric Quality Model** — recommendation quality now measurable via `typical_user_success` field (User Success metric).
- **Foundation Brain 6 (Recommendations)** — recommendations still follow reason + trade-off + alternative rule · now formalised in `pros` and `cons` fields.
- **Foundation Brain 15 (End With Value)** — every recommendation's `actions` list is the next-step offer.

## Enhancement Opportunity

Every AI competitor returns recommendations as prose ("you might also want to consider..."). Nex returns recommendations as structured objects that carry priority · budget · pros/cons · images · actions · compatibility. The user gets a CARD they can inspect · a PACK they can order as a set · a COMPATIBILITY MATRIX they can trust. That's the difference between a search result and a design decision. **That's untouchable.**
