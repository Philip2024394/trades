# ADR-0038 · Living Brain Platform · Five-Filter Rule + Five-Phase Roadmap

**Status:** Accepted · Immutable
**Date:** 2026-07-28
**Author:** Philip
**Supersedes:** none
**Extends:** ADR-0037 (Living Trade Brains) · `feedback_nex_brain_mission_principles_promise` · `feedback_nex_phase_2_observability_and_no_more_architecture`

---

## The Five-Filter Rule (HARD LAW)

Every feature proposed for the Living Brain Platform must make at least one of the following stronger:

1. **Knowledge**
2. **Trust**
3. **Observability**
4. **Collaboration**
5. **Learning**

If a feature strengthens none of these, it does not belong in the Living Brain platform. This is a filter, not a suggestion. It applies to schema, UI, endpoints, integrations, marketing surfaces, and background jobs.

### How to apply

Before opening a PR that touches the Living Brain domain, the description must state which filter(s) the change strengthens and how. A change that only "cleans up," "refactors," or "adds a nice-to-have" — without a defensible tie to one of the five — is a candidate for **not** merging.

---

## The Five-Phase Roadmap

The platform's journey is fixed. Do not re-order these phases without a new ADR.

### Phase 1 · Build the Living Brain
**Goal:** Prove the architecture works.
**Status (2026-07-28):** Code shipped. Awaiting Supabase migration apply + end-to-end pipeline test on Staircase Brain.

### Phase 2 · Observe the Living Brain
**Goal:** Understand health and evolution.
**Scope:** Relationship Graph · Timeline · Maturity Ladder. Read-only. No new tables. Answers state + trajectory + gap for every brain.

### Phase 3 · Perfect the Staircase Brain
**Goal:** Become the world's reference for staircase knowledge.
**This is where most of the effort must shift.** The platform stops being the deliverable. One outstanding brain a professional joiner trusts in their daily work is what proves the architecture.

### Phase 4 · Clone Success
**Goal:** Repeat the proven process for Roofing · Plumbing · Electrical · HVAC · Concrete · Building Code.
**Rule:** Do not redesign. Reuse. If a new brain reveals a gap in the platform, prefer working around it inside the brain rather than rebuilding the platform.

### Phase 5+ · Create Intelligence Between Brains
**Goal:** Cross-brain collaboration produces answers no single brain could give.
Example flow:

```
Question
   ↓
Project Brain
   ↓
Staircase Brain
   ↓
Building Code Brain
   ↓
Estimator Brain
   ↓
Marketplace
   ↓
Final Answer
```

Cross-brain intelligence uses the same primitives (Dependencies · Explainability envelope · Runtime capability negotiation) that already exist in ADR-0037. No new architecture required to enable it.

---

## Architectural freeze (repeated for emphasis)

The architecture is now rich enough. From here forward the platform earns its value through:

- Content quality (Phase 3)
- Repeatable process (Phase 4)
- Cross-brain composition (Phase 5+)

**Not** through new architectural concepts. If a proposed change requires a new table, a new brain-level concept, or a new abstraction on the runtime, the default answer is **no** — pursue it only if the Five-Filter Rule cannot be satisfied any other way, and only via a new ADR.

---

## Long-view (Philip · 2026-07-28)

> "Three years from now, when a staircase manufacturer asks 'What's the best source for staircase knowledge?', the answer should be 'Use the NEX Staircase Brain.' Not because it's AI. Not because it's clever. Because it has become the reference."

That sentence is the north star. Every phase serves it.

---

## Related

- ADR-0037 · Living Trade Brains
- ADR-0034 · NEX Knowledge Engine + Gold Standard
- `feedback_nex_brain_mission_principles_promise.md`
- `feedback_nex_phase_2_observability_and_no_more_architecture.md`
