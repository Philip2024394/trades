---
title: NEX Router Build 0.06 — Report
build_id: 0.06
generated_by: scripts/nex-router-build-006.mjs
generated_at: 2026-07-31
classifier_type: pattern-based + Subject Dictionary + See/Consult/Compare/Why/Reality/Confused/Diagnostic intents
changes_from_0_05: |
  1. Why intent (Curiosity family per Philip's authored insight) — pattern for "Why does...", "Why is...", "Why can't...".
  2. Reality intent — pattern for "Can every X?", "Can I ... myself?".
  3. Confused user state — pattern for "I'm confused about...", "I don't understand...".
  4. Diagnostic intent — pattern for "My staircase squeaks", "Why is there a gap?".
  5. New Info Types: Reasoning (paired with Why) · Reality (paired with Reality) · Diagnosis (paired with Diagnostic).
  6. New Knowledge Domains: Engineering · Reality Check · Teaching · Troubleshooting.
  7. String subject dictionary extended: "stair strings" now matches (fixes "Why are stair strings so thick?").
  Full Thinking Mode architecture preserved as Standard v2 candidate · NOT built here.
regenerate: node scripts/nex-router-build-006.mjs
---

# NEX Router Build 0.06 — Report

**Classifier:** pattern-based + Subject Dictionary + Curiosity/Reality/Confused/Diagnostic intents

## Summary

| Metric | Value |
|---|---|
| Total questions tested | 41 |
| Passed | **27** |
| Failed | **14** |
| Overall Pass Rate | **65.9%** |
| Build 0.05 baseline (against current Suite) | 51.2% |
| Delta | **+14.7%** |

## Per-Dimension Accuracy

| Dimension | Accuracy |
|---|---|
| Brain | **100.0%** |
| Clarify | **95.1%** |
| Intent | **90.2%** |
| Domain | **87.8%** |
| Information Type | **87.8%** |
| Subject | **80.5%** |

## Regression Detection

| State | Count |
|---|---|
| Still Passed | 20 |
| **Improved** | **+7** |
| **Regressed** | **-1** |
| Still Failed | 13 |
| **Net Gain** | **+6** |

**Regressed:**
- `What's the difference between a string and a skirt?` · v005 PASS → v006 FAIL:R001,R004,R006


**Improved:**
- `Why are stair strings so thick?` · v005 FAIL:R001,R004,R005 → v006 PASS
- `Why is a newel post so large?` · v005 FAIL:R001,R004,R005 → v006 PASS
- `Why do staircases squeak?` · v005 FAIL:R001,R004,R005 → v006 PASS
- `Can every staircase be floating?` · v005 FAIL:R001,R004,R005 → v006 PASS
- `Can I fit a staircase myself?` · v005 FAIL:R001,R004,R005 → v006 PASS
- `I'm confused about strings` · v005 FAIL:R001,R004,R006 → v006 PASS
- `My staircase squeaks` · v005 FAIL:R001,R004,R005 → v006 PASS


## Failure Code Breakdown

| Code | Meaning | Count |
|---|---|---|
| R001 | Wrong intent | 4 |
| R002 | Wrong subject | 8 |
| R003 | Wrong brain | 0 |
| R004 | Wrong knowledge domain | 5 |
| R005 | Wrong information type | 5 |
| R006 | Clarification should have been requested | 2 |
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

### Q25 · suite · PASS · still-passed

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

### Q29 · suite · PASS · improved

```
USER
Why are stair strings so thick?

──────────────────────────

Intent
✓ Why (0.90)

Subject
✓ String (via alias "stair strings") (0.92)

Brain
✓ Staircase (0.85)

Knowledge Domain
✓ Engineering (0.88)

Information Type
✓ Reasoning (0.90)

Router Confidence
89%

Result
PASS
```

### Q30 · suite · PASS · improved

```
USER
Why is a newel post so large?

──────────────────────────

Intent
✓ Why (0.90)

Subject
✓ Newel post (0.92)

Brain
✓ Staircase (0.85)

Knowledge Domain
✓ Engineering (0.88)

Information Type
✓ Reasoning (0.90)

Router Confidence
89%

Result
PASS
```

### Q31 · suite · PASS · improved

```
USER
Why do staircases squeak?

──────────────────────────

Intent
✓ Why (0.90)

Subject
✓ Staircase (via alias "staircases") (0.92)

Brain
✓ Staircase (0.85)

Knowledge Domain
✓ Engineering (0.88)

Information Type
✓ Reasoning (0.90)

Router Confidence
89%

Result
PASS
```

### Q32 · suite · PASS · improved

```
USER
Can every staircase be floating?

──────────────────────────

Intent
✓ Reality (0.90)

Subject
✓ Staircase (0.92)

Brain
✓ Staircase (0.85)

Knowledge Domain
✓ Reality Check (0.90)

Information Type
✓ Reality (0.90)

Router Confidence
89%

Result
PASS
```

### Q33 · suite · PASS · improved

```
USER
Can I fit a staircase myself?

──────────────────────────

Intent
✓ Reality (0.90)

Subject
✓ Staircase (0.92)

Brain
✓ Staircase (0.85)

Knowledge Domain
✓ Reality Check (0.90)

Information Type
✓ Reality (0.90)

Router Confidence
89%

Result
PASS
```

### Q34 · suite · PASS · improved

```
USER
I'm confused about strings

──────────────────────────

Intent
✓ Confused (0.92)

Subject
✓ String (via alias "strings") (0.85)

Brain
✓ Staircase (0.85)

Knowledge Domain
✓ Teaching (0.85)

Information Type
✓ Definition (0.80)

Router Confidence
85%

Result
PASS
```

### Q35 · suite · FAIL:R001,R004,R006 · regressed

```
USER
What's the difference between a string and a skirt?

──────────────────────────

Intent
✗ Confused (0.92)

Subject
✓ String (0.85)

Brain
✓ Staircase (0.85)

Knowledge Domain
✗ Teaching (0.85)

Information Type
✓ Comparison (0.88)

Router Confidence
87%

Fail Codes
R001, R004, R006

Result
FAIL:R001,R004,R006
```

### Q36 · suite · PASS · improved

```
USER
My staircase squeaks

──────────────────────────

Intent
✓ Diagnostic (0.90)

Subject
✓ Staircase (0.92)

Brain
✓ Staircase (0.85)

Knowledge Domain
✓ Troubleshooting (0.90)

Information Type
✓ Diagnosis (0.90)

Router Confidence
89%

Result
PASS
```

### Q37 · derived · FAIL:R002 · still-failed

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

### Q38 · derived · FAIL:R001,R004 · still-failed

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

### Q39 · derived · FAIL:R005 · still-failed

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

### Q40 · derived · FAIL:R001,R004,R005 · still-failed

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

### Q41 · derived · FAIL:R002,R004,R005 · still-failed

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

