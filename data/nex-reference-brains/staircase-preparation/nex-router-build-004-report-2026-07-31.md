---
title: NEX Router Build 0.04 — Report
build_id: 0.04
generated_by: scripts/nex-router-build-004.mjs
generated_at: 2026-07-31
classifier_type: pattern-based + Subject Dictionary + See/Consult intents (Build 0.04)
changes_from_0_03: |
  1. New Intent · See (VISUAL_COMPONENT) — "can I see" / "looks like" / "picture of" → Info Type Visual · Domain Components.
  2. New Intent · Consult (CONSULTATIVE_INQUIRY) — "which staircase can fit" / "help me find" / "cheapest but best" → Info Type Recommendation · Domain Recommendation · Clarify=Yes always.
  3. Subject Dictionary: Newel cap added as distinct canonical from Newel post (longest-alias-match ensures correct routing).
  4. Subject Dictionary: Landing added as canonical with aliases (landing balcony · gallery · stairwell landing).
  5. New Info Type · Visual (paired with See intent) + Recommendation (paired with Consult intent).
regenerate: node scripts/nex-router-build-004.mjs
---

# NEX Router Build 0.04 — Report

**Classifier:** pattern-based + Subject Dictionary + See/Consult intents

## Summary

| Metric | Value |
|---|---|
| Total questions tested | 27 |
| Passed | **17** |
| Failed | **10** |
| Pass Rate | **63.0%** |
| Build 0.03 baseline (against current Suite) | 48.1% |
| Delta | **+14.9%** |
| Acceptance target | ≥95% |

## Regression Detection

| State | Count |
|---|---|
| Still Passed | 13 |
| **Improved** | **+4** |
| **Regressed** | **-0** |
| Still Failed | 10 |
| **Net Gain** | **+4** |

**No regressions.** All previously-passing questions still pass.


**Improved questions:**
- `Can I see what a stair tread looks like?` · v003 FAIL:R001,R004,R005 → v004 PASS
- `Can I see what a newel cap looks like?` · v003 FAIL:R001,R004,R005 → v004 PASS
- `Which type of staircase can fit my stairwell opening?` · v003 FAIL:R001,R004,R005,R006 → v004 PASS
- `I need help finding the cheapest but best staircase` · v003 FAIL:R001,R004,R005,R006 → v004 PASS


## Failure Code Breakdown (Build 0.04)

| Code | Meaning | Count |
|---|---|---|
| R001 | Wrong intent | 3 |
| R002 | Wrong subject | 5 |
| R003 | Wrong brain | 0 |
| R004 | Wrong knowledge domain | 4 |
| R005 | Wrong information type | 5 |
| R006 | Clarification should have been requested | 1 |
| R007 | Retrieved incorrect evidence | 0 · *N/A no retrieval layer yet* |
| R008 | Response contradicted evidence | 0 · *N/A no composition layer yet* |

## Top Failure

**Wrong subject (R002) — 5 cases · e.g. "Can I buy stairs?"**

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

### Q10 · suite · PASS · still-passed

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

### Q17 · suite · PASS · improved

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

### Q18 · suite · PASS · improved

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

### Q20 · suite · PASS · improved

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

### Q21 · suite · PASS · improved

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

### Q23 · derived · FAIL:R002 · still-failed

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

### Q24 · derived · FAIL:R001,R004 · still-failed

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

### Q25 · derived · FAIL:R005 · still-failed

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

### Q26 · derived · FAIL:R001,R004,R005 · still-failed

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

### Q27 · derived · FAIL:R002,R004,R005 · still-failed

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

