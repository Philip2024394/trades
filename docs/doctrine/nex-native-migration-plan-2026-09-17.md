# NEX · Native Chat Progressive Migration & Capability Parity · Plan

**Author:** master_ai_engineer (supervisor · §18)
**Date:** 2026-09-17
**Authorised by:** founder · Option C · Progressive Native Migration Mission
**Discipline:** evidence-driven inventory · zero speculation · no wholesale cutover · zero silent LLM fallback · one shared `ConversationHead` remains the single conversation-state authority

---

## §0 · What this document is (and is not)

This is the **inventory + gap map + migration plan** the founder directed for Option C. It is NOT a capability migration itself. Per founder §10: *"Migration must be capability-by-capability."* This session's scope was §3 inventory + §4 classification + §5 immediate-migration analysis + §6 native registry + §7 gateway design (documented) + §17 priority ordering.

No consumer capability was migrated this session. No Qwen removal. No wholesale cutover.

The three evidence files supporting this doc are:
- `data/nex-native-migration/consumer-capability-inventory-2026-09-17.json`
- `data/nex-native-migration/native-capability-registry-2026-09-17.json`
- `data/nex-native-migration/gap-map-and-priority-2026-09-17.json`

---

## §1 · Inventory summary (per §3)

**Consumer NEX system audit:**

| Layer | Count / evidence |
|---|---|
| Primary entry route | `/api/nex-conv/chat/route.ts` (80+ imports · orchestrateChatTurn/Live @ orchestrate.ts:1390, 2515) |
| Brain modules (non-test) | **118 files** in `src/lib/nex/brain/` |
| Live-chat-completion subsystems | ~20 (actions · conversation-brain · files · governors · image-gen · isp-status · knowledge factory · llm-rescue · memory · question-factory · retrieval · safety · semantic · streaming · truth-engine · vision · voice · web-acquisition) |
| Domain adapters | **9** (accommodation · attractions · business · **code** · food · markets · transport · travel · thin-adapter-factory) |
| Consumer LLM providers | 4 (anthropic · ollama · stub · image-normalize). `providers/anthropic.ts` has 41 grep signatures. `providers/ollama.ts` = local Qwen 2.5 3B per route.ts:4-5. |
| Data adapters | 5 (filesystem · postgres · supabase · open-directory · whatsapp) |

**Native NEX1 system registry:**

| Native capability | Status |
|---|---|
| Unified `ConversationHead` state | RUNTIME_VERIFIED |
| `runChatTurn` orchestrator | RUNTIME_VERIFIED |
| Intent classifier (Capability A) | RUNTIME_VERIFIED |
| Conversation intents (bind · recall · thread · decision · definition · anchor-kind) | RUNTIME_VERIFIED |
| Chat routing (NEX ↔ NEX1) | RUNTIME_VERIFIED for actionable coding |
| Response composer (24 states) | RUNTIME_VERIFIED |
| Native investigation | RUNTIME_VERIFIED |
| Spec-driven coding loop | RUNTIME_VERIFIED |
| Data-flow tracer | RUNTIME_VERIFIED |
| Repository discovery / File memory | RUNTIME_VERIFIED |
| Voice hook (browser Web Speech) | CONNECTED_NOT_FULLY_VERIFIED (browser test blocked) |

**LLM audit:** `ZERO_LLM_RUNTIME_CONFIRMED` for the native path · `LLM_BACKED` for the consumer path (both remote anthropic + local Qwen/Ollama · both count as LLM per founder's absolute rule).

---

## §2 · Classification of every consumer capability (per §4)

Full per-capability records live in `consumer-capability-inventory-2026-09-17.json`. Summary counts:

| Classification | Count |
|---|---|
| `NATIVE_ALREADY_AVAILABLE` (or `DUPLICATED_IN_NEX1_NATIVE`) | 2 (code · voice) |
| `PARTIALLY_AVAILABLE_IN_NATIVE` | 5 (session · personality-voice · conversational-frame · voice-intent-selector · conversation-brain-state) |
| `NATIVE_MIGRATION_REQUIRED` | 6 (orchestration · knowledge-retrieval · claim-verification · safety · truth-engine · streaming) |
| `LEGACY_LLM_DEPENDENT` | 8 domain adapters (accommodation · food · transport · markets · travel · attractions · business · staircase) + llm-rescue + live-discovery |
| `EXTERNAL_SERVICE_REQUIRED` | 3 (vision · image-gen · web-acquisition) |
| Data adapters (not intelligence) | 5 (postgres · supabase · filesystem · whatsapp · open-directory) |

**The eight domain adapters + llm-rescue are the primary consumer LLM surface area.** They are REAL product features (accommodation search, food discovery, staircase design intake, etc.) that would need per-domain native replacements before Qwen can be retired.

---

## §3 · What can migrate immediately (per §5)

**Batch 1 · Low-risk unification · IMMEDIATE candidates** (§17 priorities 1-5):

1. **`code` capability** — NEX1 native already provides zero-LLM equivalent (`runSpecificationDrivenCodingLoop` etc.). The consumer `code-adapter.ts` is redundant with NEX1. **Retire consumer code path when consumer UI wired to native.**
2. **`conversation-state / session`** — parallel implementations. Consumer `nex/brain/session.ts` + `live-chat-completion/conversation-brain` overlap with native `capability-conversation-context.ts`. Adapter can translate consumer session shape ↔ `ConversationHead`.
3. **`voice-intent-selector`** — native `capability-a-founder-intent` covers coding intents. Consumer domains need vocabulary expansion but are separate work.
4. **`conversational-frame`** — native threads on `ConversationHead` are structurally equivalent to consumer "frame". Adapter is trivial.
5. **`shadow-mode`** — already deterministic in consumer · pattern is compatible with native composer.

**None of the above require touching the 8 domain adapters. They can be migrated without loss of consumer product functionality.**

---

## §4 · Native Capability Registry (§6)

Registry structure documented in `native-capability-registry-2026-09-17.json`. Every entry carries:

- `capability_id` (dotted namespace)
- `name`
- `intent`
- `native_implementation` (file path)
- `public_functions` (list)
- `evidence_requirements`
- `authorization_requirements`
- `verification_method`
- `status` (RUNTIME_VERIFIED / CONNECTED_NOT_FULLY_VERIFIED / etc.)
- `provenance` (mission that introduced it)

**14 native capabilities enumerated** · 13 `RUNTIME_VERIFIED` · 1 `CONNECTED_NOT_FULLY_VERIFIED` (voice · browser test blocked).

The registry is the truth source for "what NEX1 can do natively today." Every migration adds to this registry with runtime evidence. Nothing gets added without evidence.

---

## §5 · Native Gateway Design (§7)

Per §7 the gateway is a **deterministic transport + contract-adaptation layer**, NEVER a second intelligence system.

**Proposed component (documentation only · not built this session):**

```
                    Consumer NEX Chat UI (NexAppShell.tsx et al.)
                             │
                             ▼
              ┌──────────────────────────────────┐
              │   NEX Conversation Gateway       │  ← proposed new module
              │   (transport + adaptation only)  │
              │                                  │
              │   · session_id normalisation     │
              │   · request-shape adaptation     │
              │   · capability lookup            │
              │   · route decision:              │
              │        native → runChatTurn      │
              │        consumer-legacy →         │
              │           /api/nex-conv/chat     │
              │   · response-shape adaptation    │
              │   · execution-source labeling    │
              │     (NEX1_NATIVE vs              │
              │      LEGACY_QWEN)                │
              └──────────────┬───────────────────┘
                             │
                    ┌────────┴────────┐
                    ▼                 ▼
             runChatTurn         orchestrateChatTurn
             (native · zero LLM) (legacy · Qwen/Ollama)
                    │                 │
                    └────────┬────────┘
                             ▼
                   ONE ConversationHead
                   (single conversation-state authority)
```

**Gateway invariants (must-hold):**
- The gateway MUST NOT contain LLM reasoning, hidden fallback, duplicated conversation memory, duplicated reference resolution, or duplicated coding intelligence
- The gateway MUST record actual `execution_source` (never claim `NEX1_NATIVE` when consumer route was invoked)
- The gateway MUST use the same `ConversationHead` across both branches (both routes call context helpers)
- The gateway routing decision MUST be traceable (log the classifier signals + decision rule)

**Gateway routing rules (§15 no-hidden-fallback):**
- Message classifies as coding-family verb + explicit target → route to native `runChatTurn`
- Message contains no coding signal AND consumer capability requested is `NATIVE_ALREADY_AVAILABLE` → route to native
- Message contains a `LEGACY_LLM_DEPENDENT` capability request (accommodation etc.) → route to consumer route, label `execution_source = LEGACY_QWEN`
- Ambiguous → clarification_required (native · no LLM)
- Never silently fall back from native failure to Qwen

**Not built this session:** the gateway is a proposal, not an implementation. Building it requires founder authorization on the routing rules above · specifically the LEGACY_QWEN labelling contract for domain-adapter passthroughs.

---

## §6 · Migration priority (§17) · summary table

| Priority | Capability | Complexity | Risk | Batch |
|---|---|---|---|---|
| 1 | code | LOW | LOW | Batch 1 |
| 2 | conversation-state / session | LOW-MED | LOW | Batch 1 |
| 3 | voice-intent-selector (coding scope) | LOW | LOW | Batch 1 |
| 4 | conversational-frame | LOW | LOW | Batch 1 |
| 5 | shadow-mode | LOW | LOW | Batch 1 |
| 6 | streaming (SSE) | MED | MED | Batch 2 |
| 7 | safety-gate | MED | LOW-MED | Batch 2 |
| 8 | truth-engine explicit | LOW-MED | LOW | Batch 2 |
| 9 | knowledge-retrieval native | HIGH | MED | Batch 3 |
| 10 | claim-verification native | HIGH | MED | Batch 3 |
| 11-18 | 8 domain adapters | HIGH | HIGH | Batch 4 |
| 19-20 | vision · image-gen | N/A (external) | N/A | Batch 5 |
| 99 | llm-rescue retirement | N/A | LOW at end | Batch 6 |

Total estimated effort: **~20-40 focused mission sessions** across 6 batches to reach full `ZERO_LLM_RUNTIME_CONFIRMED` for the entire NEX application.

---

## §7 · What was preserved (per §19)

Zero regressions permitted per §19. Verified by grep + prior probes still on disk:

- **All previously RUNTIME_VERIFIED native capabilities:** ConversationHead, runChatTurn, bindings, threads, findings, mutations, verifications, decisions (§9 detector), definitions (§8 detector), semantic entity-kind resolver (§7 Fix A)
- **Fix 7-25** capability files: untouched
- **Q7 · Q8 · GAP 5 · Track A · nex-debugger:** untouched
- **`src/lib/nex-shop/pricing.ts`** SHA `150158baa3b0274a`: byte-identical throughout entire session
- **`nex/brain/*`:** untouched
- **`useNexVoice.ts`:** untouched
- Consumer route `/api/nex-conv/chat`: untouched (per §8 preserve Qwen until parity)

---

## §8 · Honest closure statements

**§9 · Zero-LLM classification precision:**
- `NEX1 native path` = `ZERO_LLM_RUNTIME_CONFIRMED` (verified across 12/12 composite benchmark turns · 4/4 chat acceptance · investigate trace · native intelligence trace)
- `Consumer NEX Chat legacy path` = `LEGACY_LLM_DEPENDENT` (Qwen 2.5 3B via local Ollama · plus Anthropic provider available)
- The entire NEX application is NOT yet zero-LLM · the consumer path still uses Qwen by product-design (untouched)

**§16 · No hidden fallback commitment:**
- The proposed gateway explicitly labels `execution_source` on every reply
- Any capability request that fails native MUST NOT silently invoke Qwen
- Any capability request that legitimately requires legacy Qwen MUST be labeled `LEGACY_QWEN` in the reply metadata

**§22 · Final success criteria progress:**
- Architecture · one `ConversationHead` · **YES** (native side)
- Both interfaces use same state · **API layer YES · UI layer PENDING** (consumer UI cutover deferred to Batch 1)
- Zero LLM runtime application-wide · **NOT YET** (Batch 6 target)
- Continuity NEX Chat ↔ NEX1 Code Chat · **PENDING** (depends on Batch 1)
- Consumer capabilities migrated · **INVENTORY COMPLETE · MIGRATIONS PENDING**

**No claim of application-wide unification is made.** The inventory reveals this is a 20-40 session migration, not a one-session rewire.

---

## §9 · Deliverables from this session

**Added:**
- `data/nex-native-migration/consumer-capability-inventory-2026-09-17.json`
- `data/nex-native-migration/native-capability-registry-2026-09-17.json`
- `data/nex-native-migration/gap-map-and-priority-2026-09-17.json`
- `docs/doctrine/nex-native-migration-plan-2026-09-17.md` (this file)

**Not built this session (deliberate scope limit):**
- Consumer capability migrations (§10 requires capability-by-capability with individual authorization)
- Gateway implementation (design documented · build deferred to Batch 1 start)
- Streaming / SSE (Batch 2 · deferred)
- Domain adapter native equivalents (Batch 4 · deferred)

**Modified:**
- None. Zero code changes this session. Inventory + design only per Option C §3-§7.

---

## §10 · Recommended next mission

**Batch 1 · Low-risk unification** as the founder's next authorization:

1. Deprecate consumer code-adapter (route consumer coding intent → native `runChatTurn`)
2. Build the Gateway module (deterministic transport only · with `execution_source` labeling)
3. Adapt consumer session shape ↔ `ConversationHead`
4. Runtime-prove Batch 1 with a consumer-UI probe going through the Gateway to the native path

Estimated effort: 2-3 focused sessions.

Outcome: Consumer UI can start using native intelligence for coding + general conversation, **while all domain adapters (accommodation etc.) remain untouched on the legacy Qwen route.** Progressive migration begins without destroying product features.

Awaiting founder direction on Batch 1 authorization.

---

**End of native migration plan.**
