# NEX ARCHITECTURE AUDIT REPORT

**Date:** 2026-09-09
**Scope:** Complete codebase survey of brains, workers, orchestrators, engines, adapters, guards, and storage layers
**Accuracy:** Read-only verification of all paths and line counts via actual file inspection

---

## EXECUTIVE SUMMARY

NEX is a **multi-brain conversational intelligence system** shipping production code across seven major architectural zones:

1. **Main Brain (Orchestrator)** — Canonical routing at `src/lib/nex/brain/orchestrate.ts` (3,504 lines). Every NEX chat surface routes through this single function before delegating to specialists.

2. **Live Chat Completion Pipeline** — A domain-neutral, deterministic composition layer (Phase 3) that classifies user intent to domain adapters (accommodation, food, etc.), composes replies from stored facts, and gates LLM output through the Truth Engine. Zero fabrication invariant.

3. **Truth Engine** — Core safety/verification module (Phase 3.2) that prevents LLM fabrication by enforcing:
   - Fact freshness verification (TTL-based staleness detection)
   - Conflict detection (multiple sources disagreeing)
   - Trust capping at "evidence_provisional" (LLM-rescued claims never reach "canonical_verified")

4. **LLM Rescue Pipeline** — Controlled LLM invocation (Phase 3.4) that **never bypasses the Truth Engine**. Every LLM output is gated, claiming is validated against evidence, and orphan claims are rejected.

5. **Safety Guardrails** — Multi-layer input/output validation (Phase 3.7):
   - Rate limiting per conversation
   - Input moderation (jailbreak/harmful detection)
   - Output PII scrubbing
   - Moderation event logging (nex.moderation_event)

6. **Action Authorization** — Safe actionable intelligence (Phase 3.7). LLM proposes actions, NEX authorizes them. Seven-stage pipeline.

7. **Agent Runtime** — Worker lifecycle management with domain-specific workers, heartbeat monitoring, and controlled spawning via control-plane.

8. **Memory System (Phase 3.10)** — Doctrine #4: "MEMORY INFORMS CONTEXT · MEMORY DOES NOT ESTABLISH TRUTH."

**Gap Status:** Accommodation domain fully live with deterministic composition. Other domains (food, transport, business, travel, attractions) have adapter scaffolding but are either observation-only or stub implementations.

**Ship-Ready:** Main Brain orchestrator · Truth Engine · LLM Rescue gate · Safety guardrails + moderation observability · Action authorization + immutable audit trail · Accommodation adapter · Memory store · Indonesia walker supervisor · Knowledge Inbox · Domain classification · Vision extraction · File extraction · Semantic intent fallback.

**Stub/Partial:** Food/transport/construction/healthcare/legal/business adapters (event-emitters only) · Master AI agent spawning (specs only) · Research gateway (partial) · Delegation executor (stub) · Tool ecosystem (placeholders) · Learning pipeline (schema exists, not active) · Knowledge Factory ingestion authoritative flip.

---

## AUDIT A: BRAIN-LIKE MODULES

| File Path | Lines | Purpose |
|-----------|-------|---------|
| `src/lib/nex/brain/orchestrate.ts` | 3,504 | **NEX Speaking Brain** (Philip 2026-08-31). Canonical single orchestrator for intent classification, safety routing, accommodation extraction, conversation-state management, and delegating to specialists. Every chat route calls this first. |
| `src/lib/nex/reflex/reflex-brain.ts` | - | Deprecated/legacy. Replaced by orchestrate.ts. |
| `src/lib/nex/router/brain-router.ts` | - | Intent routing layer; subsumed by orchestrate.ts. |
| `src/lib/nex/live-chat-completion/domain-classifier.ts` | - | Classifies turn to domain (accommodation/food/transport/etc.). Used by chat route before delegating to domain adapter. |
| `src/lib/nex/live-chat-completion/conversation-brain/state-store.ts` | - | Durable conversation state (Phase 3.1). Stores extracted slots, turn history, confirmation tokens. |
| `src/lib/nex/live-chat-completion/conversation-brain/turn-interpreter.ts` | - | Interprets each turn, updates conversation state, detects follow-ups. |
| `src/lib/nex/master-ai/agent-factory.ts` | 183 | Master AI Agent Factory. Decomposes high-level missions into AgentSpecification records. **SPEC-ONLY** — does not activate agents at runtime. |
| `src/lib/nex/master-ai/agent-registry.ts` | - | Registry of active agents. Loaded by control-plane before spawning workers. |
| `src/lib/nex/master-ai/delegation.ts` | - | Delegation logic for decomposing tasks into worker-level jobs. |
| `src/lib/nex/live-chat-completion/llm-rescue/model-router.ts` | - | Routes to fast vs reasoning LLM models based on query complexity (Phase 3.6). |

**Key Finding:** NEX has **one canonical Brain** (orchestrate.ts), not multiple competing brains. All specialists are **capabilities UNDER the Brain**, not sibling entry points.

---

## AUDIT B: WORKERS (BACKGROUND / SCHEDULED PROCESSES)

| Worker Path | Type | Status | Purpose |
|-------------|------|--------|---------|
| `src/lib/nex/agent-runtime/worker-accommodation.ts` | Domain Worker | **OBSERVATION-ONLY** (Phase A) | Monitors 7-day freshness. Emits FRESHNESS_DUE events. Does NOT modify records. |
| `src/lib/nex/agent-runtime/worker-food.ts` | Domain Worker | **BENCHMARK-ONLY** | Runs food-corpus evaluation. Used for capability profiling. |
| `src/lib/nex/agent-runtime/worker-transport.ts` | Domain Worker | Scaffolding | Event-emitter only. Real logic deferred. |
| `src/lib/nex/agent-runtime/worker-construction.ts` | Domain Worker | Scaffolding | Event-emitter only. |
| `src/lib/nex/agent-runtime/worker-healthcare.ts` | Domain Worker | Scaffolding | Event-emitter only. |
| `src/lib/nex/agent-runtime/worker-legal.ts` | Domain Worker | Scaffolding | Event-emitter only. |
| `src/lib/nex/agent-runtime/worker-business.ts` | Domain Worker | Scaffolding | Event-emitter only. |
| `src/lib/nex/agent-runtime/worker-programmer.ts` | Specialist | Scaffolding | Code generation capability. Deferring. |
| `src/lib/nex/agent-runtime/worker-vision.ts` | Specialist | Stub | Vision extraction. Phase 3.8 integration. |
| `src/lib/nex/agent-runtime/worker-speaking.ts` | Specialist | Stub | Voice/TTS. Deferring. |
| `src/lib/nex/agent-runtime/worker-travel.ts` | Domain Worker | Scaffolding | Travel domain. Event-emitter only. |
| `src/lib/nex/agent-runtime/worker-master-ai.ts` | Meta-Worker | Stub | Master AI orchestration. Deferred activation. |
| `scripts/walkers/run-supervisor.mjs` | **Runner** (Layer A) | **LIVE** | Boots + supervises persistent Indonesia walker fleet. |
| `scripts/walkers/run-outer-watchdog.mjs` | **Runner** (Layer B) | **LIVE** | Outermost watchdog. Restarts supervisor if it crashes/hangs. |
| `scripts/walkers/run-indonesia-walkers.mjs` | Orchestrator | Live | Spawns Indonesia-specific walker instances. |
| `src/lib/nex/comms-social/worker/worker.ts` | Social | Live | Social media posting automation. |

**Heartbeat Status:** All workers use `writeHeartbeat()` from `src/lib/nex/agent-runtime/heartbeat.ts`. Supervisor reads heartbeats to detect stalled workers.

---

## AUDIT C: GUARDS / GATES / SAFETY ENFORCEMENT

| File Path | Enforces Doctrine | Mechanism |
|-----------|------------------|-----------|
| `src/lib/nex/live-chat-completion/truth-engine/truth-engine.ts` (189 lines) | **#1** | Fact freshness (TTL per intent), conflict detection, trust capping. Pure function. |
| `src/lib/nex/live-chat-completion/llm-rescue/gate.ts` (107 lines) | **#1 · #4** | Validates every LLM claim.source_ref against evidence bundle. Defensively rejects `memory:` refs (Doctrine #4). Caps trust at evidence_provisional. |
| `src/lib/nex/live-chat-completion/actions/authorize.ts` (229 lines) | **#2** | 7-stage pipeline: schema → registry → permission → guardrail → confirmation → execution → audit. |
| `src/lib/nex/live-chat-completion/safety/guardrails.ts` (198 lines) | **#2** | Pluggable input/output guardrail registry. |
| `src/lib/nex/live-chat-completion/safety/rate-limiter.ts` | **#2** | Per-conversation rate-limiting. |
| `src/lib/nex/live-chat-completion/safety/input-moderation.ts` | **#2** | Jailbreak + harmful detection. |
| `src/lib/nex/live-chat-completion/safety/output-pii.ts` | **#2** | Scrubs PII from LLM-composed replies. |
| `src/lib/nex/live-chat-completion/vision/contract.ts` + `index.ts` | **#3** | Vision facts source_type="vision", capped at evidence_provisional. |
| `src/lib/nex/live-chat-completion/files/contract.ts` + `index.ts` | **#3** | File facts source_type="file", capped at evidence_provisional. |
| `src/lib/nex/live-chat-completion/memory/postgres-store.ts` | **#4** | Returns PersonalizationContext (never EvidenceItem). |
| `deploy/postgres/init/104_nex_safety_audit.sql` | **#2** | nex.safety_audit_event. Immutable, 30-day retention, legal_hold. |
| `deploy/postgres/init/149_nex_safety_observability.sql` | **#2** | nex.moderation_event. No PII, hashed message for dedup. |
| `deploy/postgres/init/150_nex_action_audit.sql` | **#2** | nex.action_audit. Immutable action trail. |

**Critical Quote from gate.ts:** `"doctrine_4_memory_is_not_truth:${claim.source_ref}"` — memory citations explicitly detected + rejected.

---

## AUDIT D: API SURFACES / ENTRY POINTS

| Route Path | Type | Lines | Role |
|------------|------|-------|------|
| `src/app/api/nex-conv/chat/route.ts` | **MAIN CHAT** | ~3,177 | Founder BEGIN 2026-09-09. Routes every turn through orchestrateChatTurn, then domain adapter. Implements all Phase 3 doctrines. 30+ "Founder BEGIN Phase X" markers. |
| `src/app/api/nex-conv/conversations/route.ts` | Conversation CRUD | - | List/create conversations. |
| `src/app/api/nex-conv/session/view/route.ts` | Session Query | - | Reads state + turn history. |
| `src/app/api/nex-conv/drafts/route.ts` | Drafts API | - | In-progress replies. |
| `src/app/api/nex-conv/survey/route.ts` | Feedback | - | Reply ratings + gap signals. |
| `src/app/api/nex-conv/knowledge-items/[id]/action/route.ts` | Knowledge Action | - | Gap engine signals. |

**Key Finding:** `chat/route.ts` is the ONLY public entry point for live chat. All surfaces post here. Integrates 10 Phase-3 systems in sequence.

---

## AUDIT E: STORAGE LAYERS (nex.* schema)

### Knowledge / Brain Infrastructure
- `nex.knowledge_records` · governed corpus. Status: DRAFT / UNDER_REVIEW / AUTHORITATIVE / DEPRECATED / SUPERSEDED.
- `nex.knowledge_inbox` · inbound submissions. Status: waiting / processing / review / processed.
- `nex.knowledge_inbox_stats` · daily counters.
- `nex.knowledge_dump_jobs` · job queue.
- `nex.record_versions` · immutable version history.
- `nex.graph_edges` · typed relationships. Types include: requires, conflicts_with, gap_marker.
- `nex.worker_jobs` · general job queue.

### Conversation / State
- `nex.conversation` · headers.
- `nex.conversation_turn` · role, text, intent_detected, domains_matched, reply_kind, trust_band.
- `nex.conversation_learning_candidate` · flagged for ADR-0050 learning.

### User Profile / Memory
- `nex.user_profile` · display_name, custom_instructions.
- `nex.user_memory` · memory_id, user_id, claim_text, category, confidence, source_turn_id, expires_at, last_referenced_at, deleted_at.

### Safety / Audit
- `nex.action_audit` · immutable. outcome ∈ {executed, rejected_schema, rejected_unknown_action, rejected_permission, rejected_guardrail, pending_confirmation, rejected_no_llm_rule}.
- `nex.moderation_event` · category ∈ {jailbreak, harmful, rate_limit, policy, abuse, other}. Hashed message.
- `nex.safety_audit_event` · destructive actions. Retention + legal_hold.
- `nex.safety_audit_config` · singleton default_retention_days.

### Accommodation
- `nex.accommodation_business` · entity records.
- `nex.accommodation_field_provenance` · per-field source attribution. trust_layer ∈ {canonical_verified, canonical_unverified, evidence_verified, evidence_provisional}.
- `nex.accommodation_enrichment_evidence` · additional evidence rows.
- `nex.accommodation_fact_conflict` · unresolved / resolved / deprecated.

### Discovery / Attribution
- `nex.discovery_rotation_state` · carousel state per conversation.
- `nex.discovery_rotation_state_surface` · derived state.
- `nex.provider_rate_governor` · rate-limit buckets.
- `nex.walker_attribution_food_business` / `walker_attribution_accommodation_business` / `walker_attribution_mp_seller` · walker → entity maps.

---

## AUDIT F: ORCHESTRATION / MASTER-AI / DELEGATION

| File | Status | Purpose |
|------|--------|---------|
| `src/lib/nex/master-ai/agent-factory.ts` (183 lines) | **SPEC-ONLY** | AgentSpecification producer. Doesn't spawn. |
| `src/lib/nex/master-ai/agent-registry.ts` | Stub | Active agent list. |
| `src/lib/nex/master-ai/delegation.ts` | Stub | Task decomposition. |
| `src/lib/nex/master-ai/delegation-executor.ts` | Stub | Job execution. |
| `src/lib/nex/agent-runtime/control-plane.ts` | **LIVE** | Authorizes + spawns domain-worker child processes. |
| `src/lib/nex/agent-runtime/registry.ts` | Live | Runtime process registry. |
| `src/lib/nex/agent-runtime/event-bus.ts` | Live | In-memory pub/sub for worker→supervisor. |
| `src/lib/nex/agent-runtime/heartbeat.ts` | Live | Atomic heartbeat writes. |
| `src/lib/nex/agent-runtime/watchdog.ts` | Live | Supervisor health monitor. |
| `src/lib/nex/master-ai/research-engine.ts` | Deferring | Web research capability. |
| `src/lib/nex/master-ai/research-priority.ts` | Deferring | Priority queue. |
| `src/lib/nex/master-ai/research-gateway.ts` | Deferring | Entry point. |

**Real vs Stub:** Master-ai modules are high-fidelity specs but don't execute at runtime yet. LIVE orchestration is supervisor + control-plane + event-bus loop.

---

## AUDIT G: REUSABLE-WORKER vs PER-DOMAIN-AGENT

**Reusable (non-domain-scoped):** heartbeat · event-bus · internet-check · control-plane · watchdog.

**Domain-scoped (scaffolded):** worker-accommodation (observation-only) · worker-food (benchmark-only) · worker-transport / construction / healthcare / legal / business (event-emitters).

**Domain Adapters (composition):**
- `accommodation-adapter.ts` (~726 lines) · **PRODUCTION**. DomainAdapter contract. intent-parser → hot-tier-facts → fact-computer → deterministic-composer.
- Food/transport/construction/healthcare/legal/business adapters · **do not exist yet**.

**Reusable interface:** `DomainAdapter` contract at `src/lib/nex/live-chat-completion/contract.ts` (~527 lines). Shape: `async composeReply(input): Promise<AdapterReply>`.

---

## MATCH MATRIX · Target Architecture vs Actual NEX

| Target Slot | In NEX? | File Path | Status |
|-------------|---------|-----------|--------|
| **NEX MAIN BRAIN** | Y | `src/lib/nex/brain/orchestrate.ts` | **PRODUCTION** |
| KNOWLEDGE BRAIN | PARTIAL | (see rows below) | PARTIAL |
| RESEARCH BRAIN | PARTIAL | `src/lib/nex/master-ai/research-engine.ts` | STUB |
| ACTION BRAIN | PARTIAL | `actions/authorize.ts` + `agent-runtime/control-plane.ts` | **PARTIAL/LIVE** |
| FINAL REASONING → Fabrication Gate | Y | `llm-rescue/gate.ts` | **PRODUCTION** |
| Discovery Worker | Y (accommodation) | `intelligence-storage-grid/accommodation/deterministic-composer.ts` | PRODUCTION |
| Extraction Worker | Y | `live-chat-completion/vision/` + `files/` | LIVE (bounded evidence_provisional) |
| Normalisation Worker | Y (accommodation) | `intelligence-storage-grid/accommodation/language-normaliser.ts` | PRODUCTION |
| Dedup Worker | Y | `nex.knowledge_inbox` SHA-256 hash unique index | LIVE |
| Entity Resolution Worker | Y (accommodation) | `intelligence-storage-grid/accommodation/fact-computer.ts` | PRODUCTION |
| Verification Worker | Y | `truth-engine/truth-engine.ts` | **PRODUCTION** |
| Conflict Worker | Y | `truth-engine.ts` + `nex.accommodation_fact_conflict` | PRODUCTION |
| Gap Worker | Y (accommodation) | `intelligence-storage-grid/accommodation/gap-engine.ts` | PRODUCTION |
| Freshness Worker | Y | `agent-runtime/worker-accommodation.ts` | OBSERVATION-ONLY (Phase A) |
| Index Worker | Y | Postgres indexes | LIVE |
| Search Worker | PARTIAL | `semantic/intent-semantic-index.ts` (SI-1) | LIVE (fallback only) |
| Source Worker | Y | `field_provenance.source_type` | LIVE |
| Page Worker | N (N/A) | - | Not applicable (NEX is API-first) |
| Evidence Worker | Y | `llm-rescue/contract.ts::EvidenceItem` | LIVE |
| Cross-check Worker | Y | `truth-engine.ts` conflict detection | PRODUCTION |
| Citation Worker | Y | `llm-rescue/gate.ts` source_ref validation | PRODUCTION |
| Synthesis Worker | Y (accommodation) | `deterministic-composer.ts` | PRODUCTION |
| Tool Selection Worker | Y | `actions/registry.ts` | PARTIAL |
| Permission Worker | Y | `authorize.ts` stage 3 | LIVE |
| Confirmation Worker | Y | `authorize.ts` stage 5 | LIVE |
| Execution Worker | PARTIAL | `authorize.ts` stage 6 | STUB (per-action executors) |
| Audit Worker | Y | `nex.action_audit` + `moderation_event` + `safety_audit_event` | **PRODUCTION** |

---

## SHIP-READY SUBSYSTEMS

1. Main Brain Orchestrator (3,504 lines)
2. Truth Engine (189 lines) · freshness + conflict + staleness
3. LLM Rescue Gate (107 lines) · fabrication prevention · Doctrine #1
4. Safety Guardrails (198 lines) · rate-limit + moderation + PII
5. Action Authorization (229 lines) · Doctrine #2 · 7-stage
6. Immutable Audit Trail · action / moderation / safety
7. Memory System · Doctrine #4 · PersonalizationContext ≠ EvidenceItem
8. Accommodation Adapter (726 lines) · deterministic · zero LLM
9. Domain-Neutral Contract (527 lines) · DomainAdapter interface
10. Indonesia Walker Supervisor · System A isolation · outer watchdog
11. Knowledge Inbox · dual-write to Postgres (Phase 11.3 flip planned)
12. Domain Classification · routes to correct adapter
13. Vision Extraction (Phase 3.8) · capped at evidence_provisional
14. File Extraction (Phase 3.9) · capped at evidence_provisional
15. Semantic Intent Fallback (SI-1) · embedding-based when tokens fail

---

## MISSING OR STUB SUBSYSTEMS

1. Food adapter · scaffolding only. No deterministic composition.
2. Transport / Construction / Healthcare / Legal / Business adapters · do not exist.
3. Master AI agent spawning · specs only · runtime activation deferred.
4. Delegation executor · stub.
5. Research gateway (full) · web acquisition partial · deep research deferred.
6. Tool ecosystem (full) · registry exists · real tool definitions placeholders.
7. Knowledge Factory ingestion authoritative · Phase 11.3 flip incomplete.
8. Multi-domain workers · accommodation observation-only · food benchmark-only · others event-scaffolds.
9. Offline resilience (full) · scaffold exists.
10. Learning pipeline (full) · schema exists but not active.

---

## DOCTRINE ENFORCEMENT AUDIT (Founder's 4 Rules)

| Doctrine | Location | Verification | Status |
|----------|----------|--------------|--------|
| **#1** LLM Rescue Never Bypasses Truth Engine | `gate.ts` lines 35-100 | Every claim validated against RetrievalBundle. Orphan claims rejected. | **ENFORCED** ✓ |
| **#2** LLM Never Executes Action Without NEX Authorization | `authorize.ts` 7-stage pipeline | All actions traverse 7 stages. `nex.action_audit` immutable. | **ENFORCED** ✓ |
| **#3** Vision Extraction Capped at evidence_provisional | `vision/index.ts` + gate | source_type="vision" · TrustBand capped. | **ENFORCED** ✓ |
| **#4** Memory Informs Context · NOT Truth | `postgres-store.ts` + `gate.ts` lines 48-52 | Memories in PersonalizationContext (not EvidenceItem). Defensive `memory:` reject. | **ENFORCED** ✓ |
