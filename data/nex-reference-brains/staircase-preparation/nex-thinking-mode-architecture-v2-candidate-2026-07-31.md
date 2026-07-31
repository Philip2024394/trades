---
title: NEX Thinking Mode Architecture · Standard v2 Candidate · 2026-07-31
type: nex_v2_candidate_reference
status: REFERENCE_MATERIAL · NOT_ARCHITECTURE · AWAITS_REALITY_SIGNAL
composes_with:
  - NEX-KNOWLEDGE-ARCHITECTURE-STANDARD-v1.md (v1 unmodified)
  - Prior v2 candidates: Knowledge Confidence Layer (6th ruling) · Estimator Brain (10th ruling)
governance_position: |
  Philip 2026-07-31 authored a fundamental architectural insight: NEX may need a THINKING MODE layer
  distinct from Intent. Intent = what the user wants. Thinking Mode = how NEX should solve it.
  Preserved verbatim as Standard v2 CANDIDATE per Reality-Over-Speculation.
  Standard v1 remains unmodified. Build only when reality demonstrates need.
reality_signal_to_unlock_v2_build: |
  Router successfully classifies Intent + Subject at high accuracy, but downstream response quality
  suffers because the same Intent triggers wildly different response STYLES that pattern-based Info Type
  cannot distinguish (e.g. Why questions that need reasoning vs Why questions that need lookup).
  Reality has not yet spoken this signal. Preserved for future.
---

# NEX Thinking Mode Architecture · Standard v2 Candidate

## Philip's Authored Insight (preserved verbatim)

> *"You've been talking about intents, but what you're really designing is how NEX thinks.
> There's a difference between 'What did the user ask?' and 'What kind of thinking is needed to answer this well?'
> Those are two separate layers."*

## The Proposed Full Cognitive Stack

```
User Question
      │
      ▼
USER STATE           ·  Curious · Confused · Planning · Buying · Learning
      │
      ▼
INTENT               ·  Visual · Compare · Install · Price · Why · See · Consult · ...
      │
      ▼
THINKING MODE  ★     ·  Lookup · Reasoning · Diagnostic · Consultative · Systems · Teaching · Reality
      │  (NEW · this candidate)
      ▼
KNOWLEDGE GRAPH      ·  Components · Materials · Regulations · Engineering · Manufacturing · Installation
      │
      ▼
COMPOSER             ·  Text · Images · Drawings · Videos · FAQs · Related Questions
```

## Ten Thinking Modes (Philip's authored enumeration · verbatim)

1. **Lookup Thinking** — simple retrieval. *"What is a tread?"* → Retrieve definition.
2. **Visual Thinking** — needs pictures. *"Show me a tread"* → Images first.
3. **Comparison Thinking** — weighs differences. *"Oak or ash?"* → Compare/pros/cons/recommendation.
4. **Consultative Thinking** — needs discovery. *"Which staircase suits my house?"* → Don't answer · ask (floor height · opening · budget · style).
5. **Reasoning Thinking ⭐** — connects facts. *"Why can't I remove this newel?"* → Newel supports handrail · handrail transfers load · loads go into post · remove post → handrail weakens → therefore...
6. **Systems Thinking** — cross-domain connections. *"Can I move this wall?"* → affects stairs → headroom → trimmers → landing → regulations → manufacture → installation.
7. **Diagnostic Thinking** — investigative. *"My staircase squeaks."* → possible causes: movement · wedges · moisture · loose fixings · timber shrinkage · flooring.
8. **Critical Thinking** — verification. *"My builder says this is okay."* → checks: regulations · engineering · manufacturer guidance · practical experience.
9. **Reality Thinking** — expectation vs reality. *"Can every staircase float?"* → Expectation → Engineering → Reality → Advice.
10. **Teaching Thinking ⭐⭐⭐** — audience-adaptive. Same knowledge · adjusted to beginner / architect / installer.

## The REASONER Module (Philip's authored proposal)

> *"Its job isn't to know facts. Its job is to CONNECT facts."*

Example — *"Why are stair strings so thick?"*

Knowledge knows: string thickness · loads · timber properties.

Reasoner connects: Weight → Treads → String → Newel → Floor → House. Then explains.

## Curiosity / Understanding Intent Family (Philip's proposed additions to v1's Intent enum)

- **WHY** — *"Why...", "Why does...", "Why is...", "Why can't...", "Why should..."* · Purpose: explain reasoning.
- **HOW IT WORKS** — *"How does...", "How is..."* · Purpose: explain mechanism.
- **PURPOSE** — *"What does it do?", "What's the point of...", "Why have one?"* · Purpose: explain function.
- **SCIENCE / ENGINEERING** — *"Why does oak move?", "Why do staircases creak?"* · Purpose: engineering principles.
- **HISTORY** — *"Why are staircases built this way?", "Where did bullnose steps come from?"* · Purpose: educational.

## New User States (Philip's proposal for v2)

- **CONFUSED** — user doesn't know enough to ask a precise question. NEX teaches gently: simpler language · labelled images · comparisons · analogies · avoid jargon · check understanding.
- **CURIOUS** — user wants understanding, not lookup. NEX explains reasoning, not just facts.

## New Knowledge Layers (Philip's proposal · would extend Standard v1 Knowledge Domains)

For every subject: Definition · Visual · Installation · Engineering · History · Regulations · **Reality Check** · **Common Mistakes** · **Myths vs Reality** · Maintenance.

### Reality Check (first-class knowledge type)

- **Myth:** Glass needs no maintenance.
- **Reality:** Glass still requires regular cleaning and inspection.
- **Why:** Fingerprints, dust and fixings require maintenance.

### Common Misconceptions (first-class knowledge type)

- Oak → *"Oak never moves."* (Myth)
- Glass → *"Glass is fragile."* (Myth)
- Open risers → *"They're always unsafe."* (Myth)
- Reclaimed timber → *"It's always better quality."* (Myth)

## Why This Is a v2 Candidate (not v1)

Per Reality-Over-Speculation: build unlocked by reality. This candidate awaits the specific reality signal above — routing accuracy plateaus AND downstream composition quality suffers from same-Intent-different-Thinking-Mode collisions.

Small pieces of this candidate that pass the four-filter constraint TODAY (partial engineering adoption):

- **Curiosity / Why intent** — pattern detection for "Why..." queries → route to a different Info Type (Reasoning / Explanation). Legitimate Router extension.
- **Confused Suite rows** — testable now, no v2 build required.
- **Reality Suite rows** — testable now, no v2 build required.

These CAN enter Router Build 0.06 without triggering the v2 architecture. The full Thinking Mode layer awaits its own reality signal.

## Philip's Summary Insight (preserved verbatim)

> *"Intent decides what the user wants. Thinking mode decides how NEX should solve the problem. A human staircase expert doesn't use the same mental process for every question — they retrieve facts, compare options, diagnose problems, reason through consequences, or teach concepts depending on the situation. Separating those layers gives NEX a much more human-like decision process and will make its answers feel more like those of an experienced staircase consultant than a search engine."*

---

## Gatekeeper Note

**Standard v1 remains UNMODIFIED.** This candidate is REFERENCE MATERIAL only. If Philip later ratifies Thinking Mode as a v2 amendment (following the same pipeline as Constitutional Ruling #6), this document becomes the anchor. Until then · no build.

**Small pieces adopted today** (Router Build 0.06): Curiosity/Why intent pattern + Suite rows testing Why/Reality/Confused/Diagnostic queries. These pass the four-filter constraint and do not require the full Thinking Mode architecture.
