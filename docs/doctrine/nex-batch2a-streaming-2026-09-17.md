# NEX · Batch 2A · Native Streaming · Closure Doctrine · 2026-09-17

**Status.** Runtime-proven. 21/21 verdicts pass. Regression clean in scoped nex-agent/code-engine (1991/1991).

**Scope.** The smallest connection required to expose the native NEX1 runtime's real stage-by-stage progress over the wire without simulating streaming.

**Not in scope.** Token-level streaming (the native path has no model tokens). Streaming the classifier itself (fast · sub-ms · not observable). Refactoring the entire orchestrator into a generator (deferred until warranted).

---

## 1. What changed

| File | Change |
|---|---|
| `src/lib/nex-agent/code-engine/native-programming-loop.ts` | Added `onStage?: (s: StageResult) => void` to `NativeLoopInput`. Monkey-patched `stages.push` in BOTH vitest-mode and tsc-mode functions so every real StageResult fires the observer without touching 65 push sites. Fire-and-forget: thrown observer errors are swallowed so the loop never halts. |
| `src/lib/nex-agent/code-engine/capability-specification-driven-loop.ts` | Added `onStage?` to input; forwards to `runNativeProgrammingLoop`. |
| `src/lib/nex-agent/code-engine/capability-chat-turn.ts` | Introduced `ChatTurnEvent` discriminated union (11 kinds); added `onEvent?` to `RunChatTurnInput`; emit at every real observable boundary (classifier / follow_up_synthesis / pending_goal_stored / recall_dispatch / authorization / coding_loop_start / coding_loop_stage / coding_loop_done / investigation_start / investigation_done / composer). |
| `src/app/api/nex1/chat/turn/stream/route.ts` (new) | SSE route. Sets `Content-Type: text/event-stream`, `X-Nex-Execution-Source: NEX1_NATIVE`, `X-Nex-Zero-LLM: true`. Wires `onEvent` to write SSE frames. Emits terminal `event: done` with the full `RunChatTurnResult`. Emits `event: error` on failure — never falls back to legacy path. |

**Untouched.** `/api/nex1/chat/turn` (non-streaming) · `/api/nex-chat/gateway` · `/api/nex-chat/native-turn` · Fix 15/16/17 files · Track A · nex-debugger · consumer legacy path · pricing.ts.

---

## 2. Runtime evidence

`scripts/batch2a-streaming-probe.mjs` executed against `http://localhost:3008/api/nex1/chat/turn/stream`.

**Turn 1 · state coding problem (no auth):** 5 events observed — `hello`, `classifier`, `pending_goal_stored`, `composer`, `done`. All at +0-1ms (no coding loop invoked, fast path is genuinely fast).

**Turn 2 · authorize (triggers full coding loop):** 18 events over 4795ms with genuine time-spread:

| Event | Arrival | Notes |
|---|---|---|
| `hello` / `classifier` / `follow_up_synthesis` / `authorization` / `coding_loop_start` | +0ms | Synchronous prefix work |
| `coding_loop_stage: understand` (VERIFIED) | +1ms | Spec extraction |
| `coding_loop_stage: inspect` (VERIFIED) | **+2442ms** | Real vitest baseline run |
| `coding_loop_stage: reason` / `plan` / `change` (VERIFIED) | +2442ms | Synchronous JS after inspect await |
| `coding_loop_stage: test` (VERIFIED) | **+4795ms** | Real second vitest run |
| `coding_loop_stage: diagnose` / `repair` (SKIPPED) / `verify` / `learn` (VERIFIED) | +4795ms | Synchronous JS after test await |
| `coding_loop_done` / `composer` / `done` | +4795ms | Terminal |

The 2441ms and 2353ms gaps are **real vitest execution boundaries**, not artificial delays. Fixture SHA changed: `32aaedfe26b1b09a` → `84a6c730c2f55876` (real mutation on line 4).

**Anti-simulation grep clean:** zero `setTimeout`/`setInterval`/`sleep`/`delay(...)` calls in the new code (stream route + Batch 2A additions in chat-turn + native-loop).

**Regression:** non-streaming `/api/nex1/chat/turn` returns identical shape (verified Turn 2 · state=verified · mutation `41→42@line4`).

Evidence: `data/nex-native-migration/batch2a-streaming-trace.json`.

---

## 3. Honest limitations

- **Stages within a synchronous batch share a timestamp.** Between two `await` boundaries, several stages emit at the same physical moment because there is no yielding to the event loop between them. The timestamps ARE honest — they reflect when the code physically ran — but callers should not infer that stages inside a batch happened one at a time. This is real streaming with real boundaries, not per-line streaming.
- **The `hello` frame is a connection-open acknowledgement, not a NEX1 stage.** It exists to help clients confirm the stream opened. It is labelled as such and carries `streaming_version` in its data. This is not a fabricated intelligence event.
- **The 10 stages themselves are not proof of complete intelligence.** They are the current native workflow. Whether each stage is doing meaningful native work is measurable NOW (via the events we just wired) but is a separate question from streaming.
- **No headed browser test yet.** UI updates on stage events would require wiring the `Nex1WorkstationChat` component to `EventSource(/api/nex1/chat/turn/stream)`. Deferred.

---

## 4. Invariants preserved

- Zero LLM in the new code (grep on the added files: 0 imports of openai/anthropic/@google/generative/groq-sdk/ollama).
- Every SSE frame carries `execution_source: NEX1_NATIVE` + `zero_llm: true`.
- No silent fallback: a `runChatTurn` exception emits `event: error` and closes; the route does NOT call any legacy path.
- Existing non-streaming route byte-for-byte unchanged in behaviour.
- pricing.ts SHA `150158baa3b0274a` byte-identical.
- Q7 / Q8 / authorization / modification / execution / verification boundaries unchanged.

---

## 5. Batch 2A status

`RUNTIME_VERIFIED` (via HTTP + genuine event timestamps + real mutation observed).

Batch 2B (Safety Gate) is next in the founder's authorized order. Awaiting confirmation to proceed.
