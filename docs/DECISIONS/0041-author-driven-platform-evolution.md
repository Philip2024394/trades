# ADR-0041 · Author-Driven Platform Evolution

**Status:** Accepted · Immutable
**Date:** 2026-07-28
**Author:** Philip
**Type:** Operational governance (enforces the architectural freeze declared in ADR-0038)
**Extends:** ADR-0037 · ADR-0038 · ADR-0039 · ADR-0040

---

## The rule (HARD LAW)

> **Platform features must now be discovered by authoring reference brains, not imagined in advance.**

The architecture is on **probation.** Every future platform enhancement must be justified by a real limitation encountered while authoring the Staircase Brain (or, later, another reference brain).

If the Staircase Brain cannot expose the need, the platform does not grow.

---

## The question inversion (operational core)

The default question shifts:

- **Old:** *What should the platform do next?*
- **New:** *What stopped us from making the Staircase Brain more trustworthy today?*

Only if the honest answer is "the platform can't support this" is a platform change even eligible for consideration. Every other cause (author skill gap · content gap · review gap · process gap · discipline gap) is solved inside the authoring layer, not inside the platform.

---

## Every proposed platform change must include

1. **The concrete authoring scenario** where the limitation was encountered
2. **The workaround attempted** — proof the platform doesn't already support this via existing primitives
3. **The trust impact** — which of the four filters (Prime Sentence · Trust Question · Five Qualities · Professional Test) does this unblock, and how?
4. **Scope discipline** — the smallest possible change that unblocks the scenario, nothing larger

A proposal lacking any of the four is a **wish list item**, not a platform requirement. Treat it accordingly.

---

## The success measure shifts

Platform success is now measured by:

- Quality of the brains built on top of it
- Trustworthiness of those brains
- Professional peer recommendations of those brains (the Professional Test result)

**Not** by:

- Number of platform capabilities
- Sophistication of the architecture
- Feature announcement volume
- Number of ADRs

The measure of a lean platform is that its owners can list its capabilities from memory, and every one earns its keep.

---

## Why this rule matters

Platforms bloat when they grow speculatively. Every unused capability is future maintenance debt. Every added abstraction is future confusion for the next author.

By binding platform growth to authoring reality, the platform stays **lean and purposeful**. Every line of platform code exists because a real author needed it to earn real trust from a real professional.

---

## How this composes with the prior four ADRs

| ADR | Says |
|---|---|
| 0038 | Architecture is rich enough — no more architectural concepts |
| 0039 | Phase 3 is Reference Brain Engineering — earn the right to become the reference |
| 0040 | The Prime Sentence — become the most trusted professional reference (not the smartest) |
| **0041 (this)** | **If the platform must extend, prove the extension comes from authoring reality, not imagination** |

Together they form a closed loop:

- The **platform serves the brains** (0041)
- The **brains serve the professionals** (0040)
- The **professionals validate the brains** (0039 · Professional Test)
- **Their needs — surfaced through authoring — are the only justification for platform change** (back to 0041)

The loop has no leaks. Speculative work cannot enter.

---

## What this rule protects

- The platform stays lean
- Architectural surface area stays small enough for a small team to master
- Every capability has a real customer (an author, blocked by a real limitation)
- Trust in the platform's decisions compounds over time — because every decision has been earned by a real problem

## What this rule forbids

- Speculative capability additions
- "It might be nice to have…" features
- Cargo-culted concepts from other AI platforms
- Building for imagined future users
- Extending the platform because a Claude session or ChatGPT session suggested it

The last item is important. This rule applies to AI-authored proposals as strictly as to human-authored proposals. An AI that proposes new platform capabilities without an authoring-driven trigger is doing exactly the kind of speculative expansion this rule exists to prevent.

---

## The proving ground

The **Staircase Brain** is the proving ground for every platform decision throughout Phase 3. Later, when Phase 4 begins, each subsequent brain (Roofing · Plumbing · Electrical · HVAC · Concrete · Building Code · etc.) also serves as a proving ground — but the Staircase Brain remains the primary reference because it earned that status by going through Phase 3 first.

If Phase 4 discovers a limitation that Phase 3 did not, the platform may extend to serve it — but only under the same four-part justification.

---

## The one-line summary

> The platform is now on probation. The Staircase Brain is the judge.

---

## Related

- ADR-0037 · Living Trade Brains
- ADR-0038 · Five-Filter Rule + Five-Phase Roadmap (architectural freeze)
- ADR-0039 · Reference Brain Engineering Discipline
- ADR-0040 · The Prime Sentence + The Professional Test
- Memory: `feedback_nex_author_driven_platform_evolution.md`
- Memory: `feedback_nex_phase_2_observability_and_no_more_architecture.md` (partial predecessor)
