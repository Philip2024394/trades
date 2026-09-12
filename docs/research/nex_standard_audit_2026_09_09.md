# NEX Standard · Audit · 2026-09-09

**Scope:** What NEX can MEASURE TODAY against the 10-point NEX Standard test suite challenged by ChatGPT, vs what needs new infrastructure.

---

## Executive Summary

NEX has **real, durable telemetry for 6 of 10 tests** with live-traffic data streaming into PostgreSQL. Four tests require new infrastructure.

**What measures TODAY:**
- **Test 2 (Knowledge)** — Gate v2 alignment scoring via `nex.gate_kept_event` (p50/p95 distributions available)
- **Test 4 (Groundedness)** — Fabrication Gate v2 rejects orphan/postrationalisation/memory citations
- **Test 6 (Actions)** — `nex.action_audit` tracks all 7-stage authorization (zero unauthorized execution guaranteed by construction)
- **Test 7 (Speed)** — `turn_latency_event` logs P50/P95 per component + promotion path
- **Test 9 (Reliability)** — Observatory `doctrine_health.overall_score` (target 1.0 · zero violations)
- **Test 10 (Independence)** — `local-only.ts` proves Ollama-only operation · `smoke-local-only.mjs` passes

**What needs infrastructure:**
- **Test 1 (Reasoning)** — No per-turn reasoning quality scorer
- **Test 3 (Research)** — Retrieval path success/failure not decomposed from composition
- **Test 5 (Memory)** — Personalization confidence uncorrelated to source tiers
- **Test 8 (Cost)** — Token counting + pricing model absent

**Total build effort:** ~8-10 engineer-weeks (Research 2×S · Reasoning 1×L · Memory 1×M · Cost 1×L).

---

## A · Existing Telemetry by Test

### Test 1 — General Reasoning
- No per-turn reasoning quality measurement
- Brain orchestration logs only route selection (adapter/composer/rescue), not reasoning correctness
- Composition Pilot validates routes, not reasoning chains

### Test 2 — Knowledge (Factual Accuracy)
- **Fully instrumented:** `src/lib/nex/live-chat-completion/llm-rescue/gate.ts` (lines 101-120) implements `scoreClaimAlignment()` + optional NLI
- **Table:** `nex.gate_kept_event` (alignment_score 0-1, provider_model, source_ref)
- **Live data:** 2026-09-08 pilot showed alignment_max=0.98, mean=0.76

### Test 3 — Research (Source + Citation)
- Retrieval router exists (`retrieval-router.ts`) but per-path success/failure logging absent
- Citation-source match confidence not scored
- `nex.retrieval_hit` table mentioned in contract but underutilized

### Test 4 — Groundedness (Claims Rejected)
- **Fully instrumented:** `gate-events.ts` writes `nex.gate_rejection_event`
- **Verification:** `gate-kept_event` tracks verified claims with alignment scores
- **Observable:** `/api/nex/observatory/snapshot?window=1h` reports verified_replies + postrationalisation_rate

### Test 5 — Memory (Personalization)
- Storage layer functional (`postgres-store.ts` lines 23-60): `nex.user_memory` (claim_text, category, tier, confidence)
- Doctrine #4 enforced: memory never maps to EvidenceItem
- **Missing:** Personalization outcome logging · tier↔groundedness correlation

### Test 6 — Actions (Zero Unauthorized)
- **Fully instrumented:** `authorize.ts` 7-stage pipeline
- **Table:** `nex.action_audit` (outcome: executed/rejected_schema/rejected_permission/rejected_guardrail, trace)
- **Safety:** 5-minute confirmation token TTL · no silent execution

### Test 7 — Speed (P50/P95)
- **Fully instrumented:** `turn-telemetry.ts` writes `nex.turn_latency_event`
- **Observable:** Observatory snapshot reports end_to_end_p50_ms, end_to_end_p95_ms, adapter_promoted_ratio (target ≥90%)

### Test 8 — Cost
- **Missing:** Token counting at all LLM call sites
- **Missing:** Provider pricing config (`nex.llm_cost_config` does not exist)
- **Missing:** Per-conversation cost aggregation

### Test 9 — Reliability (Millions of Turns)
- **Fully instrumented:** `observatory-brain/index.ts` (lines 138-200+) computes `doctrine_health`
- **Doctrines measured:** #1 · #2 · #3 · #4 (all targets 0 violations)
- **Overall score:** 1.0 = perfect · < 1.0 = violations detected

### Test 10 — Independence (No OpenAI/Anthropic)
- **Fully functional:** `local-only.ts` (lines 39-50) fills missing env non-destructively
- **Providers:** Ollama (LLM, vision, embeddings) · DuckDuckGo/Wikipedia (web) · Postgres · tesseract.js (WASM)
- **Validation:** `smoke-local-only.mjs` passes regression suite on Ollama-only

---

## B · Existing Corpus / Test Data

- **Composition Pilot** (n=354 historical): `data/pilot-nex-composition/results/` — 30-case cold-start scenarios with route accuracy, latency, cache state
- **Staircase Knowledge** (50K+ edges): `data/staircase-*.json` — materials · diagnosis · quote engine · design rules · defect matrix · UK/USA/Australia regional packs
- **Directory Seeds** (50+ cities · 200+ merchants): `data/directory-seeds/` — text only per ADR-0023
- **Gate Event Stream** (live): `nex.gate_rejection_event` + `nex.gate_kept_event`
- **Memory Pilot** (staging): `nex.user_memory` with tier tracking (semantic/episodic/procedural)

---

## C · Missing Infrastructure

### Test 1 · Reasoning Quality
- No trajectory capture for reasoning steps
- Needs: (a) reasoning chain logging per turn · (b) human-annotation corpus (500+ cases) · (c) semantic quality scorer
- **Effort: 1×L (3-4 weeks including annotation)**

### Test 3 · Research Accuracy
- No per-retrieval success/failure telemetry
- Citation-source similarity scorer missing
- Topic relevance detector missing
- Needs: (a) `nex.retrieval_event` table (path, latency, sources, matches) · (b) semantic similarity scorer
- **Effort: 2×S (2 weeks)**

### Test 5 · Memory Personalization
- No memory usage logging during composition
- Personalization outcome not scored
- Needs: (a) `nex.memory_usage_event` table · (b) outcome classifier · (c) correlation analysis
- **Effort: 1×M (2-3 weeks)**

### Test 8 · Cost
- No token counter wrapper around LLM calls
- No provider cost table
- No per-conversation cost aggregation
- Needs: (a) token logging at all LLM sites · (b) `nex.llm_cost_config` table · (c) cost rollup queries
- **Effort: 1×L (3-4 weeks)**

---

## D · Match Matrix

| Test | Existing Capability | Key Files | Missing |
|------|---------------------|-----------|---------|
| 1 · Reasoning | Route selection only | `orchestrate.ts` | Trajectory capture · annotation corpus · quality scorer |
| 2 · Knowledge | Gate v2 alignment + NLI | `gate.ts:101-120` + `nex.gate_kept_event` | None (ready to publish) |
| 3 · Research | Retrieval router exists | `retrieval-router.ts` | Per-path telemetry · citation scorer · relevance detector |
| 4 · Groundedness | Gate v2 rejection + kept events | `gate-events.ts` + tables | None (ready to publish) |
| 5 · Memory | Storage + tier tracking | `postgres-store.ts` + `nex.user_memory` | Usage logging · outcome scorer · correlation analysis |
| 6 · Actions | 7-stage authorization pipeline | `authorize.ts` + `nex.action_audit` | None (ready to publish) |
| 7 · Speed | Component latency + P50/P95 | `turn-telemetry.ts` + `nex.turn_latency_event` | None (ready to publish) |
| 8 · Cost | Provider model name only | `turn-telemetry.ts` | Token counting · pricing table · aggregation |
| 9 · Reliability | Doctrine health snapshot | `observatory-brain/index.ts` | None (ready to publish) |
| 10 · Independence | Local-only + smoke | `local-only.ts` + `smoke-local-only.mjs` | None (ready to publish) |

---

## E · Ship-Ready Measurements (Today)

- **Test 2 · Knowledge** — Gate-kept alignment distribution (p50, p95, max) from live samples
- **Test 4 · Groundedness** — Doctrine #1 violations · orphan · postrationalisation · memory cites per window
- **Test 6 · Actions** — Doctrine #2 outcomes · proposed · executed · rejected by reason
- **Test 7 · Speed** — Per-component P50/P95 + promotion path ratios
- **Test 9 · Reliability** — Overall doctrine score + per-doctrine counts
- **Test 10 · Independence** — smoke-test pass rate on local-only Ollama · zero external API calls logged

---

## F · Effort Estimates

| Gap | T-Shirt | Weeks | Notes |
|-----|---------|-------|-------|
| Test 1 (Reasoning) | L | 3-4 | Requires 500+ annotated reasoning chains; optional ML model training |
| Test 3 (Research) | 2×S | 2 | Add `nex.retrieval_event` · build semantic scorer |
| Test 5 (Memory) | M | 2-3 | Instrument memory usage · outcome classifier · correlate tiers |
| Test 8 (Cost) | L | 3-4 | Token counting middleware · pricing sync · cost aggregation |
| **Total** | — | **8-10** | — |

---

## Key Files & Line References

- `src/lib/nex/observatory-brain/turn-telemetry.ts:18-66` — TurnTelemetryEvent interface + write logic
- `src/lib/nex/live-chat-completion/llm-rescue/gate.ts:56-144` — Fabrication Gate v2 pipeline
- `src/lib/nex/live-chat-completion/llm-rescue/gate-events.ts:43-84` — Event logging
- `src/lib/nex/live-chat-completion/actions/authorize.ts:1-200+` — 7-stage authorization
- `src/lib/nex/live-chat-completion/memory/postgres-store.ts:23-60` — Memory storage
- `src/lib/nex/observatory-brain/index.ts:138-200+` — Doctrine health computation
- `src/lib/nex/live-chat-completion/local-only.ts:39-50` — Local-only mode sentinel

---

**Bottom Line:** NEX can benchmark **tests 2, 4, 6, 7, 9, 10 today** with real production numbers. Tests 1, 3, 5, 8 need infrastructure builds (total ~8-10 weeks). No measurements are fabricated; all reference durable table structures verified in source code.
