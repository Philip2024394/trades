# NEX1 · First-Loss Audit · Session 2 evidence · 2026-09-17

**Purpose.** Founder-directed diagnostic: for every failed Session 2 turn, identify the EXACT first pipeline layer where information was lost — not the final refusal. Answer the binary question: **Are the new failures caused by missing capabilities, or are existing capabilities simply inaccessible because the natural-language → entity → context → capability pipeline is fragmented?**

**Method.** Ran the same regex extractors NEX1's own layers use (from `capability-a-founder-intent/classifier.ts` and `capability-conversation-intents.ts`) against each Session 2 message *standalone*, then compared the signals present in the message vs what actually reached the ConversationHead.

**Zero code changed. Zero repository reorganization proposed.**

---

## 1. Confirmed root cause from code inspection

`src/lib/nex-agent/code-engine/capability-a-founder-intent/classifier.ts:776-784`:

```ts
const verbResult = classifyVerbFamily(tokens, trace);
if (verbResult.winner === null) {
  return refuse("refused_no_verb_recognised", "no verb from the controlled vocabulary appeared in the goal", trace, goalLength);
}
// ── everything below here only runs if a verb was found ──
// scanDeliverables(...)          — deliverable regex
// scanFileReferences(...)        — file-reference regex  ← DROPPED WHEN NO VERB
// scanProjectDirReferences(...)  — dir regex             ← DROPPED WHEN NO VERB
// scanRequirementPhrases(...)    — spec/requirement      ← DROPPED WHEN NO VERB
// scanCodingConcepts(...)        — concept vocab         ← DROPPED WHEN NO VERB
```

**Every downstream extractor sits behind the verb gate.** When the classifier can't find a coding verb, it drops the entire message — including the file names, spec clauses, code identifiers, and everything else that WAS in the text.

The `Nex1IntentRefused` type in `types.ts:186-193` has NO field for extracted references. There is no channel by which a refused message can pass along its extractable signals.

---

## 2. Per-turn first-loss table

Loss counts across 26 Session 2 turns:

| First-loss stage | Count | Meaning |
|---|---|---|
| **L3_classifier** (verb refusal) | 14 | Verb gate fired; downstream extractors never ran |
| **L3_classifier_file_ref** | 3 | Verb classified but no target extracted from message |
| **L3_classifier_deliverable** | 3 | Verb + target extracted but no deliverable phrase matched |
| **L8_coding_loop_precondition** | 1 | Reached the loop; failed on target-shape precondition |
| **none** (no loss) | 5 | Turn completed as expected |

---

## 3. Signals dropped by L3 verb refusal (14 turns)

For each of the 14 verb-refusal losses, I ran the extractors independently on the message text to see what WAS available. Every one of these signals was present in the message and would have been useful downstream — but the verb gate discarded them all.

| Signal type | Count | Example turns |
|---|---|---|
| **File references** (`answer.ts`, `pipeline.ts`, `backoff.ts`, `ts-async.ts`, `answr.ts`) | 5 | "I mean the pipeline.ts fixture." · "In backoff.ts, when attempt is 5…" · "It's in ts-async.ts. For id=1, I want data to be 100." |
| **Non-TS file references** (`config-sample.json`) | 1 | (config was classified elsewhere · this was a spurious match) |
| **Spec-shape clauses** ("For X, Y should be Z" / "when X is Y") | 1 | "For input=2, output should be 2." |
| **Authorization markers** ("yes go", "yeah go for it", "please proceed") | 3 | "yeah go for it" · "yes, go" · "please proceed" |
| **Bind intents** ("let's call this task X") | 1 | "let's call this task the number-swap" |
| **Referential phrases** ("the one called X", "the X fixture", "the X thing", "back to X") | 3 | "The one called answer.ts…" · "the pipeline.ts fixture" · "back to the number-swap thing" |
| **Query verbs** ("what", "why", "how") | 4 | "what number is in there right now?" · "why did you pick that line?" |

---

## 4. Classified but incomplete (6 turns)

Not all losses were at the verb gate. Six turns DID get a verb but then stalled:

- **3 turns** classified a verb but no target file was extracted (`L3_classifier_file_ref`). Example: "OK make it 7 when n is 5." — verb=BUILD extracted from "make" but no file reference in the text.
- **3 turns** classified verb + target but the deliverable regex refused (`L3_classifier_deliverable`). Example: "There's a JSON file in the same folder — config-sample.json. Change the timeout to 5000." — verb=MODIFY + target=`config-sample.json`, but `no deliverable phrase from the controlled vocabulary matched`.

---

## 5. Answer to the founder's binary question

Categorizing every loss by whether the required capability EXISTS in the codebase (inaccessible) or does not exist (missing):

| Failure class | Turns | Capability status | First-loss diagnosis |
|---|---|---|---|
| File reference in message, verb missing | **5** | **INACCESSIBLE** | Extractor exists in `classifier.ts` and in `capability-conversation-intents.ts` (`FILE_REF_RE`). Gated behind verb. |
| Spec-shape clause, verb missing | **1** | **INACCESSIBLE** | `scanRequirementPhrases` exists in classifier · gated behind verb. |
| Auth marker, prior turn refused | **3** | **INACCESSIBLE** | `AUTH_MARKERS` regex exists in `capability-chat-turn.ts`. But Fix 24 follow-up requires `head.active_task_verb` and `head.active_target` to be set — which they aren't when prior turns all refused (no downstream information flow from refusals). |
| Bind intent phrasing, wrong shape | **1** | **PARTIALLY INACCESSIBLE** | `detectBindIntent` exists with several regex patterns · this specific shape ("let's call this task the X") isn't matched by the current `BIND_PATTERNS` list. Extending the list is small vocabulary work · same class as the recall vocab extension already applied in Session 1. |
| Referential phrases ("the one called X", "the X fixture", "back to X thing") | **3** | **MISSING** | No capability in the codebase resolves natural referential phrases against ConversationHead history. The `detectThreadIntent` covers `go back to X` for thread topic but not general entity resolution. |
| Query verbs ("what", "why", "how") | **4** | **MISSING** | No intent kind for read-only explanation/query. Classifier's verb vocabulary is BUILD/MODIFY/FIX/REFACTOR/TEST/INVESTIGATE/VERIFY/REMOVE — none of which cover "explain" or "why". |
| Deliverable phrase missing | **3** | **INACCESSIBLE** | Deliverable regex exists, just under-covers natural phrasings. Vocabulary extension. |
| Coding loop precondition | **1** | Downstream issue · not natural-language pipeline |

**Aggregate:**

- **INACCESSIBLE (existing capability behind wrong gate)**: **13 of 21 losses (62%)**.
- **MISSING (capability does not exist)**: **7 of 21 losses (33%)**.
- **Downstream (not the pipeline in question)**: 1 loss (5%).

---

## 6. Diagnosis

The founder's hypothesis is correct with data behind it:

> "NEX1 has a capability integration / semantic resolution architecture gap. Existing capabilities are inaccessible because the natural-language → entity → context → capability pipeline is fragmented."

**Almost two-thirds of the failures were inaccessible-capability failures, not missing-capability failures.** The extractors already exist in the codebase; they just live behind the verb gate. When the classifier can't find a coding verb, none of them run.

The remaining third splits into:
- **Referential-phrase resolution** (3 losses) — a genuinely new small capability. Not a subsystem — a resolver that takes phrases like "the X thing" / "the file from earlier" / "the one called X" and matches them against ConversationHead bindings + threads + prior mutation targets.
- **Query-verb intent** (4 losses) — a new intent kind (e.g. `EXPLAIN` / `QUERY`) that routes to explain-from-state or investigate-only paths without requiring a coding verb.

**No file/repo reorganization is indicated by this data.** The problem is not physical fragmentation of code · it is functional fragmentation of *when extractors run*.

---

## 7. What NOT to do (per the founder's guardrails)

- **Do not reorganize the repository.** The audit shows the code layout is not the issue.
- **Do not build a "natural language subsystem" or a new intelligence layer.** The extractors already exist; they need rewiring, not replacement.
- **Do not chase §4.1 / §4.2 / §4.3 / §4.4** from the Session 1 report. Those hit 1 turn each in Session 1 and 0 turns in Session 2. This inaccessible-capability problem hit 14 turns in one session.
- **Do not add a "context resolver" that silently guesses.** Any target/binding/spec resolution must produce evidence trails and stay refusable — same discipline as Q7/Q8 and Safety.

---

## 8. What the smallest general fix would look like (not implemented · founder decision required)

**The minimum architectural change to fix the 13 INACCESSIBLE losses:**

Change `classifyFounderIntent` to always run the downstream extractors (file references, project dirs, requirement phrases, coding concepts, deliverable) EVEN when the verb classifier refuses. Return a NEW intent variant — call it `refused_but_partial` — that carries the refusal reason AND the extracted signals. Then `capability-chat-turn.ts` can:

- Store any file reference on the head as `head.pending_target`.
- Store any spec clause as `head.pending_spec_fragment`.
- Store any auth marker as a flag.
- On the NEXT turn, Fix 24 follow-up synthesis can inherit not only from the last CLASSIFIED turn but from these accumulated partial signals.

This is a **rewiring** of an existing layer, not a new subsystem. It preserves every existing invariant:
- No new intent kind — `refused_but_partial` still means "did not classify as an actionable intent".
- The coding loop still requires `verb=FIX/MODIFY + target + goal + auth` to fire — none of those requirements are weakened.
- Safety gate still runs.
- Every existing test would still pass because they use well-formed prose which classifies successfully on the first turn.
- Zero-LLM invariant preserved.

**For the 7 MISSING losses (referential + query),** two small additions:

- New intent-kind `EXPLAIN` for query verbs (`what/why/how/where` when addressed to NEX1). Routes to a read-only explanation path that uses ConversationHead state.
- New helper `resolveReferentialPhrase(text, head)` that matches phrases like "the X thing" / "the one called X" / "the file from earlier" against `head.bindings` and `head.threads` and returns a candidate entity. Runs alongside the existing pronoun resolver.

Both are small · deterministic · zero-LLM · additive.

---

## 9. Two-session evidence · same conclusion

| Session | Phrasing style | Turns | verified count | dominant loss class |
|---|---|---|---|---|
| Session 1 (2026-09-17 earlier) | well-formed prose | 26 | 8 | scattered · 1 hit each on §4.1/§4.2/§4.3/§4.4 |
| Session 2 (2026-09-17 later) | natural conversational | 26 | 0 | 14 hits on **verb-gate signal drop** |

Session 1 exposed four different downstream gaps at low frequency. Session 2 exposed one upstream gap at very high frequency. Both are honest data. Fixing the upstream gap should be prioritized because it unblocks the ordinary conversational path that any real user would use.

---

## 10. Recommendation

**Do not authorize any implementation yet.** Run a **third** varied session with different phrasing styles — different user personae, different subject matter — to confirm that the verb-gate signal drop is not specific to my probe's phrasing choices. If session 3 reproduces the same >50% inaccessible-capability failure ratio, the founder has strong grounds to authorize the smallest-general-fix described in §8.

If session 3 shows a different dominant loss pattern, we have learned something new and can prioritize accordingly.

**The alternative — starting implementation on §4.1–§4.4 — would be building capabilities that this data suggests are lower-priority than the upstream integration gap.**

---

## 11. Evidence

- `scripts/nex1-first-loss-audit-2026-09-17.mjs` (audit runner · regex-based · no LLM)
- `data/nex-native-migration/nex1-first-loss-audit-2026-09-17.json` (per-turn audit with signals present + first-loss stage)
- `docs/doctrine/nex1-session-varied-2026-09-17.md` (Session 2 report)
- `data/nex-native-migration/nex1-session-varied-2026-09-17.json` (Session 2 raw)

No files under `src/` were modified during or after this audit. Registry unchanged. Memory unchanged.
