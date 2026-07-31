---
title: NEX Nine Capabilities Roadmap · Standard v2 Candidate
type: nex_v2_candidate_reference
status: REFERENCE_MATERIAL · NOT_ARCHITECTURE · AWAITS_REALITY_SIGNAL
authored_by: Philip O'Farrell · 2026-07-31 · preserved verbatim
composes_with:
  - NEX-COGNITIVE-MODEL-v1.md (defines the vocabulary these capabilities operate on)
  - Prior v2 candidates: Thinking Mode Architecture · Brain Evolution · Voice Production System · Multilingual Communication System · Knowledge Confidence Layer · Estimator Brain
---

# NEX Nine Capabilities Roadmap · Standard v2 Candidate (Philip 2026-07-31 · verbatim)

Brain-inspired capabilities translated into staircase-specific AI modules.

## The Nine Capabilities

| # | NEX Module | Brain Inspiration | Purpose |
|---|---|---|---|
| 1 | **Governed Knowledge Learning** | Dynamic Synaptic Weighting | Promote frequently successful routes · record which clarifications resolved user questions · suggest new aliases and homeowner terms · learn from approved engineering updates. HUMAN APPROVES every dictionary update (fits governance model). |
| 2 | **Context Memory** | Hierarchical Memory | Short-term: current conversation ("It", "That"). Long-term: customer preferences (Oak house · white spindles · wants glass · building extension). Avoids repeating questions. |
| 3 | **Internal Review Engine** | Self-Correction | Instead of immediately replying, checks: conflicting answers · regulation conflicts · missing measurements · contradictory advice. **Draft → Review → Answer.** |
| 4 | **Adaptive Conversation** | Prosody / Cadence | If NEX becomes voice-enabled: adapt communication style. Beginner → slow · simple. Professional → technical. NOT breathing simulation. |
| 5 | **Concept Resolution** | Semantic Decoding | Understand incomplete language. "big wooden thing" → Newel. Already started in Router Build 0.07 with Subject Intelligence homeowner_terms. |
| 6 | **User State Detection** | Valence Mapping (language only) | Detect: Confused · Frustrated · Happy · Buying · Learning · Planning · Professional. Then change response style. Language-only · NO biometric feedback. |
| 7 | **Multi-Modal Understanding** | Cross-Modal Association | Image · Drawing · Description · CAD → NEX understands they're the same staircase. Directly composes with existing Reference Gallery + Vision Analysis. |
| 8 | **Systems Reasoner** | Generative Scenario Testing | User: "Can I remove this wall?" → NEX simulates: Wall removed → Trimmers move → Headroom changes → Landing changes → Manufacturing changes → Installation changes → Result. This IS the Systems Thinking Engine from prior v2 candidates. |
| 9 | **Focus Engine** | Attention Gating | User uploads image + drawing + measurements + asks one question → NEX focuses on the question (Headroom) · not oak species · not pricing · not paint. Prevents information overload. |

## The Missing Capability (Philip 2026-07-31)

**Confidence Engine** — every answer should have an internal confidence score:

- **97% Confidence** → Answer immediately
- **62% Confidence** → Ask one clarification
- **31% Confidence** → Don't guess. Ask for drawing / measurements / image.

*"That single capability will make every other module safer and more effective."*

**Status:** partially built already. Router Confidence field exists in every Trace + Low-Confidence handling triggers Clarify per Standard v1 §Runtime Contract. The composer-side confidence gate (what evidence to serve · what to abstain from) awaits Retrieval + Composer layers being built.

## Top 6 Highest-Impact Additions (Philip's authored priority order)

1. **Internal Review Engine** (self-check before answering)
2. **Context Memory** (conversation and long-term project continuity)
3. **Multi-Modal Understanding** (link images · drawings · measurements · text)
4. **Systems Reasoner** (simulate consequences and dependencies)
5. **Focus Engine** (concentrate on the relevant information for the current task)
6. **Confidence Engine** (know when to answer · clarify · or request more information)

## Explicitly REJECTED (Philip's discipline)

- ❌ **Sub-Vocal Intention Mapping** — specialised hardware · not relevant to staircase consultant
- ❌ **Biometric Feedback** (EEG · heart-rate) — language detection is sufficient
- ❌ **Artificial Mood** — NEX shouldn't have moods. It should have Response Modes.
- ❌ Breathing simulation in voice
- ❌ Brain-reading

## Router Generations (Philip 2026-07-31 · milestone framing)

**Generation 1 · Pattern Router** — v0.01–v0.02 — Pattern matching + rule expansion.

**Generation 2 · Semantic Router** — v0.03–v0.07 — Subject Dictionary · Intent families · User states · Subject Intelligence · Concept resolution · Regression governance.

**Generation 3 · Cognitive Router (future)** — Thinking Modes · Knowledge Graph · Relationship reasoning · Multi-subject planning · Response composition driven by cognition.

The current Router Builds sit in **Generation 2** · Generation 3 is the v2 candidate territory.

## Subject Intelligence v1 · Full Knowledge Object Schema

Beyond aliases + homeowner_terms (adopted in Build 0.07), every subject should eventually carry:

```yaml
Subject:
  Canonical name
  Aliases
  Homeowner Terms       # adopted Build 0.07 (5 subjects)
  Functions             # v2 candidate
  Purpose               # v2 candidate
  Location              # v2 candidate
  Engineering Role      # v2 candidate
  Relationships         # v2 candidate · unlocks Knowledge Graph
  Manufacturing         # v2 candidate
  Installation          # v2 candidate
  Visual Assets         # v2 candidate
  Common Questions      # v2 candidate
  Common Misconceptions # v2 candidate
  Typical Problems      # v2 candidate
  Related Subjects      # v2 candidate
```

*"That isn't just a dictionary. It's a knowledge object."*

## Build 0.08 Target (Philip's authored suggestion)

*"I don't think the biggest gains come from more homeowner terms. I think they come from relationships."*

Relationship graph example:
```
Handrail → connects to → Newel → supports → String → holds → Treads → above → Risers
```

Query: *"Why can't I remove the newel?"* → router traverses Newel → Handrail → Balustrade → Loads → String → Safety. Reasoning without hard-coding every question.

---

## Gatekeeper Note

Preserved as v2 candidate per Reality-Over-Speculation. Standard v1 remains unmodified. All 9 capabilities await reality signals. Confidence Engine is partially built (Router Confidence field + Low Confidence Clarify) · composer-side gate awaits Retrieval + Composer layers.
