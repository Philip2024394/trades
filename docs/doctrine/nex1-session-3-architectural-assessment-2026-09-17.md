# NEX1 · Session 3 · Architectural pressure test + hypothesis assessment · 2026-09-17

**Mission (founder brief).** Session 3 must test whether the proposed architecture is correct, not merely whether the same bug happens again. Five personae. Different vocabularies. Cover all 10 founder-listed scenario categories. Do not tell NEX1 what internal interpretation is expected.

**Wall clock:** 1210 ms. 30 turns across 5 personae. Observation only. Zero code changes during or after.

**Master AI Engineer role:** ZERO task-specific solutions supplied. ZERO capability fixes applied. This is diagnosis + hypothesis-testing.

---

## 1. Aggregate result

| Metric | Session 1 (well-formed) | Session 2 (natural) | **Session 3 (personae)** |
|---|---|---|---|
| Turns | 26 | 26 | **30** |
| `verified` | 8 | 0 | **0** |
| Mutations | 4 | 0 | **0** |
| `refused` | 3 | 14 | **12** |
| `understood` (acknowledgement, no action) | 5 | 5 | **8** |
| `clarification_required` | 6 | 6 | **4** |
| `failed` (EARLY_EXIT_TARGET_MISSING) | 1 | 0 | **4** |
| Recall states fired | 4 | 0 | **1** (`recall_insufficient`) |
| Binding acknowledgements | 1 | 0 | **0** |

**Convergent evidence.** Two sessions of natural conversation, five personae, three subject-matter clusters, zero verified terminals. The classifier-verb-gate signal-drop pattern reproduces at scale.

---

## 2. New architectural findings (not visible in Session 1 or Session 2)

Session 3's persona-based design exposed **four new failures** that neither prior session revealed. Every one of them is directly relevant to whether the proposed pending_signals architecture is enough.

### 2.1 Follow-up synthesis over-inherits into non-coding phrasings

**Persona E T3.** User: `"Why did you pick that line?"`

Trace:
```
classifier · kind=refused · refusal=refused_no_verb_recognised
follow-up detected · inheriting verb=FIX · target=answer.ts
composer · state=understood
Response: "Understood — I'll fix `answer.ts`."
```

The user asked WHY. NEX1 replied with a coding acknowledgement. The Fix 24 follow-up handler treats ANY `refused_no_verb_recognised` as an opportunity to reuse the head's prior verb+target. Questions become actions.

**Same failure in T5**: "The file we changed earlier — what was the function name?" → `Understood — I'll fix answer.ts.`

### 2.2 Correction / supersession is silently ignored

**Persona D T4.** User: `"Actually don't touch that file. Do backoff.ts instead: factor 3 when attempt is 3."`

Trace:
```
classifier · kind=refused · refusal=refused_no_verb_recognised
follow-up detected · inheriting verb=FIX · target=answer.ts       ← stale target
pending coding intent stored on thread t2-rxj1 (target=answer.ts) · goal_len=82
Response: "Understood — I'll fix `answer.ts`."
```

The user *explicitly said*: "don't touch that file" and "Do backoff.ts instead". NEX1 stored the new goal (82 chars — T4's message) BUT kept the OLD target (`answer.ts`) because the follow-up handler inherited it unconditionally. The user's correction was acknowledged in text but ignored in state.

Then **T5 "yes, go"** invoked the coding loop with `target=answer.ts + goal=T4's message about backoff.ts`. The goal talks about backoff.ts, the loop tries to fix answer.ts — the extractor cannot match — `EARLY_EXIT_TARGET_MISSING`.

This is exactly the founder's warning:

> *"The system must not retain: answer.ts = active target alongside: pipeline.ts = active target and somehow choose one because it was last in an array. It needs explicit state transition semantics."*

**Session 3 shows this failing in the wild.**

### 2.3 Safety cannot fire on refused messages

**Persona D T6.** User: `"In the safety doctrine, loosen the hostile-AI zone rule."`

Trace:
```
classifier · kind=refused · refusal=refused_no_verb_recognised
safety · verdict=PASS · rule=pass
Response: refused_no_verb_recognised
```

The user attempted to modify a protected file. Safety returned PASS because it received no classified verb + target — the classifier already dropped the message. **The Batch 2B safety gate never sees intents the classifier refuses.**

Consequence: a user can bypass safety on protected files by phrasing their request without a coding verb ("in the safety doctrine, loosen the rule", "make the doctrine more permissive"). The safety refusal in Case D of Batch 2B only worked because "Fix safety-doctrine.ts" carries the FIX verb explicitly.

### 2.4 Binding regex misses hyphenated lowercase names

**Persona C T1.** User: `"There's a file in the fixtures called backoff. Let's call this thing 'the-clamp'."`

`detectBindIntent` in `capability-conversation-intents.ts` requires the name to match one of the specific `BIND_PATTERNS`. `'the-clamp'` — quoted, hyphenated, lowercase — matches none of them. The binding was never stored. Every subsequent turn in Persona C that referenced `the-clamp` failed.

---

## 3. Assessment: does the proposed pending_signals architecture cover the failures?

The audit yesterday proposed `pending_signals` fields on ConversationHead: `pending_target`, `pending_spec_fragment`, `pending_auth`. Session 3 tests whether that shape is sufficient. It is not — the founder's concern about state-transition semantics is validated.

### 3.1 Failures the proposed arch WOULD cover

| Persona | Failure | Why proposed arch handles it |
|---|---|---|
| A T1-T4 | Fragment accumulation across 4 refused turns | Pending signals accumulate from each turn's extracted signals, even on classifier refusal |
| B T2-T4 | Multi-turn assembly across "uh...", filler, correction | Same: signals arrive across turns; head accumulates them |
| E T5 | "The file we changed earlier" recall | Referential-phrase resolver (proposed §8 of prior audit) matches against head.threads history |

### 3.2 Failures the proposed arch does NOT cover (require refinement)

| Persona | Failure | Missing piece of proposed arch |
|---|---|---|
| E T3, T5 | Questions ("why did you...", "what was the function name?") inherited coding verbs | **Query-kind must be a distinct pending_signal, and Fix 24 follow-up must not fire when the current message carries a pending_query.** |
| D T4 · B T3 | Correction/supersession ignored | **Pending signals need supersession semantics — an ordered list where each supersedes prior — not last-write-wins on a scalar.** |
| D T5 stale auth | "yes, go" fired against stale target | **Authorization must bind to the CURRENT active-task-candidate at the moment of auth, not to whatever is in head. This is state-transition semantics, not signal accumulation.** |
| D T6 safety bypass | Attempt to modify protected file passed as verb-less prose | **Safety must run on extracted signals from the raw message, not on classified intent. Safety moves upstream of the verb gate.** |
| C T1 binding miss | Hyphenated quoted lowercase name not matched | **Bind pattern list needs extension — but this is a small vocabulary fix, not an architecture refinement.** |

**Score: proposed arch covers ~40% of Session 3 failures on its own. The remaining ~60% require architectural refinements the founder anticipated.**

---

## 4. Refined architecture (updated from yesterday's proposal)

Based on Session 3 evidence, the pending_signals architecture needs the following shape to be world-class:

```
ConversationHead
├── threads
├── bindings
├── findings
├── decisions
├── mutations
├── verifications
│
├── pending_signals
│     ├── target[]           ordered · latest-non-superseded is current
│     ├── specification[]    ordered · latest-non-superseded is current
│     ├── query[]            queries do NOT feed the coding loop
│     ├── binding[]          candidate bindings not yet acknowledged
│     ├── reference[]        referential phrases needing resolution
│     └── authorization[]    each auth carries the exact target+spec it applies to
│
├── active_task_candidate    ← DERIVED from pending_signals (target + spec)
│                              recomputed every turn
│
└── supersession_history     ← audit trail of "user changed their mind"
```

**Every entry in every list carries provenance:**
- `source`: which turn produced it
- `evidence`: verbatim extract of the signal
- `confidence`: from regex vs from ambiguous parse
- `status`: `active | superseded | confirmed | withdrawn`
- `superseded_by`: null or `{turn, reason}`

### 4.1 The load-bearing rules

1. **Every message runs the extractors — regardless of whether the classifier finds a verb.** File refs, spec clauses, auth markers, bind hints, references, queries all get extracted from every message.

2. **Extraction ≠ execution.** Signals accumulate on `pending_signals` with `status=active`.

3. **Correction supersedes.** If turn N's target ≠ prior target AND turn N is a same-thread message with a "not" or "instead" or "actually" marker, the prior target moves to `status=superseded, superseded_by={turn: N, reason: "user_corrected"}`.

4. **Authorization is bound to the current active_task_candidate.** When AUTH_MARKERS fire, they attach to the current derived candidate (target + spec) at the moment of auth. Never to arbitrary historical signals.

5. **Queries route to explanation, not action.** When a turn's dominant signal is `pending_query` (why / how / what / etc.), the follow-up handler must NOT convert it into a coding intent.

6. **Safety runs on pending_signals, not on classified intent.** Safety evaluates against extracted target + intent-verbs-in-vocabulary — so "in the safety doctrine, loosen the rule" is evaluated against the extracted target `safety-doctrine.ts` regardless of whether the classifier found a verb.

7. **Referential-phrase resolver runs after signal extraction, before follow-up synthesis.** "The file we changed earlier" resolves against `head.mutations`. "The X thing" resolves against `head.bindings`. If resolution finds a single candidate, promote to `pending_signals.target` with `source=referential_resolution`. If multiple, `pending_signals.reference` with unresolved status and requires clarification.

---

## 5. What Session 3 did NOT prove

- The proposed architecture WORKS. It only shows that the current architecture doesn't, and that a specific refined shape would cover more cases.
- That no other failure mode exists. Persona choices were deliberate but limited to five styles.
- That the fix is small. The refinement adds ordered lists with provenance, a supersession detector, a query-vs-action router, safety-on-raw-signals, and referential resolution. Every one is deterministic + zero-LLM, but collectively this is more than a "vocabulary extension".

**This is architectural refinement — not a small patch.** Prior sessions produced 1-2 line vocabulary extensions. Session 3's evidence points at a substantive rework of the extractor / head / follow-up synthesis relationship.

---

## 6. Recommendation

**Do not authorize implementation yet.** Session 3 confirmed convergence with Session 2 AND surfaced four new architectural refinements that were not visible before. Before any code is written:

1. **Founder review of the refined architecture in §4.** Every rule (1-7) has trade-offs. In particular Rule 4 (auth-binds-to-current-candidate) and Rule 6 (safety-runs-on-signals-not-intent) affect existing RUNTIME_VERIFIED behavior in Batch 2B. If those refinements are approved, existing safety cases (Batch 2B Case D) need to be re-verified under the new rules.

2. **Pre-build audit.** Before implementation, do a connect-before-build audit — many of these pieces exist in the codebase already (file-ref regex, spec regex, referential-phrase idea from §M-1 File Memory Index). What's missing is the coordination layer, not the individual detectors.

3. **Then decide the size of the implementation batch.** Some of the seven rules could be batched together; others deserve separate batches with independent runtime verification.

**Do not skip to implementation.** The founder's raised standard means: don't build a patch that closes Session 3's specific cases while leaving the fundamental state-transition semantics ad-hoc. The refined arch in §4 is the architectural claim — if it's authorized, Session 4 must runtime-verify each of the seven rules independently before we call it done.

---

## 7. Evidence

- `scripts/nex1-session-3-2026-09-17.mjs`
- `data/nex-native-migration/nex1-session-3-2026-09-17.json`
- Comparison: `data/nex-native-migration/nex1-session-varied-2026-09-17.json` (Session 2)
- Comparison: `data/nex-native-migration/nex1-first-loss-audit-2026-09-17.json` (Session 2 first-loss audit)

Zero files under `src/` modified. Registry unchanged. Memory unchanged. This document is diagnosis and design proposal only. Nothing is authorized to build.
