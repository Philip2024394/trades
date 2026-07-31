---
title: NEX Router Build 0.02 — Report
build_id: 0.02
generated_by: scripts/nex-router-build-002.mjs
generated_at: 2026-07-31
classifier_type: pattern-based (deterministic · idempotent · no LLM)
changes_from_0_01: |
  R005 targeted as a class per Philip's 2026-07-31 direction.
  Info Type patterns extended for Inquiry / Pricing / Gallery / Classification.
  Synonym map extended: Cost≈Pricing · Images≈Gallery · Types≈Classification · Inquiry≈Enquiry.
  Buy intent Info Type = Inquiry (not Definition fallback).
  Quote intent Info Type = Pricing (Cost accepted synonym).
  Browse intent Info Type = Gallery (Images accepted synonym).
  Learn "different X types" → Classification.
regenerate: node scripts/nex-router-build-002.mjs
---

# NEX Router Build 0.02 — Report

**Classifier:** pattern-based (deterministic · Build 0.02 targets R005 as a class)

## Summary

| Metric | Value |
|---|---|
| Total questions tested | 21 |
| Passed | **12** |
| Failed | **9** |
| Pass Rate | **57.1%** |
| Acceptance target | ≥95% |
| Status | ⚠️ BELOW target |

## Failure Code Breakdown (PRIMARY KPI · Philip 2026-07-31)

| Code | Meaning | Count |
|---|---|---|
| R001 | Wrong intent | 2 |
| R002 | Wrong subject | 4 |
| R003 | Wrong brain | 1 |
| R004 | Wrong knowledge domain | 3 |
| R005 | Wrong information type | 4 |
| R006 | Clarification should have been requested | 1 |
| R007 | Retrieved incorrect evidence | 0 · *N/A no retrieval layer yet* |
| R008 | Response contradicted evidence | 0 · *N/A no composition layer yet* |

## Top Failure

**Wrong subject (R002) — 4 cases · e.g. "Can I buy stairs?"**

## Per-Question Traces

### Q1 · suite · PASS

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
✓ Classification (0.92)

Information Type
✓ Classification (0.92)

Router Confidence
89%

Result
PASS
```

### Q2 · suite · PASS

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
✓ Gallery (0.92)

Router Confidence
90%

Result
PASS
```

### Q3 · suite · PASS

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

### Q4 · suite · PASS

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

### Q5 · suite · PASS

```
USER
Need staircase

──────────────────────────

Intent
✓ Buy (0.75)

Subject
✓ Staircase (0.88)

Brain
✓ Staircase (0.85)

Knowledge Domain
✓ Sales (0.85)

Information Type
✓ Inquiry (0.75)

Router Confidence
81%

Result
PASS
```

### Q6 · suite · PASS

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
✓ Pricing (0.95)

Router Confidence
91%

Result
PASS
```

### Q7 · suite · PASS

```
USER
Need staircase

──────────────────────────

Intent
✓ Buy (0.75)

Subject
✓ Staircase (0.88)

Brain
✓ Staircase (0.85)

Knowledge Domain
✓ Sales (0.85)

Information Type
✓ Inquiry (0.75)

Router Confidence
81%

Result
PASS
```

### Q8 · suite · PASS

```
USER
Looking for stairs

──────────────────────────

Intent
✓ Buy (0.75)

Subject
✓ Staircase (0.88)

Brain
✓ Staircase (0.85)

Knowledge Domain
✓ Sales (0.85)

Information Type
✓ Inquiry (0.75)

Router Confidence
81%

Result
PASS
```

### Q9 · suite · FAIL:R005,R006

```
USER
Can I buy stairs?

──────────────────────────

Intent
✓ Buy (0.90)

Subject
✓ Staircase (0.88)

Brain
✓ Staircase (0.85)

Knowledge Domain
✓ Sales (0.85)

Information Type
✗ Best Practice (0.75)

Router Confidence
84%

Fail Codes
R005, R006

Result
FAIL:R005,R006
```

### Q10 · suite · PASS

```
USER
Want oak stairs

──────────────────────────

Intent
✓ Buy (0.75)

Subject
✓ Oak (0.88)

Brain
✓ Materials (0.85)

Knowledge Domain
✓ Sales (0.85)

Information Type
✓ Inquiry (0.75)

Router Confidence
81%

Result
PASS
```

### Q11 · suite · FAIL:R002

```
USER
Need quote

──────────────────────────

Intent
✓ Quote (0.95)

Subject
✗ Unknown (0.30)

Brain
✓ Staircase (0.85)

Knowledge Domain
✓ Pricing (0.90)

Information Type
✓ Pricing (0.95)

Router Confidence
73%

Fail Code
R002

Result
FAIL:R002
```

### Q12 · suite · FAIL:R002

```
USER
How much?

──────────────────────────

Intent
✓ Quote (0.95)

Subject
✗ Unknown (0.30)

Brain
✓ Staircase (0.85)

Knowledge Domain
✓ Pricing (0.90)

Information Type
✓ Pricing (0.95)

Router Confidence
73%

Fail Code
R002

Result
FAIL:R002
```

### Q13 · suite · FAIL:R002

```
USER
Show me images

──────────────────────────

Intent
✓ Browse (0.92)

Subject
✗ Unknown (0.30)

Brain
✓ Staircase (0.85)

Knowledge Domain
✓ Reference Gallery (0.92)

Information Type
✓ Gallery (0.92)

Router Confidence
72%

Fail Code
R002

Result
FAIL:R002
```

### Q14 · suite · PASS

```
USER
Different staircase types

──────────────────────────

Intent
✓ Learn (0.88)

Subject
✓ Staircase (0.88)

Brain
✓ Staircase (0.85)

Knowledge Domain
✓ Classification (0.92)

Information Type
✓ Classification (0.92)

Router Confidence
89%

Result
PASS
```

### Q15 · suite · PASS

```
USER
What is a newel?

──────────────────────────

Intent
✓ Learn (0.88)

Subject
✓ Newel post (0.88)

Brain
✓ Staircase (0.85)

Knowledge Domain
✓ Components (0.70)

Information Type
✓ Definition (0.80)

Router Confidence
82%

Result
PASS
```

### Q16 · suite · PASS

```
USER
What size newel?

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

### Q17 · derived · FAIL:R002,R003

```
USER
Can I supply my own timber for my staircase?

──────────────────────────

Intent
✓ Advise (0.80)

Subject
✗ Timber (0.88)

Brain
✗ Materials (0.85)

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

### Q18 · derived · FAIL:R001,R004

```
USER
Can my site carpenter install my new staircase instead of the staircase company's installers?

──────────────────────────

Intent
✗ Service (0.85)

Subject
✓ Site carpenter (0.88)

Brain
✓ Staircase (0.85)

Knowledge Domain
✗ Installation (0.85)

Information Type
✓ Best Practice (0.75)

Router Confidence
83%

Fail Codes
R001, R004

Result
FAIL:R001,R004
```

### Q19 · derived · FAIL:R005

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
✗ Best Practice (0.75)

Router Confidence
81%

Fail Code
R005

Result
FAIL:R005
```

### Q20 · derived · FAIL:R001,R004,R005

```
USER
Can the staircase installation team fit my loft ladder while they're on site?

──────────────────────────

Intent
✗ Service (0.85)

Subject
✓ Loft ladder (0.88)

Brain
✓ Staircase (0.85)

Knowledge Domain
✗ Installation (0.85)

Information Type
✗ Definition (0.50)

Router Confidence
77%

Fail Codes
R001, R004, R005

Result
FAIL:R001,R004,R005
```

### Q21 · derived · FAIL:R004,R005

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
✗ Components (0.70)

Information Type
✗ Definition (0.50)

Router Confidence
65%

Fail Codes
R004, R005

Result
FAIL:R004,R005
```

