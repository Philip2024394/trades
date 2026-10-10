# NEX1 · Conversation-State Architecture · Pre-Build Audit · 2026-09-17

**Founder brief.** *"Before implementation, I want the pre-build audit to answer these questions: A) Where does state currently live? B) Who is allowed to mutate ConversationHead? C) What exactly can supersede what? D) What survives a topic switch? E) What does 'withdrawn' mean? F) What does uncertainty mean?"* — plus a connect-before-build discipline: identify which pieces of the refined architecture ALREADY exist in the codebase.

**Method.** Three parallel Explore agents inspected the actual source with file:line evidence. This doctrine composes their findings and answers the founder's six questions with concrete citations. **Zero code changed. Zero implementation authorized.**

---

## A · Where does conversation-relevant state currently live?

14 state categories inventoried across 4 storage classes.

| # | Category | Storage class | File · line | Shape |
|---|---|---|---|---|
| 1 | Active coding target | GLOBALTHIS-pinned mirror | `capability-conversation-context.ts:91` | `string \| null` |
| 2 | Active task verb | GLOBALTHIS-pinned mirror | `capability-conversation-context.ts:92` | `string \| null` |
| 3 | Coding goal / spec text | GLOBALTHIS-pinned per-thread | `capability-conversation-context.ts:42` (`Thread.goal`) | `string \| null` |
| 4 | Authorization state | **EPHEMERAL** — regex + boolean | `capability-chat-turn.ts:708-748` (`AUTH_MARKERS` + `wantsRun`) | computed each turn |
| 5 | Bindings | GLOBALTHIS-pinned flat on head | `capability-conversation-context.ts:27-34, 90` | `Binding[]` (max 200) |
| 6 | Referential state ("the X thing") | **EPHEMERAL** — pronoun regex only | `capability-conversation-context.ts:143-154` | matches PRONOUN_RE against `active_target` |
| 7 | Query state | **EPHEMERAL** — detected then routed | `capability-conversation-intents.ts:165-202` | `DetectedRecall \| null` |
| 8 | Findings | GLOBALTHIS-pinned per-thread | `capability-conversation-context.ts:59-64` | `FindingsRecord[]` |
| 9 | Mutations | GLOBALTHIS-pinned per-thread | `capability-conversation-context.ts:66-73` | `MutationRecord[]` |
| 10 | Verifications | GLOBALTHIS-pinned per-thread | `capability-conversation-context.ts:75-81` | `VerificationRecord[]` |
| 11 | Decisions | GLOBALTHIS-pinned per-thread | `capability-conversation-context.ts:53-57` | `Decision[]` |
| 12 | Thread topic / thread state | GLOBALTHIS-pinned array | `capability-conversation-context.ts:38-51, 89` | `Thread[]` |
| 13 | Pending clarifications | GLOBALTHIS-pinned mirror | `capability-conversation-context.ts:93` | `string \| null` |
| 14 | Last verified result | GLOBALTHIS-pinned mirror | `capability-conversation-context.ts:94` | `string \| null` |

**JSONL-persisted (3):** File Memory Index (`data/nex-code-brain/file-memory/index.jsonl`), chat turns (`data/nex1-chat-conversations/{id}.jsonl`), investigation conclusions (`data/nex1-investigation-conclusions/entries.jsonl`).

**Load-bearing finding.** The classifier's 7 output fields — `file_references`, `coding_concepts`, `requirement_phrases`, `project_dir_references`, `domain_tokens`, `ambiguities`, `reasoning_trace` (`types.ts:142-176`) — are all **EPHEMERAL**. Computed fresh every turn. Never persisted to ConversationHead. Never available to next turn's recall. This is a stronger statement than the first-loss audit yesterday: even when the classifier DOES extract signals successfully, the signals disappear at end-of-turn.

---

## B · Who is allowed to mutate ConversationHead?

**Answer: Only `runChatTurn` in `capability-chat-turn.ts`.**

- Grep across the whole repo: two files import `capability-conversation-context` — `capability-chat-turn.ts` (writer) and `capability-conversation-gateway.ts:223` (read-only `getConversationHead()`).
- Zero external callers outside `src/lib/nex-agent/code-engine/`.
- Zero direct `HEADS.get`/`HEADS.set`/`STORE_KEY` access outside `capability-conversation-context.ts` itself (lines 163, 178, 400 — three encapsulated access points).

**Ownership discipline:**
- **Single-writer rule enforced by scope**, not by locks. No mutex, no transaction log, no optimistic locking. Safe for single-process Node.js only.
- **Three mutation phases inside a single `runChatTurn` call:**
  - **Phase 1 (BEFORE classifier)**: user turn appended (line 148), bindings added (169/179), decisions recorded (190), recall/thread intents handled (200–432) including possible `openThread` (376) or `activateThread` (421).
  - **Phase 2 (AT/AFTER classifier)**: classifier (458), follow-up synthesis (492–527), safety boundary (539) with possible `updateContextHead` (565) + `appendTurn` (592) short-circuit, pending-goal-store (663).
  - **Phase 3 (AFTER native intelligence)**: `recordMutation` (918), `recordVerification` (927/940), `updateContextHead` on verify (912), investigation `updateContextHead` (1139) + `recordFindings` (1144), final `updateContextHead` (1167–1180), final `appendTurn` (1197).

**Critical**: Phase 1 mutations happen BEFORE the classifier runs. The intent classifier cannot retroactively change what Phase 1 wrote. Any redesign that moves extraction upstream must preserve this discipline.

**No cross-conversation coordination.** HEADS is process-global keyed by `conversation_id` — safe for isolated conversations, unsafe for multi-process horizontal scale.

---

## C · What exactly can supersede what?

Every state transition today is either `silent_overwrite`, `guarded_overwrite`, or `not_modeled`. **Zero explicit supersession markers anywhere.**

| Transition | Behaviour | Line ref | Class |
|---|---|---|---|
| target → target | Ternary replace; `openThread` if no existing open thread matches | `capability-conversation-context.ts:348, 335-346` | `silent_overwrite` |
| spec/goal → spec/goal | Replace only if new is longer or slot empty | `capability-chat-turn.ts:669-670` | `guarded_overwrite` |
| verb → verb | Ternary replace | `capability-conversation-context.ts:349` | `silent_overwrite` |
| **Auth-time verb precedence** | If head has FIX/MODIFY + wantsRun + classifier extracted different verb → keep head verb | `capability-chat-turn.ts:720-735` | **explicit guard** (Batch 1 Closure) |
| authorization → target | Not modeled — pattern-match stateless | `capability-chat-turn.ts:708, 749-785` | `not_modeled` |
| "actually" / "instead" / "not X" | `FOLLOW_UP_MARKERS` triggers classifier replacement by follow-up synthesis (inherits head, does not supersede) | `capability-chat-turn.ts:481, 492-527` | `guarded_overwrite` of classification, not of head state |
| topic switch → target/verb | `activateThread` silently replaces both from switched thread | `capability-conversation-context.ts:220-221` | `silent_overwrite` |

**Load-bearing finding.** Correction phrases (`FOLLOW_UP_MARKERS`) are recognised but they trigger **inheritance from head**, not **supersession of head**. Session 3 Persona D T4 ("Actually don't touch that file. Do backoff.ts instead: factor 3…") went exactly this path: the classifier refused, follow-up detected, and NEX1 inherited the STALE `active_target=answer.ts` from the head. The system currently has no code that says "the user just corrected · supersede the prior target". This is a genuinely missing behaviour.

---

## D · What survives a topic switch?

**`openThread` and `activateThread` (`capability-conversation-context.ts:188-224`):**

| Field | Behaviour |
|---|---|
| `head.active_thread_id` | Reset (adopts new thread) |
| `head.active_target` | Reset (adopts new thread's target — possibly `null`) |
| `head.active_task_verb` | Reset (same) |
| `head.pending_clarification` | **Persists** (never touched by thread switch) |
| `head.last_verified_result` | **Persists** (same) |
| `head.turn_id` | **Persists** — global monotonic counter, unaffected by thread switch |
| `head.bindings` | **Persists** — flat on head, not per-thread. Each `Binding` records its `thread_id` of introduction but the array lives on the head. |
| `Thread.mutations` / `verifications` / `findings` / `decisions` | Each stays pinned to originating thread. Recall queries FLATTEN across all threads (`capability-chat-turn.ts:220-223`) — conversation-level, not thread-level. |
| `Thread.entity_binding_names` | Per-thread; new thread starts empty (line 200) |
| `Thread.goal` / `target` / `verb` | Per-thread; new thread inherits nothing (must come from input args) |

**Founder's concern about topic-switch stale execution.** Currently: if user says "let's forget that task and talk about dinner" (thread switch), then five turns later says "yes, do it" — the follow-up handler would see `head.active_task_verb=null` (from the new thread) and refuse. So the *silent execute of stale coding task* is **not currently possible** through the thread-switch path alone. HOWEVER, if the user re-mentions the old target in the new thread ("look at answer.ts"), the auth marker on a subsequent turn would fire against the newly-set target — which is correct behaviour. The genuine risk is elsewhere: **not a topic-switch problem, but a correction problem** (Section C).

---

## E · What does the codebase currently mean by "withdrawn"-like concepts?

**Grep results across the whole repo:**
- `withdrawn`: 0 hits
- `superseded`: 0 hits
- `stale`: 0 hits
- `revoked`: 0 hits
- `invalidated`: 0 hits
- `closed`: 1 hit — `Thread.closed_turn`

**`Thread.closed_turn` (`capability-conversation-context.ts:41`):**

```ts
readonly closed_turn: number | null;
```

- Initialized `null` in `openThread` (line 196).
- Read at exactly two sites: `capability-conversation-context.ts:336` and `capability-chat-turn.ts:660` — both find "open threads only" (`t.closed_turn === null`).
- **Never set to non-null anywhere in the codebase.**

**Conclusion.** `closed_turn` is planned infrastructure that has been sitting dormant since the thread system was built. The read-sites are ready for it; the write-sites don't exist. This is a genuine "half-built" slot: any withdrawal-status semantics can be introduced by wiring writes into it, without new schema.

**No other withdrawal concept exists.** Thread lifecycle today is: opened → active → (implicitly abandoned when a new thread is activated). Never explicitly closed. Never marked as superseded. The infrastructure for `active | superseded | confirmed | withdrawn` status transitions does not exist and would need to be added — but only for the *four fields* the founder listed (target, spec, auth, binding), not for the existing 14 state categories.

---

## F · How is uncertainty represented today?

**Two independent uncertainty systems, neither of which persists across turns:**

### F.1 · Classifier-level ambiguities (turn-local)

`types.ts:79-89` — six kinds:
- `low_verb_confidence`
- `low_deliverable_confidence`
- `multiple_verb_families_close`
- `no_domain_extracted`
- `requirement_phrases_missing`
- `no_coding_context_detected`

Rebuilt fresh every turn. Never accumulated. Never used by downstream recall.

Plus one refusal variant: `refused_conflicting_verbs_equal_top` (`types.ts:184`).

### F.2 · Q7/Q8 candidate uncertainty (per investigation)

`capability-candidate-ranker.ts` (Fix 15) + `capability-candidate-selector.ts` (Fix 16):

Six-state selection vocabulary (`capability-candidate-selector.ts:64-70`):
- `SELECTED`
- `NO_SELECTION`
- `TIE`
- `INSUFFICIENT_EVIDENCE`
- `UNRESOLVED`
- `REQUIRE_MORE_INVESTIGATION`

Ranking tuple (`candidate-ranker.ts:238`): `[has_contradicting, has_unresolved, has_insufficient, -supporting_count]` — no weighted scores; pure boolean flags + count comparison per V1 policy.

Persisted in the InvestigationEvidencePacket, retrievable via `what_did_you_find` recall query.

**Load-bearing finding.** **The Q7/Q8 6-state vocabulary is a real precedent inside NEX1's own doctrine.** If we design a conversation-state supersession/uncertainty vocabulary, the founder has already approved this shape for a different but structurally-similar problem (candidate evaluation). Reusing the same vocabulary shape for signal-level supersession would be architectural consistency, not new invention.

**What's genuinely missing:** multi-turn accumulation of any uncertainty. Every ambiguity signal today is discarded at end-of-turn. Recall of "what were you uncertain about earlier?" has no answer path today.

---

## G · Connect-Before-Build: which pieces of the refined architecture ALREADY exist?

Mapping the seven load-bearing rules from the Session 3 architectural assessment against actual codebase evidence.

| Rule | Pieces that exist today | Pieces genuinely missing |
|---|---|---|
| **R1 · Extract regardless of verb** | Classifier extractors (file_refs, coding_concepts, requirement_phrases, project_dirs, domain_tokens, ambiguities) all IMPLEMENTED at `classifier.ts:799+`. Bind/definition/recall/thread/decision detectors in `capability-conversation-intents.ts` already run BEFORE the classifier (chat-turn.ts:169-195). | Classifier's own extractors are gated by verb refusal (`classifier.ts:776-784`). Need to move them above the verb gate OR expose them via a `refused_but_partial` variant. |
| **R2 · Extraction ≠ execution** | Already the case in Phase 1 (bindings, decisions land on head before classifier). Nothing in Phase 1 executes the coding loop. | Extend the same discipline to file-refs / spec / auth by making them Phase-1 too. |
| **R3 · Correction supersedes** | `FOLLOW_UP_MARKERS` regex recognises "actually" / "instead" / "not X". `Thread.closed_turn` field exists but never written. Binding provenance (`introduced_turn`, `thread_id`) is close in shape to what supersession records would need. | Supersession status enum (`active/superseded/confirmed/withdrawn`) does not exist. Correction detection is downstream (used for classifier synthesis) not for state mutation. No `supersession_history`. |
| **R4 · Authorization binds to current active_task_candidate at moment-of-auth** | `AUTH_MARKERS` regex + `wantsRun` boolean exist. Auth-time verb precedence guard exists (chat-turn.ts:720-735) — the only explicit supersession-adjacent code in the whole system today. | `active_task_candidate` as a *derived* field does not exist. Today auth uses `head.active_target + head.active_task_verb + thread.goal` directly, all of which are silent-overwrite scalars. Snapshot-at-auth semantics don't exist. |
| **R5 · Queries route to explanation, not action** | Recall detectors in `capability-conversation-intents.ts:165-202` route what_did_i_call / did_it_work / what_changed / etc. via the recall short-circuit before classifier. Query detection is real. | No `EXPLAIN` intent kind. Fix 24 follow-up handler unconditionally inherits verb=FIX when classifier refuses — it does not check whether the message carries `pending_query`. Session 3 Persona E T3 exposed this. |
| **R6 · Safety on raw signals, not classified intent** | Safety module (`capability-safety-boundary.ts`) already consumes founder-authored constants (`isPathInProtectedLayer`, `pathProtectedLayers`, `BANNED_AI_FRAMEWORK_PACKAGES`) from `safety-doctrine.ts` — reads a path + verb, not a full classifier output. | Safety is *called* AFTER the classifier at `chat-turn.ts:539`. When classifier refuses, safety returns PASS because it receives no target (Session 3 Persona D T6). Need to feed safety extracted signals, not classified intent. |
| **R7 · Referential resolver runs after extraction, before follow-up** | Existing pronoun resolver (`capability-conversation-context.ts:143-154`) already does a limited version — matches "it/that/this/the file" against `head.active_target`. `head.threads` history + `head.bindings` + `head.mutations`+`verifications`+`findings` all exist and can be searched. File Memory Index (`data/nex-code-brain/file-memory/index.jsonl`) provides SHA-based file lookup. | Broader referential phrases ("the file we changed earlier", "the X thing", "the one called X") — no resolver. `head.threads[]` searchable by target/goal but no natural-language resolver. |

**Aggregate: ~50-60% of the refined-architecture primitives already exist in the codebase in some form.** The remaining ~40% is genuinely new: supersession status enum, derived `active_task_candidate`, EXPLAIN intent kind, safety-on-signals wiring, broader referential resolution.

**This is coordination-not-duplication territory.** No 2,000-line "natural language subsystem" is warranted. The audit findings support the founder's constraint: keep the architecture composable and inspectable.

---

## H · What Batch 2B / Fix 15/16/17 / Track A behaviour would be affected?

Every existing invariant checked against the seven refined rules.

| Existing behaviour | Would refined arch affect it? | Re-verification required if authorized |
|---|---|---|
| **Batch 2B Case A** (Fix answer.ts + auth → mutation) | No · well-formed prose classifies successfully · path unchanged | Should still pass. Re-run to confirm. |
| **Batch 2B Case B** (protected path + FIX verb → I_NEED_PERMISSION) | Yes · safety currently reads `classification.verb_family` and `classification.file_references[0].path`. Under R6, safety moves upstream — same signals, different plumbing. | **Must re-run.** Same rule set, new plumbing. |
| **Batch 2B Case C** (openai import + INTELLIGENCE_CORE → I_CANNOT) | Yes · same plumbing change as B. | **Must re-run.** |
| **Batch 2B Case D** (auth cannot bypass safety) | Yes · today safety re-runs on the follow-up-synthesized classification. Under R4+R6, safety runs on the current `active_task_candidate` regardless of how the intent was assembled — behaviour should be equivalent but must be proven. | **Must re-run — highest priority.** This is the load-bearing safety invariant. |
| **Batch 2B Case E** (insufficient evidence · no target) | Safety returns PASS · existing clarification behaviour. Under R6 signals-based safety, still returns PASS. Compatible. | Should still pass. Re-run to confirm. |
| **Session 3 Persona D T6** (verb-less safety attempt) | **This is exactly the case R6 is designed to fix.** Currently safety returns PASS (miss); under R6 safety should refuse. **New behaviour · must be proven with a new probe.** | New coverage · not a regression check. |
| **Fix 15 (Q7 ranking)** | Not affected. Q7 operates on investigation candidate hypotheses, not on conversation state. | Regression-only. |
| **Fix 16 (Q8 selection)** | Not affected. Same reasoning. | Regression-only. |
| **Fix 17 (investigation conclusion store)** | Not affected. | Regression-only. |
| **Track A / nex-debugger** | Not affected. Untouched by all seven rules. | Regression-only. |
| **Fix 20-23c (J.2 tracer + preservation)** | Not affected. Coding loop invocation shape unchanged. | Regression-only. |
| **`pricing.ts` SHA `150158baa3b0274a`** | Not affected. Must remain byte-identical. | Verify pre/post. |
| **Batch 1 Closure two-turn coding flow (Test C)** | Yes · the goal-store gate (`chat-turn.ts:663-683`) currently requires `classification.kind === "classified"`. Under R1+R2, spec-fragments arriving on refused turns should also populate `pending_signals.specification`. | **Must re-run.** Same 3 variants (A/B/negative) plus new fragment-accumulation variant. |
| **Batch 1 Final Closure recall vocab** | R5 (query→explanation) extends this. Existing recall states must still resolve; new EXPLAIN paths added. | Re-run. |
| **Batch 2A streaming** | ChatTurnEvent union may gain new event kinds (`signal_extracted`, `supersession_recorded`, etc.). Existing events unchanged. | Re-run to confirm no regression. |

**Summary of re-verification burden if refined arch is authorized:**
- 3 Batch 2B safety cases require re-run (B, C, D) plus a new probe for the Persona D T6 case.
- 1 Batch 1 Closure Test C variant plus new fragment-accumulation variant.
- 1 Batch 1 Final Closure recall variant.
- 1 Batch 2A streaming probe re-run.
- Full scoped `code-engine` regression.
- `pricing.ts` SHA verification.

**Nothing in Track A / Fix 15/16/17 / nex-debugger touched.**

---

## I · Proposed Batch 3A-3F sequencing (for founder review · not authorized)

Based on connect-before-build map: order the batches so each one has independently verifiable evidence before the next depends on it.

**Batch 3A — Signal preservation (extraction survives refusal).**
- Scope: Rule R1 + R2. Move classifier extractors above the verb gate, or expose them via `refused_but_partial`. Populate `pending_signals.target[]` / `pending_signals.specification[]` / `pending_signals.authorization[]` / `pending_signals.query[]` / `pending_signals.binding[]` / `pending_signals.reference[]` with provenance.
- No execution semantics change. Coding loop still requires `verb+target+goal+auth` — none of those requirements weaken.
- Runtime proof: replay Session 2 + Session 3 messages · every previously-refused turn should now populate pending_signals with the extracted evidence (verified by JSON receipts).
- Regression: full `code-engine` + Batch 2B + Batch 1 Closure Test C.
- Small · additive · low blast radius.

**Batch 3B — State transitions (supersession + status).**
- Scope: Rule R3. Introduce `status: active | superseded | confirmed | withdrawn` on pending_signal entries. Detect correction markers ("actually", "not X", "instead") and mark prior signals `superseded` with provenance. Wire `Thread.closed_turn` for explicit topic close.
- Runtime proof: Session 3 Persona B T3 + Persona D T4 · correction turn produces a `supersession_history` entry visible in trace.
- Regression: same suite.

**Batch 3C — Candidate assembly (derived active_task_candidate).**
- Scope: `active_task_candidate` becomes a derived value: newest-non-superseded target + newest-non-superseded spec. Ambiguity when multiple candidates.
- Runtime proof: Session 3 Persona A fragment accumulation produces a valid candidate after Turn 3. Persona D correction turn moves candidate from answer.ts to backoff.ts with supersession recorded.
- Regression: same.

**Batch 3D — Safety integration (signals-based).**
- Scope: Rule R6. Safety consumes `pending_signals.target[]` + intent-verbs-in-vocab regardless of classifier verdict. Re-verify every Batch 2B case + the new Persona D T6 case (verb-less safety attempt).
- Runtime proof: 5 Batch 2B cases + Persona D T6 · all pass under new plumbing.
- **This is the highest-safety batch. Must re-verify before proceeding.**

**Batch 3E — Authorization binding (snapshot-at-auth).**
- Scope: Rule R4. `wantsRun` triggers auth-binds-to-current-active_task_candidate. Stale auth (Persona D T5) refuses safely with clear rationale.
- Runtime proof: Persona D scenario · T5 "yes, go" after supersession does NOT execute against the stale target.
- Regression: same.

**Batch 3F — Query routing + referential resolution.**
- Scope: Rule R5 + R7. `EXPLAIN` intent kind. Fix 24 follow-up checks `pending_query` before inheriting verb. Referential-phrase resolver runs after signal extraction.
- Runtime proof: Session 3 Persona E T3 ("Why did you pick that line?") no longer becomes FIX. Persona E T5 ("The file we changed earlier — what was the function name?") resolves via `head.mutations` history.
- Regression: same.

**Not proposed as a single batch.** Six independent RUNTIME_VERIFIED evidence gates. If any one fails, the chain halts for founder decision.

---

## J · What this audit did NOT do

- Did NOT authorize any implementation.
- Did NOT touch any file under `src/`.
- Did NOT change the capability registry.
- Did NOT update memory index.
- Did NOT propose a specific file layout for the new code (that's a Batch 3A design decision, not a pre-build one).
- Did NOT evaluate the seven rules against each other (some may conflict — e.g., R3 supersession vs R4 auth-binding-to-candidate need to co-design when correction happens WITH auth in one turn).
- Did NOT compare NEX1's architecture against external references (LangGraph, LlamaIndex, etc.) — the founder's guardrail rules out external LLM tooling by design.

---

## K · Founder decision surface

The audit is complete. The seven refined rules are architectural claims backed by evidence. The Batch 3A-3F proposal is a sequencing hypothesis, not a plan.

Three questions for the founder before authorising anything to build:

1. **Is the 6-state uncertainty vocabulary from Q7/Q8** (`SELECTED / NO_SELECTION / TIE / INSUFFICIENT_EVIDENCE / UNRESOLVED / REQUIRE_MORE_INVESTIGATION`) the vocabulary you want reused for pending-signal status, or should signals use a distinct language (`active / superseded / confirmed / withdrawn` as I proposed)?

2. **Is Batch 2B safety re-verification a blocking gate on Batch 3D?** I recommend yes — all three affected Batch 2B cases (B, C, D) must re-run cleanly before Batch 3D closes. Confirming this is the discipline you want.

3. **Do you want Batch 3A implemented as a single change, or split into a pre-build "connect audit" that lists every classifier extractor call site + safety gate + Fix 24 follow-up call site before any edit is made?** The audit here is inventory-level; a full connect audit would be edit-plan-level.

**No implementation begins until these three questions are answered explicitly.** No file under `src/lib/nex-agent/**` will be modified.

---

## L · Evidence

- `docs/doctrine/nex1-session-3-architectural-assessment-2026-09-17.md` (Session 3 findings + seven load-bearing rules)
- `docs/doctrine/nex1-first-loss-audit-2026-09-17.md` (Session 2 first-loss analysis)
- `data/nex-native-migration/nex1-session-3-2026-09-17.json` (Session 3 raw)
- `data/nex-native-migration/nex1-first-loss-audit-2026-09-17.json` (per-turn signal audit)
- Agent A report · state inventory
- Agent B report · mutation ownership
- Agent C report · supersession + topic-switch + withdrawal + uncertainty

Zero files under `src/` modified. Registry unchanged. Memory index unchanged.
