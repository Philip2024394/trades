---
title: NEX Failure Intelligence Architecture · Standard v3 Candidate
type: nex_v3_candidate_reference
status: REFERENCE_MATERIAL · NOT_ARCHITECTURE · AWAITS_REALITY_SIGNAL
authored_by: Philip O'Farrell · 2026-07-31 · preserved verbatim
composes_with:
  - NEX-CONSTITUTION-v1.md (Principle 14 directly anchors this architecture · "Every significant failure must become governed knowledge, measurable improvement, or a protected regression test")
  - Creator Governance (Failure Intelligence proposes · Creator approves)
  - Validation Suite + Regression Framework (proves improvements actually improved · protects against recurrence)
reality_signal_to_unlock_v3_build: |
  NEX begins accumulating failures at a volume + variety that manual triage cannot keep up with.
  Currently: 7 Router builds · 1 documented regression (governance-resolved) · manual triage sufficient.
  Signal to build: >20 failures per week · or repeated failures on the same root cause suggesting systemic gap.
---

# NEX Failure Intelligence Architecture · Generation 3 Candidate (Philip 2026-07-31 · verbatim)

## Philosophy

*"Every failure is an opportunity to improve the system, but no failure changes the protected core without governance approval."*

Directly matches Constitution Principle 14 + Creator Governance principles.

## Eight Modules

| # | Module | Neuroscience Inspiration | Purpose |
|---|---|---|---|
| 1 | **Error Detection Engine** ⭐⭐⭐⭐⭐ | ACC | Recognise when something went wrong. Triggers: wrong subject · low confidence · user corrects NEX · validation failure · regression · customer abandons conversation · conflicting knowledge. Output: category · severity · confidence. No emotion · just detection. |
| 2 | **Failure Analysis Engine** | DLPFC | Classify root cause: missing alias · missing relationship · missing engineering knowledge · wrong intent · ambiguous wording · missing measurements · insufficient confidence threshold. Structured post-mortem. |
| 3 | **Knowledge Evaluation Engine** | OFC | Is this isolated · recurring · affects many users · worth changing the architecture · can current architecture solve? If insufficient evidence → keep observing. Prevents overfitting to individual conversations. |
| 4 | **Learning Proposal Engine** | — | NEX creates PROPOSALS · not changes. Example: *"23 users called 'big wooden side' → potential alias → String → confidence 91% → await creator approval."* Exactly the governance model already established. |
| 5 | **Reflection Engine** | Post-Error Slowing | After failure detected: don't immediately retry. Pause → Review → Alternative strategies → Choose best → Respond. Reflective reasoning · not reactive behaviour. |
| 6 | **Failure Memory** | — | Every failure becomes structured knowledge. Institutional memory of system evolution. Columns: Failure · Cause · Resolution · Status. |
| 7 | **Improvement Prioritiser** | — | Score failures by: Frequency · Severity · User impact · Engineering impact · Regression risk · Complexity to fix. High-scoring issues become roadmap candidates. |
| 8 | **Prevention Engine** | — | Once a failure is solved: protect against it. Failure → Validation Suite entry → Regression Test → Protected Forever. Formalises what Philip already does manually. |

## Complete Failure Lifecycle

```
Failure
   ↓
Detection (Error Detection Engine)
   ↓
Classification (Failure Analysis Engine)
   ↓
Root Cause (Failure Analysis Engine)
   ↓
Evidence (Knowledge Evaluation Engine)
   ↓
Proposal (Learning Proposal Engine)
   ↓
Creator Approval (Creator Governance)
   ↓
Implementation (Router build)
   ↓
Validation (Validation Suite)
   ↓
Regression Protection (Regression Framework)
   ↓
Knowledge (Failure Memory · ADR Index)
```

Complete engineering feedback loop.

## Explicit Rejection (Philip's discipline)

Do NOT implement:
- ❌ Frustration
- ❌ Disappointment
- ❌ Emotional pain
- ❌ Dopamine
- ❌ Anxiety

Biological mechanisms are fascinating but add no value for NEX. What matters: detect mistakes · analyse root causes · learn in a governed way · prevent recurrence.

## Placement in Architecture

Level 3 · Reasoning:

- Knowledge Graph
- Estimator
- Systems Thinking
- **Failure Intelligence** (this candidate)
- Reflection
- Confidence Engine

## Constitutional Anchor

Constitution Principle 14 (Philip 2026-07-31): *"Every significant failure must become governed knowledge, measurable improvement, or a protected regression test."*

Constitution Principle 13 (Philip 2026-07-31): *"Every increase in capability must be matched by an equal increase in transparency, governance and measurability."*

Failure Intelligence satisfies both.

## Composition with Existing Governance

- **Creator Governance** decides whether NEX may change
- **Failure Intelligence** determines what should be improved and why
- **Validation and Regression** prove improvements actually improved the system

*"NEX doesn't simply avoid mistakes — it systematically turns important mistakes into better architecture while remaining under creator control."*

---

## Gatekeeper Note

Preserved as v3 candidate per Reality-Over-Speculation. Standard v1 remains unmodified. Constitution Principle 14 already anchors this architecture. Reality signal for build: failure volume exceeds manual triage capacity.
