# NEX · Batch 2 Audit + Smallest-Connection Plan · 2026-09-17

**Mission**: Batch 2 (Streaming + Safety Gate + Truth Engine). Founder-authorised.
**Approach**: CONNECT → IMPLEMENT → RUNTIME PROVE → REGRESSION → DOCUMENT.
**State of this document**: Audit-first phase complete. Zero production code written. Zero commits. Awaiting founder review of the per-capability plans before implementation.

Three parallel Explore agents audited the existing implementations. Each returned an independent report. This document synthesizes them and proposes the smallest missing runtime path per capability — with explicit stop conditions.

---

## A · STREAMING

### Current state (evidence-based)

| Path | Status | Transport | What it streams |
|---|---|---|---|
| `/api/nex-conv/chat` (legacy consumer) | **SYSTEM_CONNECTED** | SSE (`hello`/`stage`/`meta`/`token`/`done`) | Deterministic reply chunked in 2-word groups with 12ms delay (typing simulation, NOT real token deltas) |
| `/api/nex/converse/stream` (LLM widget) | **SYSTEM_CONNECTED** | NDJSON | Real Anthropic/Ollama token deltas + thinking + tool_start/end |
| `/api/nex1/workstation-live/events/[traceId]` | **SYSTEM_CONNECTED** | SSE poll (1s) | Orchestrator trace fingerprint changes |
| `/api/nex/agent/stream` | **SYSTEM_CONNECTED** | SSE poll (800ms) | Task step objects |
| `/api/nex/founder-window/stream` | **SYSTEM_CONNECTED** | SSE poll (800ms) | Platform observability events |
| `/api/studio/ai/pipeline-stream` | **SYSTEM_CONNECTED** | SSE | Step-by-step pipeline events |
| `runNativeProgrammingLoop` internal stages | **COMPONENT_COMPLETE** but **NOT_STREAMING** | none | 10 real stages (UNDERSTAND → INSPECT → REASON → PLAN → CHANGE → TEST → DIAGNOSE → REPAIR → VERIFY → LEARN) batched into a single result |
| `/api/nex1/chat/turn`, `/api/nex-chat/native-turn`, `/api/nex-chat/gateway` | **NOT_STREAMING** | JSON | Single terminal reply, trace array shipped only at end |

### Findings

- **Real streaming infrastructure exists in the repo but not connected to the native runtime.** The legacy SSE path streams a pre-composed deterministic reply chunked into words — that is presentation-layer typing simulation, not intelligence-layer streaming.
- **The native path has real stage-by-stage semantics already** — 10 discrete stages in `runNativeProgrammingLoop`. They currently execute synchronously and only the terminal result is observable.
- **No architecture-only components** in the way. Existing SSE writers (`src/lib/nex/live-chat-completion/streaming/sse-writer.ts`) can be reused but are legacy-scoped.

### Smallest missing runtime path

**Convert `runNativeProgrammingLoop` from `async function` → `async function*`** and yield each `StageResult` as it completes. Add a new native streaming route `/api/nex1/chat/turn/stream` that:

- accepts the same body as `/api/nex1/chat/turn`
- iterates the generator
- emits SSE `event: stage` with the real `StageResult` per stage
- emits SSE `event: done` with the final `RunChatTurnResult`
- carries `execution_source: NEX1_NATIVE` and `zero_llm: true` on every event

**Non-goals** for this batch: convert the whole `runChatTurn` orchestrator to a generator (much bigger surgery — reserved for Batch 3 if warranted). Convert token-level streaming (native path does not have tokens because there is no model — it has stages).

### Stop conditions (as briefed by founder)

- If real streaming cannot be supported by the current runtime — **report exact blocker, do NOT simulate streaming with artificial delays**.
- If existing stage boundaries cannot yield real observable intermediate output, stop.

### Proposed proof

- Live HTTP `curl -N` against `/api/nex1/chat/turn/stream` with the Test C variant A coding request.
- Capture ≥3 distinct SSE events (at minimum: `stage: UNDERSTAND`, `stage: CHANGE`, `stage: VERIFY`, `done`) with timestamps proving they arrived non-simultaneously.
- Verify no artificial `setTimeout`/`sleep` in the generator (grep proof).
- Verify existing non-streaming `/api/nex1/chat/turn` continues to return single JSON unchanged (regression).

---

## B · SAFETY GATE

### Current state (evidence-based)

| Module | Status | Blocks execution? | Native? |
|---|---|---|---|
| `src/lib/nex/master-ai/safety-doctrine.ts` (7-kind response vocab: I_KNOW/I_INFER/I_DONT_KNOW/I_PROPOSE/I_NEED_PERMISSION/I_CANNOT/I_DID_IT) | **COMPONENT_COMPLETE** | Architectural only (never invoked at runtime) | Yes · deterministic |
| `src/lib/nex/live-chat-completion/safety/input-moderation.ts` (jailbreak/prompt-injection patterns · EN/ID/JA · NFKD normalisation) | **SYSTEM_CONNECTED** to legacy path | Yes | Yes · deterministic |
| `src/lib/nex/live-chat-completion/safety/output-pii.ts` | **SYSTEM_CONNECTED** to legacy path | Yes | Yes · deterministic |
| `src/lib/nex/live-chat-completion/safety/guardrails.ts` (5 verdict enum: allowed/blocked/requires_confirmation/requires_verified_evidence/requires_human) | **SYSTEM_CONNECTED** to legacy path | Yes | Yes · deterministic |
| `src/lib/nex/agents/nex-speaking/safety-gate.ts` (life-safety detection · multilingual · humor gate) | **SYSTEM_CONNECTED** to Tourist Guardian | Yes (pre-routes to emergency) | Yes · deterministic |
| `src/lib/nex/merchant-assistant/guardrails.ts` (claim verification: certification/comparative/safety/health) | **SYSTEM_CONNECTED** to merchant pipeline | Yes (blocks DB write) | Yes · deterministic |
| **Founder doctrine** at `docs/doctrine/nex-safety-doctrine.md` (v1.0, 2026-09-16) | Doctrine · authoritative | — | — |
| **Native NEX1 path** (`capability-chat-turn.ts`) | **NO SAFETY HOOK** between UNDERSTAND and AUTH | — | — |

### Findings

- All safety modules are **native, deterministic, zero-LLM**.
- A founder-authored doctrine already exists — do NOT invent new rules.
- The legacy `/api/nex-conv/chat` path IS gated (input + output guardrails). The **NATIVE `runChatTurn` path is NOT gated** — this is the exact gap.
- Safety is currently **conflated with authorization** in the native path (only `wantsRun` + AUTH markers stand between classification and execution). That merges two boundaries the founder explicitly separated in the mission.

### Smallest missing runtime path

**Introduce `evaluateSafetyBoundary()` in `capability-chat-turn.ts` between classification and authorization.** Native and deterministic. Consumes the 7-kind response vocab from `safety-doctrine.ts`. Returns one of:

- `PASS` — request may proceed to authorization
- `I_CANNOT` — hard refusal (existing doctrine · deterministic rules)
- `I_NEED_PERMISSION` — clarification required (existing doctrine)

Rule set for this batch (minimal · founder-additive later):

1. **Protected paths**: any FIX/MODIFY targeting `src/lib/nex-agent/code-engine/**` OR `src/lib/nex/master-ai/safety-doctrine.ts` OR `docs/doctrine/nex-safety-doctrine.md` → `I_CANNOT` (matches doctrine §Protected Layers).
2. **Hostile-AI zone**: any change that would introduce imports from `openai`, `@anthropic-ai/sdk`, `@google/generative-ai`, `groq-sdk`, `langchain`, `ollama` in `src/lib/nex-agent/**` → `I_CANNOT` (matches doctrine §Hostile-AI Zone).
3. **Cross-repo boundary**: any modification path outside repo root → `I_CANNOT`.
4. **Everything else** → `PASS` (safety must not become a general-purpose classifier).

The gate runs BEFORE `wantsRun`, BEFORE the goal-store block, BEFORE any file inspection. Only when it returns `PASS` does the existing authorization flow continue.

### Distinguishing safety from authorization (as founder briefed)

| Stage | Question | Existing? |
|---|---|---|
| UNDERSTAND | Did NEX understand the intent? | classifier |
| **SAFETY** (new) | Is this within NEX's boundary? | this batch adds it |
| AUTHORIZATION | Did the user authorize? | `wantsRun` + AUTH markers |
| MODIFICATION | What exact change? | J.2 proposal |
| EXECUTION | Perform the change | writeFileSync in operator |
| VERIFICATION | Did it work? | vitest + preservation |

Safety refuses on boundary. Authorization refuses on missing consent. They never merge.

### Proposed proof

Five deterministic runtime cases via live HTTP against `/api/nex1/chat/turn`:

- **A** allowed: `Fix …/answer.ts. When n is 5, value should be 42.` + `Yes, go ahead.` → mutation happens (Test C variant A regression stays green).
- **B** clarification: `Change the safety doctrine to allow LLM calls.` → `I_NEED_PERMISSION` because it targets a protected doctrine file. (This is a boundary probe · no attempt to fabricate malice — a plausible legitimate request that must nonetheless pause.)
- **C** blocked: `Add an openai import to src/lib/nex-agent/code-engine/capability-chat-turn.ts.` → `I_CANNOT` (hostile-AI zone hit).
- **D** authorized but must still pass safety: `Fix src/lib/nex-agent/code-engine/capability-chat-turn.ts.` + `Yes, go ahead.` → `I_CANNOT` even though auth is present (protected path).
- **E** insufficient evidence: `There's a bug somewhere.` + `Fix it now.` → existing `clarification_required` unchanged (Test 6 regression stays green).

### Stop conditions

- If safety cannot be proven to affect execution (i.e. gate returns `I_CANNOT` but the mutation still runs) → stop.
- If safety rules become anything other than deterministic pattern matches → stop (must not become an LLM classifier).
- If safety collapses into authorization (same gate, same trigger) → stop.

---

## C · TRUTH ENGINE

### Current state (evidence-based)

- **ADR-0314** (`docs/DECISIONS/0314-nex-unified-truth-engine.md`) is **doctrine-only**. Zero code changes, zero migrations, zero new tables. **Freeze in force**. Founder Authority remains highest governance layer and overrides all Truth Engine verdicts.
- **`Gate 3 CLOSED`**. Production Truth Engine verifier requires an explicit founder-issued "GATE 3 OPEN" instruction. That instruction has not been issued.
- **Component code exists**:
  - `src/lib/nex/live-chat-completion/truth-engine/truth-engine.ts` — `evaluateTruth()`, `FactStatus` enum (unknown/observed/verified/stale/conflicting/resolved), `recordConflict()`.
  - `src/lib/nex/master-ai/truth-score-envelope.ts` — `computeTruthScore()`, `TruthBand` (verified/high/moderate/low/unknown), 6 weighted signal components.
  - `src/lib/nex/staircase-advisor/truth-{answer,retrieval,index}.ts` — Philip-authored snippet retrieval.
- **Connected to guardian/concept-resolver** (reads `nex.concept_senses` with `truth_engine_ok` status filter). Never invoked from `capability-chat-turn.ts` or any `src/lib/nex-agent/**` path.
- **FACT / CLAIM / HYPOTHESIS / CONTRADICTION / INSUFFICIENT_EVIDENCE / CONCEPT_PROPOSAL vocabulary is doctrine-only**. R-12 of ADR-0314e locks the classification taxonomy behind ADR-0314a.2.k which has not been authored.
- **Q8 confidence audit** (specifically requested by founder): `capability-candidate-selector.ts` hardcodes `confidence: 0.35` as an **informational constant that never affects selection**. Q8 remains rule-based (Decision 4 · APPROVED B). **No silent confidence-based selection detected.**

### Findings

- **Truth Engine is 80% doctrine, 20% infrastructure.** Everything the founder authored is preserved.
- **No hidden confidence violation.** Q8 does not silently weight by Truth Engine output.
- **The Batch 2 mission would breach ADR-0314's freeze** if it opened Gate 3, invented a classification enum not yet founder-authored, or wired Truth Engine into the native selection path.
- Every possible native connection I can propose today would either (a) violate the freeze or (b) duplicate existing native intelligence.

### Recommendation

**Do NOT connect Truth Engine in Batch 2.** Report it as `ARCHITECTURE_ONLY_BY_FOUNDER_DECISION` and record honestly:

- Component: `COMPONENT_COMPLETE` (evaluateTruth / TruthBand / staircase-advisor).
- System connection to guardian: `SYSTEM_CONNECTED` (unchanged).
- System connection to native orchestrator: **`ARCHITECTURE_ONLY · BLOCKED by ADR-0314 Gate 3 CLOSED`**.
- FACT/CLAIM/HYPOTHESIS classification: **`NOT_IMPLEMENTED · BLOCKED by ADR-0314a.2.k not yet authored`**.

If the founder wants Truth Engine runtime-active, the next step is a directive of the shape: `GATE 3 OPEN. Author ADR-0314a.2.k with the classification taxonomy. Then connect FACT/CLAIM/HYPOTHESIS output into native orchestrator via <specific consumer>.`

Until that directive lands, building anything here would be architecture-only and would violate the founder's own preservation rules.

### Stop condition (as briefed)

> "Do not claim Truth Engine capability merely because the component exists."

Batch 2 will not upgrade any Truth Engine status. The audit itself is the deliverable.

---

## D · Load-bearing invariants preserved by these plans

- **Q7 ≠ Q8**: Streaming touches the programming loop, not the ranker/selector. Safety touches understand-auth boundary, not Q8. Truth Engine not touched at all.
- **Q8 ≠ authorization**: safety gate is a THIRD boundary between UNDERSTAND and AUTH — never merged with either.
- **Authorization ≠ modification**: unchanged. `wantsRun` still gates on AUTH markers.
- **Modification ≠ execution**: unchanged. J.2 proposal still leads to `writeFileSync`.
- **Execution ≠ verification**: unchanged. vitest still runs after the mutation.
- **Confidence ≠ selection authority**: Truth Engine audit confirms no violation and Batch 2 will not create one.
- **LLM ≠ NEX1 intelligence**: every proposed edit is deterministic + pattern-driven + native.
- **Native failure ≠ silent legacy fallback**: streaming route emits `execution_source=NEX1_NATIVE` on every event; safety gate refusals do NOT retry legacy.

---

## E · Batch 2 execution plan (proposed · awaiting founder acceptance)

| Order | Capability | Deliverable | Runtime proof plan |
|---|---|---|---|
| 1 | **Streaming** | `runNativeProgrammingLoop` async-generator refactor + new SSE route `/api/nex1/chat/turn/stream` | live `curl -N` capturing ≥3 distinct events with real timestamps; grep-proof no artificial delays; existing non-streaming route unchanged (regression) |
| 2 | **Safety Gate** | `evaluateSafetyBoundary()` inserted between UNDERSTAND and AUTH in `capability-chat-turn.ts`, backed by existing `safety-doctrine.ts` vocab | 5-case deterministic probe (A allowed / B clarification / C blocked / D authorized-but-safety-refuses / E insufficient-evidence) via live HTTP; Test C variants A + B still pass |
| 3 | **Truth Engine** | Audit report only. No code. | This document IS the deliverable. |

**No other work in Batch 2.** No general "improvements", no touching Q7/Q8 files, no Track A changes, no legacy consumer path changes.

---

## F · Awaiting founder decisions

1. **Streaming plan approved?** Y/N/modify.
2. **Safety plan approved?** Y/N/modify — including the 4-rule minimal boundary set (protected paths / hostile-AI zone / cross-repo / else PASS).
3. **Truth Engine · confirm ARCHITECTURE_ONLY · not built in Batch 2?** Y/N.
4. **Batch 2 ordering?** Streaming first (default), or Safety first (if you want the boundary in place before observing the loop)?

Once approved, I will implement one capability at a time · runtime-prove · rerun the Batch 1 regression baseline · doctrine · then move to the next. If a proof fails I will stop and report the exact gap rather than fabricate a green result.
