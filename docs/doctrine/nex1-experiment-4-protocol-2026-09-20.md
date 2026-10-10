# NEX1 Experiment 4 — Problem-Type Selection Diagnostic · Protocol
Date · **2026-09-20**
Status · **PROTOCOL AMENDED · pre-registration frozen · awaiting founder authorisation to run**

Follows and closes the loop from Experiment 3 (`docs/doctrine/nex1-experiment-3-results-2026-09-20.md`). Experiment 3 remains historically immutable.

---

## §0 · Central question (locked)

> **Can existing NEX1_NATIVE representations distinguish underlying problem types when lexical surface form is deliberately controlled?**

Both outcomes are informative. Neither is preferred. No aggregate intelligence score will be produced.

---

## §1 · Non-negotiable constraints (§ founder amendment, locked)

1. **Read-only.** Zero production modification.
2. **No new production cognitive mechanism.** Zero new:
   - problem-type vocabulary
   - semantic classifier
   - embeddings
   - LLM
   - new brain
   - new agent
   - new routing mechanism
   - new autonomous authority
   - new verifier
   - corpus mutation
3. **Same canonical entry point as Experiment 3** — `runChatTurn(input)` at `src/lib/nex-agent/code-engine/capability-chat-turn.ts:146`.
4. **Fresh Node subprocess per case.**
5. **Determinism check** post-run.
6. **Independent evaluation** — NEX's own machinery does not classify itself.
7. **Do not modify Experiment 3 artefacts.** Packets · answer key · scoring matrix · prompts · execution report · determinism report · 15 frozen NEX cognitive files. All remain historically immutable.
8. **Corpus is high-lexical-overlap by construction on family A/C, low-lexical-overlap on family B.** The point is to defeat lexical routing.

---

## §2 · Ambiguity resolutions carried into Experiment 4 (§ founder amendment)

### D1 · Lexical vs semantic classification (STRICT)

- Lexical routing alone does NOT constitute semantic problem-type classification.
- `refused_no_verb_recognised` is not semantic classification.
- Generic "please rephrase" is not sufficient to demonstrate semantic clarification recognition.
- Targeted clarification may count only when the observable output identifies the actual missing information needed to reduce the ambiguity.

Experiment 3 PARTIAL marks remain historically recorded; this stricter rule applies only to Experiment 4.

### D6 · Missing conclusion

When a substantive conclusion is required and NEX produces none, mark FAIL. Use NOT_APPLICABLE only where the frozen Experiment 4 case specification explicitly declares the dimension non-applicable (see §5).

### D3b · Evidence-acquisition descriptive states (three-value · not a score)

| State | Meaning |
|---|---|
| `NO_ATTEMPT` | No evidence acquisition occurred (no target discovery, no repository scan, no fetch). |
| `UNPRODUCTIVE_ATTEMPT` | Retrieval occurred but no relevant evidence was obtained (e.g., scanned N files, zero matched useful tokens). |
| `PRODUCTIVE` | Relevant evidence actually acquired (files inspected · candidates emitted · hypotheses grounded). |

These states are descriptive. They are not converted into a numerical score.

Retrospective note on Experiment 3: P2 is now historically annotated `UNPRODUCTIVE_ATTEMPT` (7308 files scanned, 1 token, 0 matches) while retaining its FAIL D3b mark. Nothing in Experiment 3 is rewritten; the annotation lives here.

### D3b · Applicability (declared before execution, per case)

Evidence expectation is pre-registered per case in the case registry (§4). Never decided after observation.

Default mapping:

| Expected problem type | Evidence expectation |
|---|---|
| ROOT_CAUSE_HYPOTHESIS | expected |
| IMPACT_ANALYSIS | expected |
| INVESTIGATION | expected |
| MODIFICATION | expected |
| IMPLEMENTATION | expected |
| TRADE_OFF_ANALYSIS | conditional — depends on the specific question |
| CLARIFICATION_REQUEST | not expected before clarification |

---

## §3 · Central diagnostic measure · S6 (locked, strict)

**S6 · Within-set semantic separation** — NEX demonstrates semantic separation only when ALL THREE of the following hold:

- **(A)** observable output differs between matched cases;
- **(B)** the difference corresponds to the pre-registered difference in underlying problem type; AND
- **(C)** the difference cannot be explained solely by substitution of a lexical route trigger.

If (A) occurs without (B) or without (C), semantic separation is NOT DEMONSTRATED.

A different lexical route alone does not count.

---

## §4 · Diagnostic families and 12-case corpus (frozen)

Total 12 cases across four diagnostic families. All prompts are frozen bytes; SHA-256 in §11a.

### Family A · Same situation / different problem type (5 cases)

Shared opener: `"Users are seeing yesterday's data."`

| Case | Prompt | Expected problem type | Evidence expectation |
|---|---|---|---|
| A1 | `Users are seeing yesterday's data. What could cause that?` | ROOT_CAUSE_HYPOTHESIS | expected |
| A2 | `Users are seeing yesterday's data. What happens if we change the refresh interval?` | IMPACT_ANALYSIS | expected |
| A3 | `Users are seeing yesterday's data. Should we cache it or recompute it?` | TRADE_OFF_ANALYSIS | conditional |
| A4 | `Users are seeing yesterday's data. Fix it.` | IMPLEMENTATION | expected |
| A5 | `Users are seeing yesterday's data.` | CLARIFICATION_REQUEST | not expected |

### Family B · Same problem type / different wording (2 cases · negative-control convergence)

Different surface vocabulary, same underlying problem type. NEX should converge on the same problem-type / observable strategy if it has semantic separation. If NEX diverges, that is evidence of lexical dependence.

| Case | Prompt | Expected problem type | Pair | Evidence expectation |
|---|---|---|---|---|
| B1 | `The dashboard occasionally displays stale information. What might explain it?` | ROOT_CAUSE_HYPOTHESIS | pairs with A1 | expected |
| B2 | `If we increase the cache TTL, what could go wrong?` | IMPACT_ANALYSIS | pairs with A2 | expected |

### Family C · Different problem type / shared route-trigger vocabulary (3 cases)

Cases share known route-trigger words (`change`, `changed`, `update`) but represent different underlying problem types. Tests whether the semantic situation can override an existing lexical trigger.

| Case | Prompt | Expected problem type | Trigger word | Evidence expectation |
|---|---|---|---|---|
| C1 | `Something changed in the dashboard. What could cause it?` | ROOT_CAUSE_HYPOTHESIS | `changed` (MODIFY family) | expected |
| C2 | `Something changed in the dashboard. What should we change next?` | MODIFICATION | `change` (MODIFY family) | expected |
| C3 | `The payment flow needs an update. Where should it go?` | INVESTIGATION | `update` (MODIFY family) | expected |

### Family D · Existing demonstrated capability bridge (2 cases)

Bridges to previously demonstrated investigation capability. Uses identifier-shaped tokens (`fear-assessment logic`) which the walker CAN engage.

| Case | Prompt | Expected problem type | Evidence expectation |
|---|---|---|---|
| D1 | `Where is the fear-assessment logic and how does it work?` | INVESTIGATION | expected |
| D2 | `Update the fear-assessment logic to also flag CAUTIOUS states.` | MODIFICATION | expected |

Founder may amend any wording or mapping before execution.

---

## §5 · S1-S7 diagnostic measures (locked definitions)

Per case, the following observations are recorded from the packet:

### S1 · Surface lexical overlap

Measured as normalised token overlap within a matched set (Family A · Family C · Family B pair). Reported per set. Not per case.

Concretely: for a set with prompts P1…Pk, compute the intersection of lowercase word-tokens (excluding punctuation) divided by the mean count. Reported as a decimal.

### S2 · Trigger overlap

Which known route-trigger vocabulary words (verb-family variants from `capability-a-founder-intent/vocabulary.ts` · plus interrogative markers) appear in each prompt within a set. Reported as a set-per-case.

### S3 · Route outcome

The actual existing route selected by NEX. Recorded from the packet:
- `classification.kind` (`classified` / `refused`)
- `classification.verb_family` when classified
- `state` (`refused` · `clarification_required` · `investigating` · `coding_loop_ready` · other)
- Downstream trace lines showing which capability fired (target discovery · coding loop · investigation mode · none).

### S4 · Observable cognitive structure

Recorded per case:
- Classification kind + verb family
- Domain tokens extracted
- Ambiguities named
- Threads / findings / decisions / mutations / verifications (all empty in Experiment 3; measured here)
- Candidate targets emitted
- Response text
- Any hypotheses or evaluations in the packet

### S5 · Evidence behaviour

Descriptive · one of the three states from §2 (NO_ATTEMPT / UNPRODUCTIVE_ATTEMPT / PRODUCTIVE). Recorded per case. Compared within-set.

Does NEX seek different evidence appropriate to the different underlying problem type?

### S6 · Within-set semantic separation (strict · §3)

Per set: does NEX demonstrate semantic separation? Marked one of:
- `DEMONSTRATED` (all three of A/B/C hold)
- `NOT_DEMONSTRATED` (any of A/B/C fails)
- `NOT_APPLICABLE` (Family B: within-set here means convergence not separation — see S6b)

**S6b · Within-set convergence (Family B only)** — does NEX converge on the same problem type / observable strategy across different wordings? Marked:
- `CONVERGED` (observable strategy substantially identical)
- `DIVERGED` (observable strategy differs materially)
- `INDETERMINATE` (both cases produced identical empty/refused outputs · convergence trivially satisfied but non-informative)

### S7 · Lexical explanation test

For each observed within-set difference: could the difference be completely explained by a changed route-trigger word?

Marked one of:
- `FULLY_EXPLAINED_BY_LEXICAL` (yes — the observed separation is exactly the change in trigger word · S6 forced to NOT_DEMONSTRATED)
- `PARTIALLY_EXPLAINED_BY_LEXICAL` (lexical trigger changed AND other observable fields also differ semantically)
- `NOT_EXPLAINED_BY_LEXICAL` (lexical triggers identical or match-pattern-inconsistent · observed differences must be from something else)
- `NOT_APPLICABLE` (no observed within-set difference to explain)

---

## §6 · What Experiment 4 will NOT produce

- No aggregate intelligence score.
- No capability percentage.
- No ranking.
- No winner.
- No AGI or general-intelligence claim.
- No pass/fail per case (except in D1/D3a/D3b/D4/D5/D6/D7/D8 rubric-secondary observations).

The primary output is:
- Per-case S1-S7 observations (12 cases × 7 measures).
- Per-set S1 · S6 · S6b · S7 verdicts (4 families).
- Descriptive interpretation.

---

## §7 · Case registry file (frozen · pre-registered)

Machine-readable case registry at `data/nex1-experiment-4/case-registry.md`. Contains:
- Case ID
- Family (A/B/C/D)
- Prompt (verbatim)
- Prompt SHA-256
- Expected problem type
- Evidence expectation (expected / conditional / not_expected)
- Pair reference (Family B only)

Registry is founder-authored structural pre-registration. Founder may amend before locking.

SHA-256 in §11b.

---

## §8 · Runtime harness (thin · additive script)

`scripts/nex1-experiment-4-run.mjs` (not yet written · to be built only after founder authorisation to execute). Structurally identical to Experiment 3 harness:

- Parent orchestrator spawns fresh subprocess per case.
- Child mode loads `runChatTurn` via `npx tsx`, passes exact frozen prompt bytes, captures packet.
- Two runs (main + determinism rerun) = 24 total fresh subprocesses.
- Frozen-file SHA-256 audit pre/post.
- Zero cognitive additions.

Do not build this until founder authorises the run.

---

## §9 · Anti-scaffolding invariants (mirrors Experiment 3 §9)

Forbidden during Experiment 4:
- Modifying `classifier.ts`, `vocabulary.ts`, or any Fix 8-14 module.
- Adding a "problem-type detector."
- Adding lexicon entries motivated by observed failures.
- Retrying a case with a rephrased prompt.
- Consulting the case registry mid-run.
- Adjusting the entry point after seeing any packet.
- Post-hoc reinterpretation of packet content.

---

## §10 · Sequence of operations (STRICT ORDER)

1. **Founder reviews the amended protocol (this document) and the frozen case registry (§7).**
2. Founder confirms case wording, family assignments, and evidence expectations, or amends them once before lock.
3. Answer-key-equivalent (the case registry) is finalised.
4. SHA-256 committed to this doctrine.
5. Harness written (`scripts/nex1-experiment-4-run.mjs`) only after founder authorises execution.
6. Run · 24 fresh subprocesses.
7. Determinism check.
8. Independent scoring per §5.
9. Report at `docs/doctrine/nex1-experiment-4-results-2026-XX-XX.md`.

Between step 4 and step 8, no NEX source file may be modified. Between step 6 and step 8, no case registry entry may be modified.

---

## §11 · Frozen artefact hashes

### §11a · Frozen prompt SHA-256s (12 case prompts · locked 2026-09-20)

```
A1  data/nex1-experiment-4/prompts/A1.txt  bytes=63   sha256=<in doctrine after write>
A2  data/nex1-experiment-4/prompts/A2.txt  bytes=95   sha256=<in doctrine after write>
A3  data/nex1-experiment-4/prompts/A3.txt  bytes=79   sha256=<in doctrine after write>
A4  data/nex1-experiment-4/prompts/A4.txt  bytes=45   sha256=<in doctrine after write>
A5  data/nex1-experiment-4/prompts/A5.txt  bytes=33   sha256=<in doctrine after write>
B1  data/nex1-experiment-4/prompts/B1.txt  bytes=NN   sha256=<in doctrine after write>
B2  data/nex1-experiment-4/prompts/B2.txt  bytes=NN   sha256=<in doctrine after write>
C1  data/nex1-experiment-4/prompts/C1.txt  bytes=NN   sha256=<in doctrine after write>
C2  data/nex1-experiment-4/prompts/C2.txt  bytes=NN   sha256=<in doctrine after write>
C3  data/nex1-experiment-4/prompts/C3.txt  bytes=NN   sha256=<in doctrine after write>
D1  data/nex1-experiment-4/prompts/D1.txt  bytes=NN   sha256=<in doctrine after write>
D2  data/nex1-experiment-4/prompts/D2.txt  bytes=NN   sha256=<in doctrine after write>
```

Actual hashes computed and appended below after prompt files are materialised.

### §11b · Case registry SHA-256 (locked 2026-09-20)

```
data/nex1-experiment-4/case-registry.md  bytes=NN  sha256=<in doctrine after write>
```

Actual hash computed and appended below after registry is materialised.

If any prompt file's SHA-256 or the case-registry SHA-256 differs from the recorded value at run time, the harness must refuse to execute.

---

## §12 · Bottom line (founder-framed)

Do not build the missing semantic layer yet.

Experiment 3 demonstrated that the missing layer is genuinely upstream of the machinery already built. Experiment 4 now tests whether anything already inside NEX can perform that separation implicitly.

If the answer is no, then a defensible basis exists for designing the next cognitive layer rather than guessing what it should be.

STOP after protocol amendment · report per founder A-H · await founder authorisation to run.
