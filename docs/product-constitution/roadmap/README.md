# NEX Product Roadmap · Future Modules

Design briefs for modules that will be built **after Materials v1 freezes** and **after Hardwood Calculator ships**. Not the backlog — briefs sit here because they've been thought through end-to-end but deliberately not scheduled yet.

Every brief here must pass the **twelve quality-gate questions** in `docs/product-constitution/README.md` before it becomes a shipping module. The briefs preserve intent; the questions determine when they're ready.

## Order of arrival (subject to change)

Materials v1 freezes first. Then:

1. **Hardwood Calculator** — the immediate next module. Not in roadmap because it has its own design brief already agreed with Philip.
2. **NEX Stock Intelligence** — smart stock monitoring, low-stock alerts, reorder recommendations *(with owner approval always)*. Brief: [`nex-stock-intelligence.md`](nex-stock-intelligence.md).
3. **NEX Vision Stock Count** — camera-based physical stock counting. Brief: [`nex-vision-stock-count.md`](nex-vision-stock-count.md).
4. **NEX Buying Intelligence** — package-based supplier comparison (compare the whole staircase package cost, not individual parts). Brief: [`nex-buying-intelligence.md`](nex-buying-intelligence.md).
5. **NEX Specification Intelligence** — comparison engine that reveals *why* two staircase quotes differ (tread thickness, string thickness, newel size), so customers and manufacturers stop comparing unfairly on price alone. Brief: [`nex-specification-intelligence.md`](nex-specification-intelligence.md).
6. **NEX Installation Readiness Check** — pre-installation customer coordination · turns the experienced installer's mental site-preparation checklist into a repeatable customer process. Brief: [`nex-installation-readiness-check.md`](nex-installation-readiness-check.md).
7. **NEX Staircase Estimation Intelligence** — estimating like an experienced staircase manufacturer (six-stage survey + calculation + risk-factor output). Both customer-facing (free preliminary estimate → qualified lead) and internal (full workshop estimator). Brief: [`nex-staircase-estimation.md`](nex-staircase-estimation.md).
8. **NEX Payment & Account Intelligence** — payment plan suggestions per quote · account health monitor · payment protection assistant at pre-manufacture and pre-installation · courteous overdue-reminder progression · dispute-packet assembly. Never a payments platform — observes, surfaces, recommends. Brief: [`nex-payment-and-account-intelligence.md`](nex-payment-and-account-intelligence.md).
9. **NEX Staircase Design Configurator** — customer-facing visualisation + design composition · customer uploads hallway photos + measurements → NEX composes 3 design options set in their actual hallway with reasoning drawn from the Staircase Reference Brain → workshop receives a briefed customer with an agreed design direction, ready for professional site survey. Brief: [`nex-staircase-design-configurator.md`](nex-staircase-design-configurator.md).
10. **Message Centre re-engagement + Best Time to Buy + Material Watch** — Buying Intelligence sub-capabilities (all captured inside the Buying Intelligence brief rather than standalone modules).

## What lives here vs elsewhere

- **This directory** — future feature briefs, in the shape of a working spec (workflow · UX · quality-gate stance · architecture note).
- **`docs/DECISIONS/`** — architecture that has been *decided and shipped* (ADRs). Roadmap items become ADRs when the architecture crystallises.
- **`docs/product-constitution/principles/`** — permanent product principles that every module must satisfy.
- **`data/nex-reference-brains/staircase-preparation/`** — expert-authored trade evidence that will one day enter the Staircase Reference Brain.

## Rules for adding to the roadmap

1. Every brief starts with a real owner scenario, not a technical capability.
2. Every brief runs its own draft through the twelve quality-gate questions.
3. No brief prescribes a schema, an API, or a UI component library — those are decided when the brief becomes a build.
4. If a brief starts assuming AI can do something magical, cut it back to what an experienced workshop manager could actually verify.

## Cross-references

- `docs/product-constitution/README.md` — the twelve quality-gate questions
- `docs/product-constitution/principles/0001-nex-quietly-runs-the-paperwork.md` — the operations-manager principle
- `docs/product-constitution/principles/0002-standard-nex-workflow.md` — the six-step workflow every module inherits
