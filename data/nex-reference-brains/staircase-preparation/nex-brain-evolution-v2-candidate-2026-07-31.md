---
title: NEX Brain Evolution · Standard v2 Candidate · 2026-07-31
type: nex_v2_candidate_reference
status: REFERENCE_MATERIAL · NOT_ARCHITECTURE · AWAITS_REALITY_SIGNAL
composes_with:
  - NEX-KNOWLEDGE-ARCHITECTURE-STANDARD-v1.md (v1 unmodified)
  - Prior v2 candidates: Knowledge Confidence Layer · Estimator Brain · Thinking Mode Architecture
governance_position: |
  Philip 2026-07-31 authored the "NEX Brain Evolution – Build 0.06+ (Architectural Vision)" plus the
  follow-up simpler three-layer separation (Brain / Knowledge / Conversation).
  Both preserved verbatim as v2 candidate. Standard v1 remains unmodified.
adopted_today_partial: |
  Only Subject Intelligence (homeowner_terms field on select subjects) is adopted in Router Build 0.07.
  That single concrete extension passes the four-filter constraint by targeting the 80.5% Subject bottleneck.
  Full Brain/Knowledge/Conversation refactor deferred to v2.
---

# NEX Brain Evolution · Standard v2 Candidate

## Philip's Three-Layer Refinement (preferred over biological metaphor)

```
Brain (how NEX thinks)              Knowledge (what NEX knows)           Conversation (how NEX speaks)
├── Reasoning                       ├── Staircases                       ├── Beginner
├── Teaching                        ├── Components                       ├── Homeowner
├── Diagnostic                      ├── Materials                        ├── Builder
├── Consultation                    ├── Manufacturing                    ├── Architect
├── Systems Thinking                ├── Installation                     ├── Installer
├── Reality                         ├── Regulations                      └── Manufacturer
├── Curiosity                       └── Maintenance
└── Confusion Resolver
```

**Philip's framing:** *"The Brain chooses a thinking strategy, the Knowledge provides the facts, and the Conversation layer presents them in the right style."*

## Five Major Capabilities (Philip's roadmap)

1. Understand the user — words + context + emotional state
2. Understand the subject — Subject Intelligence with functions · locations · relationships · homeowner terminology · common misconceptions
3. Think appropriately — different questions need different thinking modes
4. Explain like an expert — Curiosity · Confusion · Reality become answer styles
5. Grow without becoming fragile — regression testing preserves stability

## Subject Intelligence Schema (partially adopted Build 0.07)

```yaml
Subject:
  Canonical name
  Aliases
  Homeowner terminology         # ADOPTED in Build 0.07 (5 subjects)
  Functional descriptions       # v2 candidate
  Purpose                       # v2 candidate
  Location                      # v2 candidate
  Relationships                 # v2 candidate
  Common misconceptions         # v2 candidate
  Visual references             # v2 candidate
  Engineering notes             # v2 candidate
```

Example (adopted format):

```
Subject:         Newel Post
Aliases:         newel post · newel posts · newel · newels
Homeowner terms: big post · corner post · wooden post · post at the bottom
```

## Twelve Biological Brain Regions (Philip's original metaphor · preserved)

1. **Cerebrum / Executive** — Intent classification · subject resolution · logic · multi-intent routing
2. **Frontal Lobe / Decision** — Recommendation · consultation · clarification · trade-offs
3. **Parietal Lobe / Spatial** — Dimensions · geometry · headroom · rise & going · installation space
4. **Temporal Lobe / Knowledge** — Definitions · terminology · materials · manufacturing · history · FAQs
5. **Occipital Lobe / Visual** — Show · see · picture · looks like · gallery (partially built via See intent)
6. **Cerebellum / Coordination** — Manufacturing · installation · site coordination · workflow · dependencies
7. **Brainstem / Safety** — Building regulations · safety · compliance · structural integrity — never bypass
8. **Hippocampus / Memory** — Previous staircase · customer preferences · earlier questions · conversation continuity
9. **Amygdala / Emotion** — Confused · frustrated · excited · worried · first-time buyer — response adapts
10. **Hypothalamus / Needs** — What customer NEEDS vs what they asked
11. **Thalamus / Router** — Central routing hub across all knowledge dimensions
12. **Cingulate Gyrus / Conversation** — Ask questions · continue discussion · teach · confirm · guide

## Seven Additional Thinking Modules

1. **Curiosity Engine** — Why · How · What makes → Explain engineering
2. **Confusion Resolver** — I'm confused · Don't understand → Simplify with images + analogies
3. **Reality Engine** — Can every staircase float? → Expectation · Engineering · Reality · Advice
4. **Diagnostic Engine** — My staircase squeaks → Possible causes · questions · likely diagnosis
5. **Systems Thinking** — Can I move this wall? → Wall → Trimmers → Headroom → Landing → Manufacture → Installation → Regulations
6. **Reasoning Engine** — Why can't I remove this newel? → Newel · Handrail loads · String · Floor · Structural stability
7. **Teaching Engine** — Adjust explanations to user's knowledge level (Beginner ↔ Professional)

## Concept Resolution — The Critical Insight

Current Subject Dictionary matches:
- User says "newel" → Subject = Newel post ✓
- User says "the big wooden post at the bottom" → Subject = Unknown ✗

Subject Intelligence adds `homeowner_terms` that matches descriptive language:
- User says "the big wooden post at the bottom" → Subject = Newel post ✓
- User says "the piece you hold" → Subject = Handrail ✓
- User says "the wooden thing under the steps" → Subject = String ✓
- User says "the flat bit you stand on" → Subject = Tread ✓

**This is not more aliases. This is concept resolution.**

## Final Vision (Philip's verbatim)

> *"The goal is not to build a smarter search engine. The goal is to build a staircase consultant that can understand what the user means · choose the appropriate mode of thinking · teach, reason, compare, diagnose, recommend and explain · adapt its language and depth · combine text, images, engineering knowledge and practical advice into a coherent conversation. NEX should behave less like a glossary and more like a master staircase designer, joiner and consultant."*

---

## Gatekeeper Note

**Standard v1 remains UNMODIFIED.** Full v2 architecture preserved as reference. Only Subject Intelligence with homeowner_terms is adopted in Router Build 0.07 (four-filter compliant · targets Subject Dictionary bottleneck).
