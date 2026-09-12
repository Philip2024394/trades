# ADR-0314i · Stage 1b · Seven Founder Decisions + Anti-Competing-Substrate Invariant · 🔒 LOCKED

**Status:** 🔒 DOCTRINE LOCKED · founder-authored 2026-09-11 · design only · zero code · zero substrate mutation · Stage 1b implementation itself STILL BLOCKED pending separate "AUTHORISE STAGE 1b"
**Founder:** Philip · authored verbatim 2026-09-11 · consuming ADR-0314h §9 seven decision points
**Consumes:** ADR-0314h Stage 1b Wiring (bridge doctrine · §9 seven decision points) · ADR-0314g Acquisition Fabric target architecture (§3 nine-object-type model) · ADR-0314f Guardian Responsibility Reconciliation · ADR-0314a.2.s Stage 1a Exit Report · project memory `project_nex_phase_abc_sequencing_and_acquisition_fabric_2026_09_11.md` · feedback memory `feedback_observation_is_not_constitutional_authority.md` · `feedback_thresholds_are_founder_policy_not_ai_statistics.md`

**Doctrine version:** `stage_1b_founder_decisions.v1.0.0` · **Applies to:** every Stage 1b sub-step ADR · every implementation ADR · every future Acquisition-Fabric Layer implementation

---

## Section 1 · Founder verbatim statement (context)

> *"There are 7 founder decisions deliberately exposed. We should settle those first so Master AI cannot make implementation choices implicitly. ... My proposed locked decision set is [seven decisions plus anti-competing-substrate invariant] ... I would now have Master AI record these seven founder decisions in the appropriate doctrine/decision record, without writing code or touching production."*
>
> — Philip · 2026-09-11 · consuming ADR-0314h §9

---

## Section 2 · Decision D-1b-1 · Legacy coexistence = C-β (freeze legacy AUTHORITATIVE writes)

### 2.1 · Decision (locked)

**C-β · legacy AUTHORITATIVE write path FREEZES at Stage 1b commencement.**

- No new row moves into any specialist substrate (`nex.accommodation_business` · `nex.food_business` · `nex.service_business` · `nex.brain_attractions` · etc.) via the pre-constitutional Lab-verified → executor path once Stage 1b begins.
- Existing historical AUTHORITATIVE data remains **untouched** (retro-adjudication is Stage 2 R-10 territory).
- New Claims flow only through the constitutional pipeline · terminating at `AWAITING_R10` per ADR-0314h §3.1.

### 2.2 · Reason (founder verbatim)

> *"Otherwise we could have: NEW CONSTITUTIONAL PIPELINE → AWAITING_R10 · while LEGACY PIPELINE → AUTHORITATIVE. That would undermine the entire constitutional work we've just completed. C-β gives us a clean forward boundary."*

### 2.3 · How to apply

- Stage 1b sub-step 1b.4 (production adapter): must intercept the four active promotion executors (`accommodation-executor.ts` · `food-executor.ts` · `business-lead-executor.ts` · `activities-executor.ts`) BEFORE they write to specialist substrates.
- At Stage 1b activation: intercepted candidates flow into the constitutional pipeline · executors no longer write directly.
- Existing rows are untouched: no migration · no legacy-tag column · no retroactive reclassification.
- Stage 2 (R-10) may later authorise retroactive review of legacy rows · under its own founder-authored policies.

### 2.4 · What this forbids

- ❌ Any new specialist-table INSERT that bypasses Truth Engine + TE-Guardian
- ❌ Any parallel legacy path that could produce AUTHORITATIVE rows outside the constitutional pipeline
- ❌ Any silent shim that appears to route through the constitutional pipeline but writes to specialist tables anyway
- ❌ Retroactive modification of the ~40,000 existing AUTHORITATIVE rows

---

## Section 3 · Decision D-1b-2 · Lab-Guardian implementation timing

### 3.1 · Decision (locked)

**Lab-Guardian is implemented BEFORE production candidates enter the new constitutional pipeline.**

Concretely: Stage 1b sub-step 1b.3 (Lab-Guardian implementation) must complete and be founder-approved before Stage 1b sub-step 1b.4 (production adapter) commences.

### 3.2 · Reason (founder verbatim)

> *"The Lab-Guardian should be implemented as part of Stage 1b before production candidates are allowed through the new constitutional pipeline. The separation remains: Lab-Guardian → Truth Engine → TE-Guardian → R-10. No overlap."*

### 3.3 · How to apply

- Sub-step 1b.3 authors `src/lib/nex/lab-guardian/*` per ADR-0314f responsibility split (candidate acceptance · structural/safety · `lab.` rejection prefix)
- Lab-Guardian consumes candidates from acquisition · emits ACCEPT/REJECT decisions to `nex.gate_kept_event` / `nex.gate_rejection_event` (preserved substrate) or newly-namespaced tables per §9 anti-competing-substrate invariant
- Sub-step 1b.4 (production adapter) then bridges Lab-Guardian OUTPUT → Truth Engine INPUT
- No production candidate reaches Truth Engine without Lab-Guardian ACCEPT

### 3.4 · What this forbids

- ❌ Sub-step 1b.4 shipping before 1b.3 is founder-approved
- ❌ Production adapter shipping a "no-op Lab-Guardian" placeholder
- ❌ Lab-Guardian enforcing constitutional truth (per ADR-0314f invariant §6.1)
- ❌ TE-Guardian being asked to enforce candidate structural safety (per ADR-0314f invariant §6.2)

---

## Section 4 · Decision D-1b-3 · Shadow mode duration = acceptance criteria (NOT calendar time)

### 4.1 · Decision (locked)

**Shadow mode continues until founder-approved acceptance conditions are demonstrated. NOT a fixed calendar window.**

### 4.2 · Reason (founder verbatim)

> *"I would not say '7 days' or '14 days.' Instead: Shadow mode continues until the founder-approved acceptance conditions are demonstrated. That prevents time becoming constitutional authority."*

Aligned with `feedback_observation_is_not_constitutional_authority.md`: time-based rollouts implicitly grant "N days elapsed" the authority to promote a stage · which is not a founder decision · it's a clock.

### 4.3 · Founder-authored acceptance criteria (locked · observed by Master AI · decided by founder)

Master AI observes and reports each of the following; founder decides when the 1b.5 → 1b.6 gate opens:

- Deterministic repeatability (byte-identical output across repeated verification runs on identical inputs)
- Expected verdict distribution per Domain (PASS · FAIL · UNKNOWN · CANDIDATE_FLAG · CONTRADICTION_RECORDED shape matches what the founder-authored policy + pending-policy UNKNOWN mix would predict)
- Unexpected rejection rate (surface systemic issues · `te.` codes that appear at unexpected volume)
- Envelope integrity (100% of envelopes carry `verifier_instance_id` · `rule_set_version` · `guardian_version` · `objectSnapshotRef` · valid `verdictAt`)
- No production corruption (specialist tables unchanged · Lab-Guardian ledger unchanged · Stage 1a `nex_test.*` unchanged)
- No unexplained divergence (any run-to-run difference has a documented cause)
- Legacy-vs-new verdict comparison (what would the legacy executor have promoted? what does the constitutional pipeline decide? · shadow-mode captures both for founder review)
- Audit completeness (every Claim in the sample workload traceable from Raw Capture through Verifier verdict through Guardian decision · reproducible on demand)

### 4.4 · How to apply

- Sub-step 1b.5 (shadow rollout) runs indefinitely (no timer) until founder issues explicit "SHADOW-MODE ACCEPTANCE CONDITIONS MET · OPEN REJECTION-ACTIVE GATE"
- Master AI reports metrics continuously · never claims acceptance
- Master AI does NOT compute a "readiness score" and act on it

### 4.5 · What this forbids

- ❌ Auto-advance from 1b.5 to 1b.6 based on any calendar duration
- ❌ Auto-advance based on any observed-metric threshold
- ❌ Master AI declaring "acceptance conditions met · advancing"
- ❌ Silent metric-driven promotion (per `feedback_observation_is_not_constitutional_authority.md`)

---

## Section 5 · Decision D-1b-4 · Rejection-active scope = start NARROW

### 5.1 · Decision (locked)

**When 1b.6 opens, rejection-active mode applies ONLY to the specific production write paths explicitly adapted to the new constitutional pipeline. Everything else remains untouched.**

### 5.2 · Reason (founder verbatim)

> *"Don't turn the entire NEX knowledge universe into rejection-active on day one. Start with the specific production write paths that have been explicitly adapted to the new constitutional pipeline. Everything else remains untouched. That gives us a controlled blast radius."*

### 5.3 · How to apply

- Sub-step 1b.4 (production adapter) enumerates the specific paths adapted (initially small · e.g. one executor · one Domain)
- Sub-step 1b.6 (rejection-active) activates rejection ONLY on the enumerated paths
- Non-enumerated paths continue to run per C-β decision D-1b-1 (i.e., they are frozen with respect to new AUTHORITATIVE writes · but their existing state persists)
- Expansion to additional paths requires **separate founder authorisation per path**

### 5.4 · What this forbids

- ❌ Wholesale activation across all Domains simultaneously
- ❌ Adding new adapted paths at 1b.6 without founder authorisation
- ❌ Assumption that "activation covers everything similar" (analogy is not authorisation)

---

## Section 6 · Decision D-1b-5 · Shadow → rejection gate = founder-authored criteria (NOT AI-derived thresholds)

### 6.1 · Decision (locked)

**The 1b.5 → 1b.6 gate is opened by founder-authored criteria + explicit founder gate. Master AI reports observations. Founder decides.**

### 6.2 · Reason (founder verbatim)

> *"Observed data can tell NEX what is happening. It cannot tell NEX what the constitutional policy should be. So Master AI can report: 'Here are the observed results.' But it must not decide: 'Therefore 98.7% is good enough and we should activate rejection.' Founder decides the gate."*

Aligned with `feedback_observation_is_not_constitutional_authority.md` and `feedback_thresholds_are_founder_policy_not_ai_statistics.md`.

### 6.3 · How to apply

- Master AI produces observation reports at founder-determined cadence
- Report format is factual: "Observed: `te.reason_not_canonical` fired 3 times in 10,000 candidates · sources X and Y produced them"
- Report never includes a recommendation to advance
- Report never includes a "readiness percentage"
- Founder issues explicit "OPEN REJECTION-ACTIVE" · which is the ONLY way to transition 1b.5 → 1b.6

### 6.4 · What this forbids

- ❌ Master AI computing a "constitutional readiness score"
- ❌ Master AI setting a threshold (e.g. "when rejection rate < 1%, advance")
- ❌ Auto-advancement of any kind
- ❌ Retroactive interpretation of past acceptance as authority for present promotion

---

## Section 7 · Decision D-1b-6 · Entity Resolution / Location / Source Registry / Knowledge Gap Registry = PARALLEL implementation streams · NOT prerequisites

### 7.1 · Decision (locked)

**Entity Resolution · Location Intelligence · Source Registry · Knowledge Gap Registry are PARALLEL implementation streams. They MUST conform to Phase C architecture (ADR-0314g). They MUST NOT block Stage 1b Truth Engine wiring.**

### 7.2 · Reason (founder verbatim)

> *"Stage 1b's job is proving the constitutional production path. The Acquisition Fabric's Layer C/F machinery is a separate implementation stream. If we block Stage 1b until Entity Resolution, Location, Source Registry and Knowledge Gap are all implemented, we risk turning one controlled implementation into another enormous dependency chain."*

### 7.3 · Sequencing (locked)

```
                     STAGE 1b
              Constitutional path
                    │
     ┌──────────────┼──────────────┐
     │              │              │
     ▼              ▼              ▼
Entity          Location       Source Registry ·
Resolution      Intelligence   Knowledge Gap Registry
     │              │              │
     ├──────┬───────┘              │
            ▼                      ▼
      Acquisition Fabric (Phase C convergence)
            │
            ▼
      Knowledge-gap-driven loop (Layer F)
```

Each stream:
- Has its own founder-authored implementation ADR (per Phase C Layer implementation ADRs candidate slots)
- Must conform to ADR-0314g architecture (nine-object-type model · six-layer fabric · country-config not code)
- May run before · alongside · or after Stage 1b depending on founder sequencing
- Does NOT gate Stage 1b activation

### 7.4 · How to apply

- Stage 1b Truth Engine + TE-Guardian activation MUST work with the current substrate: Claims arrive without full Entity Resolution · without hierarchical Location · without Source Registry · without Knowledge Gap Registry
- Where a rule requires evidence not yet available (e.g. R-05 authority registry entries), the rule returns UNKNOWN per its ADR-locked fail-closed doctrine
- When Entity Resolution / Location / Source Registry / Knowledge Gap Registry come online, they extend the pipeline · they do not restructure Stage 1b

### 7.5 · What this forbids

- ❌ Blocking Stage 1b on "Entity Resolution must exist first"
- ❌ Master AI silently building a stub Entity Resolution / Location / Source Registry inside Stage 1b
- ❌ Any implementation of these Layers that violates the ADR-0314g nine-object-type model or six-layer fabric

---

## Section 8 · Decision D-1b-7 · Production determinism = two levels (mandatory + continuous)

### 8.1 · Decision (locked)

**Two levels of production determinism enforcement:**

- **Mandatory** · deterministic verification on every verifier · rule module · Guardian release BEFORE promotion to production
- **Continuous** · scheduled production determinism / canary checks (frequency founder-authored per release cadence)
- **Failure handling** · production determinism failure STOPS the relevant constitutional path · does NOT silently continue

### 8.2 · Reason (founder verbatim)

> *"Production determinism failure must stop the relevant constitutional path rather than silently continuing."*

Preserves the Stage 1a byte-identical determinism proof at production scale · applied to every future release.

### 8.3 · How to apply

- **Mandatory pre-release check**: any change to `src/lib/nex/truth-engine/verifier/*` · `rules/*` · `guardian/*` requires a byte-identical determinism proof (analog of Stage 1a sub-step 1a.7) before founder authorises production promotion
- **Continuous canary**: on a founder-authored cadence (e.g. daily · weekly · founder decides), the fixture suite runs against production verifier/Guardian and confirms byte-identical output against the pinned expected suite
- **Failure semantics**: if canary detects divergence, the affected path is HALTED (freeze that specific adapted production write path) · founder is notified · determinism cause is investigated before resumption
- **No silent continuation**: no timer · no auto-recovery · no "retry-until-passes" behaviour · determinism failure is a founder-visible event

### 8.4 · What this forbids

- ❌ Promoting new verifier / rule / Guardian code without a pre-release determinism proof
- ❌ Silent auto-recovery from canary failures
- ❌ Interpreting an intermittent divergence as "flakiness · retry"
- ❌ Continuing production writes when the canary fails
- ❌ Master AI deciding "this divergence is minor · continue"

---

## Section 9 · Locked invariant · anti-competing-knowledge-substrate

### 9.1 · The problem (founder verbatim)

> *"I would not let the new nex.claim / nex.evidence tables accidentally become another competing knowledge substrate. ... We don't want: nex.claim · nex.evidence · nex.knowledge · specialist tables · Supabase knowledge to gradually become five competing truths."*

### 9.2 · Locked invariant

**There is ONE canonical Knowledge substrate in NEX at any given time. The Claim + Evidence layer supports the constitutional pipeline; it is NOT itself canonical Knowledge. The specialist tables and Supabase knowledge are DOMAIN-STORAGE for canonical Knowledge produced by the pipeline; they are NOT separate truths.**

### 9.3 · Substrate role clarification (locked)

| Substrate | Role | Truth status |
|---|---|---|
| `nex.claim` (new · Stage 1b) | Per-Claim row in the constitutional pipeline · one row per attribute-assertion under verification | **PIPELINE INTERMEDIATE** · NOT canonical Knowledge |
| `nex.evidence` (new · Stage 1b) | Per-Evidence row · immutable trace linking Claim → Raw Capture → Source | **PIPELINE PROVENANCE** · NOT canonical Knowledge |
| `nex.claim_verification_state` (new · Stage 1b) | Tracks each Claim's state (ACQUIRED · LAB_CANDIDATE_ACCEPTED · ... · AWAITING_R10) | **PIPELINE STATE** · NOT canonical Knowledge |
| `nex.verifier_verdict` (new · Stage 1b) | Truth Engine `VerdictEnvelope` per Claim | **PIPELINE VERDICT** · NOT canonical Knowledge |
| `nex.knowledge_records` (existing) | Founder-authored canonical Knowledge record set | **CANONICAL KNOWLEDGE** (existing behaviour preserved · Stage 2 R-10 governs future writes) |
| Specialist tables (`nex.accommodation_business` · `nex.food_business` · `nex.service_business` · `nex.brain_attractions` · etc.) | Domain-shaped storage of canonical Knowledge (post-authorisation) | **CANONICAL KNOWLEDGE · Domain view** (existing rows preserved · new rows Stage 2 gated per D-1b-1) |
| Supabase knowledge (nex knowledge tables in cloud) | Same-role · cloud-mirror of canonical Knowledge (per §7.8 J1 physical vs logical authority) | **CANONICAL KNOWLEDGE · cloud view** (per §7.8 J1 discipline · physical location does not determine logical authority) |

### 9.4 · How the Router preserves the distinction

The Knowledge Router (ADR-0314g Layer E2) MUST:

- Query CANONICAL Knowledge sources when serving user queries · never `nex.claim` / `nex.evidence` / `nex.verifier_verdict` / `nex.claim_verification_state`
- Treat pipeline substrates as internal audit trail · not as query surface
- Compose an answer by walking: Router → canonical Knowledge (specialist tables · knowledge_records · Supabase) → optionally Evidence chain (for "where did this come from?") · never by aggregating Claims-in-flight

### 9.5 · How the Truth Engine preserves the distinction

The Truth Engine produces VERDICTS about Claims · not Knowledge. TE-Guardian's ACCEPT means "constitutionally sound Claim". R-10's AUTHORISE (Stage 2) means "authorised to write to canonical Knowledge". The transition from Claim → Knowledge happens ONLY at R-10 · not at TE-Guardian ACCEPT · not at Truth Engine PASS.

### 9.6 · Enforcement (doctrine · not implemented)

- **Every downstream ADR referencing `nex.claim` · `nex.evidence` · `nex.verifier_verdict` · `nex.claim_verification_state` MUST declare "PIPELINE substrate, NOT canonical Knowledge".**
- **Every Router / query path ADR MUST declare its canonical Knowledge source.** Any ADR that would let the Router return data drawn from `nex.claim` or `nex.verifier_verdict` fails review.
- **Every future Layer implementation ADR (Entity Resolution · Location · Source Registry · Knowledge Gap Registry per D-1b-6) MUST preserve this distinction.**
- **Every Stage 2 R-10 policy ADR MUST author the specific Claim → Knowledge transition semantics · without collapsing Claim and Knowledge into the same substrate.**

### 9.7 · What this forbids

- ❌ The Router serving Claims-in-flight as if they were Knowledge
- ❌ Any specialist table storing Claim rows alongside Knowledge rows without an authoritative marker
- ❌ Downstream code treating `nex.verifier_verdict.truth_engine_ok=true` as promotion to Knowledge (verdict integrity ≠ authorisation · per ADR-0314f)
- ❌ Silent conflation of Supabase knowledge tables with cloud-shadow-of-Claim tables
- ❌ Five (or more) competing truths accreting over time

---

## Section 10 · Summary matrix · seven decisions locked

| # | Decision | Locked value | Reason |
|---:|---|---|---|
| D-1b-1 | Legacy coexistence | **C-β · freeze legacy AUTHORITATIVE writes** | Prevents parallel-legacy pipeline undermining the constitutional work |
| D-1b-2 | Lab-Guardian timing | **Implement 1b.3 BEFORE production candidates enter (1b.4)** | Preserves Lab-Guardian → Truth Engine → TE-Guardian → R-10 ordering |
| D-1b-3 | Shadow duration | **Acceptance criteria · NOT calendar time** | Time is not constitutional authority |
| D-1b-4 | Rejection-active scope | **Start narrow · only adapted paths · everything else untouched** | Controlled blast radius |
| D-1b-5 | 1b.5 → 1b.6 gate | **Founder-authored criteria + explicit founder gate** | Observation ≠ constitutional authority |
| D-1b-6 | ER / Location / Source Registry / Knowledge Gap | **Parallel implementation streams · NOT prerequisites for 1b** | Prevents dependency-chain expansion |
| D-1b-7 | Production determinism | **Mandatory pre-release + continuous canary · failure STOPS path** | Preserves Stage 1a determinism at production scale |
| + | Anti-competing-substrate | **ONE canonical Knowledge substrate · Claim/Evidence are pipeline · NOT Knowledge** | Prevents 5 competing truths |

---

## Section 11 · What this ADR did NOT do

- ❌ No code authored
- ❌ No migrations authored
- ❌ No schema changes
- ❌ No substrate mutation (`nex.*` · `nex_test.*` · `nex_lab_*` · Supabase all frozen)
- ❌ No AUTHORITATIVE writes
- ❌ No Lab-Guardian implementation
- ❌ No production adapter authored
- ❌ No new tables created
- ❌ No verifier · rule · Guardian · fixture · runner modified
- ❌ No ADR-0314h · 0314g · 0314f · Stage 1a Exit Report modified (each stands as authored)
- ❌ No shadow-mode acceptance thresholds hardcoded (§4.3 lists observation categories · founder decides gate)
- ❌ No metric thresholds authored (§6.3 forbids AI-derived thresholds)
- ❌ No specific canary cadence hardcoded (§8.3 defers to founder)
- ❌ No Entity Resolution · Location · Source Registry · Knowledge Gap Registry implemented
- ❌ No consolidation of duplicated machinery
- ❌ No Lab restructuring
- ❌ No country expansion
- ❌ No Category taxonomy population
- ❌ No pending policy population (R-03 · R-05 · R-07 · R-12 · R-20 remain UNKNOWN)
- ❌ No English Brain expansion
- ❌ No autonomous operation authorised
- ❌ **No "AUTHORISE STAGE 1b" issued** · Stage 1b implementation remains BLOCKED

---

## Section 12 · Decision provenance footer

| Field | Value |
|---|---|
| **Decision** | Seven Stage 1b founder decisions locked: (D-1b-1) legacy coexistence = C-β freeze · (D-1b-2) Lab-Guardian before production candidates · (D-1b-3) shadow duration = acceptance criteria not calendar · (D-1b-4) rejection-active starts narrow · (D-1b-5) shadow→rejection gate = founder-authored criteria + explicit gate · (D-1b-6) ER/Location/Source Registry/Knowledge Gap = parallel streams · NOT prerequisites · (D-1b-7) production determinism = mandatory + continuous · failure stops path. PLUS anti-competing-knowledge-substrate invariant: ONE canonical Knowledge substrate · Claim/Evidence are pipeline · NOT Knowledge. |
| **Decided by** | Philip |
| **Decision date** | 2026-09-11 |
| **ADR** | 0314i · this file · consumed by every future Stage 1b sub-step ADR · every Acquisition Fabric Layer implementation ADR · every Stage 2 R-10 policy ADR · Router query surface ADRs |
| **Effective from** | `stage_1b_founder_decisions.v1.0.0` |
| **Supersedes** | none (first-time locking of the seven ADR-0314h §9 decision points) |
| **Reason** | Founder verbatim: *"We should settle those first so Master AI cannot make implementation choices implicitly."* This ADR removes seven implicit implementation choices from Master AI's autonomy and locks them as founder policy. |

---

## Section 13 · Cross-references

**Consumed by (future ADRs):**
- Stage 1b sub-step 1b.1 migration ADR
- Stage 1b sub-step 1b.2 apply ADR
- Stage 1b sub-step 1b.3 Lab-Guardian implementation ADR
- Stage 1b sub-step 1b.4 production adapter ADR
- Stage 1b sub-step 1b.5 shadow rollout ADR
- Stage 1b sub-step 1b.6 rejection-active rollout ADR
- Stage 1b sub-step 1b.7 determinism proof ADR
- Stage 1b sub-step 1b.8 Stage 1b Exit Report ADR
- Stage 2 R-10 authorisation policy ADRs
- Acquisition Fabric Layer implementation ADRs (Entity Resolution · Location · Source Registry · Knowledge Gap Registry)
- Any Router / query surface ADR (must respect anti-competing-substrate invariant §9)
- Any Stage 1a foundation release ADR (must respect production determinism D-1b-7)

**Consumes:**
- ADR-0314h Stage 1b Wiring (bridge doctrine · §9 seven decision points now resolved)
- ADR-0314g NEX Acquisition Fabric Target Architecture (§3 nine-object-type model · §6 fit map)
- ADR-0314f Guardian Responsibility Reconciliation (Lab-Guardian ≠ TE-Guardian ≠ R-10)
- ADR-0314a.2.s Stage 1a Exit Report (foundation preserved)
- ADR-0314e Truth Engine Verifier Implementation (D-Impl)
- §7.3-B1 · §7.7 H1 · §7.8 J1 · §7.10 M1 · R-DOMAIN-01 · R-10 gate-model
- Project memory `project_nex_phase_abc_sequencing_and_acquisition_fabric_2026_09_11.md`
- Feedback memories: `feedback_observation_is_not_constitutional_authority.md` · `feedback_thresholds_are_founder_policy_not_ai_statistics.md` · `feedback_guardian_duality_lab_te_r10.md` · `feedback_no_crawler_zoo_acquisition_fabric_target.md` · `feedback_knowledge_gap_driven_acquisition.md`

---

## Section 14 · Master AI STOPS · awaiting founder "AUTHORISE STAGE 1b"

**Master AI does NOT autonomously proceed to sub-step 1b.1 or any Stage 1b work.** Each Stage 1b sub-step requires a separate founder authorisation · beginning with an explicit "AUTHORISE STAGE 1b · SUB-STEP 1b.1 ONLY" (per Stage 1a one-at-a-time discipline).

**Current position:**

- Phase A · Stage 1a · 🟢 COMPLETE
- Phase B · Guardian reconciliation · 🟢 LOCKED (ADR-0314f)
- Phase C · Acquisition Fabric · 🟢 LOCKED (ADR-0314g)
- Stage 1b Wiring bridge · 🟢 LOCKED (ADR-0314h)
- **Stage 1b Founder Decisions · 🟢 LOCKED (this ADR · ADR-0314i)**
- Stage 1b implementation itself · 🔴 BLOCKED pending explicit "AUTHORISE STAGE 1b · SUB-STEP 1b.1 ONLY"

**Substrate posture:**

- Production `nex.*` · 💾 FROZEN
- `nex_lab_*` · 💾 FROZEN
- Supabase · 💾 FROZEN
- `nex_test.*` · 💾 stable · no writes by this ADR
- Gate 3 · 🟢 OPEN
- Legacy AUTHORITATIVE write path · 🔒 will freeze on Stage 1b commencement per D-1b-1 · currently unchanged (Stage 1b not yet commenced)

---

**End of ADR-0314i · Seven Stage 1b Founder Decisions + Anti-Competing-Substrate Invariant · locked · Stage 1b implementation itself remains BLOCKED pending explicit founder "AUTHORISE STAGE 1b · SUB-STEP 1b.1 ONLY".**
