# ADR-0314f · Guardian Responsibility Reconciliation · 🔒 DOCTRINE LOCKED · Phase B (design only)

**Status:** 🔒 DOCTRINE LOCKED · founder-authorised Phase B 2026-09-11 · design only · zero code · zero substrate mutation · Stage 1b remains BLOCKED
**Founder:** Philip · authorised via verbatim "AUTHORISE PHASE B" 2026-09-11
**Consumes:** ADR-0314a.2.s Stage 1a Exit Report · ADR-0314a.2.s NEX Lab / Crawler / Scraper / Acquisition Architecture Audit · ADR-0314e Truth Engine Verifier Implementation (D-Impl) · §7.3-B1 five-axis architecture · §7.7 H1 (`other` ≠ `unknown`) · R-DOMAIN-01 · R-10 gate-model doctrine (2026-09-11 consolidation) · project memory `project_nex_phase_abc_sequencing_and_acquisition_fabric_2026_09_11.md` · feedback memory `feedback_guardian_duality_lab_te_r10.md`

**Doctrine version:** `guardian_responsibility_split.v1.0.0` · **Effective from:** Phase B founder approval · **Applies to:** every future acquisition · verification · promotion · authorisation ADR

---

## Section 1 · Founder verbatim authorisation

> *"I agree with Master AI's η recommendation. But I would go one step further: don't simply choose 'unify / layer / retire.' Define the responsibilities first. ... That gives the two Guardians different jobs, rather than two competing Guardians. Lab Guardian should answer: 'Is this candidate sufficiently well-formed and safe to enter the NEX knowledge pipeline?' It should not decide ultimate truth or AUTHORITATIVE status. Truth Engine Guardian should answer: 'Does this object satisfy NEX's constitutional truth/promotion requirements?' Then R-10 Answers: 'Is this particular object type authorised to become AUTHORITATIVE under founder policy?' That is a clean separation."*
>
> — Philip · 2026-09-11 · Phase B strategic lock

> *"AUTHORISE PHASE B ... let it produce only the Guardian Responsibility Reconciliation ADR. No code. No migrations. No substrate writes. No Stage 1b. No taxonomy population. No English Brain work."*
>
> — Philip · 2026-09-11 · Phase B execution authorisation

---

## Section 2 · The problem this ADR solves

Two Guardians now exist in NEX:

| Guardian | Location | Provenance | Scope today |
|---|---|---|---|
| **Lab-Guardian** | Live production · `nex.gate_kept_event` (2,300 events) · `nex.gate_rejection_event` (368 events) | Predates Stage 1a · has been running through Lab-verification pipelines | Enforces Lab-verification rules at candidate acceptance boundary |
| **Truth-Engine-Guardian (TE-Guardian)** | Isolated code · `src/lib/nex/truth-engine/guardian/*` · 24 canonical rejection codes · `nexTestWritesPermitted=false` at Stage 1a | Shipped 2026-09-11 in sub-step 1a.5 · proven via 33 fixtures + 5-run byte-identical determinism | Enforces R-18 envelope integrity · §7.7 H1 named-reason discipline · UNKNOWN→PASS · FAIL→PASS silent-conversion detection · R-10 injection blocking · production/lab/nex_test write rejection |

Without a founder-authored responsibility split, these two Guardians would either (a) compete at the same substrate boundary at Stage 1b commencement, or (b) one would be silently retired without preserving its role. Either failure mode is architecturally unacceptable per founder direction.

**This ADR locks the three-way responsibility split so that neither Guardian is retired · neither is silently unified · both preserve distinct jurisdictions.**

---

## Section 3 · The three-way responsibility split (locked)

Founder-authored 2026-09-11. Locked. No amendment without explicit founder-authored versioning-policy ADR.

### 3.1 · Lab-Guardian

**Answers:** *"Is this candidate sufficiently well-formed and safe to enter the NEX knowledge pipeline?"*

**Jurisdiction:** the candidate acceptance boundary between raw acquisition and NEX knowledge processing.

**Concerns:**
- Structural integrity of the candidate row (required fields present · types valid · encoding correct)
- Source provenance recorded (source_reference · authority chain fragment · licence)
- Rate-limit / robots / politeness compliance already honoured by acquisition
- Anti-corruption checks (obvious garbage · truncated JSON · encoding errors · malformed geospatial · illegal characters)
- Reasonable safety posture (no obviously-malicious payload · no unresolved deference-to-humans marker)
- Domain classification suggestion attached (Layer B Discovery Orchestrator supplies)

**Does NOT decide:**
- Whether the claim is TRUE (that is TE-Guardian territory)
- Whether the row may become AUTHORITATIVE (that is R-10 territory)
- Whether existing AUTHORITATIVE knowledge should be modified (that is TE-Guardian + R-10 chain)
- Whether contradictions with existing knowledge should trigger consequences (that is R-20 territory)

**Output:** Lab-Guardian ACCEPT means "candidate passes structural/safety gate · ready for Truth Engine input". Lab-Guardian REJECT means "candidate malformed at the acquisition boundary · does not enter the pipeline · reason recorded".

**Existing substrate remains authoritative:** `nex.gate_kept_event` (permit) + `nex.gate_rejection_event` (reject) preserve Lab-Guardian's ledger. This ADR does NOT modify · rename · or migrate those tables.

### 3.2 · Truth-Engine-Guardian (TE-Guardian)

**Answers:** *"Does this object satisfy NEX's constitutional truth/promotion requirements?"*

**Jurisdiction:** the constitutional truth boundary between verified candidate and promotion-eligible verdict.

**Concerns:**
- R-18 verdict envelope integrity (`verifier_instance_id` · `rule_set_version` · `guardian_version` · `objectSnapshotRef` present · ISO-8601 timestamps)
- Per-rule verdict identity integrity (ruleId matches · ruleVersion matches · no duplicate ruleId in `perRuleVerdicts`)
- §7.7 H1 named-reason enforcement (every UNKNOWN/FAIL/CONTRADICTION_RECORDED verdict carries a canonical reason from `CANONICAL_FAIL_CLOSED_REASONS`)
- Aggregate integrity (`truthEngineOk` recomputed from `perRuleVerdicts` · silent UNKNOWN→PASS conversion detected · silent FAIL→PASS conversion detected)
- Anti-substitution invariants at verdict level (per R-DOMAIN-01)
- Constitutional discipline (`authorisationPolicyRef` null at Stage 1a · non-null values rejected as smuggled R-10)

**Does NOT decide:**
- Whether the candidate is structurally well-formed (that was Lab-Guardian's decision · upstream)
- Whether the row is AUTHORISED to become AUTHORITATIVE for its LAM Object Type · Domain · substrate (that is R-10 territory)
- What policy governs authoritative promotion (that is R-10 territory)

**Output:** TE-Guardian ACCEPT means "verdict envelope is constitutionally sound · ready for R-10 authorisation check". TE-Guardian REJECT means "envelope violates constitutional truth requirements · verdict discarded · reason recorded".

**Substrate posture:** at Stage 1a · TE-Guardian writes only to `nex_test.gate_kept_event` / `nex_test.gate_rejection_event` (via the isolated `nex_test.*` schema). At Stage 1b · TE-Guardian will write to a distinct substrate from `nex.gate_kept_event` (Lab-Guardian's ledger). Substrate naming to be authored in the Stage 1b wiring ADR (not this ADR).

### 3.3 · R-10 (authorisation policy · Stage 2)

**Answers:** *"Is this particular object type authorised to become AUTHORITATIVE under founder policy?"*

**Jurisdiction:** the authorisation boundary between constitutionally-sound verdict and AUTHORITATIVE row.

**Concerns:**
- Per-LAM-Object-Type authorisation policy (accommodation vs food vs commerce vs services etc.)
- Per-Domain authorisation policy (may vary by Domain per founder-authored policy)
- Per-substrate authorisation policy (may vary by target table)
- Authority chain evaluation (`source_reference` traceable to a registered authority per R-05 when populated)
- Confidence-band-vs-target-substrate policy (per D-11 · a band=very_low verdict cannot promote to AUTHORITATIVE even if TE-Guardian accepted)

**Does NOT decide:**
- Whether the candidate was well-formed (Lab-Guardian)
- Whether the verdict was constitutionally sound (TE-Guardian)
- Whether any single R-XX rule fires (Truth Engine internal · verified by TE-Guardian)

**Output:** R-10 AUTHORISE means "verdict may write to AUTHORITATIVE substrate · row promoted". R-10 NOT_AUTHORISED means "verdict is constitutionally sound but not authorised for this target · row remains DRAFT · reason recorded".

**Substrate posture:** R-10 does not exist yet. Stage 2 authors it. This ADR simply locks R-10's responsibility so that no future ADR silently expands TE-Guardian into an authorisation engine or reduces R-10 into a truth engine.

### 3.4 · Boundary invariant

**No rule of any kind may live in two of the three gates.** A rule is either:
- Structural/safety (Lab-Guardian) · or
- Constitutional truth (TE-Guardian) · or
- Authorisation policy (R-10)

If a rule feels like it belongs to two, the reconciling ADR MUST decompose it into distinct rules that each live in exactly one gate.

---

## Section 4 · Pipeline ordering + handoff mechanics

The founder-locked pipeline (from `project_nex_phase_abc_sequencing_and_acquisition_fabric_2026_09_11.md`):

```
ACQUISITION FABRIC
      │
      ▼
CANDIDATE ROW
      │
      ▼
LAB-GUARDIAN  ── REJECT (record · drop) ──▶ [pipeline stops]
      │
      │ ACCEPT
      ▼
TRUTH ENGINE (10 rules · verifier produces VerdictEnvelope)
      │
      ▼
TE-GUARDIAN  ── REJECT (record · discard verdict) ──▶ [pipeline stops]
      │
      │ ACCEPT
      ▼
R-10 (authorisation policy · Stage 2)
      │
   ┌──┴───┐
   │      │
NOT_AUTH  AUTHORISED
   │      │
   ▼      ▼
DRAFT   AUTHORITATIVE (write to NEX Storage)
```

**Handoff rules:**

1. **Acquisition → Lab-Guardian**: candidate row arrives with source reference · claim payload · Domain suggestion. Lab-Guardian inspects and issues ACCEPT / REJECT.
2. **Lab-Guardian ACCEPT → Truth Engine**: accepted candidate becomes an input to the verifier. The verifier produces a `VerdictEnvelope` with `perRuleVerdicts` for R-01 through R-20.
3. **Truth Engine → TE-Guardian**: TE-Guardian inspects the envelope for constitutional integrity + inspects any proposed post-verifier action (`envelope_only` · `promote_to_authoritative` · `apply_r10_authorisation` · `write_production`).
4. **TE-Guardian ACCEPT → R-10 (Stage 2)**: envelope with `truthEngineOk=true` and no rejections proceeds to R-10 authorisation check. TE-Guardian ACCEPT does NOT itself write anywhere · R-10 (or its absence) governs the write.
5. **R-10 AUTHORISED → AUTHORITATIVE write**: only R-10 issues the authorisation. Truth Engine and TE-Guardian cannot promote anything to AUTHORITATIVE.

**Every stage records its decision · every rejection carries a named reason · every acceptance carries evidence of what was inspected.**

---

## Section 5 · Rejection code separation

Rejection codes MUST be namespaced by Guardian to prevent conflation:

| Prefix | Owner | Example |
|---|---|---|
| `lab.` | Lab-Guardian | `lab.malformed_source_reference` · `lab.encoding_error` · `lab.provenance_missing` |
| `te.` | TE-Guardian | `te.unknown_verdict_missing_reason` · `te.truth_engine_ok_recompute_mismatch` · `te.authorisation_policy_ref_non_null_at_stage_1a` |
| `r10.` | R-10 (Stage 2) | `r10.no_policy_for_lam_object_type` · `r10.band_below_promotion_threshold` · `r10.authority_chain_broken` |

**Existing TE-Guardian rejection codes (from sub-step 1a.5 · 24 codes) are already anchored in the TE-Guardian jurisdiction and do NOT require renaming.** However, when Phase C wires acquisition into the pipeline, ALL new Lab-Guardian rejection codes MUST carry the `lab.` prefix and MUST NOT overlap with existing TE-Guardian codes.

Guardian at each stage MUST reject an envelope/candidate carrying a rejection code from another Guardian's namespace as **misrouting** — a defensive invariant preventing accidental cross-Guardian rule migration.

---

## Section 6 · Anti-overlap invariants (locked)

Six invariants that hold across every future ADR touching any Guardian:

1. **Lab-Guardian MUST NOT enforce constitutional truth.** No `truth_engine_ok` recomputation. No R-XX rule evaluation. No named-reason canonicality check for verdict envelopes. Lab-Guardian works on CANDIDATE rows · not envelopes.

2. **TE-Guardian MUST NOT enforce candidate acceptance.** No source-reference structural check. No encoding validation. No provenance-required check. TE-Guardian works on ENVELOPES · not candidate rows.

3. **TE-Guardian MUST NOT decide AUTHORITATIVE promotion.** `truthEngineOk=true` does not equal "promote". Only R-10 promotes. TE-Guardian's ACCEPT means "constitutionally sound · eligible for authorisation review · but not yet authorised".

4. **R-10 MUST NOT enforce constitutional truth.** R-10 assumes the envelope has already passed TE-Guardian. R-10 evaluates authorisation policy · not truth rules.

5. **R-10 MUST NOT enforce candidate acceptance.** By the time R-10 runs, Lab-Guardian and TE-Guardian have both already ACCEPTED. R-10 evaluates only "is this AUTHORITATIVE promotion authorised".

6. **No rule migration across Guardian boundaries without a founder-authored ADR.** If a Lab-Guardian rule needs to become a TE-Guardian rule (or vice versa · or to R-10), the migration requires an explicit founder-authored ADR with provenance footer and version tag.

---

## Section 7 · Naming discipline

To eliminate the "which Guardian?" ambiguity in code and audit logs, the following naming conventions apply from Phase B forward:

| Concept | Naming | Location |
|---|---|---|
| Lab-Guardian class | `LabGuardian` (Phase C · to be authored) | `src/lib/nex/lab-guardian/*` (Phase C) |
| Lab-Guardian rejection code prefix | `lab.` | Phase C authoring |
| Lab-Guardian ledger | `nex.gate_kept_event` + `nex.gate_rejection_event` (existing · preserved) | Live substrate |
| TE-Guardian class | `Guardian` (existing · Stage 1a shipped) | `src/lib/nex/truth-engine/guardian/*` |
| TE-Guardian rejection code prefix | `te.` (Stage 1a existing codes fall in this namespace) | Stage 1a shipped |
| TE-Guardian ledger (Stage 1a · isolated) | `nex_test.gate_kept_event` + `nex_test.gate_rejection_event` | Stage 1a shipped |
| TE-Guardian ledger (Stage 1b · production) | to be authored in Stage 1b wiring ADR · distinct from Lab-Guardian ledger | Stage 1b |
| R-10 class | `R10Authoriser` or similar (Stage 2 · to be authored) | Stage 2 |
| R-10 policy substrate | to be authored (Stage 2) · distinct from both Guardian ledgers | Stage 2 |

**IMPORTANT:** the existing Stage 1a TE-Guardian class is currently named `Guardian` in code. That name is preserved because the class lives inside `src/lib/nex/truth-engine/guardian/` and there is no ambiguity within its namespace. When Phase C authors Lab-Guardian, the two classes will live in distinct namespaces (`src/lib/nex/lab-guardian/` and `src/lib/nex/truth-engine/guardian/`) so the class-name `Guardian` remains context-scoped. Renaming is not required.

---

## Section 8 · Substrate posture (audit-ready)

### 8.1 · At Phase B doctrine landing (this ADR)

| Substrate | Owner | Row count (as of 2026-09-11 post-1a.7) | Status |
|---|---|---:|---|
| `nex.gate_kept_event` | Lab-Guardian (existing) | 2,300 | preserved · untouched by this ADR |
| `nex.gate_rejection_event` | Lab-Guardian (existing) | 368 | preserved · untouched by this ADR |
| `nex_test.gate_kept_event` | TE-Guardian (Stage 1a shipped) | 0 (not yet exercised by Stage 1a.7 which used envelope-only inspection) | preserved · untouched by this ADR |
| `nex_test.gate_rejection_event` | TE-Guardian (Stage 1a shipped) | 0 | preserved · untouched by this ADR |
| `nex_test.verifier_verdict` | Truth Engine + TE-Guardian test proof | 150 (from 1a.7) | preserved · untouched by this ADR |

**Zero substrate mutations by this ADR.** This ADR authors doctrine only.

### 8.2 · At Phase C (Acquisition Fabric wiring · future)

Phase C will introduce · under a separate founder authorisation · Lab-Guardian code and tables mapped to the founder-locked responsibility above. Phase C will NOT modify existing Lab-Guardian ledgers · it will BUILD ON them.

### 8.3 · At Stage 1b (production Truth Engine writes · future)

Stage 1b will connect TE-Guardian to a production substrate (`nex.te_guardian_kept_event` / `nex.te_guardian_rejection_event` · exact naming to be authored in Stage 1b wiring ADR). Stage 1b will NOT modify Lab-Guardian ledgers · the two ledgers remain independent.

---

## Section 9 · Enforcement implications (doctrine · not implemented by this ADR)

- **Every Phase C acquisition-fabric ADR must record which of the three gates each rule belongs to.** A rule with no gate assignment cannot ship.
- **Every Stage 1b wiring ADR must show that Lab-Guardian runs before TE-Guardian, and R-10 runs after TE-Guardian.** Pipeline ordering enforced at ADR review.
- **Every Stage 2 R-10 policy ADR must consume an envelope that has already been TE-Guardian-accepted.** R-10 cannot inspect raw rules or raw candidates.
- **Guardian rule migration across gates requires a founder-authored ADR.** No silent moves. No autonomous rule promotion.
- **Contradiction detection (R-20) sits inside Truth Engine, not inside Lab-Guardian or TE-Guardian.** Lab-Guardian sees no contradictions (only candidate integrity). TE-Guardian verifies R-20's verdict is correctly recorded in the envelope. Neither Guardian invents contradictions.
- **Change detection (Phase C · knowledge-gap-driven acquisition loop) sits inside Acquisition Fabric, not inside any Guardian.** Guardians inspect the specific candidate/envelope in front of them · not the source's change history.

---

## Section 10 · Stage 1b prerequisites (unlocked by this ADR)

For Stage 1b production wiring to become founder-authorisable:

1. ✅ Stage 1a proven (ADR-0314a.2.s Stage 1a Exit Report · 2026-09-11)
2. 🟢 Guardian Responsibility Reconciliation locked (**this ADR** · 2026-09-11 · Phase B)
3. 🔴 Acquisition Fabric target architecture locked (Phase C · pending founder authorisation)
4. 🔴 Stage 1b wiring ADR authored (post Phase C · pending)
5. 🔴 Founder explicit "AUTHORISE STAGE 1b" (post 1-4 above)

Stage 1b remains BLOCKED · consistent with founder verbatim 2026-09-11.

---

## Section 11 · What this ADR did NOT do

- ❌ No code authored
- ❌ No migrations authored
- ❌ No `nex.*` substrate modified
- ❌ No `nex_test.*` substrate modified
- ❌ No `nex_lab_*` substrate modified
- ❌ No Guardian class renamed
- ❌ No Guardian rule installed
- ❌ No Guardian rule deprecated
- ❌ No Lab-Guardian implementation created (Phase C will author)
- ❌ No R-10 authorisation policy authored (Stage 2 will author)
- ❌ No Stage 1b production wiring commenced
- ❌ No taxonomy modified
- ❌ No constitutional layer modified
- ❌ No English Brain work
- ❌ No Acquisition Fabric architecture authored (Phase C will author)
- ❌ No unification of the two Guardians
- ❌ No retirement of Lab-Guardian
- ❌ No retirement of TE-Guardian
- ❌ No autonomous operation authorised

---

## Section 12 · Decision provenance footer

| Field | Value |
|---|---|
| **Decision** | Three-way responsibility split locked: Lab-Guardian answers "candidate well-formed and safe?" · TE-Guardian answers "constitutionally true?" · R-10 answers "authorised AUTHORITATIVE?" · six anti-overlap invariants locked · rejection-code namespaces locked (`lab.` / `te.` / `r10.`) · pipeline ordering locked (Acquisition → Lab-Guardian → Truth Engine → TE-Guardian → R-10 → AUTHORITATIVE) · both existing Guardian substrates preserved untouched · neither Guardian retired · Stage 1b remains BLOCKED pending Phase C + Stage 1b wiring ADR + explicit founder authorisation |
| **Decided by** | Philip |
| **Decision date** | 2026-09-11 |
| **ADR** | 0314f · this file · consumed by future Phase C Acquisition Fabric ADR · Stage 1b wiring ADR · Stage 2 R-10 policy ADRs · every downstream acquisition/verification/promotion ADR |
| **Effective from** | `guardian_responsibility_split.v1.0.0` |
| **Supersedes** | none (first-time three-way lock) |
| **Reason** | Founder verbatim (Phase B strategic): *"Don't simply choose 'unify / layer / retire.' Define the responsibilities first. ... That gives the two Guardians different jobs, rather than two competing Guardians."* Founder verbatim (Phase B execution): *"AUTHORISE PHASE B ... let it produce only the Guardian Responsibility Reconciliation ADR. No code. No migrations. No substrate writes. No Stage 1b. No taxonomy population. No English Brain work."* This split prevents the two-competing-Guardians failure mode while preserving both existing enforcement layers with distinct responsibilities · a clean prerequisite for Stage 1b production wiring. |

---

## Section 13 · Cross-references

**Consumed by (future ADRs):**
- Phase C · NEX Acquisition Fabric target architecture ADR (candidate slot `ADR-0314g` · design only · pending founder "AUTHORISE PHASE C")
- Stage 1b wiring ADR (post-Phase-C · pending)
- Stage 2 R-10 authorisation policy ADRs (per LAM Object Type · per Domain · pending)
- Every downstream acquisition · verification · promotion ADR

**Consumes:**
- ADR-0314a.2.s Stage 1a Exit Report (2026-09-11) — Stage 1a completion
- ADR-0314a.2.s NEX Lab / Crawler / Scraper / Acquisition Architecture Audit (2026-09-11) — surfaced Guardian duality
- ADR-0314e Truth Engine Verifier Implementation (D-Impl) — defines TE-Guardian's environment
- Stage 1a sub-step 1a.5 (Guardian installed at `src/lib/nex/truth-engine/guardian/*`) — TE-Guardian ships
- §7.3-B1 (five-axis architecture) · §7.7 H1 (`other` ≠ `unknown`) · R-DOMAIN-01 (anti-substitution) · R-10 gate-model doctrine
- Project memory `project_nex_phase_abc_sequencing_and_acquisition_fabric_2026_09_11.md`
- Feedback memory `feedback_guardian_duality_lab_te_r10.md`
- Feedback memory `feedback_no_crawler_zoo_acquisition_fabric_target.md`
- Feedback memory `feedback_observation_is_not_constitutional_authority.md`

**Referenced by future candidate slots:**
- Stage 1b wiring ADR (post-Phase-C)
- Stage 2 R-10 policy ADRs
- ADR-0314c Cross-Substrate Contradiction Detection (integrates with TE-Guardian's envelope inspection)

---

## Section 14 · Master AI STOPS · awaiting founder review

**Master AI does NOT autonomously proceed to Phase C · Stage 1b · Stage 2 · Category taxonomy population · pending-policy authoring · Lab-Guardian implementation · R-10 implementation · English Brain expansion · or any other work.**

Each subsequent step requires a separate founder authorisation.

**Current position:**

- Phase A · Stage 1a · 🟢 COMPLETE (ADR-0314a.2.s Stage 1a Exit Report)
- Phase B · Guardian Responsibility Reconciliation · 🟢 LOCKED (this ADR)
- Phase C · Acquisition Fabric target architecture · 🟡 AUTHORISED · authoring blocked pending explicit founder "AUTHORISE PHASE C"
- Stage 1b · production wiring · 🔴 BLOCKED pending Phase C + Stage 1b wiring ADR + founder authorisation
- Stage 2 · R-10 promotion gate + LAM policies · 🔴 BLOCKED pending Stage 1b + Stage 2 authoring
- Category taxonomy per-Domain enums · 🔴 BLOCKED pending founder authoring (ADR-0314a.2.k values)
- Pending policy population (R-03 · R-05 · R-07 · R-12 · R-20) · 🔴 BLOCKED pending founder authoring
- Lab/crawler restructure · 🔴 subsumed by Phase C Acquisition Fabric
- English Brain expansion · 🔴 waits for proper substrate

**Substrate posture:**

- Production `nex.*` · 💾 FROZEN · zero writes
- `nex_lab_*` · 💾 FROZEN · zero writes
- Supabase · 💾 FROZEN · zero writes
- `nex_test.*` · 💾 stable at post-1a.7 counts · no writes by this ADR
- Gate 3 · 🟢 OPEN (unchanged since 2026-09-11 opening)

---

**End of ADR-0314f · Guardian Responsibility Reconciliation · Phase B doctrine locked · Phase C awaits separate founder authorisation.**
