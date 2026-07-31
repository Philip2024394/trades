---
title: NEX Router Build 0.03 — Report
build_id: 0.03
generated_by: scripts/nex-router-build-003.mjs
generated_at: 2026-07-31
classifier_type: pattern-based + SUBJECT DICTIONARY (Build 0.03 addition)
changes_from_0_02: |
  1. Subject Dictionary introduced (Philip's 2026-07-31 directive: "Not more patterns. A Subject Dictionary.").
     Canonical subject → alias list. Longest-alias-match wins. Normalisation before classification.
  2. Material extracted as separate dimension metadata (oak stairs → STAIRCASE + Material=Oak).
  3. Regression detection added. Both Build 0.02 + Build 0.03 classifiers run against same corpus.
     Reports: Previously Passed → Still Passed · Previously Failed → Now Passed · Previously Passed → Now Failed.
regenerate: node scripts/nex-router-build-003.mjs
---

# NEX Router Build 0.03 — Report

**Classifier:** pattern-based + Subject Dictionary (Build 0.03 · normalisation layer before classification)

## Summary

| Metric | Value |
|---|---|
| Total questions tested | 21 |
| Passed | **12** |
| Failed | **9** |
| Pass Rate | **57.1%** |
| Build 0.02 Pass Rate (baseline) | 52.4% |
| Delta vs 0.02 | **+4.7%** |
| Acceptance target | ≥95% |
| Status | ⚠️ BELOW target |

## Regression Detection (Philip 2026-07-31)

| State | Count | Meaning |
|---|---|---|
| Still Passed | 11 | Passed in 0.02 · still passes in 0.03 |
| Improved | **1** | Failed in 0.02 · now passes in 0.03 |
| Regressed | **0** | Passed in 0.02 · now fails in 0.03 (⚠️ real progress test) |
| Still Failed | 9 | Failed in 0.02 · still fails in 0.03 |
| **Net Gain** | **+1** | Improved minus Regressed |

**No regressions.** All previously-passing questions still pass.


**Improved questions (v002 fail → v003 pass):**

- `Want oak stairs` · v002 FAIL:R002,R003 → v003 PASS


## Failure Code Breakdown (Build 0.03)

| Code | Meaning | Count |
|---|---|---|
| R001 | Wrong intent | 2 |
| R002 | Wrong subject | 5 |
| R003 | Wrong brain | 0 |
| R004 | Wrong knowledge domain | 3 |
| R005 | Wrong information type | 4 |
| R006 | Clarification should have been requested | 1 |
| R007 | Retrieved incorrect evidence | 0 · *N/A no retrieval layer yet* |
| R008 | Response contradicted evidence | 0 · *N/A no composition layer yet* |

## Top Failure

**Wrong subject (R002) — 5 cases · e.g. "Can I buy stairs?"**

## Per-Question Traces (Build 0.03 outputs)

### Q1 · suite · PASS · still-passed

```
USER
What type of staircase?

──────────────────────────

Intent
✓ Learn (0.88)

Subject
✓ Staircase (0.92)

Brain
✓ Staircase (0.85)

Knowledge Domain
✓ Classification (0.92)

Information Type
✓ Classification (0.92)

Router Confidence
90%

Result
PASS
```

### Q2 · suite · PASS · still-passed

```
USER
Straight flight oak staircase images

──────────────────────────

Intent
✓ Browse (0.92)

Subject
✓ Straight flight (0.92)
Material (derived)
✓ Oak


Brain
✓ Staircase (0.85)

Knowledge Domain
✓ Reference Gallery (0.92)

Information Type
✓ Gallery (0.92)

Router Confidence
91%

Result
PASS
```

### Q3 · suite · PASS · still-passed

```
USER
What size newel post?

──────────────────────────

Intent
✓ Learn (0.88)

Subject
✓ Newel post (0.92)

Brain
✓ Staircase (0.85)

Knowledge Domain
✓ Components (0.88)

Information Type
✓ Dimensions (0.90)

Router Confidence
89%

Result
PASS
```

### Q4 · suite · PASS · still-passed

```
USER
What woods are available?

──────────────────────────

Intent
✓ Learn (0.88)

Subject
✓ Timber (via alias "woods") (0.85)

Brain
✓ Materials (0.85)

Knowledge Domain
✓ Species (0.85)

Information Type
✓ Options (0.88)

Router Confidence
86%

Result
PASS
```

### Q5 · suite · PASS · still-passed

```
USER
Need staircase

──────────────────────────

Intent
✓ Buy (0.75)

Subject
✓ Staircase (0.92)

Brain
✓ Staircase (0.85)

Knowledge Domain
✓ Sales (0.85)

Information Type
✓ Inquiry (0.75)

Router Confidence
82%

Result
PASS
```

### Q6 · suite · PASS · still-passed

```
USER
How much for straight flight stairs?

──────────────────────────

Intent
✓ Quote (0.95)

Subject
✓ Straight flight (0.92)

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

### Q7 · suite · PASS · still-passed

```
USER
Need staircase

──────────────────────────

Intent
✓ Buy (0.75)

Subject
✓ Staircase (0.92)

Brain
✓ Staircase (0.85)

Knowledge Domain
✓ Sales (0.85)

Information Type
✓ Inquiry (0.75)

Router Confidence
82%

Result
PASS
```

### Q8 · suite · PASS · still-passed

```
USER
Looking for stairs

──────────────────────────

Intent
✓ Buy (0.75)

Subject
✓ Staircase (via alias "stairs") (0.85)

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

### Q9 · suite · FAIL:R005,R006 · still-failed

```
USER
Can I buy stairs?

──────────────────────────

Intent
✓ Buy (0.90)

Subject
✓ Staircase (via alias "stairs") (0.85)

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

### Q10 · suite · PASS · improved

```
USER
Want oak stairs

──────────────────────────

Intent
✓ Buy (0.75)

Subject
✓ Staircase (via alias "oak stairs") (0.92)
Material (derived)
✓ Oak


Brain
✓ Staircase (0.85)

Knowledge Domain
✓ Sales (0.85)

Information Type
✓ Inquiry (0.75)

Router Confidence
82%

Result
PASS
```

### Q11 · suite · FAIL:R002 · still-failed

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

### Q12 · suite · FAIL:R002 · still-failed

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

### Q13 · suite · FAIL:R002 · still-failed

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

### Q14 · suite · PASS · still-passed

```
USER
Different staircase types

──────────────────────────

Intent
✓ Learn (0.88)

Subject
✓ Staircase (0.92)

Brain
✓ Staircase (0.85)

Knowledge Domain
✓ Classification (0.92)

Information Type
✓ Classification (0.92)

Router Confidence
90%

Result
PASS
```

### Q15 · suite · PASS · still-passed

```
USER
What is a newel?

──────────────────────────

Intent
✓ Learn (0.88)

Subject
✓ Newel post (via alias "newel") (0.85)

Brain
✓ Staircase (0.85)

Knowledge Domain
✓ Components (0.70)

Information Type
✓ Definition (0.80)

Router Confidence
81%

Result
PASS
```

### Q16 · suite · PASS · still-passed

```
USER
What size newel?

──────────────────────────

Intent
✓ Learn (0.88)

Subject
✓ Newel post (via alias "newel") (0.85)

Brain
✓ Staircase (0.85)

Knowledge Domain
✓ Components (0.88)

Information Type
✓ Dimensions (0.90)

Router Confidence
87%

Result
PASS
```

### Q17 · derived · FAIL:R002 · still-failed

```
USER
Can I supply my own timber for my staircase?

──────────────────────────

Intent
✓ Advise (0.80)

Subject
✗ Staircase (0.92)

Brain
✓ Staircase (0.85)

Knowledge Domain
✓ Customer FAQ (0.80)

Information Type
✓ Best Practice (0.75)

Router Confidence
82%

Fail Code
R002

Result
FAIL:R002
```

### Q18 · derived · FAIL:R001,R004 · still-failed

```
USER
Can my site carpenter install my new staircase instead of the staircase company's installers?

──────────────────────────

Intent
✗ Service (0.85)

Subject
✓ Site carpenter (0.92)

Brain
✓ Staircase (0.85)

Knowledge Domain
✗ Installation (0.85)

Information Type
✓ Best Practice (0.75)

Router Confidence
84%

Fail Codes
R001, R004

Result
FAIL:R001,R004
```

### Q19 · derived · FAIL:R005 · still-failed

```
USER
Can my staircase maker also make a matching hallway table or other furniture?

──────────────────────────

Intent
✓ Advise (0.80)

Subject
✓ Matching furniture (via alias "hallway table") (0.92)

Brain
✓ Staircase (0.85)

Knowledge Domain
✓ Customer FAQ (0.80)

Information Type
✗ Best Practice (0.75)

Router Confidence
82%

Fail Code
R005

Result
FAIL:R005
```

### Q20 · derived · FAIL:R001,R004,R005 · still-failed

```
USER
Can the staircase installation team fit my loft ladder while they're on site?

──────────────────────────

Intent
✗ Service (0.85)

Subject
✓ Loft ladder (0.92)

Brain
✓ Staircase (0.85)

Knowledge Domain
✗ Installation (0.85)

Information Type
✗ Definition (0.50)

Router Confidence
78%

Fail Codes
R001, R004, R005

Result
FAIL:R001,R004,R005
```

### Q21 · derived · FAIL:R002,R004,R005 · still-failed

```
USER
Is installing a staircase on a new build just the responsibility of the staircase company?

──────────────────────────

Intent
✓ Learn (0.45)

Subject
✗ Staircase (0.92)

Brain
✓ Staircase (0.85)

Knowledge Domain
✗ Components (0.70)

Information Type
✗ Definition (0.50)

Router Confidence
66%

Fail Codes
R002, R004, R005

Result
FAIL:R002,R004,R005
```

