# ADR-0314e · Truth Engine Verifier Implementation · 🔒 DOCTRINE LOCKED · Gate 3 CANDIDATE

**Status:** 🔒 DOCTRINE LOCKED · founder-authored 2026-09-11 · **Gate 3 remains CLOSED** · verifier code implementation BLOCKED until founder explicitly issues "GATE 3 OPEN"
**Founder:** Philip · authored via Stage 1 Founder Decision D-Impl verbatim 2026-09-11 + Pre-Flight Item 1 correction
**Consumes:** R-01…R-20 companion ADRs · R-DOMAIN-01 · §7.3-B1 five-axis · §7.6.5 G4 · §7.7 H1 · §7.8 J1 · §7.9 L1 · §7.10 M1 · D-11 · D-17 · D-01-values · D-Fix · D-Impl · R-10 gate-model doctrine (2026-09-11 consolidation)

**Rule version:** N/A (verifier is implementation · not a rule) · **Verifier version:** `truth_engine_verifier.v1.0.0` (locks at Stage 1a implementation)

---

## Section 1 · Founder-directed constitutional safeguard (Pre-Flight Item 1 · verbatim)

> **ADR-0314e is Gate 3 CANDIDATE doctrine. Implementation of the verifier is BLOCKED until the founder explicitly issues "GATE 3 OPEN". Founder-authorisation of this ADR (as doctrine) does NOT open Gate 3. Founder-authorisation of ALL 12 Stage 1 companion ADRs does NOT open Gate 3. Founder-approval of fixture strategy does NOT open Gate 3. Founder-approval of R-10 impact analysis does NOT open Gate 3. Only the founder-issued verbatim statement "GATE 3 OPEN" opens Gate 3. That statement is a separate constitutional write-authorisation event.**

This ADR is DOCTRINE. Implementation is a separate authorised event.

---

## Section 2 · Founder verbatim authorisation (D-Impl)

> *"After GATE 3 OPEN, the first implementation should still be small and controlled. Not: 'Build the whole Truth Engine.' Instead: Implement the smallest certified Truth Engine + Guardian path that can run the Stage 1 reference fixtures deterministically. Then prove it. Only after that should production writes begin."*
>
> — Philip · 2026-09-11 · Stage 1 Founder Decision D-Impl

---

## Section 3 · Purpose

The verifier is the code that consumes R-01–R-20 rules per companion ADRs and produces `truth_engine_ok` verdicts + R-18 verifier envelope (verifier_instance_id + rule_set_version + guardian_version + authorisation_policy_ref) per verdict. It does NOT promote to AUTHORITATIVE — R-10 gate (Stage 2 · ADR-0314a.2.a-h) governs promotion. Verifier terminates at `truth_engine_ok`.

---

## Section 4 · Architecture (locked doctrine · implementation delegated to Stage 1a code)

**Runtime:** TypeScript / Node · consumes Postgres via pg client (matches existing NEX code convention)

**Structure:**
- Rule-composable evaluation pipeline
- Rules fire in parallel (order NOT doctrinally locked per R-10 gate-model 2026-09-11 · implementation ordering is verifier-internal)
- Each rule produces a per-rule verdict row in `nex.verifier_verdict` (schema authored at Stage 1a implementation · currently 0 rows)
- Composite `truth_engine_ok` state is the aggregate of individual rule verdicts having passed

**Verdict envelope per row (locked per R-18):**
```
verifier_instance_id: UUID (deterministic per verifier deploy)
rule_set_version: string (composed manifest per ADR-0314a rule-parity)
guardian_version: string
authorisation_policy_ref: string | null (null at Stage 1 · Stage 2 R-10 fills this)
truth_engine_ok: boolean
per_rule_verdicts: {
  R-01: { verdict, reason, threshold_version },
  R-03: { verdict, reason, mandate_version },
  R-05: { verdict, reason, registry_version },
  R-07: { verdict, reason, criteria_version, candidate_flag: bool },
  R-11: { score, band, band_derivation_version },
  R-12: { verdict, reason, taxonomy_version },
  R-13: { verdict, reason, vocabulary_version },
  R-17: { version_triggered: bool, trigger_reason, threshold_version },
  R-18: { verifier_instance_id, rule_set_version },
  R-20: { verdict, reason, rule_spec_version, contradiction_id: UUID | null }
}
verdict_at: timestamptz (ISO-8601)
```

**Fail-closed defaults per rule** (per each R-XX lock text · already documented in each companion ADR):
- R-01: `plausibility_check_disabled_pending_thresholds` (now unblocked at Stage 1a per D-01-values lock)
- R-05: `authority_check_disabled_pending_registry` (unblocked when ADR-0314a.2.p registry authored)
- R-07: `plausibility_check_disabled_pending_criteria` — **never `false` · never `contradiction`** (per §7.6.5 G4 / §7.7 H1)
- R-11: `unknown` band on null score
- R-12: `classification_taxonomy_version=pending` (unblocked when ADR-0314a.2.k enum authored)
- R-13: `relationship_vocabulary_version=pending` (currently 8-value baseline ratified)
- R-17: automatic versioning DISABLED until thresholds authored (now unblocked at Stage 1a per D-17 lock)
- R-20: `cross_record_detection_pending_rules` — **never `contradiction`** (per §7.7 H1)

---

## Section 5 · Stage 1a smallest-certified-path (locked per D-Impl)

**Stage 1a scope:**
- Implement **minimum-viable** verifier + Guardian pair capable of processing the Stage 1 Reference Fixture Set (per ADR-0314a.1) deterministically
- Writes to **isolated test schema only** (`nex_test.*` or similar · NEVER production `nex.*`)
- Reads production substrate PERMITTED for fixture-parity checks (reference data)
- Verifier passes **100% of Stage 1 fixtures** deterministically (same input → same output every run)
- Guardian rejects fixtures per fail-closed / unknown-named-reason contract
- Rule-set version manifest authored: `rule_set_version` composes from individual `rule_version` values per R-18
- verifier_instance_id · guardian_version · authorisation_policy_ref (null pending Stage 2) recorded per verdict

**Stage 1a exit criteria:**
1. 100% fixture parity across 33 baseline + additional cross-rule fixtures reaching the 50-75 target
2. Deterministic reproducibility verified (repeated runs produce identical verdicts)
3. Zero production substrate mutation during Stage 1a
4. Founder-authorised transition to Stage 1b

---

## Section 6 · Stage 1b production writes (locked per D-Impl)

**Stage 1b begins ONLY after Stage 1a is proven per fixture parity.**

**Stage 1b scope:**
- Verifier runs against production substrate (existing rows read · verdicts written to R-11 · R-17 · R-18 · R-20 tables · plus `nex.verifier_verdict`)
- Guardian rules install at Router boundary (extends existing 2,300+ permit / 368+ reject event pipeline)
- **NO row demoted from AUTHORITATIVE** (per §7.10 M1 anti-inflation + R-10 gate discipline)
- **NO Domain reclassification**
- Verdicts recorded (currently schema-ready · 0 rows) but do NOT trigger AUTHORITATIVE promotion (Stage 2 R-10 gate authors promotion)
- Guardian violations (band drift · unregistered classification · missing verifier envelope · etc.) recorded per R-18 provenance

**Stage 1b exit criteria:**
1. Verifier processing production reads without corruption
2. Verdicts written to substrate tables · schema-ready fields populated
3. No AUTHORITATIVE row silently demoted or corrupted
4. Regression baseline preserved (Test J-partial passes)
5. Test N (fail-closed) verified continuously

---

## Section 7 · What the verifier is NOT (constitutional invariants)

- **NOT a truth authority.** Verifier produces `truth_engine_ok` · not authoritative promotion (per R-10 gate model doctrine 2026-09-11)
- **NOT allowed to invent Domains.** Per §7.10 M1 · Domain axis is closed at 9 · verifier consumes them · does not create them
- **NOT allowed to invent Category values.** Per R-12 · Guardian rejects unregistered classifications
- **NOT allowed to adjust rule thresholds** based on observation (per feedback_observation_is_not_constitutional_authority.md)
- **NOT allowed to convert UNKNOWN to FALSE** or to `very_low` (per §7.7 H1 · R-11 D-11 lock)
- **NOT allowed to bypass R-10.** Verifier verdicts terminate at `truth_engine_ok` unless R-10 gate policies (Stage 2 · ADR-0314a.2.a-h) permit promotion
- **NOT allowed to open Gate 3** — Gate 3 opens ONLY when founder issues explicit "GATE 3 OPEN"

---

## Section 8 · Enforcement implications

- Verifier code lives at `src/lib/nex/truth-engine/verifier/*` (implementation path locked at Stage 1a code time)
- Guardian rules install extend existing `src/lib/nex/brain/gate_kept_event` + `gate_rejection_event` pipeline
- Verifier writes to `nex.verifier_verdict` (schema authored Stage 1a) · currently 0 rows
- Rule-set version manifest authored: `rule_set_version = manifest({R-01.v1.0.0, R-03.v1.0.0, ..., R-20.v1.0.0})` deterministic composition

**Substrate impact by this ADR:** 0.

- No verifier code written · no Guardian rule installed · no schema authored
- Gate 3 remains CLOSED
- Freeze holds

---

## Section 9 · Decision provenance footer

| Field | Value |
|---|---|
| **Decision** | Truth Engine verifier · doctrine locked · Stage 1a smallest-certified-path (isolated test schema · fixture parity · deterministic) · then Stage 1b production writes (verdicts recorded · no promotion until Stage 2 R-10 gate) · verifier NEVER opens Gate 3 · founder-issued "GATE 3 OPEN" required |
| **Decided by** | Philip |
| **Decision date** | 2026-09-11 |
| **ADR** | 0314e · consumed by Stage 1a implementation post-Gate-3 |
| **Effective from** | truth_engine_verifier.v1.0.0 (implementation) |
| **Supersedes** | none |
| **Reason** | Founder verbatim (D-Impl): *"After GATE 3 OPEN, the first implementation should still be small and controlled. Not: 'Build the whole Truth Engine.' Instead: Implement the smallest certified Truth Engine + Guardian path that can run the Stage 1 reference fixtures deterministically. Then prove it. Only after that should production writes begin."* Pre-Flight Item 1: *"Gate 3 opens at this ADR's implementation start" wording REMOVED. Founder-authorisation of this ADR does NOT open Gate 3. Only the founder-issued verbatim statement "GATE 3 OPEN" opens Gate 3."* |

---

## Section 10 · What this ADR did NOT do

- ❌ **NO Gate 3 opened** · per founder safeguard · only the verbatim "GATE 3 OPEN" statement opens Gate 3
- ❌ No verifier code written
- ❌ No Guardian rule installed
- ❌ No `nex.verifier_verdict` schema authored (Stage 1a code time)
- ❌ No CHECK constraint · no migration · no capabilities activated
- ❌ No 175 R-10-impact rows modified
- ❌ No production substrate mutation

---

## Section 11 · Cross-references

**Consumed by:** Stage 1a smallest-certified-path implementation · Stage 1b production writes · Stage 2 R-10 gate + authorisation policies (verifier verdicts consumed by gate)

**Consumes:** all Stage 1 R-XX companion ADRs (rules) · R-10 gate-model doctrine · D-Impl lock · ADR-0314a.1 (fixture set) · ADR-0314a rule-parity certification criteria · feedback memories (all 8)

---

**End of ADR-0314e · doctrine locked · Gate 3 CANDIDATE · implementation blocked pending founder-issued "GATE 3 OPEN".**

Master AI STOPS. Gate 3 CLOSED. Freeze holds. Zero substrate touched. **Master AI does NOT open Gate 3 autonomously regardless of any authorisation state · only the founder-issued verbatim statement "GATE 3 OPEN" opens Gate 3.**
