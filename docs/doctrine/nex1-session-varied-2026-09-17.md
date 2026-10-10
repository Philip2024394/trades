# NEX1 · Varied real-work session · 2026-09-17

**Purpose.** Second application of the continuous-learning program. Founder-directed: progressively less predictable tasks, no per-turn expectations, no labels revealing which capability is under test, mixed conversation + coding + memory + non-code files + ambiguity + self-doubt prompts + wrong-claim challenges.

**Wall clock:** 4711 ms. Six conversations, 26 turns total. Automated runner.

**Master AI Engineer role:** ZERO task-specific solutions supplied. ZERO capability fixes applied during or after this session. This document is observation only. A recommendation appears at the end · nothing has been changed in NEX1's code.

---

## 1. Raw observation

| Metric | Value |
|---|---|
| Turns | 26 |
| Conversations | 6 |
| State: `refused` | 14 (54%) |
| State: `clarification_required` | 6 (23%) |
| State: `understood` | 5 (19%) |
| State: `failed` | 1 (4%) |
| State: `verified` | **0** |
| Mutations observed | **0** |
| Recall states fired | **0** |
| Binding acknowledgements | **0** |
| Thread switches | **0** |
| Safety refusals | 0 |

**Session 1 comparison** (well-formed prose): 26 turns → 8 verified terminals, 4 mutations, 4 recall states, 1 bind_acknowledged. **Session 2** (natural phrasing): 26 turns → 0 verified terminals, 0 mutations, 0 recall, 0 bind.

The two sessions used the same NEX1 code. The only variable was how the messages were phrased.

---

## 2. Dominant recurring cause

**Every single `refused` turn (14 of 14) has the same classifier verdict:**

```
classifier · kind=refused · refusal=refused_no_verb_recognised
   (or: refused_goal_too_short for messages <8 chars)
```

The natural phrasings NEX1 refused on:

| Phrase | Why the classifier refused |
|---|---|
| "The one called answer.ts has a value in it — what number is in there right now?" | No verb in controlled vocab · "what number" is a query, not a coding verb |
| "OK make it 7 when n is 5." | "make" was classified as `BUILD` not `MODIFY`; downstream `wantsRun` requires FIX/MODIFY |
| "yeah go for it" | Auth marker present but no verb; prior turns had left no `active_task_verb` on the head |
| "let's call this task the number-swap" | Bind intent (natural, real user phrasing) not detected — `bind_acknowledged` never fired |
| "why did you pick that line?" | Explanation-request verb missing from vocab |
| "actually, is what you did correct?" | Ambiguity-check verb missing from vocab |
| "I mean the pipeline.ts fixture." | Target clarification with no verb · target reference was inside the message but the classifier's early exit on no-verb prevented the file reference from reaching the head |
| "For input=2, output should be 2." | Specification prose with no verb |
| "yes, go" | Auth marker but 7 characters < 8-char minimum |
| "There's a function that fetches a row asynchronously. Something's off with the value it returns." | No verb · "something's off" doesn't match any FIX-family token |
| "It's in ts-async.ts. For id=1, I want data to be 100." | Target + spec present but "I want" not classified as a verb |

The follow-up-synthesis handler (Fix 24) only fires when `head.active_task_verb !== null AND head.active_target !== null`. But when consecutive turns all refuse, those head fields stay null, so the follow-up handler cannot rebuild a synthesized classification from context. **Refusals cascade.**

The one exception: Conversation A managed to run a follow-up on Turn 8 ("OK back to the number-swap thing") because Turn 7 successfully classified `MODIFY` on `config-sample.json` — the follow-up inherited that verb+target, even though "back to the number-swap thing" was semantically a topic return to a different subject. That is a real Fix 24 mis-fire: the follow-up inherited the wrong context.

---

## 3. What NEX1 got right

- **Zero mutations occurred on files it shouldn't have touched.** The 14 refusals were correct behavior — NEX1 did not fabricate coding attempts on messages it could not parse.
- **Zero LLM was invoked.** Every response was native + deterministic.
- **Zero fabricated success.** No "understood — I'll fix..." replies followed by silent inaction; every state was honestly reported.
- **The one turn that DID reach the coding loop (Conversation C Turn 3) honestly reported `EARLY_EXIT_TARGET_MISSING`** — the loop tried, discovered the target file wasn't in the expected shape, and stopped rather than fabricating.

The refusals are not a safety failure. They are a **naturally-phrased-request comprehension gap**.

---

## 4. What this session actually reveals

The dominant repeated limitation is:

> **NEX1's classifier is verb-driven, but real conversation uses verb-free fragments constantly.** Users say "I mean the pipeline.ts fixture", "For input=2, output should be 2", "yes go" — none of which contain a coding verb, and any one of which is a legitimate contribution to an ongoing coding task. The classifier's early-exit on `refused_no_verb_recognised` drops the whole message, so the target references, spec statements, and authorization markers inside those messages never reach the ConversationHead. Subsequent turns then have nothing to inherit.

This is not one of the four architectural gaps §4.1–§4.4 from Session 1. It is a **higher-leverage general limitation**: it affects EVERY natural coding conversation, not just string/async/multi-file/conditional patterns.

The pattern appears **repeatedly and consistently** — across 6 conversations of very different subject matter, the same refusal class dominated.

---

## 5. Provisional smallest-general-fix hypothesis (NOT implemented)

If a fix is authorized, the smallest general shape would be:

- **Extract target file references + specification prose + authorization markers from EVERY message, even when the classifier refuses.**
- When the classifier refuses with `refused_no_verb_recognised`, if the message contains a file reference OR a spec-shaped clause OR an auth marker, populate the ConversationHead with whatever partial signal was found (e.g. `pending_target`, `pending_spec_fragment`, `pending_auth`).
- The Fix 24 follow-up handler can then inherit not only from a prior classified turn but from accumulated partial signals across recent refused turns.

This is a general fix — it applies to every natural conversation, not to any specific probe case. It does not weaken the "verb + target + spec + auth" requirement for actually invoking the coding loop; it only allows the ingredients to arrive across turns instead of all at once.

**I will not implement this without founder authorization.** It touches core classifier/head semantics and could affect Batch 1 & Batch 2 evidence. It needs its own audit + pre-build safety check.

---

## 6. Session-specific findings vs architectural gaps

| Gap | Session 1 evidence | Session 2 evidence | Recommendation |
|---|---|---|---|
| §4.1 String outcomes | 1/12 tasks touched it | 0 turns naturally reached it | Wait for repeated evidence |
| §4.2 Async / Promise | 1/12 tasks | 0 turns naturally reached it | Wait for repeated evidence |
| §4.3 Cross-module tracing | 1/12 tasks | 0 turns naturally reached it | Wait for repeated evidence |
| §4.4 Conditional disambiguation | 1/12 tasks | 0 turns naturally reached it | Wait for repeated evidence |
| **Verb-free fragment handling** (new) | 0/12 tasks (well-formed prose bypassed it) | 14/26 turns hit it directly | **Highest observed frequency** |

The founder's principle applies exactly here: *"Real work → real limitation → repeated evidence → capability improvement."*

One session of natural phrasing produced 14 hits on the same limitation. One session of well-formed prose produced 1 hit each on four different limitations. The natural-phrasing limitation has the strongest signal.

---

## 7. Recommendation for the next move

**Do not fix anything yet.**

Run a **third** varied session — different subject matter, different conversation partners' phrasing styles — and see whether the verb-free-fragment pattern reappears with the same dominance. If it does, that's two independent sessions of evidence converging on the same limitation, and the fix in §5 becomes worth authorizing. If it doesn't, we've learned that Session 2's phrasing style was atypical.

The four §4.1–§4.4 architectural gaps stay open — they need more natural-conversation encounters to build a case for prioritization.

**No code has been changed by this session.** No memory has been updated with claims of capability. The registry is unchanged. This is pure observation.

---

## 8. Evidence

- `scripts/nex1-session-varied-2026-09-17.mjs` — 6-conversation varied runner
- `data/nex-native-migration/nex1-session-varied-2026-09-17.json` — full trace per turn
- `data/nex-native-migration/nex1-session-2026-09-17.json` — Session 1 for comparison

No files under `src/lib/nex-agent/**` were modified during or after this session.
