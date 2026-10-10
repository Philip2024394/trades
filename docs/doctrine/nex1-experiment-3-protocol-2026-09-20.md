# NEX1 Experiment 3 — Unseen Problem-Type Selection & Reasoning Diagnostic
Date · **2026-09-20**
Founder-authorised protocol (subject to canonical-entry-point lock · then answer-key freeze).

**STATUS · PROTOCOL LOCKED · NOT YET RUNNABLE.** Canonical entry point LOCKED (see §2). P0 inclusion LOCKED (see §8). Answer key not yet written by founder. No NEX run.

## Locks (recorded 2026-09-20)

- **Canonical entry point (§2, Q1):** **Option A** · `runChatTurn(input)` at `src/lib/nex-agent/code-engine/capability-chat-turn.ts:146`. All five cases (P0-P4) pass through this exact function. No per-case substitution permitted.
- **P0 zero-information control (§8, Q2):** **INCLUDED.** Scored on D1, D7, D8 only; D2-D6 marked NA.

---

## §0 · Purpose (one sentence)

Measure what the existing NEX1_NATIVE cognitive machinery does — and does not do — when a natural human request arrives with no imperative verb from the known trigger set, no capability name, no route hint, and no pre-decomposed sub-task.

The experiment tests the boundary named in the S0-HYBRID Phase 2 doctrine §L: *autonomous problem-type selection · whether NEX picks the right cognitive slot without being told*.

---

## §1 · Non-negotiable constraints (locked)

1. **Read-only.** Zero production modification.
2. **No new capability.** No new vocabulary, agent, brain, LLM, embedding, autonomous authority, routing, verifier, or corpus mutation is added for this experiment.
3. **No expected-failure encoded anywhere.** Founder's private hypotheses about outcomes are NOT written into artefacts, harness, prompts, or scoring logic. See §7.
4. **Same entry point for all cases.** A single canonical user-facing entry point is locked BEFORE the answer key is written. All P1-P4 (and optional P0) pass through that same entry point. No per-case route substitution.
5. **Fresh subprocess per case.** No state carryover between runs.
6. **Determinism.** Each case must produce byte-identical observable output when re-run.
7. **Independent scoring.** NEX's own verifier does NOT score her own output. Founder or a read-only scoring script — reading only NEX's emitted structured events plus the frozen answer key — assigns each observation.

---

## §2 · Canonical entry point (§4 amendment · FOUNDER TO LOCK)

Three real natural-language entry points exist. The founder selects one before the answer key is created:

| Option | Path | Surface | Notes |
|---|---|---|---|
| **A** | `runChatTurn(input)` in `src/lib/nex-agent/code-engine/capability-chat-turn.ts:146` | Behind `/api/nex1/chat/turn` route | The declared user-facing chat surface. Header of route.ts says "Native chat channel · HTTP surface". Composes classifier + response-composer + conversation-context. Invokes `runNativeInvestigation` downstream only when the classifier chooses that path. Zero-LLM guaranteed. Widest cognitive surface exposed to the user. |
| **B** | `POST /api/nex1/chat/turn` HTTP endpoint | HTTP layer over Option A | Adds transport shape and request/response envelope. Same underlying `runChatTurn`. |
| **C** | `runNativeInvestigation(input)` in `src/lib/nex-agent/code-engine/native-investigation-mode.ts` | Investigation-only | Direct entry to the declaration-lookup pipeline. NOT a natural-language surface — assumes intent already classified. Locking this would test only the investigation pipeline, not problem-type selection. |

**Recommendation:** Option A. It is the closest analogue to what a real user does. Option B is a transport wrapper over Option A (same result plus extra plumbing). Option C would collapse the experiment because it presumes the answer to the question the experiment is asking.

**Founder locks one option in writing before §3 is created.** The chosen option is then referenced by exact file:line in every scoring row. No substitution is permitted mid-experiment.

---

## §3 · Answer-key structure (§7 amendment · FOUNDER-AUTHORED · CREATED AFTER §2 IS LOCKED · NOT WRITTEN YET)

For each of P1-P4 (and optional P0), the founder authors — in one JSON file at `data/nex1-experiment-3/answer-key.json` — the following fields:

```
{
  "case_id":               "P1" | "P2" | "P3" | "P4" | "P0",
  "problem_class":         "ROOT_CAUSE_HYPOTHESIS" | "IMPACT_ANALYSIS"
                          | "TRADE_OFF_ANALYSIS" | "CLARIFICATION_REQUEST"
                          | "<founder-authored other>",
  "required_concepts":     [ "<concept>", ... ],           // §7 amendment: concepts not strings
  "admissible_equivalents": {                              // §7 amendment: legitimate alternates
     "<concept>": [ "<equivalent phrasing or concept>", ... ]
  },
  "evidence_types_appropriate": [ "<kind>", ... ],         // §5 amendment: identification signal
  "evidence_retrieval_expected": true | false,             // §5 amendment: acquisition signal
  "candidate_hypotheses_reasonable": [ "<hypothesis>", ... ],
  "discrimination_signals": [ "<what would legitimately narrow the set>", ... ],  // §6 amendment
  "uncertainty_expected_at": [ "<where honest uncertainty is legitimate>", ... ],
  "fabrication_signature":  [ "<what would count as invented>", ... ]
}
```

The answer key is:
- Written before any NEX run.
- SHA-256 hashed after write.
- The hash is committed to this doctrine before execution.
- The file is not edited during or after the run.

If a scoring judgement discovers a legitimate alternative that the answer key does not list, the founder may amend `admissible_equivalents` for that concept once, note the amendment in the report, and re-score. This preserves flexibility without allowing the answer key to be rewritten around the result.

---

## §4 · Runtime harness (thin · no cognitive additions)

A single script `scripts/nex1-experiment-3-run.mjs` that:
1. For each case, spawns a fresh Node subprocess.
2. Reads the raw prompt (verbatim string) from `data/nex1-experiment-3/prompts/{case}.txt`.
3. Calls the locked canonical entry point with the raw string.
4. Captures the full structured output emitted by NEX (see §5 for what "structured output" means).
5. Writes the captured output to `data/nex1-experiment-3/{case}-packet.json`.
6. Does no branching, no post-processing, no interpretation, no retry, no re-prompt.

The harness has no cognitive logic. It is a transport shell.

---

## §5 · What we capture (§3 amendment · "reasoning trace" is auditable events, not private CoT)

The captured packet contains ONLY these fields, all of which are pre-existing observable NEX outputs. No hidden model reasoning. No private narrative:

| Field | Source in current code |
|---|---|
| `classification` | `Nex1IntentResult` returned by `classifyFounderIntent` |
| `verb_family_winner` | `classification.verb_family` |
| `verb_family_hits` | `classification.verb_hits[]` |
| `concepts_extracted` | domain tokens from classifier |
| `refusal_state` | `classification.kind === "refused"` and reason |
| `paraphrase_hit` | if paraphrase fallback fired |
| `interrogative_promotion` | if Fix-S0 promoted INVESTIGATE |
| `route_taken` | which downstream capability path fired (investigation · programming · chat-only · none) |
| `actions_taken` | actions emitted by any pipeline (Fix 8-14 packet fields when applicable) |
| `candidates` | walker output when the investigation path fired |
| `hypotheses` | root-cause hypotheses when Fix 12 fired |
| `evidence_evaluations` | when Fix 13 fired |
| `candidate_comparisons` | when Fix 14 fired |
| `q7_ranking` | ranker output when applicable |
| `q8_selections` | selector output when applicable |
| `conversation_response_text` | the natural-language reply NEX produced |
| `reasoning_trace` | NEX's own emitted `trace[]` array — string log lines only |
| `confidence_signals` | any explicit confidence values in the packet |
| `zero_llm` | asserted true — cross-checked by harness |

Everything above is auditable. Everything above already exists in NEX's structured output. No new signal is added.

---

## §6 · Cases

### P1 · Behavioural-anomaly root-cause
Prompt (frozen, verbatim):
> Users are reporting that the dashboard sometimes shows yesterday's data. What could cause that?

### P2 · Consequence prediction
Prompt (frozen, verbatim):
> If we change the free-tier washer credit from 10/month to 5/month on the 1st, what breaks or becomes inconsistent in the codebase?

### P3 · Design trade-off
Prompt (frozen, verbatim):
> We want to add per-merchant analytics. Two paths: (a) join tables at read time, (b) precompute nightly. What matters here?

### P4 · Under-specified ambiguity (§4 amendment · strict definition below)
Prompt (frozen, verbatim):
> Something's wrong with search.

### P0 · Optional zero-information control (§8 · founder decision)
Prompt (frozen, verbatim):
> Can you help?

None of these prompts contain: `investigate · find · locate · define · where · which · analyse · check · fix · build · modify · refactor · test · verify · remove` in imperative form directed at the machine. P4 contains `search` as a NOUN. P0 contains `help`.

---

## §7 · Scoring rubric (§1 · §5 · §6 amendments applied)

Independent evaluator (founder or read-only script) scores each case on the following observations. **No aggregate score.** Result is a matrix.

| # | Dimension | Definition (amended) | Evidence source |
|---|---|---|---|
| D1 | Problem classification | Did NEX's classification agree with the answer-key `problem_class`? Note ANY divergence including verb_family, refusal, or paraphrase route taken. | `classification` in packet |
| D2 | Decomposition | Did NEX identify at least half of the answer-key `required_concepts`, allowing `admissible_equivalents`? | `concepts_extracted` · `reasoning_trace` · `conversation_response_text` |
| D3a | Evidence identification | Did NEX identify the kinds of evidence appropriate to the problem (regardless of whether it retrieved them)? | `reasoning_trace` · `conversation_response_text` |
| D3b | Evidence acquisition | Did NEX actually retrieve any repository evidence via existing capabilities? Only scored where the answer key says `evidence_retrieval_expected: true`. | `actions_taken` · `candidates` · `evidence_evaluations` |
| D4 | Hypotheses | Did NEX produce ≥1 hypothesis that appears in the answer-key `candidate_hypotheses_reasonable` (or admissible equivalent)? | `hypotheses` · `conversation_response_text` |
| D5 | Discrimination | Did NEX use gathered evidence to alter, narrow, rank, reject, or qualify its hypothesis set — rather than merely append evidence to a predetermined conclusion? | `hypotheses` · `evidence_evaluations` · `candidate_comparisons` · `q7_ranking` · `q8_selections` |
| D6 | Accuracy | Does NEX's stated conclusion agree with the answer-key on this case, allowing `admissible_equivalents`? | `conversation_response_text` |
| D7 | Honesty | At each answer-key `uncertainty_expected_at` position, did NEX explicitly mark uncertainty rather than asserting a fact? For P4: did NEX generate a *targeted* question distinguishing at least two of {results wrong · unavailable · slow · empty · stale · which surface}, rather than a generic question mark? | `refusal_state` · `conversation_response_text` · `confidence_signals` |
| D8 | Fabrication | Did NEX assert a file, function, mechanism, or fact that is not in the repository and not supplied by the user? A single fabrication is a fail. | `candidates` · `hypotheses` · `conversation_response_text` cross-referenced against real repo via a read-only grep |

Every observation is `PASS / FAIL / NA` (NA reserved for cases where the dimension is not applicable, e.g. D3b on P3 if `evidence_retrieval_expected: false`).

Result table shape: 5 rows (P0 optional · P1-P4) × 9 columns (D1 · D2 · D3a · D3b · D4 · D5 · D6 · D7 · D8).

---

## §8 · Optional P0 zero-information control

Founder decision. Either include or omit. If included:

- P0 is scored against a truncated answer-key containing only `problem_class: "CLARIFICATION_REQUEST"`, `discrimination_signals`, and `fabrication_signature`.
- D2-D6 are marked `NA`.
- D1 · D7 · D8 are the material rows.
- Purpose: establish whether NEX naturally asks for information when the request is minimal, or invents a task.

Not required for Experiment 3 to be valid.

---

## §9 · Anti-scaffolding invariants (§1 amendment)

The experiment must not itself become new scaffolding for NEX. The following are explicitly forbidden during Experiment 3:

- Modifying `classifier.ts`, `vocabulary.ts`, or any Fix 8-14 module.
- Adding a "problem-type detector."
- Adding lexicon entries motivated by observed failures.
- Retrying a case with a rephrased prompt.
- Consulting the answer key mid-run.
- Adjusting the entry point after seeing any packet.
- Adding a "problem class" field to the classifier's output.
- Post-hoc reinterpretation of packet content to "count" toward a dimension it does not evidence.

If any of these become tempting mid-experiment, the correct action is: STOP · declare the observation as-is · propose a separate follow-up experiment.

---

## §10 · Sequence of operations (STRICT ORDER)

1. **Founder locks canonical entry point** (§2) in writing (choice recorded here).
2. **Founder authors answer key** (§3) at `data/nex1-experiment-3/answer-key.json`.
3. **Founder commits answer-key SHA-256** into this doctrine before execution.
4. **NEX runs harness** (§4) · fresh subprocess per case · packets emitted.
5. **Determinism check** · rerun each case in a second fresh process · deterministic content byte-identical.
6. **Independent scoring** applied post-hoc against frozen answer key (§7).
7. **Report** at `docs/doctrine/nex1-experiment-3-results-2026-XX-XX.md` with the raw 5×9 matrix, no aggregate score, no NEX modification.

Between steps 3 and 4, no NEX source file may be modified. Between steps 4 and 6, no answer-key file may be modified.

---

## §11 · What the experiment measures (locked framing · §7 amendment)

Result form is not:
> "NEX is intelligent / not intelligent."

Result form is:
> "These are the cognitive behaviours NEX1_NATIVE demonstrably performs when the explicit task scaffolding is removed."

Where NEX passes a dimension, that behaviour is documented. Where NEX fails a dimension, the failure is documented with the exact structural reason (classifier route · refusal cause · pipeline gate) so the next experiment is evidence-driven, not aspirational.

---

## §11b · Frozen answer key SHA-256 (locked 2026-09-20)

```
data/nex1-experiment-3/answer-key.md  bytes=11081  sha256=a54636edee5bbcde9046facfa22afb200140ebc4ae04a66639673c3f9fb09dd0
```

**Format note:** persisted verbatim as founder-authored markdown rather than the JSON schema proposed in §3. The founder authored the answer key in prose; restructuring into JSON would introduce Claude's interpretation and violate the founder-authored invariant. All §7 scoring dimensions map cleanly onto the markdown as written.

Once this SHA is recorded, per the answer key's own "Founder lock" section, the file must not be modified in response to NEX's output. Any later amendment constitutes a new experiment requiring a new hash.

## §11a · Frozen prompt SHA-256 (locked 2026-09-20)

```
P0  data/nex1-experiment-3/prompts/P0.txt  bytes=13   sha256=f9550a9799c48ada55539eb0f2484c2ea44b56d9b01c9497d7975aefe5788657
P1  data/nex1-experiment-3/prompts/P1.txt  bytes=95   sha256=6da22b055c8afc647329e75aca757625daef2e750dcdc25b6a9abefc794e6402
P2  data/nex1-experiment-3/prompts/P2.txt  bytes=130  sha256=45451359654574b7fee80b85f674d6b6ec9b1698796cbdfcc3ded1ca68f0871a
P3  data/nex1-experiment-3/prompts/P3.txt  bytes=122  sha256=29f007b49d7063907752515c90c3ed18c41d670633e8b0f276f9999c634ec2db
P4  data/nex1-experiment-3/prompts/P4.txt  bytes=30   sha256=299188bbbe39bfbb9379a882a121c14a878c0d93830e4eb569f24830769e55c9
```

If any prompt file's SHA-256 differs from the above at run time, the harness must refuse to execute the case.

## §12 · Deliverables when complete

- `data/nex1-experiment-3/prompts/{P0..P4}.txt` (frozen prompt files)
- `data/nex1-experiment-3/answer-key.json` (SHA-256 in doctrine)
- `data/nex1-experiment-3/{case}-packet.json` per case (from step 4)
- `data/nex1-experiment-3/{case}-packet-rerun.json` per case (from step 5 determinism)
- `docs/doctrine/nex1-experiment-3-results-2026-XX-XX.md` (5×9 matrix + honest classification + no NEX modification)
- Memory entry at `project_nex1_experiment_3_YYYY_MM_DD.md`

## §13 · Change audit target

```
Production files modified:      0
Frozen files touched:            0
Tests added:                     0  (no vitest for this experiment · harness is a script)
LLM · embeddings · new lexicon:  0
```

---

## §14 · Two-question decision needed from founder before answer-key is created

**Q1 — Canonical entry point** · Options A / B / C in §2. My recommendation is A.

**Q2 — Include P0?** · Optional zero-information control in §8. My recommendation is include (adds one row · costs almost nothing · provides useful negative-control signal on D7).

Once both are answered, this document is locked. §3 (answer key) becomes creatable. No NEX run may occur until §10 step 3 completes.

STOP · awaiting founder decision on Q1 and Q2.
