---
title: NEX Router Trace Format v1
version: 1.0
status: CANONICAL SPECIFICATION · ENGINEERING TOOL · NOT CUSTOMER-FACING
created: 2026-07-31
authored_by: Philip O'Farrell (format + two examples) · composed by Gatekeeper
composes_with:
  - NEX-ROUTER-VALIDATION-SUITE-v1.md (Trace is HOW Router exposes decisions · Suite is WHAT Router must achieve)
  - Failure Code Taxonomy R001-R008 (Suite §Failure Code Taxonomy)
  - Runtime Contract (Suite §Runtime Contract · Classify first · Confidence check · Clarify OR Retrieve)
purpose: |
  Every Router implementation MUST emit a trace of its internal decisions for every user query.
  Trace is for engineering diagnosis · never surfaced to customers.
  Enables: (a) targetable improvement · (b) regression detection · (c) failure-code assignment · (d) evidence-selection audit.
customer_facing_boundary: |
  CUSTOMERS SEE: natural language response OR clarifying question.
  DEVELOPERS SEE: the full Router Trace.
  Never surface Trace fields (confidence scores · rejected evidence · fail codes) to customers.
---

# NEX Router Trace Format v1

**Purpose:** every Router implementation must emit a Trace of its internal decisions for every user query. Trace is an engineering diagnostic · never customer-facing.

**When a Trace shows all five dimensions resolved with high confidence and correct evidence selection, the Router has demonstrated it thought its way to the answer.**

**When a Trace shows low confidence or wrong dimension resolution, the Fail Code tells engineers exactly where to focus.**

---

## Format · PASS Example (authored by Philip · preserved verbatim)

```
USER
How much for straight flight stairs?

──────────────────────────

Intent

✓ Quote (0.98)

Subject

✓ Straight Flight Staircase (0.99)

Brain

✓ Staircase Brain (0.97)

Knowledge Domain

✓ Pricing (0.94)

Information Type

✓ Cost (0.96)

Router Confidence

96%

Evidence Selected

✓ Straight Flight Profile
✓ Pricing Knowledge Base
✓ Estimating Guide

Evidence Rejected

✗ Sweeping Stair Profile
✗ Timber Knots
✗ Installation Workflow

Result

PASS
```

## Format · FAIL Example (authored by Philip · preserved verbatim)

```
USER

Need staircase

──────────────────────────

Intent

Purchase (0.41)

Confidence

LOW

Correct Behaviour

Ask clarification

Actual Behaviour

Retrieved generic article

Fail Code

R006
```

---

## Required Trace Fields

| Field | Purpose | Present on |
|---|---|---|
| `USER` | Verbatim user query | Every trace |
| `Intent` | Classified intent + per-dimension confidence (0.00–1.00) | Every trace |
| `Subject` | Classified subject + per-dimension confidence | Every trace |
| `Brain` | Selected brain + per-dimension confidence | Every trace |
| `Knowledge Domain` | Selected domain + per-dimension confidence | Every trace |
| `Information Type` | Selected info type + per-dimension confidence | Every trace |
| `Router Confidence` | Aggregate confidence % (composed from the five above) | Every trace |
| `Evidence Selected` | List of artefacts used (✓ marker) | PASS traces + FAIL traces where evidence was retrieved |
| `Evidence Rejected` | List of keyword-related artefacts deliberately NOT used (✗ marker) | PASS traces + FAIL traces where evidence was retrieved |
| `Correct Behaviour` | What should have happened (e.g. *"Ask clarification"*) | FAIL traces |
| `Actual Behaviour` | What did happen | FAIL traces |
| `Fail Code` | R001–R008 from Failure Code Taxonomy · comma-separated when multiple | FAIL traces |
| `Result` | PASS or FAIL | Every trace |

---

## Trace Rendering Rules

1. **Dimension markers:** `✓` when classification passes the expected value in the Validation Suite · plain value when classified but not compared · `Fail: <reason>` when the row fails a specific dimension.
2. **Confidence display:** always two decimal places for per-dimension (0.98) · integer percentage for Router aggregate (96%).
3. **Evidence markers:** `✓` for artefacts the Router selected · `✗` for keyword-related artefacts the Router deliberately rejected. `✗` list explains WHY the Router did not choose an obvious keyword match — this is the debugging value.
4. **Low Confidence display:** when Router Confidence is below threshold, the trace MUST show `Confidence: LOW` and skip the Evidence Selected/Rejected sections (retrieval did not run per the Runtime Contract).
5. **Fail Code required on any FAIL** — no bare `FAIL` results permitted.

---

## Customer-Facing vs Developer-Facing Boundary (locked)

Philip's exact directive: *"The Router Trace should be an engineering tool, not something customers ever see."*

| Audience | What they see |
|---|---|
| **Customer** | Natural language response OR clarifying question. For a Low Confidence trace, the customer sees something like: *"I can help you choose a staircase. Are you looking to buy one, compare staircase types, or see design ideas?"* |
| **Developer** | Full Router Trace (all fields · confidence scores · rejected evidence · fail codes) |

No confidence numbers · no fail codes · no rejected-evidence lists surface to end users. Ever.

---

## Integration with the Validation Suite

The Trace is HOW the Router exposes its decisions.
The Suite is WHAT the Router must achieve.

For every Suite row tested:

1. Router emits a Trace
2. Trace's classified values are compared to Suite's expected values
3. Trace's Evidence Selected is compared to Suite's expected Evidence Used
4. Result recorded as `Pass` or `Fail:R00X` per Suite convention
5. Failure Code populated from the Trace's Fail Code field
6. Aggregate pass rate + per-code failure counts reported

The Suite's `Evidence Used` column and the Trace's `Evidence Selected` + `Evidence Rejected` fields align exactly.

---

## Composition with the Constitution

- **Permanence Principle** — Trace is Runtime · ephemeral · never stored as knowledge (composes exactly with "responses are ephemeral")
- **Evidence First** — Trace makes Evidence Selected + Rejected explicit · so no hidden guessing
- **Unknown Rule** — Low Confidence trace forces clarification · never guessed evidence
- **Trust Metric** — Traces enable auditing of individual conversations against the 100-conversation trust test
- **Vocabulary Elasticity** — trace fields are constitutional · specific values within fields are empirical

---

## Growth Log

| Version | Date | Notes |
|---|---|---|
| v1 | 2026-07-31 | Format authored by Philip · two example traces (PASS + FAIL) verbatim · customer-facing boundary locked · integration with Validation Suite locked |
| *(future)* | | |

---

## The Four-Filter Constraint (Philip's authored guidance · applies to future proposals)

> **Every proposal must either:**
> - **improve the Router pass rate**,
> - **improve evidence quality**,
> - **reduce false retrievals**,
> - **or reduce clarification failures.**
>
> **Otherwise, don't propose it.**

This constraint applies to Gatekeeper (Claude) as strictly as any human contributor. Governance documents, architectural refinements, and new artefact types that do not measurably serve one of the four filters do not belong in the project's current phase.

---

**End of NEX Router Trace Format v1**

*Customers see conversation. Developers see the trace. Both are true at the same time.*
