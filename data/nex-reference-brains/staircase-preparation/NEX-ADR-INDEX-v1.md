---
title: NEX Architecture Decision Record (ADR) Index v1
version: 1.0
status: INSTITUTIONAL MEMORY · captures WHY not just WHAT
type: nex_adr_index
authored_by: Philip O'Farrell · 2026-07-31 (initial entries) · gatekeeper appends as decisions are made
composes_with:
  - NEX-CONSTITUTION-v1.md (Level 0 governs ADRs)
  - NEX-KNOWLEDGE-ARCHITECTURE-STANDARD-v1.md
  - NEX-COGNITIVE-MODEL-v1.md
purpose: |
  Six months from now, no one should be asking "Why did we do this?"
  Every important architectural decision is recorded here with reasoning · alternatives considered · reality signals.
---

# NEX Architecture Decision Record (ADR) Index v1

**Institutional memory.** Captures WHY every important decision was made · not just what the code does. Preserves reasoning for future contributors (human and AI).

---

## ADR-001 · User State composes with Intent · does not replace it

**Date:** 2026-07-31
**Author:** Philip O'Farrell
**Status:** Locked in NEX-COGNITIVE-MODEL-v1.md
**Context:** Router Build 0.06 regression exposed that "What's the difference between a string and a skirt?" could be both *Confused* (state) and *Compare* (intent). Forcing one label to win produced a false-fail.
**Decision:** User State and Intent are separate dimensions. A user can be Confused AND Comparing. Router MUST support composite classification.
**Consequence:** Simpler patterns · composable behaviour · matches how humans actually ask questions.

---

## ADR-002 · Standard v1 is immutable without explicit governance

**Date:** 2026-07-31
**Author:** Philip O'Farrell
**Status:** Locked
**Context:** Router builds 0.01–0.07 all improved measurably without any Standard v1 modification. Discipline held for 7 builds.
**Decision:** Standard v1 does not change casually. Modifications require the same ratification process as Constitutional Ruling #6.
**Consequence:** Predictable · reproducible · future contributors can rely on Standard v1 as stable ground.

---

## ADR-003 · Subject Intelligence uses concept resolution (not just alias matching)

**Date:** 2026-07-31
**Author:** Philip O'Farrell
**Status:** Adopted in Router Build 0.07 · full schema is v2 candidate
**Context:** Customers describe by function ("the piece you hold") · location ("the big post at the bottom") · appearance ("the flat bit you stand on") — not by technical vocabulary.
**Decision:** Subject Dictionary entries carry both `aliases` and `homeowner_terms`. Longest-match wins. Description → Concept → Subject.
**Consequence:** Router became qualitatively more useful for real customer language. +10.8% pass rate on the target class in v0.07.
**Alternatives considered:** Add more aliases (rejected — infinite tail · diminishing returns). Full ML embeddings (rejected — opacity violates Constitution principle 8).

---

## ADR-004 · Confidence is a separate dimension (not derived from other dimensions)

**Date:** 2026-07-31
**Author:** Philip O'Farrell
**Status:** Partially built (Router Confidence emitted per trace) · full Confidence Engine is v2 candidate
**Context:** Every answer needs to know how sure it is. Low confidence should trigger clarification · not guessed evidence.
**Decision:** Router Confidence (0.00–1.00) is aggregated from per-dimension confidences via geometric mean. Below CONFIDENCE_THRESHOLD → Clarify · never retrieve arbitrary evidence.
**Consequence:** Unknown Rule is enforced as executable code · not just aspiration.

---

## ADR-005 · Creator Governance replaces "Fear Architecture"

**Date:** 2026-07-31
**Author:** Philip O'Farrell
**Status:** Locked in Cognitive Foundation Milestone doc
**Context:** Proposals to use simulated fear · anxiety · dependency to keep NEX aligned. Philip rejected — fictional emotional states make behaviour less predictable · not more.
**Decision:** Creator Authority · Protected Core · Learning Approval · Confidence Before Action · Creator Dashboard. Alignment via governance mechanism · not simulated suffering.
**Consequence:** NEX has Creator Awareness · not Self-Preservation. Behaviour is dependable rather than emotionally motivated.

---

## ADR-006 · Reality signals are required before promoting v2 candidates

**Date:** 2026-07-31
**Author:** Philip O'Farrell
**Status:** Locked (Reality-Over-Speculation)
**Context:** Nine v2 candidates preserved by end of Generation 2 (Knowledge Confidence · Estimator Brain · Thinking Mode · Brain Evolution · Voice Production · Multilingual · Nine Capabilities · Cognitive Foundation Milestone · Generation 3 Cognitive Efficiency). Temptation to "just build them" is strong.
**Decision:** Every v2 candidate document names a specific reality signal that must appear before build. No build unless signal appears.
**Consequence:** Growth by evidence · not feature accumulation. Aligns with Roadmap Admission Rule.

---

## ADR-007 · Proportional Thinking is a core governance principle

**Date:** 2026-07-31
**Author:** Philip O'Farrell
**Status:** Locked (6th Creator Governance principle)
**Context:** Simple questions were getting overcomplicated answers · complex questions were getting under-reasoned answers. No principle governed the match.
**Decision:** NEX uses only the amount of reasoning necessary for the task. Question complexity determines processing intensity.
**Consequence:** Focused responses · faster where possible · deeper where required. Aligns with Generation 3's Cognitive Efficiency philosophy.

---

## ADR-008 · Level 0 is FROZEN at 9 documents · no more constitutional additions

**Date:** 2026-07-31
**Author:** Philip O'Farrell
**Status:** Locked
**Context:** Level 0 stack grew to 9 documents (Standard v1 · Cognitive Model v1 · Creator Governance · Constitution v1 · ADR Index · Glossary v1 · Validation Suite · Regression Framework · Health Dashboard). Philip's judgement: *"If you keep adding to Level 0, it risks becoming harder to reason about than the system it's supposed to govern."*
**Decision:** Level 0 is frozen at 9 documents. New ideas begin life as candidate documents · earn promotion into the Protected Core only via ratification pipeline.
**Consequence:** Level 0 becomes increasingly stable · discipline preserved · governance layer stays scannable.
**Rule:** *"Level 0 should become increasingly stable over time. New ideas should almost always begin life as candidate documents before they earn promotion into the protected core."*

---

## ADR-009 · Feature Freeze on new candidate ideas · focus shifts to proving cohesion

**Date:** 2026-07-31
**Author:** Philip O'Farrell
**Status:** Locked (short-term)
**Context:** 12+ candidate documents accumulated (Knowledge Confidence · Estimator · Thinking Mode · Brain Evolution · Voice · Multilingual · Nine Capabilities · Cognitive Foundation Milestone · Generation 3 Cognitive Efficiency · Marketing Intelligence · Failure Intelligence · Communication Intelligence · Executive Controller · Insight/Observation · KMI). Rich set of architectural components ready.
**Decision:** Declare a short-term Feature Freeze on brand-new candidate ideas. Focus shifts to proving existing candidates work together coherently.
**Top 3 Generation 3 implementation priorities:** Executive Controller · Knowledge Graph · Confidence Engine.
**Consequence:** Existing candidates get integrated · not diluted by ever more proposals. Reinforces Cognitive Foundation's stability.

---

## Appending Future ADRs

Format:

```
## ADR-XXX · [short decision statement]

**Date:** YYYY-MM-DD
**Author:** [author]
**Status:** [Adopted · Deferred · Rejected · Superseded by ADR-YYY]
**Context:** [what triggered the decision]
**Decision:** [what was decided]
**Consequence:** [expected impact]
**Alternatives considered:** [optional · what was rejected and why]
```

**Rule:** ADRs are append-only. Superseded ADRs are marked as such · never deleted. Institutional memory is preserved.
