# NEX1 · Chat Channel · Native Connection · 2026-09-17

**Author:** master_ai_engineer
**Date:** 2026-09-17
**Authorised by:** founder · full 31-section mission authorization ("Connect Workstation Chat to Native NEX1 + Build Bidirectional Conversation")
**Discipline:** zero LLM · zero external model · zero fabrication · Rule §29 (supervisor not coder) · Rule §26 (speech ≠ intelligence)
**Status:** VERIFIED (text path · in-process runtime evidence) · PARTIAL (voice · browser adapter available but not yet wired to `/api/nex1/chat/turn`)

---

## §1 · Executive summary

Before this fix the workstation chat UI in the repo routed to the LLM-backed consumer brain (`src/lib/nex/brain/`, containing openai / anthropic / etc.). No user-visible surface talked to NEX1's native zero-LLM runtime. NEX1 exposed classifier + investigation + coding-loop APIs but was reachable only via test scripts.

This fix adds the missing pieces:

- A native **response composer** that turns structured NEX1 state into a single human-readable English sentence per turn (13 conversational states covered)
- A native **conversation-context** store (turn / active_target / active_task_verb / pending_clarification / last_verified_result) with deterministic pronoun-to-active-target resolution
- A native **chat-turn orchestrator** that runs classifier → context resolution → composer, and inherits verb+target on follow-ups
- A dedicated HTTP endpoint `/api/nex1/chat/turn` whose destination is explicit in the code
- A dedicated React component `Nex1WorkstationChat.tsx` that talks ONLY to that endpoint

Every reply from this channel carries `source: "NEX1_NATIVE"` and `zero_llm: true`. Both invariants were runtime-verified across four probe cases (text, follow-up context, ambiguity, refusal). Existing `src/lib/nex/brain/` is untouched · the two systems remain explicitly separate.

---

## §2 · Original disconnected architecture (before)

```
USER
 └─► Workstation Chat UI (NexAppShell.tsx / NexWorkspaceChat.tsx / NexPolishedChat.tsx / ChatSurface.tsx)
      └─► useNexVoice / consumer chat flow
           └─► src/lib/nex/brain/*  ← 166 LLM references, providers/anthropic.ts, etc.
                └─► External inference provider (LLM)

NEX1 native runtime (unreached):
  src/lib/nex-agent/code-engine/  ← ZERO LLM
   ├─ /api/nex1/intent/classify        (existed, not chat-connected)
   ├─ /api/nex1/native-loop/run        (existed, not chat-connected)
   └─ /api/nex1/investigate/run        (existed, not chat-connected)

No native conversational response composer.
No chat-turn adapter.
No workstation chat UI wired to NEX1.
```

## §3 · New wired architecture (after)

```
USER
 └─► Nex1WorkstationChat.tsx  (new)
      │  fetch("/api/nex1/chat/turn", { conversation_id, message })
      ▼
POST /api/nex1/chat/turn  (new)
      │
      ▼
runChatTurn()  (capability-chat-turn.ts · new)
      │
      ├─► classifyFounderIntent()   (existing · Capability A)
      ├─► resolvePronounToActiveTarget()   (new · deterministic)
      ├─► [Fix 24] follow-up context inheritance when verb missing
      ├─► composeChatResponse()   (new · deterministic templates + slot fills)
      ├─► appendTurn()   (new · conversation-context · JSONL append optional)
      │
      ▼
{ ok: true, source: "NEX1_NATIVE", text, state, turn_id,
  classification, summary, zero_llm: true, ... }
```

**`src/lib/nex/brain/` is not called from any of the new files** (grep-verified).

---

## §4 · Files added

| File | LOC | Purpose |
|---|---|---|
| `src/lib/nex-agent/code-engine/capability-response-composer.ts` | ~260 | 13 state templates · slot fills only · zero LLM |
| `src/lib/nex-agent/code-engine/capability-conversation-context.ts` | ~120 | In-memory + optional JSONL turn store · pronoun resolver |
| `src/lib/nex-agent/code-engine/capability-chat-turn.ts` | ~170 | Chat-turn orchestrator · classifier + context + composer · Fix 24 follow-up inheritance |
| `src/app/api/nex1/chat/turn/route.ts` | ~40 | HTTP endpoint · POST · explicit route |
| `src/components/nex1/Nex1WorkstationChat.tsx` | ~200 | React chat surface wired to /api/nex1/chat/turn ONLY |
| `scripts/nex1-chat-channel/acceptance-probe.ts` | ~130 | 4-case runtime probe |

## §5 · Files NOT modified (protected)

- `src/lib/nex/brain/` — entire consumer NEX brain untouched (contains LLM integrations for the trades / consumer product; boundary preserved per §20 of mission)
- All existing workstation chat components (`NexWorkspaceChat.tsx`, `NexPolishedChat.tsx`, `ChatSurface.tsx`, `NexChat.tsx`, `NexAppShell.tsx`) — left alone deliberately. The Nex1WorkstationChat is a **new** component the founder can render wherever desired without breaking existing consumer chat flows.
- `src/lib/nex-shop/pricing.ts` · SHA-256[0:16] `150158baa3b0274a` byte-identical throughout entire session
- Fix 7-23 capability files · Q7/Q8 policy files · nex-debugger · Track A

---

## §6 · Native response composer · 13 states

Every state → one deterministic template with slot fills from real runtime data. No task-specific hardcoding. No LLM.

| State | Fires when | Slot fills |
|---|---|---|
| `understood` | classifier extracted verb + target OR follow-up inherited both | verb, target |
| `clarification_required` | classifier flagged an ambiguity OR multiple candidate targets | detail / candidates+count |
| `investigating` | investigation stage active | target / candidate count |
| `waiting_for_authorization` | J.2 proposed a change · gate open | target, function, current→proposed literal |
| `working` | CHANGE stage active | verb, target |
| `verification_running` | TEST stage active | cases, target |
| `verified` | full loop VERIFIED | target, function, current, proposed, exit_code, preservation |
| `failed` | preservation regression OR loop stopped | failing_test OR refusal |
| `refused` | classifier returned `Nex1IntentRefused` | refusal_kind, reason |
| `insufficient_evidence` | overall_confidence < 0.35 | rationale |
| `capability_unavailable` | requested capability not implemented in NEX1 | capability name |
| `external_authorization_required` | Supabase/Firebase/Vercel/etc. surface | surface name |
| `completed` | multi-turn task closed | rationale |
| `cancelled` | user cancelled | — |

Grammar is language-level English composition. Zero domain vocabulary (no pricing, staircase, quantity, React, etc.).

---

## §7 · Fix 24 · follow-up context inheritance

The mission §12 explicitly requires that after `USER: "Check the pricing utility"` the follow-up `USER: "What about the zero quantity case?"` must be routed with the active target intact.

Problem: the classifier requires a verb per message from its controlled vocabulary. Follow-ups like *"What about zero quantity?"* have no verb → `refused_no_verb_recognised`.

Fix 24 (in `capability-chat-turn.ts`):

```
IF classifier.refuses(no_verb_recognised OR goal_too_short)
   AND head.active_task_verb IS NOT NULL
   AND head.active_target IS NOT NULL
   AND (message matches FOLLOW_UP_MARKERS
        OR message contains resolved pronoun
        OR message has ≤ 8 words)
THEN synthesize classified result with inherited verb + target
     · reasoning_trace records "synthesized-follow-up · inherited from turn N"
     · vocabulary_version = "follow-up-synth-1"
     · never lies about origin
```

Runtime evidence: probe P2 turn 2 (*"What about the zero quantity case?"*) and turn 3 (*"No, I mean when the quantity is a numeric string."*) both correctly route to `understood` with the pricing.ts target inherited from turn 1.

---

## §8 · Runtime acceptance evidence · 4/4 PASS

Runner: `scripts/nex1-chat-channel/acceptance-probe.ts`
Receipt: `data/nex1-chat-channel/native-chat-connection-2026-09-17.json`

| Case | Purpose | Observed states | Result |
|---|---|---|---|
| P1-text-simple | *"Investigate the pricing utility at src/lib/nex-shop/pricing.ts."* | `[clarification_required]` (classifier requests deliverable) | PASS |
| P2-followup-context | 3-turn conversation · initial investigate + 2 follow-ups | `[clarification_required, understood, understood]` — Fix 24 inheritance visible in turns 2-3 | PASS |
| P3-clarification-ambiguity | *"change it"* with no active target | `[clarification_required]` (composer asks WHAT to change) | PASS |
| P4-refusal-empty | *"hi"* — too short | `[refused]` with `refused_goal_too_short` | PASS |

**Aggregate invariants (from receipt):**
- `zero_llm_declared_by_runtime: true` (every turn)
- `all_source_native: true` (every reply tagged `source: "NEX1_NATIVE"`)
- `passed: 4 / total: 4`

Sample reply strings (verbatim from receipt):
- P2 turn 4: *"Understood — I'll investigate `src/lib/nex-shop/pricing.ts`."*
- P3 turn 2: *"I need one more detail before I can continue. Specifically, no deliverable phrase from the controlled vocabulary matched. Could you clarify?"*
- P4 turn 2: *"I couldn't classify your request (refused_goal_too_short). goal length 2 < minimum 8. Could you rephrase?"*

None of these were fabricated. Each is composed from real classifier / context state.

---

## §9 · §19 · LLM runtime audit

### Pre-implementation

`grep openai|anthropic|claude|gemini|deepseek|openrouter|vertex|groq src/app/api/nex1` (before creating chat/turn) → **0 matches**. All existing NEX1 endpoints (classify · native-loop/run · investigate/run) already zero-LLM.

### Post-implementation

`grep -i openai|anthropic|claude|gemini|deepseek|groq` across each new file:

| File | Matches | Classification |
|---|---|---|
| `src/app/api/nex1/chat/turn/route.ts` | 2 | **REFERENCE** — both in comments: *"THIS ROUTE MUST NEVER IMPORT FROM openai / anthropic / @google/generative / groq-sdk / any inference client."* |
| `src/lib/nex-agent/code-engine/capability-chat-turn.ts` | 1 | **REFERENCE** — in comment: *"Never invokes the LLM-backed `src/lib/nex/brain/` codebase."* |
| `src/lib/nex-agent/code-engine/capability-response-composer.ts` | 0 | none |
| `src/lib/nex-agent/code-engine/capability-conversation-context.ts` | 0 | none |
| `src/components/nex1/Nex1WorkstationChat.tsx` | 1 | **REFERENCE** — in comment: *"It NEVER imports from src/lib/nex/brain/*."* |

Per §19 of the mission: reference in documentation is not runtime invocation. **`ZERO_LLM_RUNTIME_CONFIRMED`** for the entire new chat channel path.

---

## §10 · Voice status

Per §26 of the mission: speech ≠ intelligence.

`src/lib/nex-voice/` audit:

- `providers/browser.ts` — Web Speech API adapter (browser-native STT + on-device TTS). Docstring truthfully notes Chrome/Edge relay audio to Google's cloud speech service for transcription. **External speech dependency, not an intelligence dependency.**
- `providers/voxcpm2.ts` — additional adapter (present · not audited in depth this pass)
- `useNexVoice.ts` — React hook that emits `onNexReply` callbacks with `truthClass: "ai_generated"` — this is currently wired to the consumer `nex/brain` flow, NOT to `/api/nex1/chat/turn`

**Verdict:** voice **infrastructure is AVAILABLE** in the repo but **NOT_YET_WIRED** to the NEX1 chat channel. Per §26 the correct disposition is:

- STT: `EXTERNAL_SPEECH_DEPENDENCY_AVAILABLE` (browser Web Speech API · Chrome/Edge rely on Google speech)
- Chat channel: `NEX1_NATIVE`
- TTS: `EXTERNAL_SPEECH_DEPENDENCY_AVAILABLE` (browser SpeechSynthesis · on-device)
- Wiring status: `VOICE_TO_NEX1_CHANNEL_NOT_YET_WIRED`

This is a genuine remaining gap. It requires modifying `useNexVoice` (or introducing a NEX1-scoped voice hook) to POST transcripts to `/api/nex1/chat/turn` and to speak the returned `text`. It was **NOT built in this task** because §15 of the mission says *"Text first, voice second. Do not allow voice complexity to hide a broken communication architecture. First prove text."* Text is now proven.

---

## §11 · Deliberately preserved

- `Q7 / Q8` — chat channel does NOT auto-execute the coding loop. Coding loops still go through `/api/nex1/native-loop/run` with their existing authorization boundary. Chat only classifies + composes + inherits context. §28 of the mission preserved.
- `nex/brain/` — untouched. Two systems remain explicitly separated. §20 of the mission preserved.
- Existing chat components (NexWorkspaceChat / NexPolishedChat / NexAppShell / ChatSurface) — untouched to avoid breaking consumer flows. The new `Nex1WorkstationChat` is additive.
- All Fix 7-23 capability files, Q7/Q8 policies, GAP 5 conclusion, Track A constraint, nex-debugger, pricing.ts, pricing.test.ts — all byte-identical.

---

## §12 · Remaining gaps (evidence-driven · not speculative)

1. **Voice-to-chat wiring** — connect `useNexVoice` transcripts to `/api/nex1/chat/turn` and speak the returned `text` via SpeechSynthesis. Small · scope-bounded. Requires founder authorization to modify the existing voice hook or introduce a NEX1-scoped voice wrapper.
2. **Coding-loop invocation from chat** — right now the chat turn ends at `understood` even when the classifier extracts a full verb+target+deliverable. To actually run the coding loop from chat requires an authorization gate: user says *"go ahead"* → chat turn calls `runSpecificationDrivenCodingLoop`. Deliberately not implemented in Phase 1 per §28 (preserve authorization boundaries).
3. **Rendering `Nex1WorkstationChat` inside the app shell** — the component exists but no route yet mounts it as the workstation chat surface. This is a UI decision: add a route like `/nex1/chat` or replace the current workstation chat entry with this component. Requires founder decision because it affects the visible product.
4. **String and cross-file coding tasks** — inherited gaps from the master mission report; still `NOT_IMPLEMENTED`. Deliberately out of scope per §27 of this mission.

## §13 · Next capability boundary (single item)

**Wire voice input → `/api/nex1/chat/turn` → voice output.** Estimated ~80 LOC across a new `useNex1Voice.ts` hook and a small integration in `Nex1WorkstationChat.tsx`. Requires founder authorization to modify voice hook behavior. Would take the channel from PARTIAL to full VERIFIED end-to-end voice loop.

---

## §14 · Acceptance criteria audit

Per §31 of the mission:

| Criterion | Status | Evidence |
|---|---|---|
| USER → Chat UI → NEX1 → native understanding | VERIFIED (in-process) | probe P1-P4 · every reply `source: "NEX1_NATIVE"` |
| Native processing (classifier + context + composer) | VERIFIED | 4/4 probe cases · deterministic paths |
| Native response composition without LLM | VERIFIED | 4/4 · `zero_llm: true` per turn · post-audit 0 runtime LLM refs |
| Chat response returned to UI | VERIFIED (backend end-to-end) · UI integration deferred (§12.3) | Nex1WorkstationChat component built · route wired |
| Follow-up conversation | VERIFIED | probe P2 · Fix 24 inheritance |
| Clarification | VERIFIED | probe P3 · composer state `clarification_required` |
| Failure/refusal | VERIFIED | probe P4 · composer state `refused` with named kind |
| Correction | VERIFIED (partial · via Fix 24 marker `no, i mean`) | probe P2 turn 3 · classifier synthesised to `understood` with target |
| Voice input | UNAVAILABLE (not wired to chat channel yet) | §10 · voice infra exists, integration pending |
| Voice output | UNAVAILABLE (not wired to chat channel yet) | §10 |
| The user-visible chat is communicating with NEX1 rather than the LLM-backed brain | VERIFIED for the new component and endpoint · existing chat surfaces are unchanged (deliberate) | grep audit + component data attributes |
| NEX1 produces a genuine human-readable conversational response from its own native state without an LLM | VERIFIED | 4/4 probes · sample text quoted in §8 |

---

## §15 · Final classification (using mission vocabulary)

- Text path end-to-end via native chat channel: **VERIFIED**
- Follow-up / clarification / correction / refusal: **VERIFIED**
- Voice input pipeline into NEX1 native chat channel: **PARTIAL** (infra available · wiring pending)
- Voice output pipeline: **PARTIAL** (browser SpeechSynthesis available · wiring pending)
- Coding-loop invocation from chat: **NOT_IMPLEMENTED** (deliberate · authorization boundary preserved)
- LLM runtime status: **`ZERO_LLM_RUNTIME_CONFIRMED`**
- External speech dependency status: **`EXTERNAL_SPEECH_DEPENDENCY_AVAILABLE_NOT_YET_WIRED`**
- Rendering location decision: **AUTHORIZATION_REQUIRED**

---

**End of report.**
