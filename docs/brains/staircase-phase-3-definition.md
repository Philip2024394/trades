# Phase 3 · Reference Brain Engineering — Staircase Brain

**Status:** Definition · not yet in progress · begins after Phase 2 observability ships
**Owner:** Philip · authoring team
**Date:** 2026-07-28
**Reference ADRs:**
- [ADR-0038 · Five-Filter Rule + Five-Phase Roadmap](../DECISIONS/0038-living-brain-five-filter-rule-and-five-phase-roadmap.md)
- [ADR-0039 · Reference Brain Engineering Discipline](../DECISIONS/0039-reference-brain-engineering-discipline.md)
- [ADR-0040 · The Prime Sentence + The Professional Test](../DECISIONS/0040-prime-sentence-and-professional-test.md)

---

## The Prime Sentence (sits above everything below)

> **The purpose of every Brain is to become the most trusted professional reference in its field.**

Not the smartest. Not the biggest. Not the most advanced AI. Just the most trusted professional reference.

## The Professional Test (fourth filter)

Before any Phase 3 work, ask:

> "Would this make a master tradesperson more likely to recommend this Brain to another professional?"

Peer respect, not user satisfaction. If a staircase manufacturer ever says to another *"Use the Staircase Brain. It's right"* — Phase 3 has succeeded.

---

## The reframe

Phase 3 is not "adding staircase knowledge."
Phase 3 is **Reference Brain Engineering** — earning the right to become the reference professionals recommend.

## Mission

Create the first Staircase Brain that a professional staircase manufacturer or joiner trusts as their **first** source of knowledge.

**The goal is no longer writing code. The goal is building trust.**

---

## The Trust Question (primary filter for every improvement)

> Does this increase the probability that an experienced staircase professional will trust this brain tomorrow more than they trust it today?

**If not — don't build it.**

## The Five Qualities every answer must improve

1. Accuracy
2. Consistency
3. Explainability
4. Completeness
5. Honesty

**"Intelligence" is deliberately not on the list.** The reference brain is trusted, not clever.

---

## Every answer must be

- Correct
- Explainable
- Cited from the brain's own knowledge
- Reviewed
- Versioned
- Consistent
- Honest when uncertain

**The brain must never guess.**

---

## Five work streams

### 1. Complete the knowledge
Write every module to completion — nothing left as "coming soon":

- Materials
- Construction
- Manufacturing
- Installation
- Design
- Regulations
- Maintenance
- Fault finding
- Estimating
- Terminology
- Safety
- Tools

### 2. Fill every gap · Unknown → Knowledge pipeline

```
Unknown Question
      ↓
  Author Review
      ↓
    Research
      ↓
 Expert Review
      ↓
 Version Update
      ↓
   Published
```

Every unknown becomes future knowledge. Runtime already logs every unknown/low-confidence answer to `hammerex_nex_brain_answers`. Phase 2's Unknown Queue exposes them. Phase 3 drains them.

### 3. Measure everything (to improve the brain, not to produce reports)

Track weekly:

- Unknown answer rate
- Confidence distribution
- Review backlog
- Certification status
- Coverage by module
- Author activity
- Time since last review
- Post-publication accuracy

### 4. Challenge the brain (adversarial testing)

Do not ask easy questions. Ask questions designed to **break** the brain:

- Rare staircase layouts
- Historic stair construction
- Timber movement
- Curved handrail geometry
- Building code conflicts
- Manufacturing edge cases
- Site problems
- Customer disputes

Every failure enters the Unknown → Knowledge pipeline.

### 5. Professional validation (the most important part)

The Staircase Brain is not complete because the internal team believes it is.

It is complete when experienced staircase professionals repeatedly say:

> "Yes, that's exactly how I'd answer."

Professional testimony is the final gate. Not scores. Not internal reviews. Not internal enthusiasm.

---

## Numeric targets (become the Maturity Ladder's top-rung definition)

| Metric | Target |
|---|---|
| Knowledge Coverage | ≥95% of expected professional topics |
| Unknown Answer Rate | <2% |
| Expert Agreement | ≥95% on reviewed answers |
| Production Stability | No critical knowledge regressions |
| Readiness | ≥95 |
| Maturity | Highest production level with **sustained** field trust |

---

## The Lifetime Loop (Phase 3's operating cadence)

```
Question → Answer → Feedback → Unknown? → Author Review → Research → Certification → Publish → Observe → Measure → Improve → Repeat
```

The loop never ends. Every step already has a platform primitive. The discipline is running the loop *continuously*, not building it.

## Deliverable

The world's most trusted digital Staircase Brain.

Not a codebase. Not a UI. Not a platform. A brain.

---

## Why this discipline matters

Once one exceptional brain exists, the platform proves itself through the brain. Phase 4 (Clone Success) then becomes a repeatable process — change the domain, repeat authoring and validation, produce the next brain. That is what turns NEX from a staircase solution into a reusable system for creating trusted specialist intelligence across many industries.

---

## Related

- [ADR-0037 · Living Trade Brains](../DECISIONS/0037-living-trade-brains.md)
- [ADR-0038 · Five-Filter Rule + Five-Phase Roadmap](../DECISIONS/0038-living-brain-five-filter-rule-and-five-phase-roadmap.md)
- Memory: `feedback_nex_phase_3_reference_staircase_brain.md`
- Memory: `feedback_nex_brain_mission_principles_promise.md`
