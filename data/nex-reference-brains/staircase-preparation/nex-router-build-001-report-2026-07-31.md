---
title: NEX Router Build 0.01 — Report
build_id: 0.01
generated_by: scripts/nex-router-build-001.mjs
generated_at: 2026-07-31
classifier_type: pattern-based (deterministic · idempotent · no LLM)
composes_with:
  - NEX-ROUTER-VALIDATION-SUITE-v1.md (source of validation rows)
  - nex-router-validation-derived-entries-2026-07-31.md (source of derived rows)
  - NEX-ROUTER-TRACE-FORMAT-v1.md (trace rendering format)
  - NEX-ROUTER-BUILD-DASHBOARD-v1.html (dashboard rendering format)
regenerate: node scripts/nex-router-build-001.mjs
---

# NEX Router Build 0.01 — Report

**Classifier:** pattern-based (deterministic · no LLM · Stage 2 pattern-table approach per research report)

## Summary

| Metric | Value |
|---|---|
| Total questions tested | 11 |
| Passed | **5** |
| Failed | **6** |
| Pass Rate | **45.5%** |
| Acceptance target | ≥95% |
| Status | ⚠️ BELOW target |

## Failure Code Breakdown

| Code | Meaning | Count |
|---|---|---|
| R001 | Wrong intent detected | 2 |
| R002 | Wrong subject detected | 1 |
| R003 | Wrong brain selected | 1 |
| R004 | Wrong knowledge domain | 3 |
| R005 | Wrong information type | 4 |
| R006 | Clarification should have been requested | 1 |
| R007 | Retrieved incorrect evidence | 0 · *N/A in Build 0.01 (no retrieval layer yet)* |
| R008 | Response contradicted evidence | 0 · *N/A in Build 0.01 (no composition layer yet)* |

## Top Failure

**Wrong info type (R005) — 4 cases · e.g. "Need staircase"**

## Per-Question Traces

### Q1 · starter · PASS

```
USER
What type of staircase?

──────────────────────────

Intent
✓ Learn (0.88)

Subject
✓ Staircase (0.88)

Brain
✓ Staircase (0.85)

Knowledge Domain
✓ Classification (0.90)

Information Type
✓ Types (0.90)

Router Confidence
88%

Result
PASS
```

### Q2 · starter · PASS

```
USER
Straight flight oak staircase images

──────────────────────────

Intent
✓ Browse (0.92)

Subject
✓ Straight flight (0.88)

Brain
✓ Staircase (0.85)

Knowledge Domain
✓ Reference Gallery (0.92)

Information Type
✓ Images (0.92)

Router Confidence
90%

Result
PASS
```

### Q3 · starter · PASS

```
USER
What size newel post?

──────────────────────────

Intent
✓ Learn (0.88)

Subject
✓ Newel post (0.88)

Brain
✓ Staircase (0.85)

Knowledge Domain
✓ Components (0.88)

Information Type
✓ Dimensions (0.90)

Router Confidence
88%

Result
PASS
```

### Q4 · starter · PASS

```
USER
What woods are available?

──────────────────────────

Intent
✓ Learn (0.88)

Subject
✓ Timber (0.88)

Brain
✓ Materials (0.85)

Knowledge Domain
✓ Species (0.85)

Information Type
✓ Options (0.88)

Router Confidence
87%

Result
PASS
```

### Q5 · starter · FAIL:R005

```
USER
Need staircase

──────────────────────────

Intent
✓ Buy (0.70)

Subject
✓ Staircase (0.88)

Brain
✓ Staircase (0.85)

Knowledge Domain
✓ Sales (0.80)

Information Type
Fail Definition (0.50)

Router Confidence
73%

Fail Code
R005

Result
FAIL:R005
```

### Q6 · starter · PASS

```
USER
How much for straight flight stairs?

──────────────────────────

Intent
✓ Quote (0.95)

Subject
✓ Straight flight (0.88)

Brain
✓ Staircase (0.85)

Knowledge Domain
✓ Pricing (0.90)

Information Type
✓ Cost (0.95)

Router Confidence
91%

Result
PASS
```

### Q7 · derived · FAIL:R002,R003

```
USER
Can I supply my own timber for my staircase?

──────────────────────────

Intent
✓ Advise (0.80)

Subject
Fail Timber (0.88)

Brain
Fail Materials (0.85)

Knowledge Domain
✓ Customer FAQ (0.80)

Information Type
✓ Best Practice (0.75)

Router Confidence
81%

Fail Codes
R002, R003

Result
FAIL:R002,R003
```

### Q8 · derived · FAIL:R001,R004

```
USER
Can my site carpenter install my new staircase instead of the staircase company's installers?

──────────────────────────

Intent
Fail Service (0.85)

Subject
✓ Site carpenter (0.88)

Brain
✓ Staircase (0.85)

Knowledge Domain
Fail Installation (0.85)

Information Type
✓ Best Practice (0.75)

Router Confidence
83%

Fail Codes
R001, R004

Result
FAIL:R001,R004
```

### Q9 · derived · FAIL:R005

```
USER
Can my staircase maker also make a matching hallway table or other furniture?

──────────────────────────

Intent
✓ Advise (0.80)

Subject
✓ Matching furniture (0.88)

Brain
✓ Staircase (0.85)

Knowledge Domain
✓ Customer FAQ (0.80)

Information Type
Fail Best Practice (0.75)

Router Confidence
81%

Fail Code
R005

Result
FAIL:R005
```

### Q10 · derived · FAIL:R001,R004,R005

```
USER
Can the staircase installation team fit my loft ladder while they're on site?

──────────────────────────

Intent
Fail Service (0.85)

Subject
✓ Loft ladder (0.88)

Brain
✓ Staircase (0.85)

Knowledge Domain
Fail Installation (0.85)

Information Type
Fail Definition (0.50)

Router Confidence
77%

Fail Codes
R001, R004, R005

Result
FAIL:R001,R004,R005
```

### Q11 · derived · FAIL:R004,R005,R006

```
USER
Is installing a staircase on a new build just the responsibility of the staircase company?

──────────────────────────

Intent
✓ Learn (0.45)

Subject
✓ New build (0.88)

Brain
✓ Staircase (0.85)

Knowledge Domain
Fail Knowledge Base (0.60)

Information Type
Fail Definition (0.50)

Router Confidence
63%  (LOW)

Correct Behaviour
Retrieve evidence

Actual Behaviour
Would ask clarifying question (retrieval skipped per Runtime Contract)

Fail Codes
R004, R005, R006

Result
FAIL:R004,R005,R006
```


---

## Notes for the next Build

- Build 0.01 covers Router dimensions 1-5 (Intent · Subject · Brain · Domain · Information Type) + Clarify decision. R007/R008 not applicable until retrieval + composition layers are added.
- Pattern-based classifier is deterministic + idempotent → identical output on re-run.
- Failure codes above tell the next build exactly which patterns to extend.
- Suggested Build 0.02: swap in LLM-based structured output for the intents where pattern coverage falls short (per research report Stage 1).
- Suggested Build 0.03: add retrieval scoped to the classified Brain + Knowledge Domain (research report Stage 4).

*Every improvement is measurable. Every regression is visible. No debate. No opinion.*
