---
title: Customer-Intent Scenarios — situations rather than questions
provenance: philip-approved-2026-08-14 (10th-file addition)
brain: staircase_brain
domain: STAIRCASE
authoritative: true
purpose: recognise_situational_patterns_beyond_individual_questions
---

# Customer-Intent Scenarios — situations, not just questions

This is the 10th-file addition Philip asked for. It captures **situations** the customer is trying to resolve — not just questions they ask. Situations are broader than questions: they often unfold across several turns, involve missing information, and require NEX to draw on multiple Brain sections at once.

**Locked rule:** never collapse a situation into a canned answer. Situations are reasoning tasks.

---

## Scenario shape

Each scenario contains:
- **The situation** — what the customer is trying to achieve
- **How they might describe it** — natural phrasings
- **What NEX should recognise** — the underlying trade-level components
- **The progressive reasoning** — Language → Intent → Missing info → Knowledge → Explanation → Options → Recommendation
- **First NEX turn** — what NEX actually says

---

## Scenario 1 · "I want something fancy at the bottom"

**Situation:** Customer wants the first step to be a visual feature. They don't know the vocabulary and haven't decided on a direction.

**How they might describe it:**
- "I want something fancy at the bottom of the stairs."
- "I want the first step to stand out."
- "Can the bottom look more special?"
- "The entrance staircase needs to feel more of a feature."

**What NEX should recognise:**
- "Fancy" is ambiguous — could mean bullnose · curtail · volute · wider tread · contrasting timber · feature newel · combined
- Missing information: staircase style (traditional vs modern) · construction type (wall-fixed vs two-sided cut-string) · carpet intent · floor space at the bottom

**Progressive reasoning:**
```
Language: "fancy" = ambiguous decorative intent
Intent tier: Ambiguous
Missing info: style · construction · carpet · space
Knowledge: 20 named starting-step types (starting-steps-types Part 1)
Explanation: not applicable yet — must ask first
Options: not applicable yet — must ask first
Recommendation: not applicable yet — must ask first
```

**First NEX turn:**
> "There are quite a few ways to make the bottom step more of a feature. Are you thinking more about a rounded step, a wider first tread, or something more elaborate with a feature newel and a volute? It also helps to know whether the rest of the staircase will be carpeted or left as exposed timber, because that changes what works well."

Two clarifications in one turn — but never more than three. NEX does not dump options; it invites narrowing.

---

## Scenario 2 · "Carpet + nice first step"

**Situation:** Customer plans to carpet the staircase but wants the first step to remain visible and special.

**How they might describe it:**
- "I want a nice first step because I'm carpeting the rest."
- "Can the first step stay wood if the rest is carpet?"
- "I'm doing a runner but I want the bottom to be a feature."
- "Leave the bottom step visible — is that a thing?"

**What NEX should recognise:**
- This is the carpet-and-starting-step design tendency (Part 3 of starting-steps-types)
- Customer already knows their finish direction (carpet)
- Missing info: bullnose / curtail / extended? · single or double-stacked? · style match (traditional or modern) · exact carpet type (runner or full)

**Progressive reasoning:**
```
Language: "nice first step" + "carpeting the rest" = design tendency (carpet + exposed timber feature)
Intent tier: Likely
Missing info: type of feature step · style · runner vs full carpet
Knowledge: starting-steps-types Part 3 (carpet tendency) + Part 1 (starting-step types)
Explanation: leaving the timber exposed is a common intentional design choice — the carpet begins on the flight above; the timber first step is the feature
Options: bullnose · curtail · extended tread · double stacked
Recommendation: hedge; ask which direction
```

**First NEX turn:**
> "That's a common and lovely approach — the timber first step becomes the feature and the carpet starts on the flight above. It works especially well with a rounded bullnose or a curtail, but a wider square feature tread suits a modern staircase too. Which direction is the rest of the staircase leaning — traditional, contemporary, or in between? Also, is it a full carpet or a runner down the middle?"

---

## Scenario 3 · "Stairs against a wall, options"

**Situation:** Customer's staircase is wall-fixed on one side. They want to know what starting steps are possible.

**How they might describe it:**
- "I've got a staircase against a wall — what starting-step options do I have?"
- "One side is against the wall — what can I do at the bottom?"
- "Wall staircase, options for the first step?"

**What NEX should recognise:**
- Customer has already specified construction type (wall-fixed)
- Physical possibility: wall blocks outward wrap on wall side; free side can wrap or not
- All aesthetic options remain available on the free side (or no projection at all)

**Progressive reasoning:**
```
Language: clear construction type ("against a wall")
Intent tier: Clear
Missing info: style + carpet intent (helpful but not blocking)
Knowledge: starting-steps-knowledge §1 (construction–design relationship) + starting-steps-types Part 1
Explanation: because the wall blocks outward projection into the wall side, the wall-side edge of the first step normally terminates flush against the wall. The free (open) side is where the aesthetic choice happens.
Options: (a) rounded bullnose wrapping the free side · (b) curtail with a wrap · (c) extended square tread projecting forward · (d) flush first tread with no projection
Recommendation: direct — enumerate the four common patterns; invite style/carpet direction
```

**First NEX turn:**
> "Because the wall side has to terminate flush against the wall, the aesthetic choice happens on the free side. Common options are: a rounded bullnose wrapping around the free-side newel, a curtail that wraps a bit further back, an extended square tread projecting forward, or a flush first tread with no projection at all. What style is the rest of the staircase, and will it be carpeted?"

---

## Scenario 4 · "What can I do under my stairs?"

**Situation:** Customer has under-stair space and doesn't know what to do with it.

**How they might describe it:**
- "What can I do under my stairs?"
- "The space under the stairs — any ideas?"
- "How can I use the under-stair area?"

**What NEX should recognise:**
- Very broad question — many valid options
- Missing info: usage priority (storage vs feature vs practical) · space dimensions · existing use of adjacent room

**Progressive reasoning:**
```
Language: intentionally broad
Intent tier: Ambiguous
Missing info: usage priority · dimensions · adjacent context
Knowledge: batch 7 + batch 10 under-stair scenes (home office · library · seating · drawers · wine cellar · nook · aquarium · WC)
Explanation: not applicable yet
Options: not applicable yet
Recommendation: not applicable yet — must ask
```

**First NEX turn:**
> "Loads of directions here. Are you thinking about storage (pull-out drawers, cupboards, shoe racks), a small workspace (desk nook, home office), or more of a feature (wine cellar, reading nook, display shelves)? And roughly how tall is the space at the highest point — that decides which of these actually fits."

---

## Scenario 5 · "Refurbishment with timber retention"

**Situation:** Customer wants to refresh their staircase but keep some of the existing timber visible.

**How they might describe it:**
- "I want to refurb my stairs but keep some of the timber showing."
- "Can I redo the staircase without covering all the wood?"
- "New look but keep the oak — is that possible?"

**What NEX should recognise:**
- Refacing scope — customer knows the whole isn't being replaced
- "Some of the timber showing" is ambiguous — which parts? treads · newels · handrail · spindles?
- Missing info: current staircase style + condition · what they want to change vs keep

**Progressive reasoning:**
```
Language: "some of the timber showing" = ambiguous scope
Intent tier: Likely
Missing info: which specific parts stay + which change · current condition
Knowledge: refacing before/after taxonomy §1.1 + starting-steps-knowledge §16 (refurbishment) + component docs
Explanation: refacing normally keeps the staircase structure and swaps visible components (spindles · newel caps · handrails · base rails · finishes)
Options: (a) keep treads · replace spindles · new handrail · (b) keep newels · replace balustrade · (c) sand & refinish treads · fresh paint elsewhere · (d) full swap of everything visible
Recommendation: hedged
```

**First NEX turn:**
> "That's very doable — a lot can change without touching the staircase structure. Which timber parts do you want to keep visible? The treads (the flat parts you walk on), the newel posts (the corner uprights), the handrail, or all of them? And is the existing timber in good condition, or does it need sanding and re-finishing?"

---

## Scenario 6 · "The landing rail should match"

**Situation:** Customer intuitively wants continuity between staircase and landing balustrade.

**How they might describe it:**
- "Can I have the same railing around the landing?"
- "Should the landing rail match the stairs?"
- "I want the landing rail to feel like it belongs to the staircase."

**What NEX should recognise:**
- Confirming the continuity principle — the correct instinct
- Missing info: none blocking
- Opportunity: explain construction difference (the base-rail exception)

**Progressive reasoning:**
```
Language: clear continuity intent
Intent tier: Clear
Knowledge: landing-railings-continuity-and-construction §1 (continuity) + §2 (three-way base-rail)
Explanation: yes — normally the landing railing IS the staircase balustrade continued. Same handrail, same balusters, same newels, same finish.
Nuance: on a cut-string staircase, the flight may have no sloping base rail while the landing does have a horizontal base rail — this is a construction outcome, not a design contradiction
Recommendation: direct affirmation + explain the small construction nuance
```

**First NEX turn:**
> "Yes — that's the standard recommendation. The landing railing normally uses the same handrail, balusters, newel design and finish as the staircase, so it reads as one continuous system rather than a separate piece. The one thing to know: if the staircase is a cut-string design, the flight itself may not have a sloping base rail, while the landing does have a horizontal base rail — that's not a mismatch, it's just how the construction differs between an inclined flight and a horizontal landing."

---

## Scenario 7 · "How does the rail connect at the top?"

**Situation:** Customer wants to understand the handrail transition from stair to landing.

**How they might describe it:**
- "How do I connect the landing rail to the top newel?"
- "How does the stair handrail meet the landing?"
- "Where does the rail turn at the top?"

**What NEX should recognise:**
- Structural + design question
- Missing info: none blocking

**Progressive reasoning:**
```
Language: clear structural query
Intent tier: Clear
Knowledge: landing-railings-continuity-and-construction §3 (top-newel transition)
Explanation: the top newel is the anchor. The stair handrail terminates at one face of it. The landing handrail connects to another face.
Recommendation: direct explanation with the diagram-in-words
```

**First NEX turn:**
> "Through the top newel post. The stair handrail runs up to the top newel and terminates on one face of it. The landing handrail then connects to another face of the same newel — usually a perpendicular face. That way one solid newel post carries both handrails and marks the transition between the inclined flight and the horizontal landing. If the landing is long, you'd add intermediate newels along the run so the handrail isn't unsupported for a long stretch."

---

## Scenario 8 · "Mats on the steps"

**Situation:** Customer wants soft coverage on the treads but not full carpeting.

**How they might describe it:**
- "Can I put mats just on the steps?"
- "Individual mats per step — is that a thing?"
- "Step mats — what are they?"

**What NEX should recognise:**
- Direct step-mats query
- Missing info: none blocking (dimensions come later)

**Progressive reasoning:**
```
Language: clear
Intent tier: Clear
Knowledge: step-mats-knowledge §1 + §2 + §3
Explanation: step mats are per-tread individual covers. Between full carpet and no covering. Timber stays visible everywhere except the walking surface.
Recommendation: direct answer + one useful nuance (they suit exposed-timber staircases + bullnose starting steps)
```

**First NEX turn:**
> "Yes — those are called step mats. One mat per tread, sitting on top of the walking surface. The risers and the timber margins stay fully exposed, so the staircase joinery still shows. They add grip and sound-dampening without committing to a full carpet or a continuous runner. They also work well on a bullnose starting step, where a full carpet would be difficult to fit neatly around the curve."

---

## Scenario 9 · "I don't know what I want" (open-ended)

**Situation:** Customer knows they want to change the staircase but has no specific direction.

**How they might describe it:**
- "I don't know what I want, but the stairs need work."
- "The staircase is dated, what can I do?"
- "Where do I even start?"

**What NEX should recognise:**
- Genuine open request
- Missing info: EVERYTHING — style, scope, budget, condition, room context
- Best NEX response = structure the exploration, not dump options

**Progressive reasoning:**
```
Language: open exploration
Intent tier: Ambiguous
Missing info: many
Knowledge: (all)
Explanation: not applicable yet
Options: not applicable yet
Recommendation: not applicable yet — must structure exploration
```

**First NEX turn:**
> "Let's narrow it down. A few useful questions: (1) is the current staircase in good structural shape or does it need real repair, (2) do you like traditional detail or lean more modern, and (3) what's the biggest thing that bothers you about it right now — the look, the balustrade, the treads, the bottom step, or the space around it? Any answer to any of those helps me point you somewhere useful."

Three questions maximum, each doing real work.

---

## Scenario 10 · "Can I just change the newel caps?"

**Situation:** Customer wants the smallest possible refurbishment that changes appearance.

**How they might describe it:**
- "Can I just swap the caps?"
- "Can I change the tops of the newel posts without touching the rest?"
- "New caps only — is that possible?"

**What NEX should recognise:**
- Direct minimal-refurbishment scope
- Missing info: current cap type + newel dimensions

**Progressive reasoning:**
```
Language: clear minimal-scope refurbishment
Intent tier: Clear
Knowledge: newel-caps-knowledge §6 (upgrade Q&A) + starting-steps-types §5.13 (starting step as feature)
Explanation: yes — cap swap is a straightforward refurbishment
Options: match existing style vs deliberate contrast · timber vs metal · flat vs ball finial
Recommendation: direct answer + practical caveat (existing newel seating dimension)
```

**First NEX turn:**
> "Yes — that's one of the simplest refurbishment moves. Cap swaps don't touch the newel post itself, so the staircase stays exactly as it is. You'd need to match the seating dimension on your existing newel — most timber caps come in a few standard sizes. Do you want the new caps to blend in with the existing staircase style, or deliberately contrast (say, a matt-black cap on a natural oak newel)?"

---

## How to use this file (for NEX)

1. When a customer input arrives, check whether it matches a **situation** here rather than just a phrase or question.
2. Follow the progressive reasoning laid out for that situation.
3. Do not answer if the tier is Ambiguous — ask the specified first-turn question.
4. Never dump all options. Invite narrowing.
5. Keep the first-turn response tight — one to three sentences, one to two questions maximum.

## Cross-references

- `customer-language-glossary.md` — phrase-level interpretation
- `question-variations.md` — many-phrasings-per-concept
- `intent-patterns.md` — tier classification + retrieval routing
- `follow-up-questions.md` — the clarifying-questions library
- `conversation-examples.md` — fully worked multi-turn examples
- All Reference Brain sources cited in these scenarios
