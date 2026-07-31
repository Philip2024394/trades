---
title: NEX Router Build 0.05 — Report
build_id: 0.05
generated_by: scripts/nex-router-build-005.mjs
generated_at: 2026-07-31
classifier_type: pattern-based + Subject Dictionary + See/Consult + Compare-extended + multi-material (Build 0.05)
changes_from_0_04: |
  1. Compare intent extended to catch "X or Y?" pattern (e.g. "Glass or oak balustrades?") without requiring "compare"/"vs" keyword.
  2. Subject Dictionary: 'Baluster' now accepts 'balustrade' + 'balustrades' as aliases (fixes comparison queries about balustrades).
  3. Subject Dictionary: 'Tread' now accepts 'oak stair treads' + 'oak treads' as aliases (fixes multi-material tread queries).
  4. Material dictionary reordered by length (longest first · 'white oak' beats 'oak').
  5. Multi-material extraction: subject.materials[] now returns full list not just first.
  6. Per-dimension accuracy metrics added (Subject % · Intent % · Info Type % · Domain % · Clarify %).
regenerate: node scripts/nex-router-build-005.mjs
---

# NEX Router Build 0.05 — Report

**Classifier:** pattern-based + Subject Dictionary + See/Consult + Compare-extended + multi-material

## Summary

| Metric | Value |
|---|---|
| Total questions tested | 33 |
| Passed | **20** |
| Failed | **13** |
| Overall Pass Rate | **60.6%** |
| Build 0.04 baseline (against current Suite) | 57.6% |
| Delta | **+3.0%** |

## Per-Dimension Accuracy (NEW · Philip 2026-07-31)

| Dimension | Accuracy |
|---|---|
| **Subject Accuracy** | **75.8%** |
| **Intent Accuracy** | **90.9%** |
| **Information Type Accuracy** | **84.8%** |
| **Domain Accuracy** | **87.9%** |
| **Brain Accuracy** | **100.0%** |
| **Clarify Accuracy** | **97.0%** |
| **Overall (all 6 must pass)** | **60.6%** |

Per-dimension view tells us where the router is strong vs where the next investment should go — instead of compressing everything into a single pass percentage.

## Regression Detection

| State | Count |
|---|---|
| Still Passed | 19 |
| **Improved** | **+1** |
| **Regressed** | **-0** |
| Still Failed | 13 |
| **Net Gain** | **+1** |

**No regressions.** All previously-passing questions still pass.


**Improved:**
- `Which is better, oak or walnut treads?` · v004 FAIL:R005 → v005 PASS


## Failure Code Breakdown (Build 0.05)

| Code | Meaning | Count |
|---|---|---|
| R001 | Wrong intent | 3 |
| R002 | Wrong subject | 8 |
| R003 | Wrong brain | 0 |
| R004 | Wrong knowledge domain | 4 |
| R005 | Wrong information type | 5 |
| R006 | Clarification should have been requested | 1 |
| R007 | Retrieved incorrect evidence | 0 · *N/A no retrieval layer yet* |
| R008 | Response contradicted evidence | 0 · *N/A no composition layer yet* |

## Top Failure

**Wrong subject (R002) — 8 cases · e.g. "Can I buy stairs?"**

## Per-Question Traces

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
Material(s) (derived)
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

### Q10 · suite · PASS · still-passed

```
USER
Want oak stairs

──────────────────────────

Intent
✓ Buy (0.75)

Subject
✓ Staircase (via alias "oak stairs") (0.92)
Material(s) (derived)
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

### Q17 · suite · PASS · still-passed

```
USER
Can I see what a stair tread looks like?

──────────────────────────

Intent
✓ See (0.94)

Subject
✓ Tread (via alias "stair tread") (0.92)

Brain
✓ Staircase (0.85)

Knowledge Domain
✓ Components (0.90)

Information Type
✓ Visual (0.94)

Router Confidence
91%

Result
PASS
```

### Q18 · suite · PASS · still-passed

```
USER
Can I see what a newel cap looks like?

──────────────────────────

Intent
✓ See (0.94)

Subject
✓ Newel cap (0.92)

Brain
✓ Staircase (0.85)

Knowledge Domain
✓ Components (0.90)

Information Type
✓ Visual (0.94)

Router Confidence
91%

Result
PASS
```

### Q19 · suite · PASS · still-passed

```
USER
What different options have you in newel caps?

──────────────────────────

Intent
✓ Browse (0.92)

Subject
✓ Newel cap (via alias "newel caps") (0.92)

Brain
✓ Staircase (0.85)

Knowledge Domain
✓ Reference Gallery (0.92)

Information Type
✓ Options (0.88)

Router Confidence
90%

Result
PASS
```

### Q20 · suite · PASS · still-passed

```
USER
Which type of staircase can fit my stairwell opening?

──────────────────────────

Intent
✓ Consult (0.92)

Subject
✓ Staircase (0.92)

Brain
✓ Staircase (0.85)

Knowledge Domain
✓ Recommendation (0.92)

Information Type
✓ Recommendation (0.90)

Router Confidence
90%

Result
PASS
```

### Q21 · suite · PASS · still-passed

```
USER
I need help finding the cheapest but best staircase

──────────────────────────

Intent
✓ Consult (0.92)

Subject
✓ Staircase (0.92)

Brain
✓ Staircase (0.85)

Knowledge Domain
✓ Recommendation (0.92)

Information Type
✓ Recommendation (0.90)

Router Confidence
90%

Result
PASS
```

### Q22 · suite · FAIL:R001,R004,R005 · still-failed

```
USER
Is the landing balcony included in the staircase price?

──────────────────────────

Intent
✗ Quote (0.95)

Subject
✓ Landing (via alias "landing balcony") (0.92)

Brain
✓ Staircase (0.85)

Knowledge Domain
✗ Pricing (0.90)

Information Type
✗ Pricing (0.95)

Router Confidence
91%

Fail Codes
R001, R004, R005

Result
FAIL:R001,R004,R005
```

### Q23 · suite · FAIL:R002 · still-failed

```
USER
Glass or oak balustrades?

──────────────────────────

Intent
✓ Compare (0.92)

Subject
✗ Baluster (via alias "balustrades") (0.92)
Material(s) (derived)
✓ Oak, Glass


Brain
✓ Staircase (0.85)

Knowledge Domain
✓ Design Languages (0.88)

Information Type
✓ Comparison (0.88)

Router Confidence
89%

Fail Code
R002

Result
FAIL:R002
```

### Q24 · suite · FAIL:R002 · still-failed

```
USER
Compare cut string vs closed string

──────────────────────────

Intent
✓ Compare (0.92)

Subject
✗ Closed string (0.92)

Brain
✓ Staircase (0.85)

Knowledge Domain
✓ Design Languages (0.88)

Information Type
✓ Comparison (0.88)

Router Confidence
89%

Fail Code
R002

Result
FAIL:R002
```

### Q25 · suite · PASS · improved

```
USER
Which is better, oak or walnut treads?

──────────────────────────

Intent
✓ Compare (0.92)

Subject
✓ Tread (via alias "treads") (0.85)
Material(s) (derived)
✓ Oak, Walnut


Brain
✓ Staircase (0.85)

Knowledge Domain
✓ Design Languages (0.88)

Information Type
✓ Comparison (0.88)

Router Confidence
88%

Result
PASS
```

### Q26 · suite · PASS · still-passed

```
USER
Can I see oak stair treads?

──────────────────────────

Intent
✓ See (0.94)

Subject
✓ Tread (via alias "oak stair treads") (0.92)
Material(s) (derived)
✓ Oak


Brain
✓ Staircase (0.85)

Knowledge Domain
✓ Components (0.90)

Information Type
✓ Visual (0.94)

Router Confidence
91%

Result
PASS
```

### Q27 · suite · PASS · still-passed

```
USER
White oak stair treads

──────────────────────────

Intent
✓ Learn (0.45)

Subject
✓ Tread (via alias "oak stair treads") (0.92)
Material(s) (derived)
✓ Oak


Brain
✓ Staircase (0.85)

Knowledge Domain
✓ Components (0.70)

Information Type
✓ Definition (0.50)

Router Confidence
66%

Result
PASS
```

### Q28 · suite · FAIL:R002 · still-failed

```
USER
Oak staircase with glass balustrade

──────────────────────────

Intent
✓ Learn (0.45)

Subject
✗ Glass balustrade (0.92)
Material(s) (derived)
✓ Oak, Glass


Brain
✓ Staircase (0.85)

Knowledge Domain
✓ Components (0.70)

Information Type
✓ Definition (0.50)

Router Confidence
66%

Fail Code
R002

Result
FAIL:R002
```

### Q29 · derived · FAIL:R002 · still-failed

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

### Q30 · derived · FAIL:R001,R004 · still-failed

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

### Q31 · derived · FAIL:R005 · still-failed

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

### Q32 · derived · FAIL:R001,R004,R005 · still-failed

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

### Q33 · derived · FAIL:R002,R004,R005 · still-failed

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

