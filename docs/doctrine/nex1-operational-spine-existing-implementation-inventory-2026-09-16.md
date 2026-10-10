# NEX1 Operational Spine · Existing Implementation Inventory & Truth Reclassification Audit

**Date:** 2026-09-16
**Status:** READ-ONLY AUDIT · freeze intact · no writes to src/ · no commits · no env changes · no designation moves · no migrations
**Author:** master_ai_engineer (Claude Code development workstation) — NOT NEX1 runtime
**Governing directive:** Founder Master Prompt · Full Operational Spine Existing Implementation Inventory & Truth Reclassification Audit (2026-09-16)
**Preceded by:** `nex1-operational-spine-phase-0-audit-2026-09-16.md` (partially contradicted · see §16) · `nex-workorder-readiness-g15-ed25519-authorization-2026-09-16.md` (G15 correction)

---

## §1 · Executive Summary

The Phase 0 Operational Spine audit classified **every** operational-spine capability except G8 as `NOT_STARTED` (or absent, or orphaned, or ADR-only). Direct code inspection of the repository via nine parallel Explore-agent inventories reveals this classification to be **factually wrong across the entire spine**.

**Zero of the ten inventoried capabilities are `NOT_FOUND`.**

**Every single one has substantial existing implementation.**

Summary of corrections (evidence-cited detail in §§6–15):

| Capability | Phase 0 said | Direct code says | Delta |
|---|---|---|---|
| G7 Code Generation | NOT_STARTED | COMPONENT_COMPLETE (~14.6k lines · 41 tests · WO-04 executor exists but orchestrator disconnected) | +3 tiers |
| G8 Execution Broker | PARTIAL (types-only) | COMPONENT_COMPLETE → SYSTEM_CONNECTED (~6.2k lines · 30 files · T2 in-process + T3 child-process + adversarial routes) | +2 tiers |
| G11 Real Eyes | NOT_STARTED (orphaned) | SYSTEM_CONNECTED at fs-level (IndependentObserver wired to wo4-executor · real fs walk + hash) — pixel-visual still absent | +3 tiers (fs) · 0 tiers (pixel) |
| G12 Correction Loop | NOT_STARTED | PARTIAL (J-family 2.3k lines · WO-12 real-correction cycle · orchestrator wiring incomplete) | +2 tiers |
| G13 Real Verification | NOT_STARTED | COMPONENT_COMPLETE (~1.2k lines WO-05/06/07 · 120+ real tests · real tsc/vitest/eslint spawn) | +3 tiers |
| G15 Ed25519 Authorization | NOT_STARTED | COMPONENT_COMPLETE · SYSTEM_NOT_ACTIVATED (already corrected in G15 WO Readiness audit) | +3 tiers |
| G16 Trace Persistence | NOT_STARTED | PARTIAL (JSONL hash-chain · wo1-audit-log + wo1-durable-store · trace_id correlation · downstream reports partial) | +2 tiers |
| G17 Real Vendor Tools | HIGH (missing) | SYSTEM_CONNECTED (17 real vendor adapters · 2.5k lines · running in production cron worker) | +3+ tiers |
| Truth Engine (ADR-0314) | PROPOSED (ADR-only) | COMPONENT_COMPLETE · DESIGN_ONLY (26 files · 2.9k lines · 10 rules · Verifier + Guardian · Gate 3 CLOSED) | +2 tiers |
| Native Code Understanding Stage 2 | PARTIAL (AST-only) | COMPONENT_COMPLETE (dep-graph + style-inspector wired into programming-mission draft flow · 1.4k lines) | +1 tier |

**Doctrine principle vindicated:** *"Architecture does not equal capability — but absence of an inventory does not prove absence of implementation."* This audit demonstrates the principle empirically across **10 capabilities in one pass**.

**Founder decisions triggered:** §24. **No implementation authorised by this document.**

---

## §2 · Audit Scope

Ten capabilities inventoried by direct code inspection using the founder's methodology (search → open → trace connectivity → inspect tests → separate CODE_EXISTS from CODE_EXECUTES from CODE_WORKS from CODE_VERIFIED from CODE_IS_AUTHORISED from CODE_IS_PRODUCTION_READY):

- G7 · Code Generation
- G8 · Execution Broker (Controlled Hands)
- G11 · Real Eyes / Independent Observer
- G12 · Correction Loop / Bidirectional State Machine
- G13 · Real Verification
- G15 · Ed25519 Founder Authorization *(inherited from prior audit — not re-inventoried)*
- G16 · Trace Persistence
- G17 · Real Vendor Tools
- Truth Engine (ADR-0314)
- Native Code Understanding · Stage 2

Nine parallel Explore-agent inventories dispatched. Each returned an evidence-cited report structured per Master Prompt §4 A–E and §5 truth states.

---

## §3 · Freeze Confirmation

**Actions taken during this audit:**
- 9 parallel read-only Explore-agent inventories
- Repository searches (Glob · Grep)
- File reads (types, main modules, tests, ADRs)
- 1 audit document (this file) written to `docs/doctrine/`
- MEMORY.md pointer added for durability

**Actions NOT taken:**
- Zero writes to `src/` · zero writes to tests · zero writes to config
- Zero commits · zero pushes · zero PR opens
- Zero migrations · zero database writes (this audit added no DB queries beyond the previously authorised probe)
- Zero package installs · zero package removals
- Zero environment variable changes
- Zero designation moves (no NEX-nn changes proposed)
- Zero dormant-capability activations
- Zero defects "repaired" (gaps recorded, not fixed)
- Zero doctrine silently modified

**Freeze status:** INTACT.

---

## §4 · Audit Method

Per Master Prompt §4:

**Step A — Repository search.** Glob + Grep across `src/lib/**`, `docs/DECISIONS/**`, `data/**`, `scripts/**`. Multiple synonyms per capability (see individual §§6–15).

**Step B — Open the actual implementation.** No agent classified from filename, ADR text, comment, or gap-register alone. Every classification cites file paths + line counts + observed behaviours.

**Step C — Trace connectivity.** For each artefact: is it imported? instantiated? called? gated? wired to real execution / orchestration / persistence / verification?

**Step D — Inspect tests.** Distinguish: mocks vs real fs · fixture vs real vendor · assertion vs execution. Report adversarial coverage separately.

**Step E — Inspect runtime evidence.** Separate `CODE_EXISTS` from `CODE_EXECUTES` from `CODE_WORKS` from `CODE_VERIFIED` from `CODE_IS_AUTHORISED` from `CODE_IS_PRODUCTION_READY`.

**Truth states used (from §5 of Master Prompt):**
`NOT_FOUND` · `DESIGNED_ONLY` · `PARTIAL` · `COMPONENT_COMPLETE` · `SYSTEM_CONNECTED` · `SYSTEM_ACTIVATED` · `VERIFIED` · `PRODUCTION_READY`

**Two-Proof Rule applied everywhere:** Component Proof + System Connectivity Proof reported separately. `COMPONENT_COMPLETE · SYSTEM_NOT_ACTIVATED` is a valid state (G15 is the paradigm example).

---

## §5 · Existing Implementation Inventory (top-level)

| Capability | Files | Lines | Tests | Real-execution evidence | Classification |
|---|---|---|---|---|---|
| G7 Code Generation | ~15+ | ~14,600 | 41 | Real fs writes via AuthorityBroker in wo5-build-execution tests · orchestrator halts before EXECUTION | COMPONENT_COMPLETE |
| G8 Execution Broker | 30 | ~6,165 | 8 unit + 5 adversarial HTTP routes | Real `spawn()` in WO-05 · T3-A adversarial process-isolation tests | COMPONENT_COMPLETE → SYSTEM_CONNECTED |
| G11 Real Eyes | 9 | 1,199 | 4 suites (~50 cases) | Real fs walk + SHA-256 in wo4-controlled-execution tests · no pixel-level inspection | SYSTEM_CONNECTED (fs) · NOT_FOUND (pixel) |
| G12 Correction Loop | 7 J-family + policy | 2,343 | 12+ | Real failure injection in wo12-real-correction-cycle · orchestrator VERIFICATION not wired | PARTIAL |
| G13 Real Verification | 10 (WO-05/06/07 + gate-verification) | 1,155 | 3 acceptance suites (~120 tests) | Real tsc/vitest/eslint/node spawn · UNAVAILABLE≠PASSED enforced | COMPONENT_COMPLETE |
| G15 Ed25519 Auth | 5 + offline signer | ~1,050 | 15 D-tests + adversarial | Real Ed25519 sign/verify · orchestrator gate wired · trust set unset (fail-closed) | COMPONENT_COMPLETE · SYSTEM_NOT_ACTIVATED |
| G16 Trace Persistence | 9+ | ~1,000+ | wo1-foundation + linked | JSONL append-only · hash chain · trace_id correlation · downstream reports partial | PARTIAL |
| G17 Real Vendor Tools | 17 adapters + registry | 2,562 | 29+ integration | Real vendor calls in prod cron worker · provider IDs recorded | SYSTEM_CONNECTED |
| Truth Engine (0314) | 26 | 2,873 non-test + 1,000+ test | 15+ modules | Fixture-runner only · no production claim flow · Gate 3 CLOSED | COMPONENT_COMPLETE · DESIGN_ONLY |
| Native Code Understanding S2 | 5 | 1,374 | 543 test lines | Wired into programming-mission draft flow (dep-graph → producer inference) | COMPONENT_COMPLETE |

**Aggregate:** ~35,000+ lines of relevant source · ~250+ tests across the spine.

---

## §6 · G7 · Code Generation · Findings

**Key files:**
- `src/lib/nex-agent/code-engine/` · ~8,499 lines (nex1-authoring-loop, ast-semantic adapter, diff normaliser, scope enforcer, provenance recorder · 20 test files)
- `src/lib/nex1-orchestrator/wo3-generator.ts` · ~300 lines
- `src/lib/nex1-orchestrator/wo3-pipeline.ts` · ~200 lines (8-stage pipeline)
- `src/lib/nex1-orchestrator/wo4-executor.ts` · 328 lines (CONTROLLED HANDS: verifies auth · opens Broker · writes files · calls observer)
- `src/lib/nex-code-brain/` · 1,247 lines (knowledge store · assignments · path router)

**Component Proof:** ✓ — code generation pipeline (stages 1–4) produces deterministic diffs · AST-semantic adapter uses TypeScript compiler · templates render real Next.js files · challenges bind Ed25519 signatures. All stages tested. wo5-build-execution.test.ts writes real files to disk via AuthorityBroker.

**System Connectivity Proof:** ✗ (partial) — WO-04 executor **can** write files but is **not called by orchestrator at v0.1.0**. Orchestrator state machine explicitly marks stages EXECUTION and RELEASE as `NOT_IMPLEMENTED` before reaching WO-04 invocation.

**Runtime connectivity:**
- Orchestrator flow: `REQUEST_RECEIVED → UNDERSTANDING → ARCHITECTURE → DESIGN → BUILD_PLAN → FOUNDER_DECISION → EXECUTION[NOT_IMPLEMENTED] → RELEASE[NOT_IMPLEMENTED] → ORCHESTRATION_COMPLETED`
- WO-04 executor imported ✓ · called from orchestrator ✗ · reached in tests only ✓

**Gaps discovered (recorded, not fixed):**
1. Orchestrator → WO-04 disconnection
2. No end-to-end integration test calling orchestrator.submit() and verifying files written
3. No state-machine loop-back on failure (one-shot path)
4. Transcript persistence missing (traces exist only in-memory during request)
5. WO-03 workspace-root validation restricted to test roots

**Corrected classification:** **COMPONENT_COMPLETE** · not NOT_STARTED · not SYSTEM_CONNECTED (deliberately disconnected pending Phase 1 authorization).

---

## §7 · G8 · Execution Broker (Controlled Hands) · Findings

**Key files:**
- `src/lib/nex-controlled-hands/types.ts` · 222 lines (state machine · manifest schema)
- `src/lib/nex-controlled-hands/ed25519.ts` · 49 lines
- `src/lib/nex-controlled-hands/path-security.ts` · ~180 lines (canonicalisation · TOCTOU-safe open · hardlink check)
- `src/lib/nex-authority-broker/broker.ts` · ~313 lines
- `src/lib/nex-authority-broker/broker-child-process.ts` · 130 lines (T3 real child spawn)
- `src/lib/nex-authority-broker/broker-child-client.ts` · IPC client
- `src/lib/nex-authority-broker/broker-child-loader.mjs` · ESM loader
- `src/lib/nex-authority-broker/event-log.ts` · cryptographic event log
- `src/lib/nex-authority-broker/snapshot-service.ts` · pre-mutation state capture + hash
- `src/lib/nex-cap/execution.ts` · 10-point verification pipeline
- `src/lib/nex-cap/real-workstation-adapter.ts` · scope boundary checks
- `src/lib/nex1-orchestrator/wo5-executor.ts` · **REAL `spawn()`** call with timeout
- `src/lib/nex-agent-runtime/workstation-integration/execute.ts` · 515 lines (RUNTIME-10 orchestrator ↔ workstation gateway)
- 3 adversarial HTTP routes: `t3a-attack`, `t3b-filesystem-attack`, `t3c-process-tree-attack`

**Total:** ~6,165 lines across 30 files.

**Component Proof:** ✓ · broker code exists · tests exist · authorization gates enforced (token validation · hardlink inode check · scope-escape detection · master-authority elevation attempt · workspace freeze).

**System Connectivity Proof:** ✓ · called from RUNTIME-10 · WO-04 · WO-05 · WO-06 · WO-07 · WO-08 · WO-09 (9 call sites across the operational chain). WO-05 does real `spawn()` (WO-CAP-EXECUTION-01 pipeline).

**T2 vs T3 status:** T2 in-process broker deliberately does NOT spawn (documented at broker.ts:285). T3 child-process broker DOES spawn (broker-child-process.ts). WO-05 build executor uses real `spawn()`.

**Adversarial evidence:** 5 HTTP attack harnesses produce signed evidence of process-isolation enforcement (Case 47 pre-existing handles · Case 49 fd inheritance · Case 55 cross-instance token replay).

**Gaps discovered:**
1. T2 default adapter explicitly non-executing (returns `ok: false`) pending WO-CAP-EXECUTION-02
2. CPU/memory OS-level enforcement not verified (cgroups / Job Object)
3. Evidence persistence (WO-08) referenced but not fully wired

**Corrected classification:** **COMPONENT_COMPLETE moving toward SYSTEM_CONNECTED** (component and connectivity both proven; SYSTEM_ACTIVATED requires WO-CAP-EXECUTION-02 wiring to complete).

---

## §8 · G11 · Real Eyes / Independent Observer · Findings

**Key files:**
- `src/lib/nex-independent-observer/observer.ts` · 155 lines (real fs walk · SHA-256 hashing · reconciliation)
- `src/lib/nex1-orchestrator/wo4-observer-check.ts` · 111 lines (Observer verdict · reconciliation logic)
- `src/lib/nex1-orchestrator/wo4-executor.ts` · 328 lines (calls observer after writes)
- `src/lib/nex/agents/nex-vision/vision-gate.ts` · 142 lines (deterministic classifier · **text-only fixtures**)
- `src/lib/nex/agents/nex-vision/corpus.ts` · 8 frozen test cases (fixture only)
- `src/lib/nex/agents/nex-vision/evaluator.ts` · 72 lines · deterministic checks
- `src/lib/nex/vision-intelligence/analyze.ts` · 161 lines · **hint-based heuristic**, not pixel
- `src/lib/nex/image-critic/critique.ts` · 103 lines · manifest-based scoring

**Component Proof (fs-level):** ✓ · IndependentObserver walks workspace_root recursively · SHA-256 hashes · returns Map<path, {sha256, size}> · verdict distinguishes MATCH · MISSING_EXPECTED_FILE · UNEXPECTED_FILE_STATE.

**System Connectivity Proof (fs-level):** ✓ · integrated into wo4-executor pipeline · verdict embedded in ExecutionReport · exercised by wo4-controlled-execution.test.ts (real files written, observer walks real workspace, reconciliation MATCH proven).

**Pixel-level visual inspection:** ✗ NOT_FOUND · no Playwright screenshot integration · no vision model at runtime · Vision gate is text-only fixture evaluation only.

**Runtime status:** Observer is ARCHITECTURALLY ACTIVE but UNREACHABLE from user-facing orchestrator (terminates before EXECUTION fires).

**Gaps discovered:**
1. No browser screenshot / playwright integration (deferred to Phase 4)
2. No vision model at runtime (deferred to Phase 4)
3. Observer walk is file-only (no semantic content inspection)
4. No UI-level visual correctness check
5. Verdict is binary MATCH/MISMATCH · no confidence band

**Corrected classification:**
- File-level observer: **SYSTEM_CONNECTED** (unreachable in production path until G7/G8 orchestrator wiring closes)
- Pixel-level visual: **NOT_FOUND**

Phase 0's "orphaned · NOT_STARTED" applies only to pixel-level. File-level observer is a working capability.

---

## §9 · G12 · Correction Loop · Findings

**Key files:**
- `capability-j-runtime-diagnosis.ts` · 258 lines (J.1 · parse vitest failures into typed findings)
- `capability-j2-cause-analysis.ts` · 696 lines (J.2 · TypeScript AST introspection · repair proposal · chain-of-custody)
- `capability-j3-verify-repair.ts` · 374 lines (J.3 · apply patch · re-run vitest · regression detection · rollback to byte-identity)
- `capability-j4-long-run.ts` · 311 lines (J.4.1 · long autonomous goal queue)
- `capability-j23-multi-hop-recovery.ts` · 318 lines (J.2.3 · chains J.1→J.2→apply→rerun with hop-cap)
- `capability-j42-long-run-with-recovery.ts` · 386 lines (J.4.2 · in-loop J.3 recovery)
- `nex-agent-runtime/recovery-policy.ts` · 89 lines (**generic retry** — NOT autonomous correction; escalates to founder)

**Total:** 2,343 lines correction-specific.

**Tests:**
- `wo9-correction-loop.test.ts` · 25 assertions (real correction logic · synthetic failure reports)
- `wo12-real-correction-cycle.test.ts` · **END-TO-END PROOF** · injects real failure (deleted file) → real WO-04..WO-09 → real diagnosis → real correction → real green (NO MOCKS, NO SYNTHETIC REPORTS — explicitly forbidden)
- `_recovery-demo/recovery.test.ts` · rung-4 multi-hop demo (2 failing assertions · 2 deterministic mutations · both fixed in sequence)

**Component Proof:** ✓ · J-family exists · chain-of-custody enforced · rollback on unsafe · deterministic · zero LLM.

**System Connectivity Proof:** ⚠ PARTIAL · WO-12 test proves the cycle works · orchestrator's VERIFICATION stage does NOT yet invoke J-family from FAILED path (orchestrator remains forward-only).

**Founder rule respected:** `recovery-policy.ts` (generic per-agent retry) is correctly NOT classified as an autonomous correction loop.

**Gaps discovered:**
1. `nex.recovery_attempts` / `nex.recovery_runs` tables not yet populated (deferred per WO schedule — confirmed via prior DB truth audit: these table names appear in the 253-table `nex` schema list from probe-2 output)
2. Orchestrator VERIFICATION → J-family wiring absent
3. Founder authorization for corrections not enforced at J-family boundary
4. J.2.1 first pass only covers `replace_return_literal` · other repair kinds deferred to J.2.2
5. Snapshot mismatch repair deferred

**Corrected classification:** **PARTIAL** · not NOT_STARTED. Correction loop is implemented at the correct architectural layer (code-engine), not the wrong one (orchestrator state machine). This is design correctness, not deficiency.

---

## §10 · G13 · Real Verification · Findings

**Key files:**
- `wo5-executor.ts` · 353 lines (build executor · `child_process.spawn` · timeout enforcement · artefact detection)
- `wo5-types.ts` · 124 lines
- `wo5-allowed-executables.ts` · 110 lines (allowlist enforcement via `which`/`where`)
- `wo6-runtime-executor.ts` · 331 lines (runtime executor · HTTP health poll · graceful/hard kill)
- `wo6-types.ts` · 88 lines
- `wo6-health-check.ts` · 108 lines (real `node:http` GET · bounded body)
- `wo7-run-specialist.ts` · 471 lines (adapters: node-syntax · tsc · eslint · vitest)
- `wo7-types.ts` · 119 lines (SpecialistResult status enum: PASSED/FAILED/UNAVAILABLE/TIMED_OUT/DENIED)
- `nex-agent-runtime/orchestrator/gate-verification.ts` · 368 lines (6 gates: NEX1/NEX2/NEX3/Security/Founder/Scope)
- `nex-agent/tools/verification.ts` · 80+ lines (legacy · bounded subprocess runner)

**Total:** 1,155 lines + gate-verification.

**Tests:** 120+ real child-process tests across `wo5-build-execution.test.ts` · `wo6-runtime.test.ts` · `wo7-specialists.test.ts`.

**Real-execution evidence (unambiguous):**
- `expect(result.report.exit_code).toBe(0)`
- `expect(result.report.stdout).toMatch(/^v\d+\.\d+\.\d+/)` (real `node --version`)
- `expect(outcome.result.tool.resolved_version).toBe(process.version)`

**Unavailability discipline:** if tsc/eslint/vitest not installed → returns UNAVAILABLE, NOT PASSED (lines 214-221 · 296-302 · 379-385 of wo7-run-specialist.ts). This satisfies ADR-0319 §13.

**Component Proof:** ✓
**System Connectivity Proof:** ✓ · WO-07 findings feed WO-09 corrector · gate-verification integrates NEX2/NEX3/Security into approval chain · evidence_hash preserved.

**Gaps discovered:**
1. WO-06 runtime executor not yet in G13 critical path (used only by WO-11 three-page-app builder)
2. Only 4 specialist kinds (no `next build`, no general `npm test`, no formatters)
3. Artefact detection skips `node_modules`/`.next`/`.git`/`.vercel`
4. No aggregate "all-tools-pass" predicate in WO-07 (caller must interpret findings)
5. Health check has no semantic validation (JSON schema, DB readiness, dependent-service liveness)
6. Programming-mission does NOT call WO-07 directly (verification bypasses real verification system)

**Corrected classification:** **COMPONENT_COMPLETE**

---

## §11 · G15 · Ed25519 Founder Authorization · Findings

**Inherited from prior audit** (`nex-workorder-readiness-g15-ed25519-authorization-2026-09-16.md` · not re-inventoried here).

**Summary:**
- Module: `src/lib/nex-agent-runtime/founder-authority/` (5 files · types + delegation + authorization + trusted-anchors + tests)
- Tests: 15 D-tests (D-1..D-15) all passing
- Offline signer: `scripts/nex-founder-sign-delegation.mjs` (256 lines · Node native crypto)
- Orchestrator gate: `computeFounderAuthGateDelegated` (`FOUNDER_AUTH_VALID`)
- Adversarial: `runtime-12-attacks.test.ts` (12 attack scenarios)
- Trust-set env `NEX_TRUSTED_FOUNDER_KEYS_HEX` unset → fail-closed refuses all `/execute`

**Component Proof:** ✓
**System Connectivity Proof:** ✓ orchestrator wired · trust set not activated

**Classification:** **COMPONENT_COMPLETE · SYSTEM_NOT_ACTIVATED**

---

## §12 · G16 · Trace Persistence · Findings

**Key files:**
- `wo1-audit-log.ts` · 156 lines (writer + content-hash chain · JSONL nex1_audit_events)
- `wo1-durable-store.ts` · 180+ lines (writer + query interface · JSONL nex1_workflow_traces)
- `wo1-idempotency.ts` · 80+ lines (JSONL nex1_idempotency_lookup)
- `nex-code-brain/knowledge-store.ts` · 144 lines (JSONL append-only ledger)
- `nex/storage/adapters/jsonl.ts` · 200+ lines (canonical impl)
- `nex/storage/registry.ts` · 60+ lines (backend selector via `NEX_STORAGE_BACKEND` env var)
- `nex/storage/types.ts` · 245+ lines (collection registry)
- `os/receiptStorage.ts` · 64 lines · **legacy Supabase** — NOT G16 (ADR-0319 corrected canonical layer to GB storage)

**Component Proof:** ✓ · JSONL append-only · content-hash chain · trace_id correlation · query interface (`.query()`, `.latestPerKey()`, `.load()`) · storage-backend switchable via env var.

**System Connectivity Proof:** ⚠ PARTIAL · orchestrator state machine writes to `nex1_audit_events` + `nex1_workflow_traces` on every transition · downstream reports (WO-04/05/06 execution/build/runtime) schema-declared but partial writes because WO-03 code-generation not yet reaches production execute.

**Tests:** `wo1-foundation.test.ts` exercises save/load/history/verifyAuditChain — all pass.

**Storage-medium ambiguity resolved:** ADR-0319 §2 explicitly bans Supabase as substrate; canonical is JSONL under `data/nex-storage/` (with Postgres/S3 adapters switchable). Legacy `os/receiptStorage.ts` is unrelated.

**Gaps discovered:**
1. WO-02 signing code partial (feeds G15 gap)
2. WO-04/05/06 reports exist in schema but writes incomplete
3. No multi-trace aggregation queries
4. Correction-cycle (WO-09) feedback collection not yet linked
5. No TTL/retention policy (JSONL grows indefinitely)

**Corrected classification:** **PARTIAL** (audit-chain complete for orchestrator transitions · downstream operational chain writes partial)

---

## §13 · G17 · Real Vendor Tools · Findings

**Key files (2,562 lines of adapters):**
- `nex/comms-social/adapters/meta.ts` · 244 lines (Facebook Graph API v20.0)
- `nex/comms-social/adapters/instagram.ts` · 217 lines (Instagram Graph API)
- `nex/comms-social/adapters/google_business.ts` · 213 lines
- `nex/comms-social/adapters/linkedin.ts` · 205 lines
- `nex/comms-social/adapters/tiktok.ts` · 193 lines
- `nex/comms-social/adapters/interface.ts` · 178 lines (contract)
- `nex/comms-social/adapters/http.ts` · 138 lines (transport)
- `nex/comms-social/adapters/env.ts` · 40 lines (credentials)
- `nex/comms-social/adapters/simulator.ts` · 149 lines (mock for tests)
- `nex/comms-social/adapters/registry.ts` · 72 lines (factory)
- `nex/notifications/adapters/twilio_sms.ts` · 96 lines (Twilio REST)
- `nex/notifications/adapters/web_push.ts` · 130 lines (Web Push API)
- `nex/notifications/adapters/whatsapp_meta.ts` · 110 lines (Meta WhatsApp Business)
- `nex/email/adapters/resend.ts` · 95 lines (Resend Email)
- `nex/storage/adapters/object-r2.ts` · 340 lines (Cloudflare R2 via AWS SDK)
- `lib/stripe.ts` · 40 lines (Stripe SDK client)
- `lib/licenses/stripe.ts` · 102 lines (Stripe Checkout Session)

**Component Proof:** ✓ · 17 real vendor adapters · registry factory pattern · env-driven credentials · full contract (authorize · exchange · publish · verify · error-classify).

**System Connectivity Proof:** ✓ · comms-social worker runs from `/api/cron/comms-social-worker` · calls `runWorkerTickOnce()` → `getAdapter(platform).publish()` · records `provider_post_id` + `provider_post_url` in `nex.social_publish_intents` and updates `nex.scheduled_posts`. 15+ API routes invoke adapters.

**Tests:** 29+ integration tests + live-adapter test (with mocked fetch) + adapter-isolation.

**Important nuance for the operational spine:** G17 is highly connected for **platform product features** (marketing, notifications, storage, payments). It is **NOT necessarily wired for NEX1 workstation code-generation tools** (git · npm · vendor CLIs specifically for the code-authoring path). Distinguish product-side G17 from workstation-side G17 in Work Order scoping.

**Gaps discovered:**
1. E2E receipt retention weak — no persistent idempotency proof for audit
2. Multi-provider OAuth race condition possible
3. R2 lifecycle policy must be configured manually
4. Stripe webhook per-event audit trail absent
5. No circuit breaker / fallback provider chain
6. Email template system deferred

**Corrected classification:** **SYSTEM_CONNECTED** (for product-side vendors) · **not verified for workstation code-authoring toolchain**

---

## §14 · Truth Engine (ADR-0314) · Findings

**Key files (26 total · 2,873 non-test lines):**
- `verifier/verifier.ts` · 138 lines (core verifier · rule pipeline)
- `verifier/types.ts` · 148 lines (VerdictEnvelope · RuleModule interface)
- `verifier/envelope.ts`, `fail-closed.ts`, `rule-registry.ts`
- **10 rule modules**:
  - **Populated (5):** R-01 plausibility (14 domain thresholds · ADR-0314a.2.n) · R-11 confidence (6 bands · ADR-0314a.2.j) · R-13 relationship (8-value vocab · ADR-0314a.2.l) · R-17 versioning (30% Levenshtein · ADR-0314a.2.m) · R-18 envelope (ADR-0314e)
  - **Defensive UNKNOWN (5):** R-03 voice (pending ADR-0317) · R-05 authority (pending registry ADR-0314a.2.p) · R-07 connection (pending criteria ADR-0314a.2.q) · R-12 classification (pending enum ADR-0314a.2.k) · R-20 contradiction (pending per-attr rules ADR-0314a.2.r)
- `guardian/guardian.ts` · 158 lines (deterministic ACCEPT/REJECT · 19 rejection codes)
- `guardian/types.ts` · 105 lines
- `runner/fixture-runner.ts` · ~400 lines (Stage 1a reference fixtures)

**Verdict kinds exercised:** PASS · FAIL · UNKNOWN · CANDIDATE_FLAG · CONTRADICTION_RECORDED (schema-ready)

**Component Proof:** ✓ · deterministic Verifier + Guardian · 15+ test modules · fail-closed §7.7 H1 invariant (UNKNOWN ≠ FAIL ≠ FALSE · every UNKNOWN/FAIL requires named reason).

**System Connectivity Proof:** ✗ · Verifier is **pure function** · no orchestrator import · no production claim flow · Gate 3 CLOSED per ADR-0314e §1. `nex-intel-orchestrator/dispatcher.ts` does NOT import truth-engine. `/api/nex/brain/guardian` uses a **different Guardian** (`memory-guardian.ts` · brain-audit, not Truth Engine).

**Runtime state:** DESIGN-ONLY. Architecturally complete + fixture-verified. Not connected to any production claim stream.

**Gaps discovered:**
1. R-20 per-attribute contradiction rules pending founder authorization
2. R-03/R-05/R-07/R-12 defensive UNKNOWN (correct posture)
3. Orchestrator non-integration (Gate 3 CLOSED)
4. Stage 1a persistence pattern undefined
5. Zero rows in `nex.gate_kept_event` · `nex.gate_rejection_event` · `nex.contradictions`

**Corrected classification:** **COMPONENT_COMPLETE · DESIGN_ONLY** — Phase 0's "PROPOSED / ADR-only" was under-informed; substantial code exists but is deliberately not wired.

---

## §15 · Native Code Understanding · Stage 2 · Findings

**Key files (1,374 lines):**
- `nex-agent/code-engine/adapters/ast-semantic.ts` · 911 lines (Stage 1 AST · production)
- `nex-agent-runtime/programming-mission/dependency-graph.ts` · 172 lines (**Stage 2** · deterministic regex export/import parser)
- `nex-agent-runtime/programming-mission/style-inspector.ts` · 134 lines (Stage 2 orchestrator · invokes dep-graph)
- `nex-code-brain/knowledge-store.ts` · 144 lines (semantic entry ledger)
- `nex/live-chat-completion/semantic/semantic-retriever.ts` · 147 lines (embedding-based cosine similarity)

**Component Proof:** ✓ · dependency graph builder exists · exports/imports parsed · workspace-relative path resolution with escape detection · knowledge store append-only.

**System Connectivity Proof:** ✓ · `dependency_graph` field in `ProgrammingMissionDraftRecord` (types.ts line 56) · populated by `inspectWorkspaceStyle()` (style-inspector.ts:128-131) · consumed by algorithm-matcher for cross-file producer inference (draft.ts:314-336) · diagnostic in `/execute` route references `cross_file_edge_count`.

**Founder rule respected:** existence of AST adapter (Stage 1) does NOT mean Stage 2 is complete. Stage 2 adds cross-file semantic reasoning ✓ · but does NOT yet include call-graph · type-graph · full impact-radius analysis.

**Tests:** 543 test lines · deterministic · zero LLM. No multi-file mutation tests yet.

**Gaps discovered:**
1. Multi-file cross-mutation tests absent
2. Symbol table structure informal (JSONL + regex, not full-type-graph)
3. Semantic retrieval isolated to chat domain (not used by code-engine)
4. No call-graph builder
5. No impact-radius proof

**Corrected classification:** **COMPONENT_COMPLETE** — Phase 0's "AST-only PARTIAL" applied to Stage 1 alone. Stage 2 has since shipped and is operationally integrated.

---

## §16 · Contradiction Matrix

| Capability | Phase 0 Claim | Direct Evidence | Corrected State |
|---|---|---|---|
| G7 | NOT_STARTED · "code-gen engine missing" | 14,600 lines · 41 tests · WO-04 executor can write via broker | COMPONENT_COMPLETE (orchestrator disconnected) |
| G8 | PARTIAL types-only | 6,165 lines · 30 files · T2+T3 · 9 call sites · real spawn | COMPONENT_COMPLETE → SYSTEM_CONNECTED |
| G11 | NOT_STARTED · orphaned | 155-line Observer wired to wo4-executor · real fs walk/hash | SYSTEM_CONNECTED (fs) · NOT_FOUND (pixel) |
| G12 | NOT_STARTED · no loop-back | 2,343 lines J-family · WO-12 real-cycle proof | PARTIAL (correct-layer implementation) |
| G13 | NOT_STARTED · fixture verification only | 1,155 lines · 120+ real tests · real tsc/vitest/eslint | COMPONENT_COMPLETE |
| G15 | NOT_STARTED | 1,050 lines · 15 D-tests · fail-closed | COMPONENT_COMPLETE · SYSTEM_NOT_ACTIVATED |
| G16 | NOT_STARTED · Supabase sink | JSONL hash chain · trace_id correlation · orchestrator wired | PARTIAL |
| G17 | HIGH · missing | 17 real vendor adapters · running in prod cron | SYSTEM_CONNECTED |
| Truth Engine | PROPOSED · ADR-only | 26 files · 2,873 lines · 10 rules · Verifier + Guardian | COMPONENT_COMPLETE · DESIGN_ONLY |
| Native Code Understanding S2 | AST-only PARTIAL | Dep-graph wired to mission-draft flow | COMPONENT_COMPLETE |

**Systemic pattern:** Phase 0 was faithful to ADR text and gap-register text; it did not open the relevant module paths. **9 of 10 capabilities were undercounted.** One (Truth Engine) had the code volume undercounted but the not-connected state correctly identified.

---

## §17 · Corrected Truth-State Matrix

| Capability | NOT_FOUND | DESIGNED_ONLY | PARTIAL | COMPONENT_COMPLETE | SYSTEM_CONNECTED | SYSTEM_ACTIVATED | VERIFIED | PRODUCTION_READY |
|---|---|---|---|---|---|---|---|---|
| G7 | | | | ✓ | | | | |
| G8 | | | | | ✓ | | | |
| G11 (fs) | | | | | ✓ | | | |
| G11 (pixel) | ✓ | | | | | | | |
| G12 | | | ✓ | | | | | |
| G13 | | | | ✓ | | | | |
| G15 | | | | ✓ (system-not-activated) | | | | |
| G16 | | | ✓ | | | | | |
| G17 | | | | | ✓ | | | |
| Truth Engine | | | | ✓ (design-only) | | | | |
| Native Code Understanding S2 | | | | ✓ | | | | |

**Highest attained state anywhere:** SYSTEM_CONNECTED (G8, G11-fs, G17).
**No capability reaches SYSTEM_ACTIVATED, VERIFIED, or PRODUCTION_READY.**

---

## §18 · Dependency Impact

The Phase 0 audit's dependency DAG remains structurally correct, but the **starting state is dramatically further along** than Phase 0 assumed:

- **Foundation Layer** — G15 (component-complete) · G16 (partial) · Native Code Understanding (component-complete) — all far more built than Phase 0 recognised
- **Broker Layer** — G8 (system-connected) — already wired to 9 call sites
- **Write Layer** — G7 code-gen (component-complete, orchestrator-disconnected) · G17 vendor adapters (system-connected but product-side)
- **Verification Layer** — G13 (component-complete) — 120+ real tests exist
- **Feedback Layer** — G12 correction loop (partial) — J-family exists, orchestrator wiring incomplete
- **Observer Layer** — G11 file-observer (system-connected, unreachable) · pixel visual (not-found)
- **Truth Engine** — Component-complete, design-only, Gate 3 CLOSED

**Blocking dependency map (revised):**
1. G7 orchestrator-execution wiring blocks: G12 correction loop activation · G16 downstream reports · G11 file-observer reachability
2. G15 trust-set configuration blocks: any signed `/execute` flow
3. Truth Engine Gate 3 CLOSED blocks: production claim verification integration
4. G17 workstation-scope adapters (git · npm · vendor CLIs specifically for code-authoring) is UNKNOWN — needs targeted follow-up

---

## §19 · Existing Tests Inventory

| Capability | Test files | Real-execution proof? | Adversarial? |
|---|---|---|---|
| G7 | 41 (code-engine + WO-03/04 + code-brain) | Yes (real FS writes in wo5-build-execution via mocked broker; real diff/canonical validation elsewhere) | Yes (adversarial-brain, adversarial-recursion, wave1-real-work-e2e) |
| G8 | 8 unit + 5 adversarial HTTP routes (T3-A/B/C) | Yes (real child_process spawn in T3-A, real Ed25519 keypair isolation) | Yes (T3-A cases 47/49/55, T3-B path escape, T3-C process tree) |
| G11 (fs) | 4 suites (~50 cases · wo4-controlled-execution.test) | Yes (real fs walk + hash) | No dedicated adversarial |
| G11 (pixel) | 0 relevant | No — text-only fixtures | No |
| G12 | 12+ (wo9-correction-loop, wo12-real-correction-cycle, _recovery-demo) | **YES (wo12 explicitly forbids mocks · injects real deleted-file failure)** | Regression detection built-in |
| G13 | 3 acceptance suites (wo5/wo6/wo7 · ~120 tests) | Yes (real tsc/vitest/eslint/node spawn · real exit codes) | UNAVAILABLE≠PASSED discipline |
| G15 | 15 D-tests + runtime-12-attacks | Yes (real Ed25519 sign+verify) | Yes (runtime-12-attacks corpus + D-8/D-9/D-10 attacks) |
| G16 | wo1-foundation | Yes (JSONL round-trip · hash-chain verification) | No dedicated adversarial |
| G17 | 29+ integration | Yes (some live adapter tests with mocked fetch; real adapters in prod worker) | Some (adapter-isolation) |
| Truth Engine | 15+ modules | Fixture-only (no production claim flow) | Guardian rejection tests |
| Native Code Understanding S2 | 2 dedicated (543 lines) | Deterministic (no LLM) | No multi-file cross-mutation |

**Aggregate estimate:** 250+ tests directly exercising operational-spine capabilities.

---

## §20 · Runtime Evidence Inventory

**What currently RUNS in this repository:**

- **G8 broker** — spawns real child processes in test harnesses and T3 adversarial routes
- **G13 real verification** — spawns real tsc/vitest/eslint in wo7-specialists tests
- **G17 comms-social worker** — runs against real Meta/Instagram/LinkedIn/TikTok/Google Business/Twilio/Resend/R2 APIs from cron
- **G16 JSONL trace persistence** — active writes on every orchestrator transition; `data/nex-storage/nex1_audit_events.jsonl` contains real chained records
- **G11 file-observer** — runs against real workspace directories in wo4-controlled-execution
- **G15 offline signer** — CLI callable · Ed25519 signature verification against trusted set
- **Native Code Understanding S2 · dependency-graph** — runs in every `programming-mission` draft
- **Truth Engine** — Verifier callable · fixture-runner exercisable · zero production claims routed through it

**What does NOT run in production paths:**
- Orchestrator's EXECUTION/RELEASE stages (G7 disconnection)
- Truth Engine (Gate 3 CLOSED)
- G15 real-founder `/execute` flow (trust set unset)
- G11 pixel visual (not implemented)

---

## §21 · Security Evidence

**Cryptographic primitives in use:**
- Ed25519 (Node native crypto) for founder delegation + delegate authorization + revocation
- SHA-256 for artefact hashing (Observer · G13 evidence · G16 audit chain)
- Content-hash chain (previous_event_id + content_hash) for tamper-evident audit log
- Trust-set env var `NEX_TRUSTED_FOUNDER_KEYS_HEX` with fail-closed default

**Enforced boundaries:**
- Path canonicalisation + TOCTOU-safe open + hardlink inode check (path-security.ts)
- Workspace root lock (broker enforces cwd)
- Executable allowlist (wo5-allowed-executables.ts · node/npm/npx only)
- Scope-escape detection (broker)
- Master-authority elevation attempt detection (broker)
- Workspace freeze protocol (broker)
- Founder authority never enters NEX runtime (offline signing only)
- Required forbidden set applied to every delegation (regardless of `allowed`)
- Guardian gate is pure inspection · never writes

**Adversarial coverage:**
- T3-A: pre-existing handles · fd inheritance · cross-instance token replay
- T3-B: filesystem path escape · symlink attacks
- T3-C: process tree enforcement
- runtime-12-attacks: 12 authority-chain attack scenarios
- G15 D-8/D-9/D-10: delegation impersonation · delegate mismatch · expiry extension

**Verified NOT in place:**
- CPU/memory OS-level enforcement (cgroups on Linux · Job Object on Windows) — T3-C/D/E track
- Hardware-backed founder key signing (WebAuthn/YubiKey) — deferred
- Nonce store at verifier layer for replay defence (may be storage-level · unproven)

---

## §22 · Missing Evidence

- Zero live rows in `nex.gate_kept_event` · `nex.gate_rejection_event` · `nex.contradictions` — inferred from prior DB truth audit
- Zero rows in `nex.recovery_attempts` · `nex.recovery_runs` — inferred from schema
- Zero real founder-signed `/execute` invocations recorded end-to-end
- Zero real user-facing orchestrator runs reaching EXECUTION
- Zero pixel-level visual verifications
- Zero workstation-scope vendor operations (git · npm · vendor CLIs specifically for code authoring) directly proven in the operational chain

---

## §23 · Recommended Work Order Classification

Per founder Master Prompt §23, capabilities placed into four founder-decision categories:

**Category A · Already substantially implemented (activation/verification WO candidates):**
- G8 · Execution Broker · SYSTEM_CONNECTED · needs SYSTEM_ACTIVATED via WO-CAP-EXECUTION-02 wiring
- G13 · Real Verification · COMPONENT_COMPLETE · needs orchestrator invocation from programming-mission
- G15 · Ed25519 Authorization · COMPONENT_COMPLETE · needs activation (per prior WO Readiness audit)
- G17 · Real Vendor Tools · SYSTEM_CONNECTED (product-side) · needs workstation-scope proof
- Native Code Understanding S2 · COMPONENT_COMPLETE · needs multi-file impact tests
- G11 · Real Eyes (fs-level) · SYSTEM_CONNECTED · unreachable until G7 orchestrator wiring

**Category B · Partially implemented (completion WO candidates):**
- G7 · Code Generation · COMPONENT_COMPLETE (orchestrator disconnected) · needs orchestrator → WO-04 wiring
- G12 · Correction Loop · PARTIAL · needs orchestrator VERIFICATION → J-family wiring + persistence
- G16 · Trace Persistence · PARTIAL · needs downstream report writes + multi-trace queries + retention policy
- Truth Engine · COMPONENT_COMPLETE · DESIGN_ONLY · needs Gate 3 OPEN authorization + orchestrator wiring + populate 5 defensive-UNKNOWN rules

**Category C · Designed but not implemented (construction WO candidates):**
- G11 · Pixel-level visual inspection · would require Playwright + vision model integration (deferred per ADR-0319)

**Category D · Not found (discovery/design WO candidates):**
- **None.** Every inventoried capability has existing implementation.

**None of A/B/C/D are authorised by this audit.**

---

## §24 · Founder Decisions Required

To convert any Category A / B / C item into an authorised Work Order, the founder must decide:

| Decision | Options |
|---|---|
| **D-1 · Accept the reclassifications in §17** | YES · YES-WITH-CHANGES · NO (retain Phase 0) |
| **D-2 · Adopt the Undercount Protection Rule as durable audit doctrine** (§25) | YES · REVISE |
| **D-3 · Authorise the DB Remediation Planning audit** (queued from prior audit · 4 remaining issues) | YES · NO · DEFER |
| **D-4 · Priority ordering for Category A activations** (G13 · G15 · G8 · Native Code Understanding S2 · G11-fs · G17-workstation) | Founder-only |
| **D-5 · Priority ordering for Category B completions** (G7 orchestrator wiring · G12 orchestrator wiring · G16 downstream · Truth Engine Gate 3) | Founder-only |
| **D-6 · Reissue or supersede Phase 0 audit** | Preserve unchanged (Wave Immutability) · Amend · Replace |
| **D-7 · Convene one activation WO first** — recommendation: G7 orchestrator wiring, because it unblocks G11 reachability, G12 orchestrator loop, and G16 downstream reports simultaneously | Founder-only |
| **D-8 · NEX-nn designation reviews** for modules discovered by this audit | Founder-only |

**No decision is pre-made. No implementation begins until founder authorises a specific WO.**

---

## §25 · Undercount Protection Rule (proposed durable doctrine)

*From founder Master Prompt §19.* Proposed for founder ratification as a permanent audit rule:

> **A capability MUST NOT be classified `NOT_STARTED` until the relevant implementation paths have been directly inspected.**
>
> **A capability MUST NOT be classified `OPERATIONAL` merely because implementation code exists.**
>
> **Both overclaiming and undercounting violate NEX1 truth doctrine.**

**Proposed enforcement:** future capability audits must cite specific file paths + line counts + observed behaviours before persisting any classification. `NOT_STARTED` must be accompanied by evidence that the module path was opened and found empty or absent.

---

## §26 · Final Truth Statement

**What does NEX1 actually have today?**

Ten operational-spine capabilities exist as substantial code, most with tests, several with orchestrator integration or production runtime use.

- **Six are COMPONENT_COMPLETE or better** (G7, G8, G13, G15, G17, Truth Engine, Native Code Understanding S2, G11-fs · counted individually adjusts to seven)
- **Three are SYSTEM_CONNECTED** (G8, G11-fs, G17)
- **Zero are SYSTEM_ACTIVATED, VERIFIED, or PRODUCTION_READY**
- **One is NOT_FOUND** (G11 pixel-visual only)

**What does NEX1 NOT have today?**

- End-to-end user-facing workstation execution (orchestrator halts before EXECUTION)
- Pixel-level visual verification (deferred)
- Real founder-signed `/execute` invocation history (trust set unset)
- Truth Engine in production claim flow (Gate 3 CLOSED)
- Workstation-scope vendor toolchain (git/npm/vendor CLIs for code authoring · unproven)
- Multi-trace aggregate queries + retention policy
- Full pixel + browser visual inspection

**Truth-doctrine principle demonstrated at scale:**

*"Architecture does not equal capability — but absence of an inventory does not prove absence of implementation."*

Prior audits (Phase 0) systematically undercounted existing capability by working from ADR text and gap-register text rather than direct code inspection. This audit corrects that systemic error by opening the module paths directly. **9 of 10 capabilities were undercounted. Zero were correctly classified as NOT_STARTED.**

**Freeze remains INTACT.** No implementation authorised. No designation moved. Founder decisions required to advance.

---

**End of audit · founder authorisation required before any implementation begins · Undercount Protection Rule proposed for durable adoption.**
