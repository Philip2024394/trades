---
title: NEX Router v1 · Frozen Baseline Declaration
version: v1 (Build 0.09)
status: FROZEN · runtime-integration candidate · Router change requires new failing evidence
frozen_date: 2026-07-31
frozen_by: Philip O'Farrell direction · gatekeeper Claude execution
build_reference: scripts/nex-router-build-009.mjs
report_reference: nex-router-build-009-report-2026-07-31.md
---

# NEX Router v1 · Frozen Baseline

**Build 0.09 is Router v1 · frozen against Validation Suite v1.**

The precise engineering statement: Router v1 satisfies every question in Suite v1. Router v1 is not "finished forever" — it is stable until Suite v1 gains new failing rows from real evidence. When the Suite grows, Router v2 becomes justified; until it grows, Router changes are speculation.

All Router changes from this point require new failing evidence — not speculation, not architectural exploration, not intuition about what might be better.

## Baseline metrics (against current Validation Suite v1)

| Metric | Value |
|---|---|
| Pass rate | **100.0%** (46 of 46 rows) |
| Intent accuracy | 100.0% |
| Subject accuracy | 100.0% |
| Brain accuracy | 100.0% |
| Domain accuracy | 100.0% |
| Info Type accuracy | 100.0% |
| Clarify accuracy | 100.0% |

## Trajectory

| Build | Pass rate | Delta |
|---|---|---|
| 0.01 | 45.5% | — |
| 0.02 | 57.1% | +11.6 |
| 0.07 | 71.7% | +14.6 |
| 0.08 | 91.3% | +19.6 (zero regressions) |
| 0.09 (frozen) | **100.0%** | +8.7 (zero regressions) |

## Change-admission rule (locked)

A Router change is admitted only when ALL of these are true:

1. **A failing question exists** in the Validation Suite that Build 0.09 does not classify correctly
2. **The failing question comes from real evidence** (user conversation, authored CKO, expert review) — not from imagining what a user might ask
3. **The proposed change is measured against the full Suite** before merge (regression test)
4. **The proposed change does not reduce generalisation** to pass one specific row — if it would, park the row instead

Changes that fail any of these four conditions return to authoring or are declined.

## What triggers a new Router build

The Router should NOT be tweaked based on:

- Speculation about future user questions
- New Constitution principles or governance
- Personal preference for how a classification "should" work
- Improvements to architecture, standards, or documentation

The Router SHOULD be tweaked when:

- The Suite gains a new row from real user conversation that Build 0.09 fails
- The Suite gains a new row from newly-authored evidence that Build 0.09 fails
- An existing Suite row's expected value changes because a Constitution amendment redefines a dimension

## What comes next

Not Router 0.10. **Runtime integration.**

The Router's job is now to be a dependable classification service that the runtime can call. Runtime work:

1. **Retrieval layer** — given Router output (Intent · Subject · Brain · Domain · Info Type · Confidence), retrieve ONLY evidence matching that classification
2. **Composition layer** — assemble a response from retrieved evidence · never invent knowledge · refuse when confidence low
3. **Quality Gate** — five pre-speech questions run before emission
4. **Failure capture** — record any conversation that produces a poor response · feed to Suite for next Router build

**When runtime is live and real users are producing new failing questions · that's when Build 0.10 begins.** Not before.

## Suite v1 status

**The Validation Suite v1 is now the contract** between the frozen Router and any future runtime. Every retrieval algorithm · every composition strategy · every future LLM must pass the Suite. The Suite doesn't change to accommodate implementations — implementations change to satisfy the Suite.

## Freeze verification

To verify this freeze is intact at any point:

```
node scripts/nex-router-build-009.mjs
```

Expected output: `Passed 46 · Failed 0 · Overall 100.0%`. Any deviation is a regression that requires investigation before further work.
