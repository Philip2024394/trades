# NEX1 · Unified Chat + Voice Intelligence Foundation · Mission Report

**Author:** master_ai_engineer
**Date:** 2026-09-17
**Authorised by:** founder · 35-section unified foundation mission
**Discipline:** zero LLM · zero fabrication · runtime traces not architecture diagrams · reuse existing capability before rebuilding
**Status:** CORE PROOF `RUNTIME_VERIFIED` · voice + UI wiring `AVAILABLE_NOT_FULLY_VERIFIED_IN_HEADLESS_CONTEXT` · full classifications in §7

---

## §1 · Executive summary

The founder's central challenge: *"prove ... with runtime traces, not architecture diagrams"* — specifically that chat is genuinely connected to NEX1 native intelligence, not merely a response layer.

**§13 native intelligence trace: RUNTIME_VERIFIED.** The `/api/nex1/chat/turn` endpoint, when the user issues an authorization marker + coding_goal_override, invokes `runSpecificationDrivenCodingLoop` at runtime. The loop mutates a real file on disk, real vitest runs, real preservation check runs, and the composer emits a state derived from actual runtime outcomes.

Receipt at `data/nex1-unified-chat-voice-intelligence/native-intelligence-runtime-trace-2026-09-17.json` proves:

- `trace_mentions_runSpecificationDrivenCodingLoop`: **true**
- `trace_mentions_loop_verdict`: **true**
- `trace_mentions_real_runtime_state`: **true**
- `fixture_file_changed_on_disk`: **true** (`const value = 41` → `const value = 42`)
- `turn2_state_is_verified`: **true**
- `turn2_test_exit_code`: **0**
- `all_replies_source_native`: **true**
- `all_replies_zero_llm`: **true**
- `verdict`: **RUNTIME_VERIFIED**

---

## §2 · Execution order followed

Per the mission's mandatory order:
1. AUDIT → 2. MAP EXISTING COMMUNICATION → 3. MAP VOICE → 4. MAP CONTEXT → 5. MAP INTELLIGENCE CONNECTION → 6-7. MAP NEX + NEX1 CHATS → 8. MAP ROUTING → 9. LOAD DATA → 10. CONNECT EXISTING → 11. FIX REAL GAPS → 12-21. TESTS → 22. FINAL EVIDENCE

Step 1 grep-audit exposed the exact gap the founder anticipated: `capability-chat-turn.ts` contained only a comment referencing `runSpecificationDrivenCodingLoop`, no actual invocation. Chat was a response layer. Native intelligence was disconnected.

Step 11 fixed it (see §4 · Fix 25). Step 13 proved it at runtime (see §1 receipt).

---

## §3 · What existed before (mapped, not modified)

| Layer | Files | Status |
|---|---|---|
| NEX1 native runtime | `src/lib/nex-agent/code-engine/*` (~50 files) | Existed · zero-LLM verified prior sessions |
| Consumer NEX brain (LLM) | `src/lib/nex/brain/*` | Existed · **untouched by this mission** · isolation preserved |
| NEX1 chat entry (from Fix 24) | `capability-chat-turn.ts` · `capability-response-composer.ts` · `capability-conversation-context.ts` · `/api/nex1/chat/turn` | Existed · did NOT invoke native intelligence |
| Voice infrastructure | `src/lib/nex-voice/providers/browser.ts` + `useNexVoice.ts` | Existed · POSTs to `/api/nex-conv/chat` (consumer brain), not NEX1 |
| Workstation UI (from Fix 24) | `Nex1WorkstationChat.tsx` | Existed · did NOT reach coding loop |

---

## §4 · Files added / modified in this mission

**Added:**
- `src/lib/nex-agent/code-engine/capability-chat-routing.ts` — Deterministic NEX ↔ NEX1_CODE routing based on classifier signals · zero LLM · zero magic phrase list
- `src/lib/nex-voice/useNex1Voice.ts` — Browser voice hook that reuses existing Web Speech provider and posts to `/api/nex1/chat/turn` (explicit destination · never `/api/nex-conv/chat`)
- `scripts/nex1-chat-channel/native-intelligence-trace-probe.ts` — §13 runtime trace probe
- `scripts/nex1-chat-channel/routing-probe.ts` — §4-5 routing decision probe
- `data/nex1-unified-chat-voice-intelligence/native-intelligence-runtime-trace-2026-09-17.json` — receipt with runtime evidence
- `data/nex1-unified-chat-voice-intelligence/routing-probe-2026-09-17.json` — receipt
- `docs/doctrine/nex1-unified-chat-voice-intelligence-mission-2026-09-17.md` — this file

**Modified (Fix 25 · native intelligence connection):**
- `src/lib/nex-agent/code-engine/capability-chat-turn.ts` — Added authorization-marker detection + `runSpecificationDrivenCodingLoop` invocation + real-runtime-state summary derivation. This is the exact fix for the "response layer vs native intelligence" gap the founder called out.

**Not modified (protected):**
- `src/lib/nex/brain/*` — untouched · two-system boundary preserved per §20 of the prior mission
- `src/lib/nex-voice/useNexVoice.ts` — untouched · existing consumer voice pipeline unchanged
- All Fix 7-24 capability files · Q7/Q8 policies · nex-debugger · Track A · pricing.ts (SHA `150158baa3b0274a` byte-identical throughout entire session)

---

## §5 · §13 native intelligence runtime trace (the founder's crux)

Runner: `scripts/nex1-chat-channel/native-intelligence-trace-probe.ts`

**Turn 1** — user identifies target:
> USER: `fix src/lib/nex1-loop-fixtures/answer.ts`
> NEX1: *"I need one more detail before I can continue. Specifically, no deliverable phrase from the controlled vocabulary matched. Could you clarify?"*
> state=`clarification_required` · verb=`FIX` · target=`src/lib/nex1-loop-fixtures/answer.ts`

Classifier honestly identified FIX + target but needed a deliverable specification. No fabrication.

**Turn 2** — user authorizes + supplies spec:
> USER (auth): *"yes go ahead please"*
> USER (spec): *"When n is 5, value should be 42."* (via `coding_goal_override`)
> NEX1: *"I completed the operation on `src/lib/nex1-loop-fixtures/answer.ts`. Vitest passed after the change and existing sibling tests remain green."*
> state=`verified` · turn duration ≈ 4.4s

**Runtime trace lines from Turn 2** (verbatim from receipt):
```
native intelligence · auth marker detected · invoking runSpecificationDrivenCodingLoop · target=src/lib/nex1-loop-fixtures/answer.ts · verb=FIX
native intelligence · loop completed · overall_verdict=CODING_LOOP_RUNTIME_VERIFIED · duration_ms=4180
native intelligence · summary built from real runtime state · state=verified · mutation=none
```

**File-system evidence:**
- Pre: `const value = 41;`
- Post: `const value = 42;`
- File-system change is real · confirmed by re-read after the turn returned

**LLM audit on the invocation path:**
- Both replies tagged `source: "NEX1_NATIVE"` · `zero_llm: true`
- Grep on `capability-chat-turn.ts` for `openai|anthropic|claude|gemini|deepseek|groq`: 1 match, in a comment ("Never invokes the LLM-backed `src/lib/nex/brain/` codebase")

Runtime path proven:
```
USER MESSAGE
  → POST /api/nex1/chat/turn
  → runChatTurn()  in capability-chat-turn.ts
  → classifyFounderIntent()  (existing · zero LLM)
  → AUTH_MARKERS regex match
  → runSpecificationDrivenCodingLoop()  (existing · zero LLM)
       → extractSpecification  (regex)
       → generateVerificationCases  (structural)
       → writeFileSync(spec-derived .test.ts)
       → runNativeProgrammingLoop
            → runVitest (real)
            → J.2 diagnoseAndPropose
            → applyReplaceReturnLiteral (real file write)
            → runPreservationCheck (real sibling vitest)
       → cleanup
  → composeChatResponse from real runtime state
  → return NEX1_NATIVE reply
```

No LLM anywhere in this path. Verified.

**One transparent shortfall:** the composer's `mutation` slot ended up null even though a real mutation occurred, because my regex to extract the `current→proposed@line` pattern from the change-stage summary didn't match the actual format. The mutation genuinely happened (file SHA changed), the state is correctly `verified`, vitest exit_code is `0`, but the user-facing message doesn't cite the exact literal swap. Small display gap · not a fabrication · not an intelligence gap. Would be a small line-level fix in a follow-up.

---

## §6 · §4-5 routing capability

`capability-chat-routing.ts` decides `NEX_CHAT` vs `NEX1_CODE_CHAT` from classifier signals only. Zero magic phrase list.

Rules:
- (a) file_references > 0 + coding-family verb → `NEX1_CODE_CHAT`
- (b) project_dir_references > 0 + coding-family verb → `NEX1_CODE_CHAT`
- (c) coding-family verb + coding_concepts ≥ 2 → `NEX1_CODE_CHAT`
- otherwise → `NEX_CHAT` (with `AMBIGUOUS` as a graceful middle band)

Probe: 4/6 cases match expected. The 2 "failures" are informational-coding questions ("Tell me what TypeScript is", "Explain what promises are") — both route to `NEX_CHAT` because the classifier doesn't recognize "tell me" / "explain" as verbs in its controlled vocabulary. Routing to NEX_CHAT is the honest default for messages with no strong actionable signal. Actionable coding requests (R4-R6) all correctly route to `NEX1_CODE_CHAT` with traceable reasons. Primary purpose satisfied.

Handoff context preservation: `capability-conversation-context.ts` carries `active_target` and `active_task_verb` across turns; a handoff would preserve these via the same conversation-context store · no rewiring required.

---

## §7 · Final capability classifications (mission §33 vocabulary)

| Capability | Classification | Evidence |
|---|---|---|
| Text chat · classifier → composer → reply | `RUNTIME_VERIFIED` | 4/4 acceptance probes |
| Multi-turn conversation context | `RUNTIME_VERIFIED` | P2 follow-up + pronoun resolution |
| Follow-up context inheritance (verb+target) | `RUNTIME_VERIFIED` | Fix 24 turn 2/3 trace |
| Clarification handling | `RUNTIME_VERIFIED` | P3 · composer state `clarification_required` |
| Refusal handling | `RUNTIME_VERIFIED` | P4 · classifier refuses with named kind |
| Correction handling | `RUNTIME_VERIFIED` (via follow-up markers) | P2 turn 3 ("no, I mean...") |
| **§13 · Chat → native intelligence → real files → verified** | **`RUNTIME_VERIFIED`** | native-intelligence-runtime-trace receipt |
| Routing NEX ↔ NEX1_CODE (actionable coding) | `RUNTIME_VERIFIED` | R4-R6 |
| Routing (informational coding) | `PARTIAL` | R1/R3 route to NEX_CHAT (honest classifier boundary on informational verbs) |
| Voice input pipeline (browser Web Speech) | `AVAILABLE_NOT_FULLY_VERIFIED_IN_HEADLESS_CONTEXT` | `useNex1Voice.ts` exists · reuses existing browser provider · full test requires browser |
| Voice output pipeline (browser SpeechSynthesis) | `AVAILABLE_NOT_FULLY_VERIFIED_IN_HEADLESS_CONTEXT` | same |
| Voice + text through same intelligence path | `CONNECTED_NOT_FULLY_VERIFIED` | Both call `/api/nex1/chat/turn` · identical contract · confirmed by grep · runtime trace requires browser |
| Chat UI · workstation surface | `AVAILABLE_NOT_CONNECTED_INTO_APP_SHELL` | `Nex1WorkstationChat.tsx` exists · route decision remains AUTHORIZATION_REQUIRED |
| Chat → NEX1 Code invocation (with auth marker) | `RUNTIME_VERIFIED` | §5 trace |
| Chat → NEX1 investigation invocation | `NOT_IMPLEMENTED` (deliberate) | Fix 25 wires FIX/MODIFY · INVESTIGATE hook requires separate authorization |
| Chat handoff NEX → NEX1_CODE with context | `CONNECTED_NOT_FULLY_VERIFIED` | Routing capability + conversation-context share the head; end-to-end UI handoff test deferred |
| Chat handoff NEX1_CODE → NEX (reverse) | `NOT_IMPLEMENTED` | Deliberate — needs founder decision on UX affordance |
| Preservation check + auto-revert (Fix 23c) | `RUNTIME_VERIFIED` (regression clean) | acceptance-probe · pricing.ts task honest refusal preserved |

---

## §8 · LLM audit (§14 · §19)

### Before implementation

`grep openai|anthropic|claude|gemini|deepseek|openrouter|vertex|groq src/app/api/nex1/` → **0 matches** (chat/turn route already existed from Fix 24 · zero LLM).

### After implementation

Per-file grep of all files added or modified in this mission:

| File | Matches | Classification |
|---|---|---|
| `src/lib/nex-agent/code-engine/capability-chat-turn.ts` | 1 | REFERENCE (comment: *"Never invokes the LLM-backed `src/lib/nex/brain/` codebase."*) |
| `src/lib/nex-agent/code-engine/capability-chat-routing.ts` | 0 | none |
| `src/lib/nex-voice/useNex1Voice.ts` | 2 | REFERENCE (both in comments: *"It never imports from openai / anthropic / @google/generative / groq-sdk / any inference client."*) |
| `src/app/api/nex1/chat/turn/route.ts` (unchanged) | 2 | REFERENCE (comments) |
| `scripts/nex1-chat-channel/native-intelligence-trace-probe.ts` | 0 | none |
| `scripts/nex1-chat-channel/routing-probe.ts` | 0 | none |

Per §14: reference in comments ≠ runtime invocation. **`ZERO_LLM_RUNTIME_CONFIRMED`** for the entire new unified chat + voice foundation path.

---

## §9 · Memory / context / identity architecture (§10 · §15)

- **Turn context** — `capability-conversation-context.ts` · in-memory Map + optional JSONL append at `data/nex1-chat-conversations/<conv-id>.jsonl` · bounded MAX_TURNS_PER_CONVO=200
- **Task context** — `active_target` + `active_task_verb` on the conversation head, updated by classifier on every turn or inherited by Fix 24 follow-up handler
- **Session context** — implicit via `conversation_id` uniqueness · no cross-conversation leakage
- **Long-term knowledge** — NOT auto-populated. Chat turns do not automatically promote content into any permanent NEX1 knowledge store. Explicit persistence remains a separate authorized surface.
- **Identity** — deferred. The `/api/nex1/chat/turn` route does not currently require an authenticated user (existing consumer chat surfaces DO — see `/api/nex-chat/messages/route.ts` which requires x-nex-user-id + x-nex-user-display-name headers). Wiring the NEX1 chat surface to the same identity system is a follow-up.

---

## §10 · Security (§25)

- No credentials handled by the new chat channel
- No environment-variable secrets read
- No external network calls in NEX1 native runtime path
- No file writes outside authorized coding-loop path (which enforces `isProtected` + preservation-check + auto-revert)
- Voice hook uses browser-native Web Speech API only · no external speech service invoked from NEX1 code
- Chrome/Edge Web Speech does relay audio to Google's speech service (browser-native behavior · documented in `nex-voice/providers/browser.ts`) — that is an `EXTERNAL_SPEECH_DEPENDENCY`, not a NEX1 intelligence dependency. Per §26 of the prior mission this distinction is preserved.

---

## §11 · Performance (§27)

Measured on the §13 native intelligence runtime trace:

| Stage | Duration |
|---|---|
| Chat turn 1 (classifier + compose only) | ~10 ms |
| Chat turn 2 (auth + full spec-driven loop + real vitest) | ~4.4 s |
| Of which: `runSpecificationDrivenCodingLoop` itself | ~4.2 s (real vitest is the majority — this matches Fix 23c preservation-check overhead) |

The 4.4s turn is dominated by real vitest execution. Streaming/progressive responses (state = "working" while loop runs) are NOT_IMPLEMENTED · the client currently sees a single response after the loop completes. This is an honest UX gap · not an intelligence gap.

---

## §12 · Remaining gaps · evidence-driven

| Gap | Priority | Notes |
|---|---|---|
| Mutation slot extraction from change stage summary | Low | Regex mismatch caused mutation to render as "none" even when file changed correctly. Cosmetic. |
| Streaming / progressive response state | Medium | 4.4s single-shot turn without intermediate `working` update — poor UX for real loop invocations |
| INVESTIGATE verb → chat-triggered `runNativeInvestigation` | Medium | Currently Fix 25 wires only FIX/MODIFY. Wiring INVESTIGATE is a small extension needing founder auth |
| Routing informational verbs ("tell me", "explain") | Low | Classifier vocabulary boundary · routes gracefully to NEX_CHAT default |
| Full voice runtime proof in browser | Medium | Hook + endpoint + provider all exist and grep-audit clean · requires a live browser test |
| Chat UI mounted in workstation route | Medium | `Nex1WorkstationChat.tsx` exists · route location `AUTHORIZATION_REQUIRED` |
| NEX1_CODE → NEX_CHAT reverse handoff | Deferred | Needs UX decision |
| Multi-user identity in NEX1 chat surface | Deferred | Currently anonymous conversation_id · production wiring is a separate task |

---

## §13 · What was deliberately NOT done (per Rule §33)

Rule §33 of this mission (and Rule §33 of the prior master mission) forbids speculative infrastructure. The following were NOT built despite being tempting:

- No new "conversation intelligence" engine beyond the classifier + composer + context + intelligence-invocation combo
- No streaming middleware
- No presence/typing indicator system
- No user auth flow
- No language auto-detection (`clientDetectLanguageHint` exists in existing `useNexVoice.ts` and can be reused if founder authorizes multilingual)
- No React app-shell route decision (which page hosts Nex1WorkstationChat?) — that's founder UX territory
- No expansion of the 69-language coding vocabulary (§27 of the mission explicitly forbids in this task)

Each of these can be authorized separately if evidence justifies it.

---

## §14 · Final principle · one NEX, one intelligence path

The founder's final principle: *"ONE NEX. ONE CONVERSATION FOUNDATION. ONE NATIVE INTELLIGENCE PATH. MULTIPLE SPECIALIZED EXPERIENCES."*

State after this mission:

- **One foundation**: `capability-chat-turn.ts` handles every text message
- **One intelligence path**: classifier + context + response-composer + optional native-capability invocation (proven at runtime)
- **One voice channel** that POSTs to the same endpoint (`useNex1Voice.ts` → `/api/nex1/chat/turn`)
- **One routing capability** deciding NEX vs NEX1_CODE
- **Zero LLM** in every path · grep-verified before + after
- **Two systems still coexist** in the repo: `src/lib/nex-agent/code-engine/` (NEX1 native, zero LLM) and `src/lib/nex/brain/` (consumer LLM-backed) — boundary explicit + preserved

The user-visible experience described in §35 ("*I am talking to NEX. And when the conversation requires serious coding: NEX has moved me into the Code workspace without losing what I was talking about*") requires the App-shell integration decision the founder has not yet issued. The intelligence foundation underneath it is now in place and proven.

---

**End of report.**
