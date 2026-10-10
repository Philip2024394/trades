# NEX1 Q8 Downstream Consumer Audit

**Date:** 2026-09-17
**Authorization:** Founder Q8 Downstream Consumer Audit prompt · AUDIT ONLY · zero implementation
**Baseline:** Fix 16 · RUNTIME_VERIFIED · 24/24 verifier cases · Q7 unchanged · Fix 15 unchanged · Track A frozen
**External model:** NONE (native grep + read)
**Production code changes:** 0
**Commits:** 0 · **Pushes:** 0

---

## STATUS

```
STATUS:                       AUDIT COMPLETE

Q8 SELECTOR:                  RUNTIME_VERIFIED (Fix 16 · 24/24)
Q8 RUNTIME:                   VERIFIED IN ISOLATION (via dedicated verifier probe)

PRODUCTION CONSUMER:          NOT FOUND
REPORTING CONSUMER:           NOT FOUND
NEXT-ACTION CONSUMER:         NOT FOUND
PRODUCTION ACTIVATION:        COMPONENT_COMPLETE · SYSTEM NOT CONNECTED
```

**Verified answer to the founder question — "What actually happens to a Q8 selection after NEX1 makes it?":** nothing in production. The selection is written to a field on `InvestigationEvidencePacket`, the packet is returned by `runInvestigation()`, and no production caller reads that returned value. The only callers are 23 test/verifier probes.

---

## A · Direct Evidence

### Q1 · Where `candidate_selection` is produced

| Aspect | Evidence |
|---|---|
| Producer file | `src/lib/nex-agent/code-engine/capability-candidate-selector.ts` |
| Producer function | `selectCandidates(input): SelectCandidatesResult` |
| SelectionState values | `"SELECTED" \| "NO_SELECTION" \| "TIE" \| "INSUFFICIENT_EVIDENCE" \| "UNRESOLVED" \| "REQUIRE_MORE_INVESTIGATION"` |
| Selected candidate type | `string \| null` on `CandidateSelection.selected_candidate` |
| Called from | `native-investigation-mode.ts` ACTION 15 (line ~1006-1054 · post-ACTION 14) |
| Nature | Production code path · not verification-only · integrated in the deterministic pipeline. |

### Q2 · runInvestigation() call graph

**Grep `runInvestigation|runNativeInvestigation` across `src/`:** 1 file (definition only · `native-investigation-mode.ts`).

**Grep same terms across `scripts/`:** 23 files · all test probes:

```
scripts/nex1-fix{8,9,10,11,12,13,14,15}-verification/probe.ts
scripts/nex1-test-{g,h,i,j,k,l,m,n,o,p,q,r,s}/probe.ts
scripts/nex1-absence-tests/probe.ts
scripts/nex1-investigation-tests-2-to-6/probe.ts
scripts/nex1-diagnostic-level-1-with-investigation/probe.ts
```

**No `scripts/nex1-q8-verification/probe.ts` call to `runInvestigation`** — the Q8 verifier calls `selectCandidates()` directly with controlled fixtures, not through the full pipeline.

**Production callers of `runInvestigation`:** 0.

**Production consumers of the returned `InvestigationEvidencePacket`:** grep `InvestigationEvidencePacket` in `src/` returns **1 file** (its own definition). No other file imports the type or reads the returned value.

### Q3 · Consumers of `candidate_selection` / `selected_candidate` / `selection_state` / `SelectionState` / `CandidateSelection`

**Grep across `src/`:** 3 files:

| File | Line | What it is | Classification |
|---|---|---|---|
| `capability-candidate-selector.ts` | (definition) | Producer / type definitions | PRODUCER |
| `native-investigation-mode.ts` | 75-76 · 227-239 · packet fields | Producer wiring · packet-field addition | PRODUCER (pipeline internal) |
| `capability-candidate-comparator.ts` | 25 · 152 | Prohibited-field NEGATIVE list (Fix 14 defence-in-depth · rejects any comparator record containing `selected_candidate`) | NEGATIVE MENTION (defence-in-depth · not a consumer) |

**Grep across `src/app/` (API routes):** 0 files.

**Grep across `data/`:** 0 relevant files (`data/master-ai/*.jsonl` matched only on `investigation_id` from an unrelated master-ai subsystem · not Fix 16 output).

**Verdict:** zero production consumers of any Q8 output field. Zero API routes exposing Q8. Zero persistence of Q8 selections. The only mentions outside the producer chain are in comments and a defence-in-depth NEGATIVE prohibition list.

### Q4 · Reporting boundary

- Any user-facing report or NEX1 response consuming Q8: **NONE**
- Any investigation report emitter reading `candidate_selection`: **NONE**
- Any knowledge record persistence writing Q8: **NONE**
- Any diagnostic result formatter reading Q8: **NONE**
- Any founder report emitter reading Q8: **NONE**
- Any structured mission output containing Q8: **NONE**

**Search for API endpoints referencing investigation:** the single hit (`src/app/api/nex/hq/agents/reality/route.ts`) does NOT actually import `runInvestigation`, `InvestigationEvidencePacket`, or any Q8 field — the earlier substring match was a lexical false positive on the word "investigate" in unrelated content (grep for `Investigation|investigation` returned no matches inside its top 15 lines).

**Trace:** the Q8 selection is written to `packet.candidate_selection` at ACTION 15, and the packet is returned to `runInvestigation`'s caller. Since no production caller exists, the chain terminates there.

### Q5 · Next-action boundary

- Path from Q8 to `PLAN` / `AUTHORIZE` / `BUILD` / `EXECUTE` / `VERIFY` / `CORRECT`: **NONE**
- Path from `REQUIRE_MORE_INVESTIGATION` to a re-investigation loop: **NONE**
- Path from `SELECTED` to any downstream action: **NONE**
- Path from `NO_SELECTION` / `TIE` / `INSUFFICIENT_EVIDENCE` / `UNRESOLVED` to any downstream branching: **NONE**

Q8 emits structured state · nothing subscribes.

### Q6 · Production activation classification

- COMPONENT_COMPLETE: ✅ (Fix 16 selector exists, wired, and runtime-verified)
- SYSTEM_CONNECTED: ❌ (no downstream consumer)
- SYSTEM_ACTIVATED: ❌ (no production caller of the pipeline)
- VERIFIED (as component): ✅ (24/24 verifier cases · reproducible determinism)
- PRODUCTION_READY (as system): ❌ (no production entry point invokes it)

**Correct classification of the Q8 capability as a whole:** `COMPONENT_COMPLETE` · `SYSTEM_NOT_CONNECTED`. Fix 16 achieved runtime verification of the selector in isolation, not of the end-to-end Q8-in-production experience.

---

## B · Actual Data Flow

```
Founder Problem (natural-language string)
         ↓
[ NO PRODUCTION ENTRY POINT · pipeline runs only when invoked directly ]
         ↓
runInvestigation()  ← src/lib/nex-agent/code-engine/native-investigation-mode.ts
         │
         ├── ACTION 1..4    (classifier · file memory · observer · dep graph)
         ├── ACTION 6       (source_inspections · OBSERVED)
         ├── ACTION 7..10   (chains · narratives · relationships · compositions)
         ├── ACTION 11      (root_cause_candidates · HYPOTHESIS)
         ├── ACTION 12      (hypothesis_evaluations · INFERRED · 4 states)
         ├── ACTION 13      (candidate_comparisons · INFERRED)
         ├── ACTION 14      (candidate_rankings · INFERRED · rank_position + state) ← Fix 15
         ├── ACTION 15      (candidate_selection · INFERRED · 6-state)              ← Fix 16
         ├── ACTION 5       (absence analysis · unrelated to Q8)
         └── ASSESS + finalise
                        │
                        ▼
      InvestigationEvidencePacket (includes candidate_selection[])
                        │
                        ▼
              ??????????????????????????????????
              CHAIN TERMINUS · no production reader
              ??????????????????????????????????
                        │
                        ▼
         [Only 23 test-probe files call runInvestigation and inspect the packet]
         [Zero API routes · zero orchestrators · zero mission runners · zero report emitters]
         [Zero persistence to database / file / JSONL of the actual selection output]
```

**Where the chain stops:** immediately after `runInvestigation()` returns. The returned packet is discarded by every path except test scripts.

---

## C · Consumer Matrix

| Output | Producer | Consumer | Classification | Runtime Proven |
|---|---|---|---|---|
| `candidate_rankings` (Fix 15) | `capability-candidate-ranker.ts` → `native-investigation-mode.ts:239` | Fix 16 selector (internal · same pipeline) · 23 test probes | PRODUCTION-INTERNAL CHAIN + TEST-ONLY EXTERNAL | RUNTIME_VERIFIED (Fix 15) |
| `candidate_selection` (Fix 16) | `capability-candidate-selector.ts` → `native-investigation-mode.ts:239-240` | **NONE in production** · verifier probe only | CONSUMER GAP · component runtime-verified in isolation | Component RUNTIME_VERIFIED · pipeline consumer NOT_FOUND |
| `selected_candidate` field | `CandidateSelection.selected_candidate` | **NONE** | CONSUMER GAP | Same |
| `selection_state` field | `CandidateSelection.selection_state` | **NONE** | CONSUMER GAP | Same |
| `SelectionState` type | exported from selector | **NONE outside the selector file** | UNUSED EXPORT (except by test probe) | Type only |
| `CandidateSelection` type | exported from selector | `native-investigation-mode.ts:76` (packet field type) · Q8 verifier probe | PIPELINE-INTERNAL + TEST-ONLY | Type only |
| `RankingReference` type | exported from selector | **NONE outside the selector file** | UNUSED EXPORT | Type only |
| `InvestigationEvidencePacket` | native-investigation-mode → returned by runInvestigation | **NONE in production** | CONSUMER GAP · pre-existing · predates Q8 | Same |

---

## D · Gap Matrix

| Gap | Classification | Existing Component | Connected? | Build Required? |
|---|---|---|---|---|
| Q8 → production consumer | **F · CONSUMER GAP** | none — no orchestrator / mission runner / API route calls runInvestigation | ❌ | UNKNOWN (needs founder decision on what consumer should look like) |
| Q8 → reporting | **F · CONSUMER GAP** | none — no report emitter reads packet | ❌ | UNKNOWN |
| Q8 → next-action | **F · CONSUMER GAP** | none — no downstream stage reads selection_state | ❌ | UNKNOWN (Decision 18 REQUIRE_MORE_INVESTIGATION has no re-entry mechanism) |
| Q8 → authorization | **A · ALREADY CONNECTED** (as negative invariant) | Q8 has zero connection to G15 / C6 / Ed25519 / WO-04 / broker · Q8-N14 verified | ✅ (correctly ISOLATED) | NO |
| Q8 → persistence | **F · CONSUMER GAP** | none — packet not written to any store | ❌ | UNKNOWN (founder never authorized persistence) |
| Q8 → external LLM | **A · ALREADY DISCONNECTED (correctly)** | zero external-model imports · Q8-N10 verified | ✅ (correctly ISOLATED) | NO |
| Fix 16 selector component | **A · ALREADY CONNECTED** to Fix 13/15 (upstream) | native-investigation-mode ACTION 15 wiring exists | ✅ | NO |
| Fix 16 runtime proof | **A · ALREADY VERIFIED** | 24/24 verifier cases · determinism proven | ✅ | NO |
| Fix 16 to end-to-end runtime proof through real pipeline | **D · TEST/PROOF GAP** | Fix 16 verifier uses controlled fixtures + Test S corpus fixture · does not run full `runInvestigation()` end-to-end | Partial | UNKNOWN (proving with real pipeline requires a real production caller to exist) |

**No BUILD_GAPs identified for the selector itself.** The remaining gaps are all consumer-side.

---

## E · Authority Boundary

Explicit determination · with evidence:

| Capability | Q8 can currently? | Evidence |
|---|---|---|
| SELECT | **YES** (component-level · verified) | Q8 emits `selection_state` and `selected_candidate` at ACTION 15 · Q8-P1 pass |
| MODIFY | **NO** | Q8-N12 pass · selector code contains zero `writeFileSync` / `fs.write` / file-write APIs |
| EXECUTE | **NO** | Q8-N13 pass · zero `spawn` / `execSync` / `child_process` |
| AUTHORIZE | **NO** | Q8-N14 pass · zero Ed25519 / trust-anchor / G15 / WO-04 / broker imports |
| VERIFY | **NO** | Q8-N15 pass · `evidence_kind: "INFERRED"` type-locked · never PROVEN · Q8 does not claim to verify · downstream verification is a separate stage |
| DEPLOY | **NO** | no deployment API imported · no CI/CD trigger in selector |

**Verified boundary:** Q8 currently has SELECT authority only. All other authorities remain OUTSIDE Q8. The Fix 16 selector code itself cannot cross into MODIFY / EXECUTE / AUTHORIZE / VERIFY / DEPLOY even if invoked.

The critical safety property "no Q8 output silently becomes MODIFY / EXECUTE / AUTHORIZE" is verified negatively (through Q8-N12/N13/N14/N15). Because there is no downstream consumer, no output crosses any boundary at all — including the wanted boundary of "reach a report".

---

## F · Native / External Model Status

```
NEX1_NATIVE:                        YES
EXTERNAL_MODEL_ASSISTED:            NO
EXTERNAL_MODEL_SELECTION_AUTHORITY: NO
```

**Evidence:**

- Q8-N10 verifier PASS · grep for `openai` / `@anthropic` / `anthropic` / `@google` / `groq` / `llama` / `ollama` / `openrouter` in selector file: 0 matches.
- Selector file declares `zero_llm invariant` in its file header (per Fix 15 pattern).
- No `fetch(...)` to external model APIs in selector.
- All state decisions come from Fix 13 `overall_status` + Fix 15 `ranking_state` reads.
- Determinism verified · Q8-D1 5-run identical output.

External models exist elsewhere in the wider repo (e.g., LLM-gateway subsystem) but they do not touch Q8 selection · verified by direct source inspection of `capability-candidate-selector.ts`.

---

## G · Final Capability State

```
COMPONENT_COMPLETE
```

Explanation (evidence-supported · not inflated):

- **NOT_FOUND** — rejected; Fix 16 selector exists and is imported by the pipeline
- **DESIGNED_ONLY** — rejected; runtime-verified in isolation
- **PARTIAL** — rejected; component is complete; the gap is downstream (consumer), not internal
- **COMPONENT_COMPLETE** — ✅ **selected** · Fix 16 selector is code-complete, tested (24/24), wired into `native-investigation-mode.ts` ACTION 15, produces well-formed `CandidateSelection` records, honors every Q8 V1 policy §
- **SYSTEM_CONNECTED** — rejected; production consumer does not exist; only 23 test-probe callers
- **SYSTEM_ACTIVATED** — rejected; no production entry point invokes `runInvestigation()`
- **VERIFIED** (as system) — rejected; component-level verification ≠ system-level activation
- **PRODUCTION_READY** — rejected; no production path exercises Q8; no persistence; no consumer; no reporting

**The Q8 capability as a whole is COMPONENT_COMPLETE, not PRODUCTION_READY.** Fix 16's 24/24 verifier result is the component-level proof — the founder-approved discipline "code exists ≠ runtime-verified ≠ system-connected ≠ production-ready" prevents upgrading the label further without downstream evidence that does not exist.

---

## H · Recommendation

**If a consumer gap exists** (it does · Q8 → production consumer · Q8 → reporting · Q8 → next-action):

```
NEXT REQUIRED CONNECTION:
    (founder-only decision · no single answer is technically necessary)

    Options surfaced (not recommended · not ranked):

    Option α · Reporting consumer only
        Add a read-only emitter that formats CandidateSelection into a founder-visible
        report field · zero autonomous action · zero mutation · zero authorization.
        Would prove Q8 output reaches a human observer.

    Option β · Re-investigation loop consumer
        Add a controller that on REQUIRE_MORE_INVESTIGATION re-invokes runInvestigation
        with augmented parameters · bounded budget · explicit budget contract required
        by Decision 18. Would demonstrate the founder-approved recovery-from-uncertainty
        path.

    Option γ · Persistence consumer only
        Add a write-only persistence layer that stores CandidateSelection records to
        a JSONL log (like Fix 15's receipt pattern) for later audit. Would prove the
        pipeline produces durable evidence. NB · this alone still leaves the reporting
        and next-action gaps open.

    Option δ · Do nothing yet
        Leave Q8 as COMPONENT_COMPLETE indefinitely. Founder-only decision. Q8 remains
        proven in isolation. No production risk.

    Option ε · Founder-defined connection
        ______________________

WHY:
    Fix 16 built the mechanism · runtime verified it in isolation · fulfilled Decision 19
    preconditions 1-19 (all but authorization). But without any consumer, Q8 output
    is architectural furniture · not operational capability. The founder principle
    "prove-before-progression" says: proving Q8 in production requires observing it
    reach some destination.

EXISTING COMPONENTS THAT SHOULD BE CONNECTED FIRST:
    1. (Reporting) · no existing report emitter matches the Q8 shape · would be a
       small BUILD
    2. (Re-investigation loop) · runInvestigation is idempotent and re-callable ·
       would require a bounded budget controller · small BUILD
    3. (Persistence) · pattern reusable from Fix 15's receipt JSONL emission · would
       require a persistence path · small BUILD

    In all three cases, "connect" degenerates into "build a new small consumer"
    because no existing consumer exists. This is a legitimate CONSUMER GAP · not a
    hidden connection opportunity.

NEW BUILD REQUIRED:
    YES for any of Options α · β · γ · founder-defined
    NO for Option δ (do nothing yet)

AUTHORIZATION REQUIRED:
    YES for any option that adds code · founder must issue a separate Fix 17
    authorization prompt scoped to whichever consumer option is chosen

PRODUCTION ACTIVATION:
    Separate decision · post-consumer-choice · likely requires another authorization
```

**If no consumer gap existed:** the audit would state the next verified boundary is "Q8 is production-connected · what capability does it unlock next?" · but that is not the case here.

---

## I · Additional Findings (transparently surfaced)

### Finding 1 · Pre-existing consumer gap predates Q8

The `runInvestigation` no-consumer state is not caused by Fix 16 · it existed before Fix 15 as well. Grep for consumers has been null since the investigation pipeline was introduced. This is a general NEX1 pipeline gap · Q8 inherits it · Q8 did not create it.

### Finding 2 · Q8's own verifier does not exercise `runInvestigation`

The Fix 16 verifier probe (`scripts/nex1-q8-verification/probe.ts`) calls `selectCandidates()` directly with controlled fixtures. It does NOT call `runInvestigation`. This means Fix 16 proved the selector's behaviour in isolation · not its behaviour inside the full pipeline.

The Test S corpus fixture inside the Q8 probe is a controlled fixture · not a real end-to-end pipeline run. Runtime evidence for "Q8 inside runInvestigation() produces the expected TIE state" therefore relies on the Fix 15 receipt (which shows Test S corpus produces ALL_TIED at ranking level) + the algorithmic guarantee that Fix 16 maps ALL_TIED → TIE. This chain is deductively sound but not directly observed through a `runInvestigation()` end-to-end run in production.

**Classification:** `D · TEST/PROOF GAP` at the end-to-end pipeline level. Not a defect of Fix 16 · but a limitation of the verification approach.

### Finding 3 · Type imports outside the pipeline: none

`SelectionState`, `RankingReference`, `CandidateSelection`, `SelectCandidatesInput`, `SelectCandidatesResult` — grep confirms these types are imported ONLY by `native-investigation-mode.ts` (packet field) and the Q8 verifier probe. Zero external usage.

### Finding 4 · Test S packet not re-run under Fix 16

The Test S probe (in `scripts/nex1-test-s/probe.ts`) was written before Fix 16. Rerunning it with Fix 16 active would populate the packet's `candidate_selection` field with real Q8 selections over real evidence. This audit did NOT re-run Test S post-Fix-16 · that would be part of a future runtime-verification-through-pipeline effort. Non-audit action deliberately not performed.

---

## J · Boundary Compliance

- ✅ Did NOT implement any new consumer
- ✅ Did NOT modify Fix 16 · Fix 15 · Q7 · nex-debugger
- ✅ Did NOT add a production consumer
- ✅ Did NOT connect orchestrator / WO-04 / execution broker
- ✅ Did NOT add LLM
- ✅ Did NOT commit · did NOT push · did NOT deploy · did NOT activate
- ✅ Did NOT create any files (this audit report only)
- ✅ Did NOT modify Track A
- ✅ Native inspection only · zero external model

---

## K · Hard Stop

Per founder authorization §14:

> After producing the audit: STOP. Do not implement the next connection. Do not modify the repository. Do not activate anything. Do not commit or push. The Founder will review the audit before authorizing any further build.

**STOPPED.**

Awaiting founder review. Any valid next founder response:

1. **AUTHORIZE FIX 17** for one of Options α/β/γ or a founder-defined consumer
2. **PAUSE** — Q8 remains COMPONENT_COMPLETE indefinitely
3. **REJECT AUDIT** — audit interpretation is wrong · restate what to trace differently
4. **AUDIT ADDITIONAL PATHS** — surface a specific area (persistence · orchestrator · mission chain) for deeper inspection before deciding

---

## Final answer to the founder question

**"What actually happens to a Q8 selection after NEX1 makes it?"**

```
Nothing in production.

The selection is written to InvestigationEvidencePacket.candidate_selection ·
returned by runInvestigation() · and consumed only by 23 test-probe scripts.
Zero API routes · zero orchestrators · zero mission runners · zero report
emitters · zero persistence layers touch the packet. The chain terminates
at the function return with no external reader.

Fix 16 achieved: COMPONENT_COMPLETE + RUNTIME_VERIFIED (in isolation).
Fix 16 did not achieve: SYSTEM_CONNECTED · SYSTEM_ACTIVATED · PRODUCTION_READY.

The next founder-authorized decision is whether to build one of the
consumer options (reporting · re-investigation loop · persistence · or
founder-defined) OR to leave Q8 as component-complete indefinitely.
```

---

*End of NEX1 Q8 Downstream Consumer Audit · 2026-09-17*
