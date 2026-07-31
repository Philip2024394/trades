---
title: NEX Cognitive Model v1
version: 1.0
status: CANONICAL CONTRACT · plain-English definitions for every future build
created: 2026-07-31
authored_by: Philip O'Farrell (requested the document + defined the dimensions) · composed by Gatekeeper
purpose: |
  Philip 2026-07-31 explicit request: "Before GitHub · write a one-page architectural document called something like:
  NEX Cognitive Model v1. It would define, in plain English:
  What is a User State · What is an Intent · What is a Thinking Mode · What is a Knowledge Domain ·
  What is an Info Type · What is a Subject. That document becomes the contract for every future build.
  It prevents concepts from drifting or overlapping as the system grows."
composes_with:
  - NEX-KNOWLEDGE-ARCHITECTURE-STANDARD-v1.md (v1 unmodified · this document sits BELOW as the shared vocabulary)
  - Standard v2 candidates: Thinking Mode Architecture · Brain Evolution · Knowledge Confidence Layer · Estimator Brain · Voice Production System · Multilingual Communication System
gatekeeper_discipline: |
  This is the CONTRACT layer · not a governance ruling.
  It defines vocabulary · does not amend Standard v1 architecture.
  Every future build reads this document to prevent concept drift.
---

# NEX Cognitive Model v1

**The contract for every future build.** Plain-English definitions of the six routing dimensions NEX uses to understand any user query.

---

## 1. User State — *how the user feels or their level of understanding*

Not what they asked · how they feel or where they are in their journey.

| State | Signals |
|---|---|
| **Curious** | Wants to understand, not just look up. "Why...", "How does..." |
| **Confused** | Explicitly says they don't understand. "I'm confused about..." · "I don't get it..." |
| **Planning** | Preparing a decision. "I'm thinking about...", "Considering..." |
| **Buying** | Ready to purchase. "Need...", "Want to order..." |
| **Comparing** | Weighing options. "X or Y", "Which is better..." |
| **Learning** | Building knowledge. "What is...", "Tell me about..." |
| **Troubleshooting** | Something is wrong. "My staircase squeaks..." |
| **Neutral** | No detected state — default |

**Rule:** State CAN co-exist with any Intent. A user can be *Confused AND Comparing* simultaneously.

---

## 2. Intent — *what the user wants NEX to do*

The action the user is requesting.

| Intent | Meaning |
|---|---|
| **Learn** | Retrieve a definition or explanation |
| **See** | Show images · visual content · gallery |
| **Compare** | Weigh options · differences |
| **Consult** | Ask for a recommendation with clarifying questions first |
| **Quote** | Get a price |
| **Buy** | Purchase intent |
| **Service** | Installation / fitting |
| **Advise** | Best-practice guidance |
| **Browse** | Explore options / gallery |
| **Why** | Explain reasoning (Curiosity family) |
| **Reality** | Test an expectation |
| **Diagnostic** | Investigate a symptom |
| **Explain** | Describe a mechanism |

**Rule:** Every query has exactly one PRIMARY Intent. Multiple candidate intents = router must pick or clarify.

---

## 3. Thinking Mode — *how NEX should solve the problem*

The internal reasoning process NEX applies to answer well. Currently implicit in Domain routing · will become explicit if v2 Brain Evolution is ratified.

| Thinking Mode | When to apply |
|---|---|
| **Lookup** | Simple retrieval · known-fact question |
| **Visual** | Show first, explain second |
| **Comparison** | Weigh options · produce pros/cons |
| **Consultative** | Discover requirements first · then recommend |
| **Reasoning** | Connect facts to explain WHY |
| **Systems Thinking** | Cross-domain dependencies (moving one thing affects many) |
| **Diagnostic** | Investigative · rule out causes |
| **Critical** | Verify a claim · challenge assumptions |
| **Reality** | Expectation vs engineering constraint |
| **Teaching** | Adjust language to user's level |

**Rule:** Thinking Mode is chosen from User State + Intent. Same knowledge can be delivered via different Thinking Modes for different queries.

---

## 4. Subject — *what the user is talking about*

The physical or conceptual object at the centre of the query. Resolved via **Subject Intelligence**: aliases + homeowner terms + (v2: functional descriptions · locations · relationships · misconceptions).

Examples: `Staircase` · `Newel post` · `Handrail` · `Tread` · `Riser` · `String` · `Baluster` · `Glass balustrade` · `Landing` · `Oak` · `Timber` · `Reclaimed timber`.

**Rule:** Subject is CANONICAL. Aliases and homeowner terms all resolve to one canonical subject via longest-match.

---

## 5. Brain — *which specialist owns the answer*

The professional domain that owns the expertise.

- **Staircase Brain** — the whole staircase and its architecture
- **Materials Brain** — timber species · steel · glass · finishes
- **Tool Brain** — chisels · planes · saws · measuring tapes (proposed)
- **Joinery Brain** — general joinery techniques (proposed)
- **Interior Brain** — surrounding-room integration (proposed)
- **Construction Brain** — site coordination · regulations · trades (proposed)

**Rule:** Every Subject has a primary Brain. Cross-brain references replace duplication.

---

## 6. Knowledge Domain — *which section within the brain answers this*

The area of the brain's knowledge that holds the answer.

**Staircase Brain Domains:**
- **Classification** — types of staircase
- **Components** — parts (newel · tread · riser · etc.)
- **Materials** — timber choice within staircase context
- **Construction** — how it's built
- **Installation** — how it's fitted
- **Design Languages** — traditional · contemporary · industrial · etc.
- **Reference Gallery** — browseable images
- **Customer FAQ** — everyday customer questions
- **Pricing** — cost inquiries
- **Recommendation** — consultative sales advice
- **Engineering** — the WHY behind design choices
- **Reality Check** — expectation vs reality
- **Teaching** — beginner-friendly explanation
- **Troubleshooting** — diagnostic content
- **Scope of Work** — what's included / not included

**Rule:** Each Domain holds Evidence artefacts. Router selects the Domain BEFORE retrieval.

---

## 7. Information Type — *which aspect of the subject the user wants*

The specific angle on the subject. Same Subject × different Information Type = different answer.

| Info Type | Meaning |
|---|---|
| **Definition** | What is it? |
| **Types** / **Classification** | How many kinds are there? |
| **Dimensions** | How big / thick / tall? |
| **Options** | What's available? |
| **Cost** / **Pricing** | How much? |
| **Images** / **Gallery** / **Visual** | Show me |
| **Comparison** | X vs Y |
| **Function** | What does it do? / What's included? |
| **Best Practice** | What should I do? |
| **Recommendation** | Which one for me? |
| **Reasoning** | Why? |
| **Reality** | Can it actually...? |
| **Diagnosis** | What's causing this? |
| **Inquiry** | Ambiguous under-specified query |

**Rule:** Same Subject with different Info Type demands different retrieval. `Newel post + Definition` ≠ `Newel post + Dimensions`.

---

## Composition Rule (Philip 2026-07-31 · the regression insight)

**These dimensions COMPOSE. They are not mutually exclusive.**

Example: *"What's the difference between a string and a skirt? I'm totally confused."*

```
State:         Confused
Intent:        Compare
Thinking Mode: Teaching + Comparison
Subjects:      String · Skirting Board
Brain:         Staircase (cross-ref Interior for Skirting)
Domain:        Design Languages (Comparison) + Teaching (Confused)
Info Type:     Comparison
Composer:      Side-by-side comparison + labelled image + simplified language
```

**Router MUST allow composite classifications.** One dimension winning does not preclude another.

---

## Router Confidence — *a meta-dimension*

Every dimension carries a confidence score (0.00–1.00). Aggregate Router Confidence is the geometric mean.

If Router Confidence < threshold → **Ask clarification. Do not retrieve arbitrary evidence.**

Distinct from *Knowledge Confidence* (Standard v2 candidate · maturity of the evidence itself).

---

## Contract Enforcement

Every future Router build MUST:

1. Read this document as the vocabulary contract
2. Never introduce a dimension not defined here without adding it here first
3. Never conflate two dimensions (e.g. State ≠ Intent)
4. Preserve backward compatibility of dimension names (Vocabulary Elasticity Principle: values within dimensions are empirical · dimensions themselves are constitutional)

---

## Composes With

- **Standard v1** (unmodified) — this document sits BELOW as the shared vocabulary
- **Router Validation Suite v1** — every Suite row uses these exact dimension names
- **Router Trace Format v1** — every trace exposes these six dimensions
- **Router Builds 0.01–0.07** — each has progressively implemented more of this contract

**Standard v2 candidates awaiting reality signals:**
- Thinking Mode Architecture (formal 10-mode routing layer)
- Brain Evolution (Brain/Knowledge/Conversation three-part separation)
- Knowledge Confidence Layer (Canonical · Reference · Observed · Emerging)
- Estimator Brain (own brain vs domain-within-brain)
- Voice Production System (speech-generation architecture)
- Multilingual Communication System (language detection + response)

---

**End of NEX Cognitive Model v1**

*The dimensions are constitutional. The values within them are empirical. This document is the contract.*
