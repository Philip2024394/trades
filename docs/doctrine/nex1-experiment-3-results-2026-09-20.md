# NEX1 Experiment 3 — Unseen Problem-Type Selection & Reasoning Diagnostic · Results
Date · **2026-09-20**
Status · **CLOSED as diagnostic · results preserved unchanged**

Follows the frozen protocol at `docs/doctrine/nex1-experiment-3-protocol-2026-09-20.md` (canonical entry point locked · P0 inclusion locked · prompt SHA-256s locked · answer-key SHA-256 `a54636edee5bbcde9046facfa22afb200140ebc4ae04a66639673c3f9fb09dd0` locked).

No NEX source modified. No frozen artefact modified. Independent post-hoc scoring only.

---

## A · Truth classification

`EXPERIMENT COMPLETE · CLOSED AS DIAGNOSTIC.`

The experiment did what a good diagnostic should do: it exposed the next architectural boundary without pretending the missing capability already exists.

---

## B · Boundary marker (permanent · founder-authored)

> **Experiment 3 established that NEX1_NATIVE's existing cognitive machinery is route-capable but not yet problem-type-selective. Existing lexical classification can reliably activate established cognitive routes, but unseen problem types are not semantically classified from situation/context before routing. Domain-token extraction alone does not constitute problem decomposition or semantic understanding.**

This statement prevents future reports from accidentally claiming *"NEX understands the user's problem"* when the evidence currently supports something narrower: *NEX can execute certain cognitive strategies once the appropriate route has been activated.*

---

## C · Evidence ladder (current NEX1 architecture · post-Experiment-3)

```
                 NEX1_NATIVE

          ┌─────────────────────┐
          │ Problem Understanding│  ← NOT PROVEN
          │ "What kind of       │
          │  problem is this?"  │
          └──────────┬──────────┘
                     ↓
          ┌─────────────────────┐
          │ Route Selection     │  ← lexical / limited
          └──────────┬──────────┘
                     ↓
          ┌─────────────────────┐
          │ Cognitive Machinery │  ← increasingly proven
          │                     │
          │ investigate         │
          │ evidence            │
          │ hypothesis          │
          │ verification        │
          │ learning            │
          │ retrieval           │
          │ reapplication       │
          └─────────────────────┘
```

---

## D · Execution status (all 10 subprocesses ran cleanly)

| Case | Run 1 elapsed | Run 2 elapsed | Packet bytes | Status |
|---|---|---|---|---|
| P0 · "Can you help?" | 112ms | 82ms | 2990/2989 | OK |
| P1 · dashboard yesterday's data | 69ms | 133ms | 6151/6152 | OK |
| P2 · washer credit 10→5 | 7340ms | 6708ms | 6430/6430 | OK |
| P3 · analytics join vs precompute | 117ms | 95ms | 6100/6099 | OK |
| P4 · "Something's wrong with search." | 110ms | 99ms | 3007/3006 | OK |

15 frozen NEX cognitive files SHA-256 verified UNCHANGED pre-run and post-run.

Determinism verified byte-identical after environmental-field redaction · redacted-content SHA-256 identical across both runs for every case:
- P0 · `b3c93d88428d5ae1…`
- P1 · `687702599ce26568…`
- P2 · `b5bb43ab257fa223…`
- P3 · `27bc5ab554ce2799…`
- P4 · `ff6654a4937e08b5…`

---

## E · Route selection observed

| Case | Verb family | Trigger | Downstream state |
|---|---|---|---|
| P0 | (refused) | `refused_no_verb_recognised` — no controlled-vocab verb | `refused` |
| P1 | INVESTIGATE | interrogative_fallback on `"what"` (Fix S0) | `clarification_required` |
| P2 | MODIFY | lexeme `"change"` | `clarification_required` |
| P3 | BUILD | lexeme `"add"` | `clarification_required` |
| P4 | (refused) | `refused_no_verb_recognised` — no controlled-vocab verb | `refused` |

Route selection was fully explained by the first-appearance controlled-vocabulary match. No case involved semantic recognition of the underlying problem type.

---

## F · Independent scoring matrix (5 × 9)

| Case | D1 | D2 | D3a | D3b | D4 | D5 | D6 | D7 | D8 |
|---|---|---|---|---|---|---|---|---|---|
| P0 | PARTIAL | NA | NA | NA | NA | NA | NA | **PASS** | **PASS** |
| P1 | FAIL | FAIL | FAIL | FAIL | FAIL | FAIL | FAIL | **PASS** | **PASS** |
| P2 | FAIL | FAIL | FAIL | FAIL | FAIL | FAIL | FAIL | **PASS** | **PASS** |
| P3 | FAIL | FAIL | FAIL | NA | FAIL | FAIL | FAIL | **PASS** | **PASS** |
| P4 | PARTIAL | NA | NA | NA | NA | NA | NA | PARTIAL | **PASS** |

Per rubric §11 · no aggregate intelligence score computed · no case ranked against another · no AGI/general-intelligence claim.

Full evidence and per-cell citations in prior scoring report (this session · sections C-G-H).

---

## G · Cross-case observations (strictly descriptive)

- Route selection follows the eight-family lexicon exactly as the source audit predicted.
- Only P2 engaged target-discovery (scanned 7308 files, 1 token extracted, 0 matches). Every other case refused before or inside target discovery.
- No case produced any hypothesis, candidate target, thread finding, or decision. Every `candidate_targets` array is empty across all 5 packets.
- Response text is a fixed template for P1/P2/P3 (140 chars identical). P0/P4 use the refusal template (143 chars identical).
- **Fabrication uniformly absent: D8 PASS 5/5.**
- Concept extraction is present but does not become decomposition. Domain tokens are recorded but not consumed by any downstream reasoning process on the observed problem types.
- Zero-LLM invariant held (`zero_llm: true` in every packet).

---

## H · What the experiment proved

1. Route selection is deterministic and predictable from the controlled-vocabulary lexicon.
2. Existing cognitive machinery (Fix 8-14, Q7/Q8, walker, bridge, classifier) is not invoked when the classifier does not route to it.
3. NEX does not fabricate under scaffolding removal. Zero fabrications observed across five cases.
4. NEX preserves uncertainty when routing/deliverable classification fails (D7 PASS on 4/5 cases · PARTIAL on P4).
5. The mechanism does not distinguish "root cause" from "impact analysis" from "trade-off" from "clarification" from "implementation" when the surface verbs alone determine routing.

## I · What the experiment did NOT prove

1. That the missing problem-type-selection capability is genuinely absent versus merely disconnected. Experiment 4 (§K below) is designed to test this.
2. Any behaviour under multi-turn conversation. Every case was a single turn against a fresh conversation.
3. Any behaviour on tasks matching the eight-family lexicon in a way that would engage the downstream cognitive machinery. Prior experiments cover that; this one did not.
4. Any behaviour on external repositories. All tasks were phrased against the local repo.

---

## J · Founder-authored answer key preserved

`data/nex1-experiment-3/answer-key.md` unchanged after run. SHA-256 unchanged: `a54636edee5bbcde9046facfa22afb200140ebc4ae04a66639673c3f9fb09dd0`. The frozen-lock invariant holds.

---

## K · Next diagnostic (Experiment 4 · authorised path forward)

The founder has proposed a read-only **Experiment 4 — Problem-Type Selection Diagnostic** to test whether existing NEX representations can distinguish problem types *before* we introduce a new problem-type mechanism. Draft protocol at `docs/doctrine/nex1-experiment-4-protocol-2026-09-20.md` (this session). Not yet locked. No NEX modification.

---

## L · Change audit

```
Production files modified:               0
Frozen files touched:                    0  (15 files SHA-256 unchanged)
Answer key touched:                      0
Prompts touched:                         0
Rubric touched:                          0
LLM · embeddings · new lexicon:          0
Test additions:                          0
Harness scripts (additive):              2  (nex1-experiment-3-run.mjs · nex1-experiment-3-recompare.mjs)
Doctrine additions:                      2  (this file · Experiment 4 protocol draft)
Data artefacts:                          10 packets · 1 answer key · 5 prompt files · 2 harness reports
```

---

## M · Status

`CLOSED AS DIAGNOSTIC · results preserved unchanged · boundary marker installed · Experiment 4 draft available for founder review.`

STOP.
