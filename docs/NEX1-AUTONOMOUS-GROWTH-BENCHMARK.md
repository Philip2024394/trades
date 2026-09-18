# NEX1 · Autonomous Growth Benchmark

**Purpose.** Append-only experiment log for the founder-authored autonomous-growth protocol. Any change to this document must add a new dated section; existing sections must not be edited after they land.

**Baseline reference:** `docs/NEX1-GROWTH-BASELINE-0.md` (frozen at git commit `32b91f1d`).

**Rules the engineer holds throughout:**
1. Do NOT modify the core operator library to make any test pass.
2. Do NOT tell NEX1 what to discover.
3. If a test fails, record `FAILURE` before changing anything.
4. Classify every state change into LEDGER A (NEX1 growth) or LEDGER B (human engineering). Never blur the two.
5. `LLM RUNTIME = NO` throughout the primary experiment.

---

## Experiment index (will be populated as test groups run)

| # | Test group | Verdict | Growth level | Ledger | Receipt |
|---|---|---|---|---|---|
| _pending_ | _pending_ | _pending_ | _pending_ | _pending_ | _pending_ |

---

## Ledger A · NEX1 GROWTH (verified only)

*Empty at this milestone. Populated only when a candidate growth event survives the 12-check falsification protocol.*

---

## Ledger B · HUMAN ENGINEERING

*Empty at this milestone. Populated whenever the engineer adds any mechanism, operator, module, or file during the experiment.*

Rule: any addition NEX1's engineering assistant makes during this benchmark automatically lands in Ledger B, never Ledger A.

---

## Rejected growth (false-positive candidates that failed falsification)

*Empty at this milestone.*

---

## Remaining limitations

Baseline §B is the current list. Any limitation not listed there is undetected, not absent.

---

*Living document. Latest activity: baseline recorded 2026-09-18.*

---

## Cycle 3 · Test-group execution log (2026-09-18)

**Rules held throughout:** engineer wrote no new operator, no new capability module, and no new NEX1 source file during this run. Every experiment used mechanisms present at Baseline 0.

### Groups 1-5 · pattern, reasoning, generalisation, memory, failure

Receipt: `data/nex1-growth-benchmark/groups-1-5-receipt.json`

| # | Test group | Verdict | Note |
|---|---|---|---|
| TG1 | Pattern (Fix 34 groups varied inputs) | `EXISTING_MECHANISM_EXERCISED` | Deterministic grouping behaviour, previously verified. |
| TG2 | Reasoning (Fix 30B adversarial priors) | `EXISTING_MECHANISM_EXERCISED` | Distinguished matching vs conflicting prior correctly. |
| TG3 | Generalisation (Fix 34 relaxed retrieval) | `EXISTING_MECHANISM_EXERCISED` | Within-family relaxation works; refuses cross-root. |
| TG4 | Memory (Fix 35 disk persistence) | `EXISTING_MECHANISM_EXERCISED` | Same rule persisted across a session. |
| **TG5** | **Failure** (does NEX1 treat `REQUIRE_MORE_INVESTIGATION` differently?) | **`LIMITATION_OBSERVED`** | Fix 34 groups failure states by selection_state but treats them symmetrically. Fix 35 produces rules but no invariant encodes "capability gap." **Baseline §B.6 absence confirmed at runtime.** |

### Groups 6-10 · novelty, cross-domain, coding, specialist, open-ended

Receipt: `data/nex1-growth-benchmark/groups-6-10-receipt.json`

| # | Test group | Verdict | Note |
|---|---|---|---|
| TG6 | Novelty (unseen names/paths/values) | `EXISTING_MECHANISM_EXERCISED` | Fix 35 applied rule to novel input value `987654321` correctly. |
| **TG7** | **Cross-domain** (rule trained on `src/lib/*` applied to `scripts/*` and `docs/*`) | **`EXISTING_MECHANISM_EXERCISED` + REFINES BASELINE §B.5** | Fix 35's `predictFromRules` matches on `{has_signature_format, value_type, selection_state}` only — `path_dir_root` is stored on the rule's `shape_signature` but not required for match. **Cross-root prediction was pre-existing capability but had not been runtime-tested before.** This is not growth (the code was already there at Baseline 0) but it does refine what §B.5 said was absent. |
| TG8 | Coding (novel same-family fixture) | `EXISTING_MECHANISM_EXERCISED` | Coding-loop verified end-to-end on fresh fixture. |
| TG9 | Specialist (cortex broadcast · 4 observation kinds) | `EXISTING_MECHANISM_EXERCISED` | Cortex correctly refused `NO_RESPONSE` on unknown-domain. |
| TG10 | Open-ended (heterogeneous seed the engineer did NOT design a pattern for) | `EXISTING_MECHANISM_EXERCISED` | Every group with support ≥ 2 produced a rule (numeric, boolean, string, unresolved). All group formations predictable from seed features. No unpredicted structure emerged. |

### Post-benchmark integrity check

- **All 17 Baseline-0 source SHA-16 hashes unchanged.**
- **Regression:** 28 test files · 2152/2152 tests pass (identical to Baseline 0).
- **Engineer source modifications during benchmark:** **0**.

---

## Ledger A · NEX1 GROWTH (verified only)

**Empty.** No test group produced a candidate growth event that survived (or even required) falsification. Every observation was of a mechanism that already existed at Baseline 0 behaving as previously verified.

---

## Ledger B · HUMAN ENGINEERING (during this benchmark)

- 3 documentation files (`NEX1-CYCLE-2-SIGNIFICANCE.md`, `NEX1-GROWTH-BASELINE-0.md`, this benchmark file) · committed at `b0ff61b7`.
- 2 test-group scripts (`growth-tests-groups-1-5.mjs`, `growth-tests-groups-6-10.mjs`) · in `scripts/nex1-growth-benchmark/`.
- 2 receipt JSONs · in `data/nex1-growth-benchmark/`.

No NEX1 implementation file was modified. No operator was added. No capability module was created. Ledger B contains only documentation, tests, and receipts.

---

## Rejected growth (candidates that failed falsification)

**Empty.** No candidate growth event was recorded in the first place.

---

## Baseline-refinement notes (findings that revise §A/§B without themselves being growth)

1. **§B.5 refinement:** cross-`path_dir_root` prediction in Fix 35 was ALREADY possible at Baseline 0 (the code was there since Fix 35 was written). TG7 documented this runtime observation for the first time. This is not growth; it is a documentation correction. Baseline §B.5 should be understood as *"no test had previously verified cross-domain application"* rather than *"no code path exists for it."*

2. **§B.6 confirmation:** failure-as-learning is genuinely absent at the mechanism level, confirmed at runtime by TG5.

## Remaining limitations (unchanged from Baseline §B)

Every other §B entry remains a real gap:
- B.1 no operator invention at runtime
- B.2 no probe extensibility at runtime
- B.3 no language paraphrase understanding
- B.4 no conversational reference across ≥ 4 turns
- B.6 no failure-as-learning (RUNTIME-CONFIRMED via TG5)
- B.7 no probabilistic / statistical models
- B.8 no autonomous exploration
- B.9 no self-modification of source
- B.11 no HTTP-verified path this session
- B.12 no demonstrated switch-branch / conditional-branch / array-mutation / class-method operator
- B.13 no multi-modal reasoning
- B.14 no cross-shape-family generalisation (as opposed to cross-root)
- B.15 no meta-rules (rules over rules)

---

## Final growth-level classification

Using the founder's rubric:

- **LEVEL 0 · NO GROWTH** — only existing capabilities were exercised.
- Level 1+ would require at least one candidate growth event to survive falsification. None appeared.

**Classification for this benchmark: `LEVEL 0 · NO GROWTH`.**

---

## Answer to §19 · the final question

> *"Compared with the frozen Baseline 0, did NEX1 acquire anything genuinely new through its own experience-driven processes?"*

**Answer (from the founder's own permitted-values list):** `NO VERIFIED GROWTH`

Bounded, honest reading: the ten diverse test groups exercised every learning, reasoning, memory, generalisation, specialist-cooperation, and metacognitive mechanism NEX1 has, without adding a single line to the core implementation. Every observation matched what those mechanisms were previously verified to produce. **Nothing new was created by NEX1's own data-derived processes.** One documented limitation (§B.6, failure-as-learning) was confirmed at runtime, which is a scientifically useful negative result. One documentation refinement (§B.5, cross-root prediction) narrows what "unproven" meant in the baseline without adding capability.

The result is scientifically informative: it confirms that Fix 35 does exactly what Cycle 2 said it does, and that the frontier the founder identified — genuine autonomous growth beyond the mechanisms explicitly present — has not been crossed in this benchmark. The Ledger A / Ledger B separation held throughout: every artefact created during the benchmark is either documentation or a test script, never a NEX1 mechanism.

## What would move NEX1 to Level 1+

Based on TG5's confirmed limit, the smallest scientifically clean next step is a **failure-as-learning** experiment where the engineer's role is limited to (a) providing failure examples and (b) observing whether the existing mechanisms can distinguish them from success. Any addition of a "capability gap" record type or a failure-specific probe by the engineer would land in Ledger B and would not count as autonomous growth.

*End of Cycle 3 Growth Benchmark · 2026-09-18. Living document remains open for future test groups.*
