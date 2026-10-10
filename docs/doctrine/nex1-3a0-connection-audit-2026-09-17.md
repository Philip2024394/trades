# NEX1 · Batch 3A-0 · Signal Preservation Connection Audit · 2026-09-17

**Founder authorization.** Read-only. Zero source modifications. Reproducible artefact. Feeds the Completion Contract for future Batch 3A implementation review.

**Method.** Single mechanical script `scripts/nex1-3a0-connection-audit-2026-09-17.mjs` that greps the source tree, cross-references against the 16 founder-listed categories, and emits `data/nex-native-migration/nex1-3a0-connection-audit-2026-09-17.json`. **Anyone can rerun the script; the output is deterministic.** Multiple honest self-corrections made during production (extractor name mismatch, Windows path separator, `===` vs `=` regex, audit script self-match) — every correction is preserved in the script's comments so future auditors see the discipline.

---

## 0. What this audit is NOT

- Not an implementation. Zero files under `src/` touched.
- Not a design specification. The refined architecture from Session 3 assessment is unchanged.
- Not an authorization to build. The founder said explicitly: 3A-0 first, then decide 3A.

---

## 1. Machine-verifiable map (16 categories)

Every category with numeric findings from the JSON:

| # | Category | Finding |
|---|---|---|
| 1 | **Classifier extractors** | 6 real extractors: `extractFileReferences` (L103), `extractProjectDirs` (L299), `extractCodingConcepts` (L455), `scanDeliverables` (L501), `extractRequirementPhrases` (L539), `extractDomainTokens` (L605). **All 6 invoked AFTER the verb gate (lines 790-841 > 779).** `gated_by_verb=true` for every one. `classifyVerbFamily` is invoked at 776 (it IS the gate). |
| 2 | **Classifier refusal paths** | 5 `return refuse(...)` sites in classifier.ts. 5 refusal kinds enumerated in types.ts: `refused_empty_goal`, `refused_goal_too_short`, `refused_goal_too_long`, `refused_no_verb_recognised`, `refused_conflicting_verbs_equal_top`. |
| 3 | **Safety gate call sites** | Defined at `capability-safety-boundary.ts` (`evaluateSafetyBoundary`). Invoked at 2 sites (both in `capability-chat-turn.ts`). |
| 4 | **Fix 24 follow-up / inheritance** | `FOLLOW_UP_MARKERS` regex block found. `FOLLOW_UP_MARKERS.test(...)` called at 1 site. `follow-up detected` trace fires. Synthesized-classification marker `follow-up-synth-1` used. Auth-time verb precedence guard present (the only explicit guard against silent supersession today). |
| 5 | **ConversationHead writes** | 9 exported mutators: `appendTurn` (11 call sites), `addBinding` (3), `openThread` (7), `activateThread` (2), `updateContextHead` (6), `recordFindings` (2), `recordMutation` (2), `recordVerification` (3), `recordDecision` (9). **Direct writes bypassing mutators (head-level, outside context module): 0**. **Thread-level direct writes outside context module: 1** — `capability-chat-turn.ts:670 targetThread.goal = input.user_message` (Batch 1 Closure). This is the ONE escape hatch currently in the codebase. |
| 6 | **ConversationHead reads** | 7 exported readers: `getConversationHead`, `getConversationTurns`, `getActiveThread`, `toTurnContext`, `findBinding`, `scanMessageForBindingMentions`, `resolvePronounToActiveTarget`. |
| 7 | **Active-task fields** | `head.active_target` (many refs), `head.active_task_verb`, `head.active_thread_id`, `Thread.target`, `Thread.verb`, `Thread.goal`. All accessible as plain fields. |
| 8 | **Authorization** | `AUTH_MARKERS` regex block in `capability-chat-turn.ts`. 1 test call site. `wantsRun` declared once, used 7 times downstream. |
| 9 | **Topic switch** | `openThread` and `activateThread` are the two entry points. `closed_turn` field read at 2 sites, **written to non-null at 0 sites — confirmed dormant field**. |
| 10 | **Correction markers** | `FOLLOW_UP_MARKERS` regex covers `actually`, `instead`, `no, i mean`, `what about`. Does NOT cover `sorry, I meant`. |
| 11 | **Binding operations** | `detectBindIntent`, `detectDefinitionIntent`, `addBinding`, `findBinding`, `scanMessageForBindingMentions`, `BIND_PATTERNS` (with N regex patterns). |
| 12 | **Recall operations** | `detectRecallIntent`, `RECALL_PATTERNS` block, `scanConversationIntents` composite entry point. Recall kinds enumerated: `what_did_i_call`, `did_it_work`, `what_changed`, `what_did_you_find`, `which_file`, `which_function`, etc. |
| 13 | **Information loss points** | 7 identified (see §2 below). |
| 14 | **Existing test coverage** | Grep hits per category in `__tests__` and `.test.` files. |
| 15 | **Minimum connection points for 3A** | 5 identified (see §3 below). |
| 16 | **Required test coverage for 3A verification** | 7 entries mapping each refined-arch rule to a required runtime proof. |

Full evidence: `data/nex-native-migration/nex1-3a0-connection-audit-2026-09-17.json`.

---

## 2. Where information is currently lost (7 sites)

Every loss point carries the file and the fix scope. None is a mystery — all are code decisions we can walk to.

| # | Loss point | File · location | Fix scope (refined rule) |
|---|---|---|---|
| **L1** | Classifier extractors gated behind verb refusal | `classifier.ts:779-784` (verb gate) | **R1** · move extractors above the gate OR emit `refused_but_partial` |
| **L2** | `Nex1IntentRefused` has no channel for extracted signals | `types.ts` Nex1IntentRefused interface | **R1** · schema addition or new variant |
| **L3** | Fix 24 follow-up inherits FIX unconditionally on `refused_no_verb_recognised` | `capability-chat-turn.ts` follow-up handler | **R5** · check `pending_query` before inheriting |
| **L4** | Correction phrases (`actually` / `instead`) trigger inheritance, not supersession | `capability-chat-turn.ts` FOLLOW_UP_MARKERS + Fix 24 block | **R3** · introduce ACTIVE/SUPERSEDED/CONFIRMED/WITHDRAWN status transitions |
| **L5** | Safety runs on classified intent, not raw signals | `capability-chat-turn.ts:539` safety call site | **R6** · consume pending_signals · run regardless of classifier verdict |
| **L6** | `Thread.closed_turn` field exists but never set to non-null | `capability-conversation-context.ts:41` (field), 2 read sites, 0 write sites | **R3 optional** · wire the write for explicit thread close if needed |
| **L7** | Classifier ambiguities computed per turn · never accumulated | `classifier.ts` ambiguities array | Deferred · not in the 7 load-bearing rules |

The `closed_turn` field being read but never written is not a bug — it's dormant infrastructure waiting for a specific need. R3 may or may not use it depending on whether we distinguish "topic explicitly closed" from "topic implicitly abandoned".

---

## 3. Minimum connection points for Batch 3A (5 concrete edit sites)

If Batch 3A is authorized, these are the minimum surgical edits — every one at a specific file and line:

| # | Site | Kind | What changes | Invariant |
|---|---|---|---|---|
| 1 | `classifier.ts:~776-784` (verb gate) | **SPLIT INTO TWO PHASES** | Phase 1 · unconditional run of all extractors. Phase 2 · verb classification. Refused kind carries phase-1 output. | Verb refusal must still refuse. Phase-1 signals reach the caller. |
| 2 | `types.ts` `Nex1IntentResult` | **ADD VARIANT** | `refused_but_partial` (or extend refused with optional `partial_signals`). | Refused still signals "do not execute". New field is inspectable only. |
| 3 | `capability-chat-turn.ts` `scanConversationIntents` region | **EXTEND SCAN** | Populate `head.pending_signals` from raw message with provenance. | Phase 1 mutations remain non-executive. |
| 4 | `capability-chat-turn.ts` Fix 24 follow-up handler | **GUARD** | Refuse to inherit verb=FIX when `pending_query` is present. Refuse to inherit target when a matching signal is `SUPERSEDED`. | Batch 1 Closure two-turn coding still works. |
| 5 | `capability-chat-turn.ts` safety call site (line ~539) | **MOVE UPSTREAM** | Safety consumes `pending_signals` regardless of classifier verdict. | Batch 2B Cases B/C/D must all pass. Case D remains load-bearing. |

**Plus one hygiene edit:** Introduce a proper `setThreadGoal` mutator in `capability-conversation-context.ts` and change `capability-chat-turn.ts:670` to use it instead of writing `targetThread.goal = ...` directly. Closes the single thread-level escape hatch found in this audit. Small, one-line change.

---

## 4. Required test coverage for 3A verification

Every rule requires a probe with an explicit runtime receipt. This is the Completion Contract applied to Batch 3A itself:

| Rule | Runtime proof required |
|---|---|
| **R1** signals survive refusal | Session 2 + Session 3 messages replayed → every previously-refused turn produces populated `head.pending_signals` (JSON receipt). |
| **R3** supersession | Session 3 Persona B T3 + Persona D T4 · correction produces `supersession_history` entry with provenance. Old target status → `SUPERSEDED`. |
| **R4** auth binds to snapshot-at-moment | Persona D T5 · `yes, go` after supersession executes against the CURRENT `active_task_candidate`, never against the superseded target. If none is current, refuses. |
| **R5** queries don't become actions | Persona E T3 · "why did you pick that line?" · response does NOT include "I'll fix X". |
| **R6** safety on signals | Persona D T6 · verb-less attempt on safety-doctrine.ts · safety returns `I_NEED_PERMISSION`, NOT `PASS`. Plus all Batch 2B Cases B/C/D re-verified through new plumbing. |
| **R7** referential resolution | Persona E T5 · "the file we changed earlier — what was the function name?" · resolves via `head.mutations` history · no fabricated target. |
| **Completion Contract** | Any coding task in Batch 3D produces all 14 evidence elements OR terminates with `PARTIAL / BLOCKED / INSUFFICIENT_EVIDENCE / VERIFICATION_FAILED` and names the missing element. |

**Batch 2B re-verification is the load-bearing gate on Batch 3D.** No Batch 3D `RUNTIME_VERIFIED` claim without Cases B, C, D all passing through new plumbing.

---

## 5. What survives from the earlier pre-build audit

The connection audit **confirms** the earlier pre-build audit's findings with mechanical evidence:

- **Single-writer discipline preserved** at head level (0 direct writes bypass mutators outside the context module).
- **1 thread-level escape hatch** at `capability-chat-turn.ts:670` — the only case where a Batch 3A hygiene fix should introduce a proper mutator.
- **`Thread.closed_turn` is genuinely dormant** — 2 reads, 0 writes to non-null.
- **All 6 real extractors are gated by the verb refusal** at line 779.
- **Correction phrases are recognized** by `FOLLOW_UP_MARKERS` but only for INHERITANCE, not SUPERSESSION — matching Session 3 evidence exactly.
- **Safety runs on classified intent** — the L5 architectural finding.

The refined architecture from Session 3 assessment (7 rules) is preserved unchanged. The five minimum connection points above are the specific mechanical edits it implies.

---

## 6. What this audit does not decide

- Not decided: whether `refused_but_partial` is a new variant or an extension of `refused` — a Batch 3A design choice.
- Not decided: whether `pending_signals` lives on `ConversationHead` directly or in a new `SignalLedger` module — a Batch 3A design choice.
- Not decided: whether `active_task_candidate` is recomputed every turn or cached with dependency tracking — a Batch 3C design choice.
- Not decided: how `WITHDRAWN` is triggered — user says "actually never mind" vs system decides — a Batch 3B design choice.

Every one of these is a Batch 3A/3B/3C design decision, not a 3A-0 audit decision.

---

## 7. Founder decision surface for authorizing Batch 3A

Three specific asks, each independently answerable:

1. **Authorize Batch 3A implementation using the 5 minimum connection points above?** Yes / No / Modify list.

2. **Approve the 1 hygiene edit** (introduce `setThreadGoal` mutator to close the thread-level escape hatch)? Yes / No.

3. **Confirm Batch 3D is blocked on Batch 2B re-verification of Cases B/C/D**? Yes / No.

**No file under `src/` will be modified until these three questions are answered explicitly.**

---

## 8. Evidence

- **Script (reproducible)**: `scripts/nex1-3a0-connection-audit-2026-09-17.mjs` — reruns produce the same JSON.
- **Machine-verifiable map**: `data/nex-native-migration/nex1-3a0-connection-audit-2026-09-17.json` — 16 categories · every finding cited with file:line.
- **Companion doctrines**:
  - `docs/doctrine/nex1-conversation-state-prebuild-audit-2026-09-17.md` (Agent A/B/C composed audit)
  - `docs/doctrine/nex1-session-3-architectural-assessment-2026-09-17.md` (7 refined rules + 4 new architectural findings)
  - `docs/doctrine/nex1-first-loss-audit-2026-09-17.md` (Session 2 diagnosis)
- **Continuous-learning rules**: `feedback_nex1_completion_contract_2026_09_17.md` + `feedback_continuous_learning_program_2026_09_17.md` in memory.

Zero files under `src/` modified. Registry unchanged. Memory index unchanged (documenting the audit is not a memory update; the audit IS the artefact).
