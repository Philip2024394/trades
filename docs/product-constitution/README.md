# NEX Product Constitution

**Read this before writing code.**

The Product Constitution defines **how the NEX platform should feel** to the owners who use it. It sits above every module, every screen, every prompt, every workflow.

## How this relates to the rest of the repository

| Section | Answers the question | Format |
|---|---|---|
| `docs/DECISIONS/` (ADRs) | *"How is the platform BUILT?"* | Numbered architectural decisions · technical · versioned rationale |
| `docs/product-constitution/` (this section) | *"How should the platform FEEL?"* | Numbered product principles · experience-focused · timeless |
| `docs/features/` | *"What has been built?"* | Feature index · one line per feature area |
| `docs/BLUEPRINT.md` | *"What exists right now?"* | Auto-generated map of the codebase |

**Architecture is how NEX is built. The Product Constitution is what NEX must feel like to the person using it.** Both must be true for any code that ships.

## What this is NOT

- **Not an ADR.** Architecture decisions describe technical structure. This describes experience.
- **Not a coding standard.** Coding standards are style. This is spirit.
- **Not a design system.** A design system defines components. This defines what those components should do to the user's day.
- **Not a marketing document.** This is what the product must actually deliver, not what we say about it.

## What this IS

A **permanent product philosophy** that applies to every NEX module:

- Materials
- Hardwood Calculator
- Staircase Calculator
- Projects
- Purchasing
- CRM
- Manufacturing
- Estimating
- Scheduling
- Deliveries
- Invoicing
- Any future module

Every module must satisfy the Constitution before release. No exceptions.

## The Quality Gate

Every workflow, screen, prompt and interaction must pass **all ten questions** below before shipping. If any answer is "no", redesign before merging.

1. Does this feel like working with an experienced operations manager rather than software?
2. Has NEX completed as much of the work as possible before asking the owner anything?
3. Does the owner review and approve rather than complete forms?
4. Is the technology invisible?
5. Does the workflow reduce effort compared to traditional software?
6. Does the owner always understand what will happen before anything changes?
7. Is confidence more important than automation?
8. If NEX is uncertain, does it ask rather than guess?
9. Can this workflow eventually support voice, photographs, screenshots and documents as naturally as typing?
10. After using this workflow, would a staircase manufacturer describe it as **"easy"** rather than **"clever"**?
11. **Would an experienced staircase workshop manager naturally work like this?** (Not: would a software developer build it this way. Not: would an inventory application behave this way. The single strongest filter — the workshop manager test.)
12. **Can a staircase workshop manager understand where every material came from?** (Traceability chain visible: Stock → Memory → Library → source file. If a worker asks *"where did this oak come from?"* the answer is one tap away, with dates, supplier, and provenance intact.)

These are the twelve questions that apply to a UI change, a new module, a copy tweak, an error state, an empty state, or a whole new business workflow. There is no scope too small.

## Principles Index

Principles are numbered like ADRs (0001, 0002, …) but live under `docs/product-constitution/principles/`.

| # | Title | Status |
|---|---|---|
| [0001](principles/0001-nex-quietly-runs-the-paperwork.md) | NEX quietly runs the paperwork while the owner runs the workshop | ✅ Active |
| [0002](principles/0002-standard-nex-workflow.md) | The Standard NEX Workflow — the six-step interaction model for every module | ✅ Active |
| [0003](principles/0003-answers-as-judgement-not-verdict.md) | NEX answers as judgement, not as verdict — trade principles never become rigid rules | ✅ Active |
| [0004](principles/0004-safety-first-responses.md) | Safety-first responses — protect people without humiliating users | ✅ Active |
| [0005](principles/0005-transparent-ai-identity.md) | Transparent AI identity — personable without pretending to be human | ✅ Active |

**Reference material** (not principles · demonstrates how the principles compose):

- [Canonical NEX conversation examples](examples/conversation-examples.md) — 14 example conversations showing the five principles in action across trade contexts

## For contributors

Before writing any code that changes what an owner sees or does:

1. Read the relevant principle(s) below.
2. Run your work through the ten quality-gate questions above.
3. If in doubt, ask: *"Would a real operations manager phrase / act / think this way?"*

If a change touches multiple modules, it must satisfy the Constitution in every module it touches.

## For reviewers

Reviewing a PR that changes an owner-facing surface? Verify the ten questions on the PR itself. A code review that only checks types + tests is incomplete.

## Amending the Constitution

The Constitution can grow — new principles land as new markdown files under `principles/` — but existing principles are **immutable once shipped**. If a principle needs to change, we deprecate the old one and write a new one that supersedes it, preserving the history of what we once believed and why.

## Related

- Auto-memory: `feedback_nex_design_principle_tech_disappears.md` (Claude keeps this reflected in memory across sessions)
- Architecture: `docs/DECISIONS/` — read the ADRs for the technical rules
- Companion architecture governance:
  - [ADR-0040 · Prime Sentence + Professional Test](../DECISIONS/0040-prime-sentence-and-professional-test.md) — *"most trusted professional reference"* (capstone)
  - [ADR-0041 · Author-Driven Platform Evolution](../DECISIONS/0041-author-driven-platform-evolution.md) — platform grows only from authoring reality
  - [ADR-0042 · Reference Brain Sole Authoritative Path](../DECISIONS/0042-reference-brain-sole-authoritative-path.md) — one path for Reference Brain content · nothing else authoritative
  - [ADR-0043 · Reality Over Speculation](../DECISIONS/0043-reality-over-speculation.md) — every not-yet-build decision names its specific unlock signal · sharpens ADR-0041 working language
- CLAUDE.md — top-level agent instructions must never contradict the Constitution
