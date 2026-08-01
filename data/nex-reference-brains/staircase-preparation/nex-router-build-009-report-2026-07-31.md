---
title: NEX Router Build 0.09 — Report
build_id: 0.09
generated_by: scripts/nex-router-build-009.mjs
classifier_type: pattern-based + Subject Intelligence + Build-009 Customer FAQ family closure
changes_from_0_08: |
  Targeted fixes for the 4 remaining Customer FAQ failures in v0.08:
    Fix E · Reclaimed timber removed from Materials brain classifier (fixes Q42 R003)
    Fix F · "Can my X maker also make Y" Advise/Function pattern (fixes Q44 R005)
    Fix G · "Can the X team fit Y while/during" Advise pattern + Best Practice widened to "can the/our" (fixes Q45 R001,R004,R005)
    Fix H · New build alias extended · Customer-FAQ subject set with Domain override · responsibility-of Function pattern (fixes Q46 R002,R004,R005)
  All Build 0.08 fixes (A · B1 · B2 · B3 · B4 · C1 · C2 · D) retained unchanged.
regenerate: node scripts/nex-router-build-009.mjs
---

# NEX Router Build 0.09 — Report

**Classifier:** pattern-based + Subject Intelligence + Build-008 targeted defect fixes

## Summary

| Metric | Value |
|---|---|
| Total questions tested | 46 |
| Passed | **46** |
| Failed | **0** |
| Overall Pass Rate | **100.0%** |
| Build 0.07 baseline (against current Suite) | 84.8% |
| Delta | **+15.2%** |

## Per-Dimension Accuracy

| Dimension | Accuracy |
|---|---|
| Brain | **100.0%** |
| Clarify | **100.0%** |
| Intent | **100.0%** |
| Domain | **100.0%** |
| Information Type | **100.0%** |
| Subject | **100.0%** |

## Regression Detection

| State | Count |
|---|---|
| Still Passed | 39 |
| **Improved** | **+7** |
| **Regressed** | **-0** |
| Still Failed | 0 |
| **Net Gain** | **+7** |

**No regressions.**


**Improved:**
- `Need quote` · v007 FAIL:R002 → v008 PASS
- `How much?` · v007 FAIL:R002 → v008 PASS
- `Show me images` · v007 FAIL:R002 → v008 PASS
- `Glass or oak balustrades?` · v007 FAIL:R002 → v008 PASS
- `Compare cut string vs closed string` · v007 FAIL:R002 → v008 PASS
- `Oak staircase with glass balustrade` · v007 FAIL:R002 → v008 PASS
- `Can I supply my own timber for my staircase?` · v007 FAIL:R002 → v008 PASS


## Failure Code Breakdown

| Code | Meaning | Count |
|---|---|---|
| R001 | Wrong intent | 0 |
| R002 | Wrong subject | 0 |
| R003 | Wrong brain | 0 |
| R004 | Wrong knowledge domain | 0 |
| R005 | Wrong information type | 0 |
| R006 | Clarification should have been requested | 0 |
| R007 | Retrieved incorrect evidence | 0 · *N/A no retrieval layer yet* |
| R008 | Response contradicted evidence | 0 · *N/A no composition layer yet* |

## Top Failure

**No failures**

## Per-Question Traces

### Q1 · suite · PASS · still-passed

```
USER
What type of staircase?

──────────────────────────

Intent
✓ Learn (0.88)

Subject
✓ Staircase (via alias "staircase") (0.92)

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
✓ Straight flight (via alias "straight flight") (0.92)
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
✓ Newel post (via alias "newel post") (0.92)

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
✓ Staircase (via alias "staircase") (0.92)

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
✓ Straight flight (via alias "straight flight") (0.92)

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
✓ Staircase (via alias "staircase") (0.92)

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

### Q9 · suite · PASS · still-passed

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
✓ Inquiry (0.90)

Router Confidence
87%

Result
PASS
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

### Q11 · suite · PASS · improved

```
USER
Need quote

──────────────────────────

Intent
✓ Quote (0.95)

Subject
✓ Staircase (via intent-default) (0.80)

Brain
✓ Staircase (0.85)

Knowledge Domain
✓ Pricing (0.90)

Information Type
✓ Pricing (0.95)

Router Confidence
89%

Result
PASS
```

### Q12 · suite · PASS · improved

```
USER
How much?

──────────────────────────

Intent
✓ Quote (0.95)

Subject
✓ Staircase (via intent-default) (0.80)

Brain
✓ Staircase (0.85)

Knowledge Domain
✓ Pricing (0.90)

Information Type
✓ Pricing (0.95)

Router Confidence
89%

Result
PASS
```

### Q13 · suite · PASS · improved

```
USER
Show me images

──────────────────────────

Intent
✓ Browse (0.92)

Subject
✓ Staircase (via intent-default) (0.80)

Brain
✓ Staircase (0.85)

Knowledge Domain
✓ Reference Gallery (0.92)

Information Type
✓ Gallery (0.92)

Router Confidence
88%

Result
PASS
```

### Q14 · suite · PASS · still-passed

```
USER
Different staircase types

──────────────────────────

Intent
✓ Learn (0.88)

Subject
✓ Staircase (via alias "staircase") (0.92)

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
✓ Newel cap (via alias "newel cap") (0.92)

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
✓ Staircase (via alias "staircase") (0.92)

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
✓ Staircase (via alias "staircase") (0.92)

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

### Q22 · suite · PASS · still-passed

```
USER
Is the landing balcony included in the staircase price?

──────────────────────────

Intent
✓ Learn (0.90)

Subject
✓ Landing (via alias "landing balcony") (0.92)

Brain
✓ Staircase (0.85)

Knowledge Domain
✓ Scope of Work (0.90)

Information Type
✓ Function (0.90)

Router Confidence
89%

Result
PASS
```

### Q23 · suite · PASS · improved

```
USER
Glass or oak balustrades?

──────────────────────────

Intent
✓ Compare (0.92)

Subject
✓ Balustrade (via alias "balustrades") (0.92)
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

Result
PASS
```

### Q24 · suite · PASS · improved

```
USER
Compare cut string vs closed string

──────────────────────────

Intent
✓ Compare (0.92)

Subject
✓ String (via compare-collapse) (0.88)

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

### Q28 · suite · PASS · improved

```
USER
Oak staircase with glass balustrade

──────────────────────────

Intent
✓ Learn (0.45)

Subject
✓ Staircase (via learn-primary) (0.90)
Material(s) (derived)
✓ Oak, Glass


Brain
✓ Staircase (0.85)

Knowledge Domain
✓ Components (0.70)

Information Type
✓ Definition (0.50)

Router Confidence
65%

Result
PASS
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
✓ Newel post (via alias "newel post") (0.92)

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
✓ Staircase (via alias "staircase") (0.92)

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
✓ Staircase (via alias "staircase") (0.92)

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
✓ String (via alias "string") (0.85)

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
✓ Staircase (via alias "staircase") (0.92)

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

### Q37 · suite · PASS · still-passed

```
USER
What's that big wooden post at the bottom?

──────────────────────────

Intent
✓ Learn (0.88)

Subject
✓ Newel post (via homeowner "big wooden post at the bottom") (0.92)

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

### Q38 · suite · PASS · still-passed

```
USER
The piece you hold going up

──────────────────────────

Intent
✓ Learn (0.88)

Subject
✓ Handrail (via homeowner "piece you hold going up") (0.92)

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

### Q39 · suite · PASS · still-passed

```
USER
The flat bit you stand on

──────────────────────────

Intent
✓ Learn (0.45)

Subject
✓ Tread (via homeowner "flat bit you stand on") (0.92)

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

### Q40 · suite · PASS · still-passed

```
USER
The vertical piece between steps

──────────────────────────

Intent
✓ Learn (0.45)

Subject
✓ Riser (via homeowner "vertical piece between steps") (0.92)

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

### Q41 · suite · PASS · still-passed

```
USER
The side of the staircase

──────────────────────────

Intent
✓ Learn (0.88)

Subject
✓ String (via homeowner "side of the staircase") (0.92)

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

### Q42 · derived · PASS · improved

```
USER
Can I supply my own timber for my staircase?

──────────────────────────

Intent
✓ Advise (0.80)

Subject
✓ Reclaimed timber (via homeowner "supply my own timber") (0.92)

Brain
✓ Staircase (0.85)

Knowledge Domain
✓ Customer FAQ (0.90)

Information Type
✓ Best Practice (0.75)

Router Confidence
84%

Result
PASS
```

### Q43 · derived · PASS · still-passed

```
USER
Can my site carpenter install my new staircase instead of the staircase company's installers?

──────────────────────────

Intent
✓ Advise (0.92)

Subject
✓ Site carpenter (via alias "site carpenter") (0.92)

Brain
✓ Staircase (0.85)

Knowledge Domain
✓ Customer FAQ (0.90)

Information Type
✓ Best Practice (0.75)

Router Confidence
87%

Result
PASS
```

### Q44 · derived · PASS · still-passed

```
USER
Can my staircase maker also make a matching hallway table or other furniture?

──────────────────────────

Intent
✓ Advise (0.92)

Subject
✓ Matching furniture (via alias "hallway table") (0.92)

Brain
✓ Staircase (0.85)

Knowledge Domain
✓ Customer FAQ (0.90)

Information Type
✓ Function (0.90)

Router Confidence
90%

Result
PASS
```

### Q45 · derived · PASS · still-passed

```
USER
Can the staircase installation team fit my loft ladder while they're on site?

──────────────────────────

Intent
✓ Advise (0.92)

Subject
✓ Loft ladder (via alias "loft ladder") (0.92)

Brain
✓ Staircase (0.85)

Knowledge Domain
✓ Customer FAQ (0.90)

Information Type
✓ Best Practice (0.75)

Router Confidence
87%

Result
PASS
```

### Q46 · derived · PASS · still-passed

```
USER
Is installing a staircase on a new build just the responsibility of the staircase company?

──────────────────────────

Intent
✓ Learn (0.45)

Subject
✓ New build (via alias "on a new build") (0.92)

Brain
✓ Staircase (0.85)

Knowledge Domain
✓ Customer FAQ (0.90)

Information Type
✓ Function (0.90)

Router Confidence
78%

Result
PASS
```

