# ADR-0039 · Reference Brain Engineering Discipline

**Status:** Accepted · Immutable
**Date:** 2026-07-28
**Author:** Philip
**Type:** Process discipline (NOT architecture — does not violate the ADR-0038 architectural freeze)
**Extends:** ADR-0037 (Living Trade Brains) · ADR-0038 (Five-Filter Rule + Five-Phase Roadmap)

---

## The reframe

Phase 3 is not "adding staircase knowledge."
Phase 3 is **Reference Brain Engineering** — the discipline of earning the right to become the reference professionals recommend.

> "Stop thinking of Phase 3 as 'adding staircase knowledge.' Think of it as 'earning the right to become the reference.'" — Philip, 2026-07-28

---

## The Trust Question (primary decision filter for Phase 3+)

Every improvement must answer one question:

> **Does this increase the probability that an experienced staircase professional will trust this brain tomorrow more than they trust it today?**

If the honest answer is "no" or "unclear," **do not build it.**

This filter sits alongside the Five-Filter Rule (ADR-0038). Where the Five-Filter tests fit-for-platform, the Trust Question tests fit-for-purpose. Both must pass before work begins.

---

## The Five Qualities every answer must improve

Every unit of authoring work must improve at least one of:

1. **Accuracy**
2. **Consistency**
3. **Explainability**
4. **Completeness**
5. **Honesty**

### Deliberate exclusion

**"Intelligence" is not on the list.**

The reference brain is not defined by being clever. It is defined by being **trusted**. Cleverness that does not strengthen one of the five above is not the discipline of Reference Brain Engineering — it is a distraction dressed up as sophistication.

---

## Definition of Done

The Staircase Brain is not complete because all modules are filled. It is complete when:

1. **Experienced professionals repeatedly agree** with its answers
2. **Unknown questions become rare**
3. **Corrections become uncommon**
4. **The knowledge remains current**
5. **Authors can explain why every important answer exists**
6. **The brain earns long-term trust**

Numeric targets from the earlier Phase 3 memory (≥95% coverage · <2% unknown · ≥95% expert agreement · no critical regressions · ≥95 readiness · sustained field trust) support these criteria but do not replace them. A brain that hits every number but fails criterion #1 is not done.

---

## The Lifetime Loop

The reference brain is not a product that finishes. It is a living body of professional knowledge that continuously becomes more trustworthy.

```
Question
   ↓
Answer
   ↓
Feedback
   ↓
Unknown?
   ↓
Author Review
   ↓
Research
   ↓
Certification
   ↓
Publish
   ↓
Observe
   ↓
Measure
   ↓
Improve
   ↓
Repeat
```

**This loop never ends.** Every existing platform primitive already supports it — no new architecture required to run it. The discipline is in running it *continuously*, not in building it.

Mapping to existing primitives:

| Loop step | Primitive |
|---|---|
| Question | `POST /api/nex/brains/[slug]/ask` |
| Answer | `BrainAnswerEnvelope` (explainability contract) |
| Feedback | `hammerex_nex_brain_field_outcomes` |
| Unknown? | `answer_kind IN ('unknown','low_confidence')` |
| Author Review | Draft Workspace (Phase 1) |
| Research | Off-platform · author's craft |
| Certification | `hammerex_nex_brain_certifications` |
| Publish | Draft → immutable Version + pointer flip |
| Observe | Phase 2 Timeline + Relationship Graph |
| Measure | Readiness Score + Maturity Ladder |
| Improve | New Draft |
| Repeat | forever |

---

## The vision beyond Phase 3

Five years out, each trade has its own reference brain:

- Staircase
- Roofing
- Plumbing
- Electrical
- HVAC
- Concrete
- Joinery
- Marine
- Agriculture

Each independently **trusted · certified · mature · explainable · auditable.**

The outcome is not "lots of AI assistants." The outcome is a **network of governed specialist intelligence** — a defensible position that cannot be replicated by another general-purpose LLM, because the moat is trust earned per domain, not model scale.

---

## How the three filters compose

Before authoring, spec-ing, or building any Phase 3+ work, the change must pass **all three** filters:

| Filter | Question | Source |
|---|---|---|
| Five-Filter Rule | Does it strengthen Knowledge · Trust · Observability · Collaboration · Learning? | ADR-0038 |
| Trust Question | Does it increase professional trust tomorrow vs today? | ADR-0039 (this) |
| Five Qualities | Does it improve Accuracy · Consistency · Explainability · Completeness · Honesty? | ADR-0039 (this) |

In practice a good change satisfies all three trivially. A change that requires justification against one of them is a signal to reconsider the change.

---

## Related

- ADR-0037 · Living Trade Brains
- ADR-0038 · Five-Filter Rule + Five-Phase Roadmap
- Memory: `feedback_nex_phase_3_reference_staircase_brain.md`
- Operational brief: `trades/docs/brains/staircase-phase-3-definition.md`
