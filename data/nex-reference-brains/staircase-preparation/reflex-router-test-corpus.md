# Reflex Router Test Corpus · v1

**Purpose:** measure whether NEX chooses the correct brain tier for each incoming question. Not "did the answer sound good?" — the harder question: **"was the RIGHT DEPTH of thought applied to this question?"**

**Sourced from:** existing 197-question catalogue at `questions/01-*.md` through `questions/12-*.md` plus Philip's exemplar seed questions from the 2026-07-30 Consciousness Layer reframe.

**Philip's warning that this corpus exists to enforce (locked 2026-07-30):**

> *"The goal is not: 'NEX answers faster.' The goal is: 'NEX knows when to answer instantly, when to use expertise, and when to think deeply.' That is the difference between a search engine and an expert."*

---

## The three tiers

| Tier | Latency | Cost | Purpose | Router should fire when... |
|------|---------|------|---------|----------------------------|
| **Reflex** | <100ms | £0 | instant known facts · terminology · greetings | Question has a single deterministic answer AND a real staircase expert would know it instantly |
| **Expert** | <1s | Haiku | comparisons · straightforward buying advice · troubleshooting within a narrow domain | Question requires weighing 2-5 options within a known domain, expert would think for a moment |
| **Wisdom** | 2-8s | Opus + memory | design vision · emotional context · memory-required · multi-turn synthesis | Question requires composing across the person's story, home context, aesthetic, and constraints — expert would slow down and listen |

**The mistake to prevent (Philip's line):** *"A master staircase designer does not explain timber science when someone says 'Morning.'"*

---

## The 20 questions

### REFLEX tier (7 questions · single deterministic answer · expert knows instantly)

**Q1 · "What is a newel post?"**
- **Correct tier:** Reflex
- **Why:** trade-standard term with a settled definition — expert wouldn't pause. Currently gated behind Rule B in `trade-terminology.ts` awaiting expert authoring.

**Q2 · "What is a winder?"**
- **Correct tier:** Reflex
- **Why:** structural definition, no ambiguity, no context needed. Same tier as Q1.

**Q3 · "What is a bullnose step?"**
- **Correct tier:** Reflex
- **Why:** terminology · anchors to a specific tread type · one-line answer with an image example.

**Q4 · "What is a housed string?"**
- **Correct tier:** Reflex
- **Why:** trade-standard construction type · expert answers with one sentence + example.

**Q5 · "What's the minimum handrail height on a domestic staircase?"**
- **Correct tier:** Reflex
- **Why:** regulation lookup with a specific number (Approved Doc K = 900mm min · 1000mm max). Deterministic. Cited.

**Q6 · "What is oak?"**
- **Correct tier:** Reflex
- **Why:** basic terminology · expert doesn't slow down for this.

**Q7 · "Good morning."**
- **Correct tier:** Reflex
- **Why:** greeting · single-word social opener with no substantive question attached. A master designer does not explain timber science here. Already live in the Reflex Brain.

---

### EXPERT tier (8 questions · narrow-topic comparison / recommendation · expert thinks briefly)

**Q8 · "Oak vs walnut for a staircase — which is better?"**
- **Correct tier:** Expert
- **Why:** comparison within a known domain (timber choice). Expert weighs durability · appearance · cost · finish behaviour. Answer needs 3-5 factors, not a story.

**Q9 · "MDF or timber treads?"**
- **Correct tier:** Expert
- **Why:** binary construction choice · expert names the trade-offs (cost · finish · longevity · use case) in under a minute.

**Q10 · "Dog-leg or open-plan staircase for a narrow hallway?"**
- **Correct tier:** Expert
- **Why:** configuration comparison · depends on hallway dimensions + light + budget · but bounded within known layouts.

**Q11 · "Cut string or closed string — which suits a Victorian terrace?"**
- **Correct tier:** Expert
- **Why:** style + construction match · expert has a reasoned answer that considers heritage context but isn't emotional.

**Q12 · "How much does a bespoke oak staircase cost?"**
- **Correct tier:** Expert
- **Why:** requires answering with the honest range + factors (multiplier language per composer no-£ rule) + the confirm-with-manufacturer caveat. Expert-shape answer, not deep design.

**Q13 · "Why does my staircase squeak?"**
- **Correct tier:** Expert
- **Why:** troubleshooting within a known problem space · expert lists likely causes in probability order and asks one clarifying question.

**Q14 · "Can I install a spiral staircase in a 1500mm × 1500mm footprint?"**
- **Correct tier:** Expert
- **Why:** dimensional-fit question · expert checks the physics + regulations quickly · answers yes/no with the constraints.

**Q15 · "What thickness should the treads be for a hardwood staircase?"**
- **Correct tier:** Expert
- **Why:** engineering choice within BWF-guided options (28 · 32 · 38 · 44mm) · expert names the common defaults + when to go thicker. Borderline Reflex-eligible if the answer is always the same, but the "for a hardwood" qualifier makes it context-sensitive.

---

### WISDOM tier (5 questions · deep · life-context · memory-required · emotional)

**Q16 · "I want my staircase to be the centrepiece of the home."**
- **Correct tier:** Wisdom
- **Why:** design vision · requires understanding of what "centrepiece" means to THIS person · composes home style + aesthetic aspiration + material palette + lighting. Expert slows down, listens, then thinks.

**Q17 · "I don't know what style suits my home."**
- **Correct tier:** Wisdom
- **Why:** uncertainty signal · Cold Start Soul + intent classifier + home context all matter. Expert asks about the home before recommending. Reflex answer would feel dismissive.

**Q18 · "How do I make my hallway look expensive?"**
- **Correct tier:** Wisdom
- **Why:** aesthetic composition question · not just a staircase question · requires taste + material + light + proportion synthesis. Expert doesn't dump a feature list — they explore intent.

**Q19 · "I've bought my forever home and want the staircase to represent my family."**
- **Correct tier:** Wisdom
- **Why:** emotional context + story + aspiration + Living Memory candidate. This is the exact question the recognising-not-remembering test exists to answer well.

**Q20 · "Last time you mentioned oak — is that still where I should be heading?"**
- **Correct tier:** Wisdom
- **Why:** memory-required · requires retrieval + confirmation flow + honest arc-tracking (memories evolve, per Decision 5). Reflex would guess. Expert would forget context. Only Wisdom uses the memory correctly.

---

## Scoring the router · TWO metrics · both must pass (Philip 2026-07-30)

For each question, record TWO independent scores:

### Metric 1 · Did the router choose the correct brain?

1. Feed the question into the live NEX router
2. Observe which tier fires (Reflex hit · composer with Haiku · composer with Opus)
3. Compare to the "Correct tier" label above
4. Record: correct · too_shallow · too_deep

```
   correct_tier_rate = correct_matches / 20
   too_shallow_rate  = too_shallow / 20   (Reflex fired when Expert/Wisdom needed)
   too_deep_rate     = too_deep / 20      (Wisdom fired when Reflex would serve)
```

**Target:**
- `correct_tier_rate` ≥ 80%
- `too_shallow_rate` ≤ 5% (dismissiveness · Soul violation)
- `too_deep_rate` ≤ 15% (latency + cost waste)

**Symmetric-cost reminder:** both failure modes matter. A router that always picks Wisdom looks safe but violates the winning line: *"knows when thinking is needed."*

### Metric 2 · Did the answer feel like a person? (Philip 2026-07-30)

**A technically correct answer can still fail.**

For each question, score the ANSWER on a 1-5 person-feel scale:

- **5** — sounds like a carpenter answering over a cup of tea · workshop-warm · has soul
- **4** — feels present · human phrasing · maybe slightly generic
- **3** — accurate but neutral · would pass a Turing test but not a soul test
- **2** — sounds like a manual · technical · dry
- **1** — sounds like software · exposes the machine · uses banned phrases

**Target:** every answer scores ≥ 4. Any answer ≤ 3 is a failure regardless of correctness.

**The concrete failure mode Philip named (2026-07-30):**

- ❌ *"A newel post is a vertical structural component located at the termination points of a staircase balustrade."* — correct. Reads like a manual. Score: 2.
- ✅ *"A newel post is the main upright post that anchors the handrail. It is the part you often notice first because it gives the staircase its character — especially with larger square oak newels."* — same knowledge. Completely different soul. Score: 5.

Same facts. Different expert. The second answer is what NEX earns.

### Composite pass condition

The router passes ONLY when both metrics hit target:

- ≥80% correct-tier rate AND
- Every answer scores ≥ 4 on person-feel

If either fails, the sprint continues. **You are optimising judgement, not intelligence** (Philip 2026-07-30 · the closing line the big AI companies are mostly missing).

---

## Notes for the tester

- Run these ONE AT A TIME in a fresh conversation so the router doesn't cheat from prior context.
- For Q19 and Q20, seed a prior conversation first so Living Memory has something to retrieve — otherwise those questions test the wrong thing.
- Q7 ("Good morning") should already fire Reflex today (Ship 3 live). If it doesn't, the reflex router is broken.
- Q1-Q4 will fall through to composer today (Trade Terminology entries not yet expert-authored). That's correct behaviour — Rule B gate holding.
- Q5 is a stretch Reflex — it currently requires either a lookup table or the composer. Consider it a Reflex candidate once trade terminology has an author.

---

## Governance

- **Rule B compliance:** questions sampled from the existing 197-question catalogue (Rule B-permitted curation) and Philip's exemplar seed. Tier labels are meta-classification (not trade authorship). Zero trade-content invention.
- **Provenance:** every question either exists in `questions/*.md` OR was named directly by Philip on 2026-07-30.
- **Version:** v1 · 2026-07-30. Extend the corpus as new tiers emerge or as router failures teach us new patterns worth testing.
