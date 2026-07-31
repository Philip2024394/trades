---
title: NEX Router Build 0.07 — Report
build_id: 0.07
generated_by: scripts/nex-router-build-007.mjs
classifier_type: pattern-based + Subject Intelligence (homeowner_terms) + Curiosity/Reality/Confused/Diagnostic
changes_from_0_06: |
  1. Subject Dictionary evolved into Subject INTELLIGENCE: each entry becomes { aliases: [...], homeowner_terms: [...] }.
  2. Homeowner terms adopted for 5 core subjects: Newel post · Handrail · Tread · Riser · String.
  3. Concept resolution: descriptive queries like "the big wooden post at the bottom" now match Newel post.
  4. Router normalise() searches BOTH aliases AND homeowner_terms · longest-match wins across both.
  5. Trace now shows whether Subject matched via 'alias' or 'homeowner term'.
  6. Learn intent extended to catch "the piece/part/bit/thing/side ..." patterns.
  Full Brain Evolution (Brain/Knowledge/Conversation + 12 regions + 7 thinking modules) preserved as v2 candidate · NOT built here.
regenerate: node scripts/nex-router-build-007.mjs
---

# NEX Router Build 0.07 — Report

**Classifier:** pattern-based + Subject Intelligence with homeowner_terms

## Summary

| Metric | Value |
|---|---|
| Total questions tested | 46 |
| Passed | **33** |
| Failed | **13** |
| Overall Pass Rate | **71.7%** |
| Build 0.06 baseline (against current Suite) | 60.9% |
| Delta | **+10.8%** |
| Homeowner-term matches | **5** |

## Per-Dimension Accuracy

| Dimension | Accuracy |
|---|---|
| Brain | **100.0%** |
| Clarify | **97.8%** |
| Intent | **93.5%** |
| Domain | **91.3%** |
| Information Type | **89.1%** |
| Subject | **82.6%** |

## Regression Detection

| State | Count |
|---|---|
| Still Passed | 28 |
| **Improved** | **+5** |
| **Regressed** | **-0** |
| Still Failed | 13 |
| **Net Gain** | **+5** |

**No regressions.**


**Improved:**
- `What's that big wooden post at the bottom?` · v006 FAIL:R002,R003 → v007 PASS
- `The piece you hold going up` · v006 FAIL:R002 → v007 PASS
- `The flat bit you stand on` · v006 FAIL:R002,R006 → v007 PASS
- `The vertical piece between steps` · v006 FAIL:R002,R006 → v007 PASS
- `The side of the staircase` · v006 FAIL:R002 → v007 PASS


## Failure Code Breakdown

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

### Q29 · suite · PASS · still-passed

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

### Q30 · suite · PASS · still-passed

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

### Q31 · suite · PASS · still-passed

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

### Q32 · suite · PASS · still-passed

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

### Q33 · suite · PASS · still-passed

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

### Q34 · suite · PASS · still-passed

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

### Q35 · suite · PASS · still-passed

```
USER
What's the difference between a string and a skirt?

──────────────────────────

Intent
✓ Compare (0.92)

Subject
✓ String (0.85)

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

### Q36 · suite · PASS · still-passed

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

### Q37 · suite · PASS · improved

```
USER
What's that big wooden post at the bottom?

──────────────────────────

Intent
✓ Learn (0.88)

Subject
✓ Newel post (via homeowner term "big wooden post at the bottom") (0.92)

Brain
✓ Staircase (0.85)

Knowledge Domain
✓ Components (0.70)

Information Type
✓ Definition (0.80)

Router Confidence
83%

Result
PASS
```

### Q38 · suite · PASS · improved

```
USER
The piece you hold going up

──────────────────────────

Intent
✓ Learn (0.88)

Subject
✓ Handrail (via homeowner term "piece you hold going up") (0.92)

Brain
✓ Staircase (0.85)

Knowledge Domain
✓ Components (0.70)

Information Type
✓ Definition (0.80)

Router Confidence
83%

Result
PASS
```

### Q39 · suite · PASS · improved

```
USER
The flat bit you stand on

──────────────────────────

Intent
✓ Learn (0.45)

Subject
✓ Tread (via homeowner term "flat bit you stand on") (0.92)

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

### Q40 · suite · PASS · improved

```
USER
The vertical piece between steps

──────────────────────────

Intent
✓ Learn (0.45)

Subject
✓ Riser (via homeowner term "vertical piece between steps") (0.92)

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

### Q41 · suite · PASS · improved

```
USER
The side of the staircase

──────────────────────────

Intent
✓ Learn (0.88)

Subject
✓ String (via homeowner term "side of the staircase") (0.92)

Brain
✓ Staircase (0.85)

Knowledge Domain
✓ Components (0.70)

Information Type
✓ Definition (0.80)

Router Confidence
83%

Result
PASS
```

### Q42 · derived · FAIL:R002 · still-failed

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

### Q43 · derived · FAIL:R001,R004 · still-failed

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

### Q44 · derived · FAIL:R005 · still-failed

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

### Q45 · derived · FAIL:R001,R004,R005 · still-failed

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

### Q46 · derived · FAIL:R002,R004,R005 · still-failed

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

