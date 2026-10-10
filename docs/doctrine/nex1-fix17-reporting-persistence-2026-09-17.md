# NEX1 · Fix 17 · Q8 Reporting Consumer + Parallel JSONL Persistence · Runtime-Verified Report

**Date:** 2026-09-17
**Authorization:** Founder Fix 17 Build Authorization prompt · scope α (REPORTING) + γ-2 (PARALLEL JSONL PERSISTENCE)
**External model:** NONE
**Track A status:** FROZEN
**Q7/Fix 15/Fix 16/nex-debugger:** UNCHANGED

---

## STATUS

```
FIX17_STATUS:                RUNTIME_VERIFIED

IMPLEMENTATION:              COMPLETE
RUNTIME:                     VERIFIED (via probe + real runNativeInvestigation)
END_TO_END:                  VERIFIED · closes prior D · TEST/PROOF GAP
REPORTING:                   IMPLEMENTED (POST /api/nex1/investigate/run)
PERSISTENCE:                 IMPLEMENTED (data/nex1-investigation-conclusions/entries.jsonl · append-only)

BETA (re-investigation):     NOT_IMPLEMENTED (per authorization · deliberate)

Q7:                          UNCHANGED (Fix 15 · 19 PASS regression)
Q8 SELECTOR (Fix 16):        UNCHANGED (25 PASS regression)
NEX_DEBUGGER:                INDEPENDENT · UNCHANGED (Decision 2 preserved)
TRACK A:                     FROZEN

EXTERNAL_MODEL:              NONE
FABRICATION:                 0
HIDDEN_TIE_BREAKERS:         0
UNAUTHORIZED_MODIFICATION:   0
UNAUTHORIZED_EXECUTION:      0

COMMITS:                     0
PUSHES:                      0
```

---

## Files Changed

| File | Type | Approx LOC | Purpose |
|---|---|---|---|
| `src/lib/nex-agent/code-engine/investigation-conclusion-store.ts` | **NEW** | ~180 | Append-only JSONL persistence for Q8 selections · defence-in-depth checks · path helpers |
| `src/app/api/nex1/investigate/run/route.ts` | **NEW** | ~120 | POST route · invokes `runNativeInvestigation()` · optional persistence · returns full packet |
| `scripts/nex1-fix17-verification/probe.ts` | **NEW** | ~600 | End-to-end verifier · 23 cases including real pipeline invocation |
| `data/nex1-fix17/receipt-2026-09-17.json` | **NEW** | JSON | Runtime evidence |
| `docs/doctrine/nex1-fix17-reporting-persistence-2026-09-17.md` | **NEW** | doctrine | This report |

**Unchanged (verified via test N-6):**
- Fix 15 · `capability-candidate-ranker.ts`
- Fix 16 · `capability-candidate-selector.ts`
- Fix 12/13/14 · all capability files
- `native-investigation-mode.ts` (no modification for Fix 17)
- `nex-debugger/*` (Decision 2 · INDEPENDENT)
- Q7 policy · Q8 policy · Track A

---

## Data Flow (actual proven runtime path)

```
POST /api/nex1/investigate/run
    body: { problem_statement, repo_root?, ... }
         │
         ▼
runNativeInvestigation({problem_statement, ...})
         │
         ├── ACTION 1..14   (unchanged · Fix 12/13/14/15 pipeline)
         ├── ACTION 15      (Fix 16 Q8 selection)
         └── returns InvestigationEvidencePacket
              (with candidate_selection[])
         │
         ▼
    IF persist !== false AND selections.length > 0:
         appendInvestigationConclusions({selections, repo_root})
              → mkdirSync(recursive)
              → appendFileSync(entries.jsonl, JSON.stringify(entry) + "\n")
              → returns {ok, path, appended_entry_ids, errors}
         │
         ▼
    NextResponse.json({ ok, packet, persistence })
         │
         ▼
    HTTP 200 response · packet returned verbatim · no state translation
```

**Closes the D · TEST/PROOF GAP** identified in the Q8 Downstream Consumer Audit: the Fix 17 verifier's R-1 and R-2 tests invoke the real `runNativeInvestigation()` end-to-end (not a controlled fixture) and confirm both packet emission and persistence flow.

---

## Verification (23/23 PASS · first blind run)

Raw receipt: `data/nex1-fix17/receipt-2026-09-17.json`

### Group R · Real end-to-end runNativeInvestigation()

| # | Case | Result |
|---|---|---|
| R-1 | Real `runNativeInvestigation()` executes · packet.candidate_selection present · zero_llm=true | ✅ PASS |
| R-2 | Real packet flows into persistence · row count matches selection count | ✅ PASS |

### Group P · Positive selection states (6 · all Fix 16 states persist)

| # | Case | Result |
|---|---|---|
| P-SELECTED | Fix 16 emitted SELECTED · JSONL round-tripped · type-lock preserved | ✅ PASS |
| P-TIE | TIE state persisted | ✅ PASS |
| P-NO_SELECTION | NO_SELECTION persisted | ✅ PASS |
| P-INSUFFICIENT_EVIDENCE | INSUFFICIENT persisted | ✅ PASS |
| P-UNRESOLVED | UNRESOLVED persisted | ✅ PASS |
| P-REQUIRE_MORE_INVESTIGATION | REQUIRE_MORE_INVESTIGATION persisted | ✅ PASS |

### Group N · Negative controls (8 · all defensive)

| # | Case | Result |
|---|---|---|
| N-1 | No LLM imports in store or route | ✅ PASS |
| N-2 | No spawn/exec/child_process | ✅ PASS |
| N-3 | No Track A imports (WO-04 / broker / Ed25519 / trust-anchor / G15) | ✅ PASS |
| N-4 | Persistence uses `appendFileSync` only · never `writeFileSync` / `fs.writeFile` · APPEND-ONLY invariant | ✅ PASS |
| N-5 | Route writes ZERO files directly · persistence delegated to store only | ✅ PASS |
| N-6 | Fix 15 · Fix 16 · nex-debugger contain ZERO Fix 17 modifications | ✅ PASS |
| N-7 | Type-lock rejects mutated evidence_kind (PROVEN attempt) · no row written | ✅ PASS |
| N-8 | Forbidden-causal-vocab rejects 'therefore' / 'causes' mutation · no row written | ✅ PASS |

### Group D · Determinism (2)

| # | Case | Result |
|---|---|---|
| D-1 | 5 identical runs produce identical JSONL content (excluding entry_id + timestamp) | ✅ PASS · distinct=1 |
| D-2 | Fix 16 selector determinism preserved through Fix 17 · 5 runs · identical state+candidate | ✅ PASS · distinct=1 |

### Group X · Provenance + policy stamps (4)

| # | Case | Result |
|---|---|---|
| X-1 | Q7 + Q8 policy identities preserved distinctly through round-trip · no overwrite | ✅ PASS |
| X-2 | Provenance array survives round-trip · same length · same source_file byte-for-byte | ✅ PASS |
| X-3 | investigation_id + trace_id preserved | ✅ PASS |
| X-4 | Store path targets `data/nex1-investigation-conclusions` (γ-2 · nex-code-brain untouched) | ✅ PASS |

### Group A · Authority boundary source inspection

| # | Case | Result |
|---|---|---|
| A-1 | Route imports zero Track A · zero nex-debugger · zero WO-2/4/5/13 modules | ✅ PASS |

**Aggregate: 23/23 · FIX17_STATUS = RUNTIME_VERIFIED.**

---

## Authority Boundary (explicit · verified)

| Authority | Q8 has? | Fix 17 introduces? | Evidence |
|---|---|---|---|
| **SELECT** | YES (Fix 16 · unchanged) | preserves via read-only route | Q8-P1 pass · Fix 16 receipt |
| **REPORT** | (new) | YES · HTTP JSON only · zero mutation | R-1 pass · N-5 pass |
| **PERSIST** | (new) | YES · APPEND-ONLY to isolated JSONL · zero MODIFY of any other file | N-4 pass · X-4 pass |
| **MODIFY** | NO | NO · N-4/N-5 verify no writeFileSync/fs.writeFile in Fix 17 files | N-4 · N-5 |
| **EXECUTE** | NO | NO · N-2 verifies zero spawn/exec/child_process | N-2 |
| **AUTHORIZE** | NO | NO · N-3 verifies zero WO-04/broker/Ed25519/trust-anchor/G15 | N-3 · A-1 |
| **VERIFY** | NO | NO · evidence_kind stays INFERRED (never PROVEN) | X-1 · N-7 |
| **DEPLOY** | NO | NO · zero CI/CD hooks · route is read-only + append-only | source inspection |

Fix 17 introduces exactly REPORT + PERSIST authorities. No boundary crossing.

---

## Native / External Model Status

```
NEX1_NATIVE:                        YES
EXTERNAL_MODEL_ASSISTED:            NO
EXTERNAL_MODEL_SELECTION_AUTHORITY: NO
```

Evidence:
- N-1 · grep for `openai|@anthropic|anthropic|@google|groq|llama|ollama|openrouter` in Fix 17 files: **0 matches**
- Store and route declare zero-LLM invariant in headers
- All persistence is deterministic append · no model-derived content

---

## Regression Results

| Probe | Purpose | Exit code | Signals |
|---|---|---|---|
| `nex1-fix12-verification/probe.ts` | Fix 12 hypothesis generator | 0 | `HYPOTHESIS_GENERATION_RUNTIME_VERIFIED` |
| `nex1-fix13-verification/probe.ts` | Fix 13 evidence evaluator | 0 | 5 × RUNTIME_VERIFIED |
| `nex1-fix14-verification/probe.ts` | Fix 14 candidate comparator | 0 | 5 × RUNTIME_VERIFIED |
| `nex1-fix15-verification/probe.ts` | Fix 15 candidate ranker | 0 | 19 PASS |
| `nex1-q8-verification/probe.ts` | Fix 16 Q8 selector | 0 | 25 PASS signals (24 tests + 1 status) |

**No regression.** No prior verifier expectation weakened. Every upstream probe passes at its pre-Fix-17 level.

---

## Persistence Result (actual JSONL write/read evidence)

- Path (production): `data/nex1-investigation-conclusions/entries.jsonl`
- Path (verifier · isolated): `data/nex1-fix17-verifier-scratch/data/nex1-investigation-conclusions/entries.jsonl`
- Structure: one JSON object per line · newline-terminated · UTF-8
- Fields per entry (17 minimum · matches §8 of authorization):
  - `entry_id` (unique · timestamp-derived + 6 hex bytes · e.g. `q8-2026-09-17T...`)
  - `timestamp` (ISO-8601)
  - `investigation_id` · `trace_id` · `source_file` · `selection_state` · `selected_candidate`
  - `candidates_considered` · `rankings_reference` (Q7 policy stamp reference)
  - 4 evidence-id arrays (supporting / contradicting / insufficient / unresolved)
  - `decision_reason` · `confidence` (fixed 0.35 · never a selection factor)
  - `provenance` (source_file + line ranges array)
  - `policy_id` (`NEX1_Q8_SELECTION_POLICY`) · `policy_version` (`V1`)
  - `uncertainty` · `recommended_next_action`
  - `evidence_kind` (type-locked INFERRED)

Round-trip verification (Group X):
- ✅ policy_id and policy_version preserved · both Q7 and Q8 stamps intact
- ✅ provenance array survives (length + source_file exact match)
- ✅ investigation_id + trace_id survive
- ✅ evidence_kind stays "INFERRED"
- ✅ Determinism: 5 identical writes produce identical content (excluding entry_id + timestamp which are deliberately non-deterministic metadata · not decision inputs)

---

## Founder-Authorization Compliance Checklist

Per §2 of authorization ("Fix 17 MAY / MUST NOT"):

| Item | Authorized? | Compliance |
|---|---|---|
| Create reporting consumer | YES | ✅ · POST /api/nex1/investigate/run |
| Connect to runInvestigation() | YES | ✅ · reuses existing `runNativeInvestigation` exported function |
| Expose result through API | YES | ✅ · returns InvestigationEvidencePacket verbatim |
| Persist to separate JSONL | YES | ✅ · `data/nex1-investigation-conclusions/entries.jsonl` |
| Reuse existing API pattern | YES | ✅ · mirrors `native-loop/run` route pattern |
| Reuse Fix 15/16 persistence patterns | YES | ✅ · appendFileSync + entry_id + JSON.stringify pattern |
| Add runtime verification | YES | ✅ · 23-case probe |
| Add integration verification through real runInvestigation() path | YES | ✅ · R-1 and R-2 invoke real pipeline |
| Modify Q8 selection semantics | ❌ FORBIDDEN | ✅ · Fix 16 untouched (N-6) |
| Modify Q7 ranking | ❌ FORBIDDEN | ✅ · Fix 15 untouched (N-6) |
| Modify Fix 12/13/14/15/16 | ❌ FORBIDDEN | ✅ · confirmed untouched |
| Modify Q8 policy | ❌ FORBIDDEN | ✅ · policy documents unchanged |
| Modify nex-debugger | ❌ FORBIDDEN | ✅ · confirmed untouched (N-6) |
| Modify Track A | ❌ FORBIDDEN | ✅ · N-3 verifies zero Track A imports |
| Connect WO-04 | ❌ FORBIDDEN | ✅ · N-3 · A-1 |
| Connect Execution Broker | ❌ FORBIDDEN | ✅ · N-3 |
| Connect Ed25519/G15 | ❌ FORBIDDEN | ✅ · N-3 |
| Authorize anything | ❌ FORBIDDEN | ✅ · route returns HTTP only · no authority claim |
| Modify source files as consequence of Q8 | ❌ FORBIDDEN | ✅ · N-5 route zero writes · N-4 store append-only |
| Execute generated code | ❌ FORBIDDEN | ✅ · N-2 zero spawn/exec |
| Create autonomous correction | ❌ FORBIDDEN | ✅ · no correction path |
| Create re-investigation loops | ❌ FORBIDDEN (β deliberately not built) | ✅ · zero loop code · REQUIRE_MORE_INVESTIGATION is reported and persisted only |
| Add external LLMs | ❌ FORBIDDEN | ✅ · N-1 |
| Use Claude/GPT/Gemini/Llama as selection authority | ❌ FORBIDDEN | ✅ · N-1 · zero LLM imports |
| Commit | ❌ FORBIDDEN | ✅ · 0 commits |
| Push | ❌ FORBIDDEN | ✅ · 0 pushes |
| Deploy | ❌ FORBIDDEN | ✅ · zero deploy hooks |
| Activate production beyond authorized connection | ❌ FORBIDDEN | ✅ · scope limited to α + γ-2 |

**Every §2 constraint honored. Zero silent violations.**

---

## SelectionState Preservation (per §5 authorization)

| State | Fix 16 emits | Fix 17 API returns | Fix 17 persists | Never translated to |
|---|---|---|---|---|
| `SELECTED` | ✅ | ✅ verbatim | ✅ | PROVEN · CORRECT · AUTHORIZED · VERIFIED · MODIFIED · EXECUTED |
| `TIE` | ✅ | ✅ verbatim | ✅ | FAILURE · ROOT_CAUSE_UNRESOLVED |
| `NO_SELECTION` | ✅ | ✅ verbatim | ✅ | ROOT_CAUSE · FALSE |
| `INSUFFICIENT_EVIDENCE` | ✅ | ✅ verbatim | ✅ | FALSE · UNRESOLVED · TIE (merge prohibited) |
| `UNRESOLVED` | ✅ | ✅ verbatim | ✅ | FALSE · INSUFFICIENT_EVIDENCE (merge prohibited) |
| `REQUIRE_MORE_INVESTIGATION` | ✅ | ✅ verbatim | ✅ | auto-triggered re-investigation (β prohibited) |

Honest uncertainty preserved end-to-end.

---

## Capability State (evidence-supported · not inflated)

Per §23 authorization discipline:

- **NOT_FOUND** — rejected
- **DESIGNED_ONLY** — rejected
- **PARTIAL** — rejected
- **COMPONENT_COMPLETE** — Fix 16 was here · Fix 17 upgrades to →
- **SYSTEM_CONNECTED** — ✅ **selected** · Q8 output now flows to a real HTTP endpoint AND to durable JSONL storage · both proven end-to-end via real `runNativeInvestigation()` invocation
- **SYSTEM_ACTIVATED** — Not yet · no production caller of the API is authorized · the endpoint exists but is not yet exercised by any external user or scheduled job
- **VERIFIED** — for the component AND for the end-to-end path via the verifier probe · but NOT for real-user production traffic
- **PRODUCTION_READY** — NOT claimed · this designation requires (a) production traffic evidence and (b) explicit founder activation authorization (see §24 remaining preconditions)

**Correct classification: `SYSTEM_CONNECTED` + `VERIFIED` (end-to-end · deterministic · Track-A-frozen).**

- `SYSTEM_CONNECTED` upgraded from Fix 16's `COMPONENT_COMPLETE` because Fix 17 supplies the missing consumer.
- `VERIFIED` because Fix 17 verifier's R-1/R-2 close the D · TEST/PROOF GAP.
- `PRODUCTION_READY` remains withheld because that's a separate founder activation decision · not an implementation outcome.

---

## Remaining Gaps (not hidden · surfaced)

| Gap | Reason | Options going forward |
|---|---|---|
| Real production caller (not just verifier + test scripts) | No CI job · no scheduled runner · no founder-facing UI invokes `POST /api/nex1/investigate/run` | Separate founder decision · not Fix 17 scope |
| Re-investigation loop (option β) | Deliberately NOT built per authorization · requires prior founder policy on augmentation strategy | Founder-only future decision |
| Persistence retention / rotation | JSONL grows unbounded · no rotation / archival strategy | Small future BUILD if founder authorizes retention policy |
| Reader/query interface over JSONL | Persistence exists · no read API · currently only observable via file read | Separate future scope if founder wants query surface |
| Pre-existing consumer gap for other packet fields | `source_inspections` · `observed_chains` · `hypothesis_evaluations` etc are still unconsumed. Fix 17 focused on Q8 output only. | Not Fix 17 scope · founder-only |
| Pre-existing TypeScript error at `native-investigation-mode.ts:525` | IndependentObserver constructor arg missing · unchanged since Fix 15 report · not caused by Fix 17 | Track separately |

**No hidden gaps. No silent scope expansion.**

---

## Governing Rule Compliance

> Give the Q8 decision somewhere real to go — without giving Q8 powers it does not have.

- ✅ Q8 decision now has a real destination (HTTP response + JSONL persistence)
- ✅ Q8 authority unchanged: SELECT only · never MODIFY · never EXECUTE · never AUTHORIZE
- ✅ Q8 policy V1 unchanged
- ✅ Fix 16 mechanism unchanged
- ✅ Q7 ranking unchanged
- ✅ nex-debugger untouched · Decision 2 respected
- ✅ Track A frozen · zero touches to G15 · C6 · Ed25519 · WO-04 · execution broker
- ✅ Zero external LLM · zero autonomous behaviour · zero re-investigation loop
- ✅ Real end-to-end runtime evidence produced (closes D · TEST/PROOF GAP)
- ✅ Deterministic · reproducible · provenance-preserving

---

## HARD STOP

Per §22 of authorization:

> After implementation and verification, produce the truth-only report and STOP.
> Do not proceed to Fix 18. Do not add re-investigation. Do not activate additional autonomous behaviour.

**STOPPED.**

Awaiting explicit next founder authorization for any further action. Valid founder next moves:

1. **AUTHORIZE FIX 18** for β re-investigation OR retention/rotation OR query interface OR another consumer
2. **AUTHORIZE PRODUCTION ACTIVATION** of `POST /api/nex1/investigate/run` (e.g. wire into a founder-facing UI · scheduled job · CI trigger)
3. **PAUSE** · Q8 stays SYSTEM_CONNECTED · no further consumers built
4. **REJECT REPORT** · verifier interpretation is wrong · restate what to prove differently

No implementation begins without a separate authorization prompt.

---

*End of NEX1 Fix 17 Runtime-Verified Report · 2026-09-17*
