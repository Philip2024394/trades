# Router Interpretation Dataset · v2

**Established:** 2026-07-30 · Philip O'Farrell (v1 morning · v2 later same day)
**Purpose:** Training data for the NEX interpretation layer · shows how to route homeowner language to the correct brain
**IMPORTANT:** This is NOT an answer database. Rows are classification examples, not templates. Do not codify as Reflex entries. Do not auto-populate answers from this file at runtime.

**v2 changes (2026-07-30):** expanded from 5-row-per-brain seed to Philip's fuller tables (Reflex 20 · Expert 20 · Wisdom 20 · Emotion 15 · Observatory 10). Added the "100 concepts × 5 homeowner phrases × correct brain routing" milestone target at the end.

---

## The interpretation layer (Philip 2026-07-30 · locked)

```
                Human words
                     │
                     ▼
           Interpretation Layer
                     │
       ──────────────┼──────────────────────────
       │             │             │           │
       ▼             ▼             ▼           ▼
    Reflex        Expert        Wisdom     Wisdom + context
   (What is       (How should   (What      (I have a problem
    this part      this be       should     or an emotion)
    called?)       built?)       I choose?)
```

**The one-line rule (Philip 2026-07-30 · IMMUTABLE):**

> *"The question is not 'does NEX know the answer?' — it is 'does NEX know what kind of answer the human needs?'"*

That distinction IS the intelligence layer.

---

## Reflex Brain training set

Trigger pattern: *"What is this part called?"* — customer describing a THING without knowing the trade word. **Route:** Reflex terminology lookup → sub-100ms answer.

| Customer says | Hidden trade term | NEX route |
|---------------|-------------------|-----------|
| the flat bit of the stairs | tread | Instant explain |
| the front edge of each step | nosing | Instant explain |
| the upright face between steps | riser | Instant explain |
| the wood running up the side | string | Instant explain |
| the boards underneath the steps | strings | Instant explain |
| the rail on the wall side | wall handrail | Instant explain |
| the rail you grab going upstairs | handrail | Instant explain |
| the little wooden bars | balusters/spindles | Instant explain |
| the posts at the bottom and top | newel posts | Instant explain |
| the turn in the staircase | landing/winders | Explain difference |
| the flat area halfway up | landing | Instant explain |
| the hole in the ceiling for stairs | floor opening | Explain term |
| the wood frame around the hole | trimmer | Instant explain |
| the wooden support under a tread | carriage/string | Explain term |
| the curved staircase rail | curved handrail | Explain concept |
| the spiral end of the handrail | volute | Instant explain |
| the upright support under the handrail | newel | Instant explain |
| the decorative end step | bullnose/curtail | Explain variants |
| the step that turns around the corner | winder | Instant explain |
| the angle where stairs meet floor | pitch line | Explain term |

**Note:** rows referencing concepts NOT YET in `trade-terminology.ts` (wall handrail · floor opening · carriage · curved handrail · bullnose/curtail · pitch line) fall through to the composer until Philip authors full Reflex entries for them. The routing table shows what the router SHOULD detect · concept-authoring is a separate ship gated by Rule B.

**Ambiguous-case rows** ("the turn in the staircase" → landing/winders · "the decorative end step" → bullnose/curtail · "the wooden support under a tread" → carriage/string) teach the router to CLARIFY when a homeowner phrase maps to more than one concept · never assume one · ask which.

---

## Expert Brain training set

Trigger pattern: *"How should this be built?"* — technical judgement within a known domain · needs expertise but not personal context. **Route:** composer with narrow-topic prompt (future Expert Brain · today via Wisdom composer).

| Customer says | Real question | NEX route |
|---------------|---------------|-----------|
| why are my stairs so steep | staircase geometry | Explain rise/going |
| why does my foot not fit on the step | tread depth issue | Technical advice |
| why does my staircase creak | movement/joints | Diagnose |
| can stairs be repaired instead of replaced | renovation assessment | Explain options |
| why are my balusters loose | fixing issue | Explain causes |
| can I change my staircase without moving walls | installation limits | Explain checks |
| can I make my staircase wider | building constraints | Explain possibilities |
| can I remove the bottom newel | structural/design issue | Explain carefully |
| can I put oak treads over my stairs | conversion question | Explain process |
| can carpet go over oak stairs | finish question | Explain options |
| can MDF stairs be painted | material question | Explain suitability |
| can I use plywood for stairs | material suitability | Explain limits |
| what screws should be used for stairs | installation detail | Give trade guidance |
| why are my stairs uneven | building movement | Diagnose |
| why does one step feel different | consistency issue | Explain causes |
| how do I measure stairs | survey question | Explain process |
| what does a staircase survey include | professional process | Explain |
| why does my new staircase not fit | installation issue | Explain tolerances |
| what causes gaps in stairs | timber movement/fitting | Explain |
| can stairs be made quieter | acoustic improvement | Explain solutions |

---

## Wisdom Brain training set

Trigger pattern: *"What should I choose?"* — needs context, taste, decision-making · never Reflex. **Route:** composer with full context + memory + Opus.

| Customer says | What they really need | NEX route |
|---------------|----------------------|-----------|
| I want a staircase that makes an entrance | design vision | Explore style |
| I want something timeless | aesthetic judgement | Discuss materials |
| should I spend money on stairs | investment advice | Understand home |
| what would you do with this hallway | design opinion | Ask context |
| I want my house to feel expensive | atmosphere goal | Suggest details |
| should I keep the old staircase | renovation decision | Balance options |
| modern or traditional stairs | style decision | Compare |
| what staircase will add value | homeowner goal | Explain market thinking |
| I don't know what timber I like | discovery | Guide choice |
| I want stairs like a hotel | inspiration | Understand feeling |
| how do I make my stairs stand out | feature design | Suggest details |
| should I use glass or wood | preference decision | Compare |
| is a curved staircase worth it | luxury decision | Explain impact |
| should my staircase match my doors | interior decision | Discuss harmony |
| what colour should I paint my stairs | design choice | Ask interior context |
| I want my hallway brighter | spatial feeling | Suggest solutions |
| my stairs look cheap | perception issue | Diagnose appearance |
| my staircase feels boring | transformation | Explore upgrades |
| I want something unique | creative request | Discover vision |
| can you design my dream staircase | creative collaboration | Ask questions |

---

## Emotion / Context Brain (Map 3 · v2 · Philip 2026-07-30)

Trigger pattern: *"I have a problem / emotion"* — Wisdom + context · Soul-critical · slow down before answering. **Route:** composer with Principle 0004 (Safety First) + slow-down opening.

| Customer says | NEX detects | Response style |
|---------------|-------------|----------------|
| my builder says it's fine but I disagree | conflict | calm diagnosis |
| I think I was overcharged | trust concern | explain + evidence |
| nobody listens to what I want | frustration | acknowledge first |
| my staircase is dangerous | safety concern | safety first |
| my child keeps climbing the stairs | family concern | practical advice |
| my elderly parent struggles with stairs | care concern | supportive guidance |
| I regret choosing this staircase | disappointment | understand why |
| I cannot afford to replace it | budget pressure | find alternatives |
| I need this finished before Christmas | deadline pressure | practical planning |
| I am confused by all the options | overwhelmed | simplify |
| everyone gives me different advice | uncertainty | create clarity |
| I don't know if my builder is right | trust question | explain checks |
| my staircase looks nothing like I imagined | expectation gap | diagnose |
| I love my house but hate the stairs | emotional attachment | focus on improvement |
| this is my forever home | emotional investment | long-term thinking |

**Every Map 3 pattern shares the same behaviour rule:** feeling comes BEFORE spec. If NEX opens with dimensions when the customer opened with an emotion, NEX has failed the Soul.

**Also (Philip 2026-07-30):** these Map 3 rows include some that need special handling beyond generic Wisdom composer routing:
- *"my staircase is dangerous"* + *"my child keeps climbing the stairs"* + *"my elderly parent struggles"* → **Principle 0004 SAFETY FIRST fires** before design consideration
- *"I cannot afford to replace it"* + *"I need this finished before Christmas"* → practical/budget framing overrides aspiration framing
- *"nobody listens to what I want"* + *"everyone gives me different advice"* → NEX becomes the calm reference point · listen extensively before recommending

---

## Observatory · new phrase collection (v2 · Philip 2026-07-30)

Future learning candidates. Every row is a real-shape homeowner phrase paired with a "possible meaning" hypothesis and a review-status flag. **These are gaps waiting for expert approval, not answers.**

| Human phrase | Possible meaning | Review |
|--------------|------------------|--------|
| the wood underneath the carpet | tread/string/riser | expert review |
| the sides of the stairs | string | likely |
| the things stopping you falling | balustrade | likely |
| the stair bones | structure | unknown |
| the staircase frame | strings/trimmers | ambiguous |
| the bit holding the rail | newel/handrail brackets | ambiguous |
| the top bit where stairs finish | landing | likely |
| the step that sticks out | nosing/bullnose | ambiguous |
| the curved rail bit | volute/gooseneck | likely |
| the stair border | string/nosing | unknown |

**How to read the review column:**
- **`likely`** → Philip is confident the mapping is right · could be auto-approved after review pass
- **`ambiguous`** → phrase legitimately maps to more than one concept · Router should CLARIFY not answer
- **`unknown`** → needs more real-user context before the mapping is clear · hold

**The ambiguous rows are the most valuable teaching cases.** They show that some homeowner phrases don't have single-concept answers — NEX must ask "*do you mean X or Y?*" instead of guessing. That behaviour is a Wisdom move even for a Reflex-shaped question.

---

## What this file is NOT

- ❌ NOT a Reflex answer template library
- ❌ NOT to be scraped or auto-populated
- ❌ NOT to be codified as terminology entries (only Philip authors those)
- ❌ NOT complete (5 rows per brain is a training seed, not a corpus)

## What this file IS

- ✅ Training examples for the interpretation layer (routing training)
- ✅ Expert-authored classification data · Rule B compliant · Philip 2026-07-30
- ✅ The seed for a future router-quality test (extends the 20-question corpus)
- ✅ First Map 3 dataset (emotion/context signals · 8 canonical examples)

## The failure mode this dataset exists to prevent

If NEX codifies every one of these 200+ example Q&As as a Reflex answer, NEX becomes a giant FAQ machine — the exact failure Philip named 2026-07-30. The value of this dataset is teaching NEX **when to answer instantly vs when to think vs when to sit with the customer's feeling**. That distinction is the intelligence layer.

## The 100 × 5 × brain-routing milestone (Philip 2026-07-30 · locked target)

> **"A good next milestone for NEX is not 1,000 questions. It is: 100 concepts × 5 homeowner phrases × correct brain routing = NEX starts understanding how normal people talk about staircases. That is the intelligence layer."**

**Target shape:**
- **100 concepts** covered (up from the current ~13 mapped concepts)
- **5 homeowner phrases per concept** (500 total phrase-to-concept mappings)
- **Correct brain routing per phrase** (Reflex vs Expert vs Wisdom vs Emotion)
- = ~500 phrase → concept → brain classification data points

**NOT the target:** 1,000+ answers. 10,000 scraped questions. Comprehensive definitions of every stair term ever used. Those would make NEX a bigger FAQ machine, which is exactly the failure mode.

**The intelligence measured by this milestone:** does NEX correctly interpret a random homeowner phrase and route to the right kind of answer? A router hitting 80%+ correct-brain accuracy on 500 real homeowner phrasings is meaningfully different from any generic AI · that accuracy is the moat.

## Sign-off

Philip O'Farrell · 2026-07-30 · v1 morning (5-row seed) · v2 same day (fuller tables) · dataset now: Reflex 20 · Expert 20 · Wisdom 20 · Emotion 15 · Observatory 10 = **85 expert-authored routing examples** across 5 brains. Zero new Reflex entries created from this dataset (Philip's warning respected). 100 × 5 × brain milestone locked as the next real target.
