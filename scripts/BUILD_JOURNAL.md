# NEX Runtime · Build Journal

Engineering history only. One row per completed cycle. No architecture. No governance.

| Cycle | Strategy           | Rows Added | Total Coverage | Evidence Used | Regressions | Status   |
|-------|--------------------|------------|----------------|---------------|-------------|----------|
| 001   | Gallery            | +3         | 7.3%           | Images        | 0           | Complete |
| 002   | Definition         | +9         | 29.3%          | Knowledge     | 0           | Complete |
| 003   | Customer FAQ       | +5         | 41.5%          | FAQ           | 0           | Complete |
| 004   | Session Router     | n/a *      | n/a *          | n/a *         | 0           | Complete |
| 005   | Runtime Wiring     | n/a **     | n/a **         | n/a **        | 0           | Complete |
| 006   | Vocabulary Adapter | n/a ***    | n/a ***        | n/a ***       | 0           | Complete |
| 007   | Comparison         | +4         | 51.2%          | Knowledge     | 0           | Complete |

*Cycle 004 built the Session Router (pre-Router mode-split layer). Coverage metric does not apply — Session Router runs BEFORE the Staircase Router and does not touch the Staircase Validation Suite. Success metric was own acceptance suite (57/57) and regression across all 13 existing scripts (all still pass).

**Cycle 005 wired every frozen component into a single callable pipeline. Success metric was end-to-end proof: one real customer message ("Show me oak staircases") flows through Session Router → Staircase Router → Retrieval Engine → 5 Providers → Composer → Response Plan; one real engineering message ("Start Cycle 006") is correctly diverted at the Session Router and never reaches the Staircase Router. Own acceptance suite: 37/37. Full 15-script regression: all pass. Minimal additive fix to Router v1: exposed `routeMessage` export + main-guard so imports do not run test suite (Router v1 still passes 46/46 unchanged). Discovered defect for a future cycle: Router v1 uses vocabulary ('Browse'/'Gallery') that Image Provider (and possibly other providers) don't recognize — providers currently skip valid gallery requests. Not fixed in Cycle 005 · logged for a future Vocabulary Alignment cycle.

***Cycle 006 fixed the Cycle-005-discovered vocabulary defect. New Runtime Vocabulary Adapter (`scripts/nex-vocabulary-adapter-v1.mjs`) sits between the Router adapter and the Retrieval Engine in the runtime pipeline. Evidence-driven mapping set: `intent: Browse→Show, See→Show` · `information_type: Gallery→Images`. Own acceptance suite: 34/34. Full 16-script regression: all pass. Zero modifications to Router · Suite · Providers · Composer · Strategies · Registry · Session Router. Runtime v1 change: 1 new import + 1 new line (`adaptVocabulary(routerDecisionFlat)`). End-to-end proof: "Show me oak staircases" now returns plan.status='ok', plan.answer_type='gallery', 77 image citations (was 0 in Cycle 005). Diagnostic block on every plan's router_decision records what the adapter translated (engineer-facing · not customer prose).

---

## Milestone: Runtime Core v1 Complete
**Date:** 2026-08-01

Runtime Core v1 established after Cycles 001–006.

Includes:
- Session Router
- Router v1
- Runtime Vocabulary Adapter
- Retrieval Engine
- Providers
- Strategy Registry
- Composer
- Response Plan pipeline

**Status:** Core complete. Future work extends capability (strategies, evidence, Quality Gate, Renderer) rather than altering the core architecture unless new runtime evidence justifies it.
