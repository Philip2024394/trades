# ADR-0043 · Reality Over Speculation

**Status:** Accepted · Immutable
**Date:** 2026-07-30
**Author:** Philip O'Farrell
**Type:** Operational governance (refines the working language of ADR-0041 without replacing it)
**Extends:** ADR-0037 · ADR-0038 · ADR-0039 · ADR-0040 · ADR-0041 · ADR-0042

---

## The rule (HARD LAW)

> **Every not-yet-build decision must name the specific reality signal that would unlock it.**

*"BUILD deferred"* is no longer sufficient language. It reads as passive gatekeeping. The correct language is *"unlocks when reality shows [specific signal]"* — active, evidence-driven, unambiguous.

The governance discipline established by ADR-0041 (Author-Driven Platform Evolution) does not change. What changes is how not-yet-build decisions are communicated and reasoned about.

---

## Why this ADR exists

Between the ship of ADR-0041 (2026-07-28) and 2026-07-30, a language pattern emerged inside the platform work: *"BUILD deferred"* began appearing several times per session. Individually, each decision was correct — reality had not yet surfaced the limitation that would justify the build. Cumulatively, the language started to read as *"we are not going to build things,"* creating an unintended bottleneck feel.

Philip's diagnosis (verbatim):

> *"BUILD DEFERRED feels like 'not yet.' BUILD UNLOCKED BY REALITY means 'reality has proved this capability is now required.'"*

The failure mode this ADR prevents:

- 2026 → Mind v1 → v2 → v3 → v4 → v5 → three years later → BUILD

That is the drift path where architectural refinements accumulate in memory faster than reality can validate them, and the platform quietly stops building anything at all because nothing ever quite meets the "author-driven need" bar. ADR-0043 closes that drift by requiring every not-yet-build decision to state its unlock condition explicitly.

---

## Composition with existing ADRs

- **ADR-0041 (Author-Driven Platform Evolution)** — the rule that platform features are discovered by authoring, not imagined in advance. **Unchanged.** ADR-0043 refines its working language.
- **ADR-0040 (Prime Sentence + Professional Test)** — the trust capstone. Unaffected.
- **ADR-0042 (Reference Brain Sole Authoritative Path)** — the plurality-of-truth closer. Unaffected.
- **Rules A · B · C** — anti-fabrication · no AI-authored · attributable origin. Unaffected.

Every future proposal now composes through:

1. **ADR-0041** — is the limitation surfaced by authoring reality?
2. **ADR-0042** — does the change respect the Sole Authoritative Path?
3. **ADR-0043 (this)** — does the not-yet-build decision name the specific unlock signal?

If any answer is no, the proposal is not accepted. If all three answer yes, the proposal moves.

---

## The three constitutional principles this composes into

NEX now operates under three composing principles at the highest level:

1. **Silence over fabrication** (Rule A · immutable UNKNOWN Rule)
2. **Trust over completeness** (Trust Metric · Reference Brain Validation v1.0)
3. **Reality over speculation** (this ADR · amends ADR-0041 working language)

The three do not compete. They compose. Together they answer *"when do we build, when do we stay silent, when do we ask?"* in a way that respects both governance and momentum.

---

## Every future not-yet-build decision must state

1. **The specific reality signal** — what observation, in real user or authoring behaviour, would flip the decision from not-yet to build
2. **Why the current state does not yet meet that signal** — evidence, not opinion
3. **Where the signal will be watched for** — Observatory · Trust Metric · Validation v1.0 · a specific gate · a specific corpus test · a specific author reality

A not-yet-build decision that cannot state all three of these is not a governance decision. It is a delay dressed as governance.

---

## Concrete language shift · same decisions · sharper framing

| Old framing | New framing |
|---|---|
| Multi-mode composition · BUILD deferred | Multi-mode composition · **unlocks when a real user session shows a single-mode answer failing** |
| Estimation Intelligence · BUILD deferred | Estimation Intelligence · **unlocks when a real recommendation moment needs probability language instead of a verdict** |
| Learning Mind area · BUILD deferred | Learning · **unlocks when a real user shows a mode-of-understanding preference we can't currently honour** |
| Feeling Mind area · BUILD deferred | Feeling · **unlocks when a real user shows overwhelm and no current mechanism catches it** |
| Curiosity Mind area · BUILD deferred | Curiosity · **unlocks when a real user doesn't know what questions to ask and no current mechanism helps** |
| Router rename (BrainDestination → MindArea) · NO CHANGE | Router rename · **unlocks when the full Mind flow is being wired and the type name blocks clarity** |
| `knowledge/staircase.json` extraction · deferred | **unlocks after Terminology publishes and Priority 4 becomes meaningful** |
| Module 002 (Timber / Materials / etc.) · locked | **unlocks when Terminology passes all 13 gates including runtime validation** |

Nothing above is passive. Every entry names the observable event that would unlock the build.

---

## What this ADR does NOT change

- The set of things built vs not-built today — no immediate build unlocked by this ADR itself
- ADR-0041's governance rule — untouched
- The immutability of ADR-0040 · ADR-0041 · ADR-0042 — preserved
- Terminology Gate 2 authoring remains Priority 3
- The Sole Authoritative Path is unchanged

This ADR is a language and reasoning refinement. It sharpens how we describe not-yet-build decisions. It does not permit or forbid any specific build.

---

## The reality-signals register (living document · maintained separately)

Every capability currently sitting in the not-yet-built state carries a specific reality signal that would unlock it. Those signals are recorded in `feedback_reality_over_speculation.md` (auto-memory) and will surface in the appropriate ADR or Product Constitution principle when the specific capability is built.

When a signal is observed in reality — a real user session, a Trust Metric drop, a Validation v1.0 gap, an authoring blocker — the corresponding capability is unlocked and moves into the build queue at the top of the next priority slot.

---

## The immutable line

Locked as **HARD LAW · IMMUTABLE** by Philip O'Farrell · 2026-07-30.

No future ADR overrides this. Amendments require a new ADR that explicitly cites and supersedes this one, with the same immutable line.

*"Build only what reality proves is required. Every not-yet-build decision names its unlock signal. Reality over speculation."*
