---
title: NEX CKO 001 · Tread · First Cognitive Knowledge Object
type: nex_cko
cko_id: TREAD
schema_version: 1.0
status: REFERENCE_EXEMPLAR · first authored CKO · pattern-setter for every future subject
authored_by: Philip O'Farrell · 2026-07-31 · verbatim capture
composes_with:
  - NEX-CONSTITUTION-v1.md (Principle 15 · connected knowledge)
  - NEX-KNOWLEDGE-ARCHITECTURE-STANDARD-v1.md
  - nex-cognitive-foundation-milestone-and-generation-3-roadmap-2026-07-31.md (CKO 9-layer spec ratified 2026-07-31)
purpose: |
  First authored Cognitive Knowledge Object. Sets the pattern for every future CKO.
  Anchors the Architecture Stabilization Phase: from now on, effort flows into
  CKO authoring — not into new architectural concepts. Every Cognitive Worker
  will consume this same schema.
authoring_source: |
  Verbatim capture of Philip O'Farrell's authored guidance 2026-07-31. Includes
  Tread as the primary subject plus Increase-Tread-Thickness (Decision), Newel
  (Audience + Relationships), Handrail (Engineering Rationale WHY) as illustrative
  examples of specific CKO layers. Each other subject will receive its own full CKO
  in due course.
importer_note: |
  Follows the Importer Discipline memory (Philip 2026-07-31). Source authoring is
  never rewritten. Derived structures (worker inputs, graph edges) are extracted
  into separate files by future importers, never by editing this file.
---

# NEX CKO 001 · Tread

**The first authored Cognitive Knowledge Object.** Anchors the pattern for every future subject.

Philip O'Farrell 2026-07-31 · authoring verbatim.

---

## The Fact→Concept Transition (in one comparison)

**Before (a dictionary entry · fact):**

```yaml
Subject:
  id: TREAD
  aliases:
    - tread
    - step
```

**After (a Cognitive Knowledge Object · concept):**

See the full CKO below. This is the direction that separates NEX from typical AI systems. Most assistants retrieve isolated facts or embeddings. NEX authors governed cognitive knowledge where every concept carries meaning · relationships · engineering rationale · decision context · audience adaptation · and evidence.

---

## CKO 001 · Subject: Tread

```yaml
Subject:
  id: TREAD
  cko_id: CKO-0001            # frozen numeric ID · never changes even if canonical name evolves

  canonical_name: Tread

  homeowner_terms:
    - step
    - flat bit
    - piece you stand on

  trade_terms:
    - tread
    - walking surface

  purpose:
    Supports the user's weight while ascending and descending the staircase.

  engineering_reason:
    The tread depth determines comfort, walking rhythm, and contributes to safe movement.

  structural_role:
    Transfers load into the strings.

  interacts_with:
    - String
    - Riser
    - Nosing
    - Handrail
    - Newel

  depends_on:
    - String

  affects:
    - Comfort
    - Safety
    - Building Regulations
    - Stair Geometry

  customer_questions:
    - What is a tread?
    - Why are treads different sizes?
    - Can I replace a tread?
    - Why do oak treads move?

  misconceptions:
    - Every step is identical
    - Thickness is only cosmetic

  failure_modes:
    - Squeaking
    - Deflection
    - Movement
    - Wear

  materials:
    - Oak
    - Ash
    - Pine
    - Engineered Oak

  regulations:
    - Going
    - Rise relationship
    - Slip resistance

  maintenance:
    - Cleaning
    - Refinishing
    - Inspection

  audience_explanations:

    homeowner:
      A tread is the part you stand on.

    builder:
      Primary walking surface fixed between the strings.

    engineer:
      Horizontal structural member transferring live loads into the string assembly.

  confidence_sources:
    - Engineering Manual
    - Building Regulations
    - Manufacturing Standard

  version:
    1.0

  # Layer 9 · Activation (NEW · frozen 2026-07-31)
  # Which Cognitive Workers consume this CKO. Ends manual activation tracking.
  consumers:
    - Executive Controller
    - Knowledge Worker
    - Teaching Worker
    - Communication Worker
    - Knowledge Graph
    - Confidence Worker
    - Insight Worker
    - Failure Intelligence

  # Guardian visibility · Permission Engine enforces at retrieval time
  visibility: Public

  # Cognitive DNA · immutable identity within version
  cognitive_dna:
    knowledge_type:     Engineering
    reasoning_type:     Causal
    evidence_level:     High
    primary_audience:   Homeowner
    complexity:         Medium
    dependencies:       1        # String
    relationship_count: 5        # String · Riser · Nosing · Handrail · Newel
    teaching_priority:  High
    criticality:        Core
    confidence:         96%

  # 25th field · Cognitive Triggers (schema amendment 2026-07-31)
  # What reasoning this object activates when Executive Controller retrieves it.
  cognitive_triggers:
    - Load Path Reasoning
    - Safety Analysis
    - Timber Movement
    - Manufacturing Logic
    - Installation Planning
    - Customer Education
```

## CKO 001 · Maturity Scorecard (as of 2026-07-31)

| Layer | Status |
|---|---|
| 0 · Identity | ✅ |
| 1 · Understanding | ✅ |
| 2 · Engineering | 🟡 |
| 3 · Decision | 🟡 |
| 4 · Relationships | 🔴 |
| 5 · Experience | 🔴 |
| 6 · Communication | 🟡 |
| 7 · Evidence | 🟡 |
| 8 · Cognitive Metadata | 🔴 |
| 9 · Activation | ✅ |

**KAC (Knowledge Activation Coverage):** ≈ 45% at first authoring. Rises as later layers receive dedicated authoring passes.

---

## Decision Knowledge · reusable reasoning (probably even more valuable than facts)

*"Today NEX knows facts. Generation 3 should know decisions."*

Instead of `Fact: Oak treads are available in 32mm.` NEX stores decisions:

```yaml
Decision:
  id: INCREASE_TREAD_THICKNESS

  WHAT:
    Increase tread thickness.

  WHY:
    - Reduce deflection.
    - Increase stiffness.
    - Improve perceived quality.

  WHEN:
    - Large span.
    - Heavy use.
    - Commercial staircase.

  WHEN_NOT:
    - Small domestic staircase.
    - Budget constrained.

  TRADEOFFS:
    + stronger
    + quieter
    - heavier
    - more expensive

  COMMON_ERRORS:
    - Thinking thicker always means better.

  CUSTOMER_VIEW:
    Feels more solid.

  ENGINEER_VIEW:
    Improves stiffness ratio.

  CONFIDENCE:
    High
```

That becomes **reusable reasoning** — the Reasoning Worker can select "Increase Tread Thickness" as a decision path when a query hints at deflection · span · or perceived quality.

---

## Relationship Intelligence · dictionary → graph (the biggest missing piece)

Currently subjects are like dictionary entries. Generation 3 wants them to become a **graph**.

**Example graph traversal · Newel:**

```
Newel
  supports ↓
Handrail
  stabilises ↓
Balusters
  protect ↓
People
  → Safety
```

**Example graph traversal · String:**

```
String
  contains ↓
Tread
  determines ↓
Going
  affects ↓
Comfort
  → Customer Satisfaction
```

Now NEX can answer WHY naturally. Each edge is authored · governed · not inferred at runtime.

---

## Engineering Rationale · one stores information · the other stores understanding

Today many AI systems know:

```
Handrail height: 900mm
```

Generation 3 should know:

```yaml
Subject:
  id: HANDRAIL_HEIGHT

  value: 900mm

  WHY:
    - Keeps centre of gravity protected.
    - Allows comfortable grip.
    - Reduces fall severity.
    - Matches average human reach.
    - Validated by regulation and decades of testing.
```

Notice the difference. **One stores information. The other stores understanding.**

---

## Audience Intelligence · one subject · six audiences · no duplicated knowledge

Every subject explains itself differently. Same knowledge · different explanation.

**Example · Newel Post:**

| Audience | Explanation |
|---|---|
| **Homeowner** | The newel post is the large post that holds the handrail securely. |
| **Builder** | Structural termination point for the handrail and strings. |
| **Engineer** | Primary compression member transferring balustrade loads into the stair structure. |
| **Architect** | Dominant visual anchor of the balustrade. |
| **Sales** | Feature component available in traditional and contemporary styles. |
| **Marketing** | One of the most noticeable design features customers personalise. |

The Communication Worker selects the audience · the knowledge stays singular.

---

## Knowledge Relationships · the twelve relationship types

Every subject should also know:

| Relationship | Meaning |
|---|---|
| **Parent** | The subject this concept belongs to |
| **Children** | Sub-concepts contained within |
| **Neighbours** | Adjacent components |
| **Dependencies** | Must exist for this to function |
| **Alternatives** | Other choices that fulfil the same role |
| **Opposites** | Contrasting design or engineering choice |
| **Frequently confused with** | Common mis-identifications |
| **Usually appears with** | Typical companion components |
| **Normally installed before** | Sequence predecessor |
| **Normally installed after** | Sequence successor |
| **Can replace** | Valid substitution |
| **Cannot replace** | Invalid substitution |

**Example · Newel:**

```yaml
Newel:
  usually_appears_with:
    - Handrail
    - Balusters
    - Caps
    - Base rail

  confused_with:
    - Feature post
    - Fence post
    - Column

  installed_before:
    - Handrail

  installed_after:
    - Strings
```

---

## Cognitive Value · from lookup to reasoning

Instead of asking *"What is a newel?"* NEX can answer:

- *"Why does it exist?"*
- *"What happens without it?"*
- *"What changes if I move it?"*

**That is reasoning.**

---

## The 24-Field CKO Schema (superset of the 16-field Subject Intelligence · this is the authoring template)

1. Canonical Name
2. Aliases
3. Homeowner Terms
4. Trade Terms
5. Definition
6. Purpose
7. Engineering Rationale (WHY)
8. Structural Role
9. Relationships
10. Dependencies
11. Effects
12. Customer Questions
13. Misconceptions
14. Failure Modes
15. Materials
16. Regulations
17. Installation Order
18. Maintenance
19. Audience Explanations
20. Decision Knowledge Links
21. Evidence Sources
22. Confidence Level
23. Version History
24. Review Status

Every CKO uses this schema. Consistency means every Cognitive Worker operates on the same object without translation.

---

## Why This Direction (Philip 2026-07-31)

*"This is the direction that most clearly separates NEX from typical AI systems. Most assistants retrieve isolated facts or embeddings. What you're designing is a governed cognitive knowledge system where every concept carries meaning, relationships, engineering rationale, decision context, audience adaptation, and evidence. That structure allows the Executive Controller, Knowledge Graph, Confidence Engine, Teaching Intelligence, and Communication Intelligence to all work from the same canonical knowledge rather than duplicating logic.*

*If you build this layer well, the rest of Generation 3 becomes much simpler because every higher-level reasoning module will be operating on rich, connected knowledge instead of disconnected text."*

---

## What Happens Next (Gatekeeper Note)

CKO 001 · Tread is authored. The pattern is set. The Architecture Stabilization Phase is now genuinely underway — the next contribution is CKO 002 (candidate subjects: Newel · String · Handrail · Riser · Reclaimed Timber) authored to the same 24-field schema · not another architectural concept.

Standard v1 unchanged. Constitution v1 unchanged. Cognitive Foundation Milestone anchors the 9-layer CKO spec. This file anchors the first concrete instance.
