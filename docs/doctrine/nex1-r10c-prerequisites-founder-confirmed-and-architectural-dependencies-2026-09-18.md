# NEX1 · R10-C Prerequisites · Founder Confirmed · Architectural Dependency Map + Adversarial Cases + Falsification Standards

**Date:** 2026-09-18
**Author:** master_ai_engineer (Claude Opus 4.7)
**Status:** `R10C_PREREQUISITES_FOUNDER_CONFIRMED · ARCHITECTURAL_DEPENDENCIES_DOCUMENTED · NO_IMPLEMENTATION`

**Companion to:** `docs/doctrine/nex1-r10c-prerequisites-decision-instrument-2026-09-18.md` (decision instrument with confirmed selections).

---

## §0 · Founder decisions recorded verbatim

```
R10-C-1 = D · COMPOSITE · FOUNDER CONFIRMED
R10-C-2 = C · INDEPENDENT VERIFICATION · FOUNDER CONFIRMED
R10-C-3 = D · NECESSARY BUT NOT SUFFICIENT · FOUNDER CONFIRMED
R10-C-4 = D · COMPOSITE ANTI-CIRCULARITY · FOUNDER CONFIRMED
```

Preserved unchanged:

```
R10 = R10-C · FOUNDER CONFIRMED
R11 = R11-B · FOUNDER CONFIRMED

Q8_V2_OPERATIONAL_POLICY = PENDING_CORRECTION
FIX24 = NOT_IMPLEMENTED
AUTONOMOUS_EXECUTION = NOT_AUTHORIZED
```

Constitutional invariants preserved verbatim: `REMEMBER ≠ UNDERSTAND ≠ PROVE ≠ SELECT ≠ MODIFY ≠ EXECUTE ≠ AUTHORIZED` · `RETRIEVED EXPERIENCE = EVIDENCE ABOUT THE PAST · ≠ CURRENT PROOF` · `TRUST IN EXPERIENCE ≠ AUTHORITY TO EXECUTE` · `SELECTED ≠ MODIFIED ≠ EXECUTED ≠ VERIFIED ≠ AUTHORIZED`.

**This document does not implement anything. It records the confirmed architectural direction, exposes the capability gap, and specifies falsification standards. No source code changes. No Schema V1 changes. No Q8 V2 implementation. No Fix 24 implementation.**

---

## §1 · Required architectural dependency map

Per founder Section 8 instruction. **No rankings; only mechanisms and limitations.**

| Decision | Existing capability | Missing capability | Schema impact | Policy impact | Test required |
|---|---|---|---|---|---|
| **R10-C-1 · D · Composite** | Structural dimension: Schema V1 Block C fields (`target_function_signature`, `structural_shape_hash`) + Fix 23b structural output · Behavioural dimension: Schema V1 Block D fields (`sibling_test_ids`, `runtime_evidence_ids`) | **Semantic/domain-role dimension:** no `semantic_role` field in Schema V1; no zero-LLM semantic classifier · **Contextual dimension:** caller-context / call-site analysis absent | Semantic dimension **REQUIRES SCHEMA EXTENSION** (Schema V1 amendment out of R10-C scope) · Contextual dimension may require additional B-block fields | Q8 V2 v2 must specify how the composite is computed (count vs any-flags · threshold per dimension · precedence order) · Each dimension needs its own inclusion criterion | Labelled corpus of similar/different pairs per dimension · disagreement threshold authored |
| **R10-C-2 · C · Independent Verification** | ACTIONs 1-10 produce evidence in current packet · Fix 13 evaluator classifies evidence class | **`discovery_source` provenance field on each evidence item** · ACTION-level tagging of investigation-path influence · lineage tracking that distinguishes copied / derived / discovered-via-retrieval / independent / contradicting | Schema V1 does not carry `discovery_source` on Block D fields (`runtime_evidence_ids` is opaque) · **REQUIRES SCHEMA EXTENSION** to make evidence items carry provenance metadata · **DO NOT silently add — founder-approved amendment required** | Q8 V2 v2 must define which values of `discovery_source` count as "fresh" · must define what "generated at discovery time vs retroactively" means for tagging integrity | Scenario where memory retrieval fires and NEX1 subsequently discovers evidence at the retrieved location; rule's fresh/non-fresh classification must match honest causal chain |
| **R10-C-3 · D · Necessary but not sufficient** | Fix 23b's actual outputs: `.line`, `.position`, `.end_position`, `.current_text`, `.proposed_text`, `.rationale`, `.hosting_function`, `.enclosing_expression` · `TracerResult` (Ok / Refused with specific refusal codes) | **Semantic role classifier** (out of Fix 23b scope) · **Cross-module semantic model** · **Intent inference** · **Runtime side-effect equivalence checker** · **Invariant assertion mechanism** | Fix 23b requires no schema change. **The "additional current-evidence mechanisms" that provide the sufficient part MAY require schema changes** — depending on their design | Q8 V2 v2 must define: Fix 23b MATCH criteria authoritatively (target, position, proposed_text, enclosing_expression comparison rules) · what "necessary" means in the aggregate decision · what "sufficient" mechanisms consult · when to escalate to REQUIRE_MORE_INVESTIGATION | Case B (§3) semantic mismatch scenario; MATCH criteria must produce reject/insufficient result when semantic role differs |
| **R10-C-4 · D · Composite Anti-Circularity** | Fix 13 evaluator produces STRUCTURALLY_SUPPORTING vs CONTRADICTING classifications (a proto-contradiction signal) · Investigation packet exists · JSONL persistence exists | **`discovery_source` provenance tagging** (shared with R10-C-2) · **Contradiction-search protocol** (no ACTION currently searches for disconfirming evidence; ACTIONs 1-10 are extraction) · **Dual-path orchestration** (no mechanism runs the investigation twice with different retrieval settings) · **Shared-upstream analysis** to prove genuine path independence | Provenance requires Schema V1 extension (shared with R10-C-2) · Contradiction-search may add ACTION outputs · Dual-path orchestration requires new orchestrator interface | Q8 V2 v2 must define each of the three mechanisms' inputs, outputs, failure states, provenance, falsification tests, and interaction with R11-B · Composite rule must NOT assume A+B+C automatically yields independence — shared upstream dependencies must be analysed | §9 self-confirming-loop scenario: memory retrieval → memory-guided investigation → memory-caused evidence → **must NOT enter SUPPORTING count** under any of the three mechanisms; test verifies the mechanism catches this |

---

## §2 · Capability gap enumeration · FUTURE CAPABILITY · NOT IMPLEMENTED

Per founder Section 7 instruction. Marked explicitly.

| Capability | Status | Load-bearing for | Note |
|---|---|---|---|
| **Semantic-role understanding** (variable/field-name meaning classification) | `FUTURE CAPABILITY · NOT IMPLEMENTED` | R10-C-1 D · semantic dimension | Not currently in Schema V1 or any zero-LLM classifier |
| **`discovery_source` provenance** on evidence items | `FUTURE CAPABILITY · NOT IMPLEMENTED · SCHEMA EXTENSION REQUIRED` | R10-C-2 C · R10-C-4 D independent-provenance sub-mechanism | Founder-approved schema amendment required |
| **Memory-causation tracking** at ACTION discovery-time | `FUTURE CAPABILITY · NOT IMPLEMENTED` | R10-C-2 C · R10-C-4 D | Must tag at generation, not retroactively guess |
| **Contradiction-search orchestration** | `FUTURE CAPABILITY · NOT IMPLEMENTED` | R10-C-4 D sub-mechanism B | No existing ACTION searches for disconfirming evidence |
| **Dual-path investigation orchestrator** | `FUTURE CAPABILITY · NOT IMPLEMENTED` | R10-C-4 D sub-mechanism C | Requires ability to run investigation twice with retrieval on/off |
| **Composite semantic equivalence** (rule stack across structural + semantic + behavioural + contextual) | `FUTURE CAPABILITY · NOT IMPLEMENTED` | R10-C-1 D composite computation | Requires all four dimensions defined first |
| **Independence verification** (shared-upstream analysis for dual-path) | `FUTURE CAPABILITY · NOT IMPLEMENTED` | R10-C-4 D correctness proof | Prevents dual-path from being false-independent |
| **Cross-module semantic dependency analysis** | `FUTURE CAPABILITY · NOT IMPLEMENTED` | R10-C-3 D "additional mechanisms" | Fix 23b refuses on `cross_module_call` |
| **Invariant assertion mechanism** | `FUTURE CAPABILITY · NOT IMPLEMENTED` | R10-C-3 D behavioural equivalence | Fix 23b is a pure evaluator, no invariants |

**These capabilities are NOT implemented merely because the founder confirmed the direction.** They must each be authored under separate founder-approved scope before Q8 V2 v2 can be implemented.

---

## §3 · Required adversarial cases · falsification standards

Per founder Section 9 instruction. Each case is a falsification test — a rule survives only when it correctly handles the adversarial case.

### CASE A · Genuine historical match

- **Setup:** new problem genuinely belongs to same problem class as retrieved experience.
- **Falsification question:** *"Can the architecture recognise the correspondence without treating memory itself as proof?"*
- **Rule fails if:** memory alone causes the SUPPORTING count to increment (violates R11-B) · **OR** fresh evidence is not required to confirm applicability.
- **Rule passes if:** memory is retrieved and reported · fresh evidence is independently generated · Q8 output reflects fresh evidence with retrieval as guidance-only per R11-B.

### CASE B · Superficial structural match

- **Setup:** same code structure (e.g., `return 100`); different semantic role (price → customer count).
- **Falsification question:** *"Can structural similarity be prevented from becoming semantic equivalence?"*
- **Rule fails if:** R10-C-1 D reports "not materially different" for a semantic-role mismatch · **OR** R10-C-3 D returns MATCH-and-sufficient · **OR** the semantic dimension is silently ignored because it "REQUIRES NEW CAPABILITY."
- **Rule passes if:** the architecture surfaces `SEMANTIC_DIMENSION_UNAVAILABLE` and refuses to declare equivalence · **OR** if the semantic capability exists, the semantic dimension flags the mismatch.

### CASE C · Historical failure

- **Setup:** retrieved historical solution previously failed.
- **Falsification question:** *"Does NEX1 investigate the current problem rather than blindly replaying the historical failure?"*
- **Rule fails if:** the historical failure is treated as absolute permanent prohibition (violates R10-C principle) · **OR** the historical failure is ignored and the failed solution retried without material-difference check.
- **Rule passes if:** current investigation proceeds · fresh evidence evaluated · R10-C-1 D applied to determine whether new problem is materially different from failed one · outcome respects evidence.

### CASE D · Historical success

- **Setup:** retrieved historical solution previously succeeded.
- **Falsification question:** *"Does NEX1 still require current evidence rather than allowing historical success to become current proof?"*
- **Rule fails if:** memory-tagged `RETRIEVED_PRIOR_SUCCESS` enters SUPPORTING count (violates R11-B literally) · **OR** memory-caused evidence enters SUPPORTING count with `discovery_source: fresh` mis-tagged (violates R11-B in spirit).
- **Rule passes if:** memory guides investigation · retrieval is reported · only genuinely independent evidence enters SUPPORTING count · R11-B preserved both literally and in spirit.

### CASE E · Memory-guided evidence discovery

- **Setup:** retrieval points NEX1 directly toward the evidence location; investigator finds it.
- **Falsification question:** *"Can NEX1 distinguish memory-guided discovery from independent discovery?"*
- **Rule fails if:** the evidence is tagged `discovery_source: fresh` when its existence was caused by retrieval · **OR** no tagging exists at all and the evidence flows into SUPPORTING count.
- **Rule passes if:** the evidence carries `discovery_source: memory_guided` at generation-time · R10-C-2 C rules it out of the SUPPORTING count · R10-C-4 D anti-circularity protection fires.

### CASE F · Contradictory current evidence

- **Setup:** current evidence contradicts the retrieved experience.
- **Falsification question:** *"Can the contradiction be represented, preserved and investigated without silently overriding one side?"*
- **Rule fails if:** the contradiction is silently reconciled (retrieval "wins" over current, or vice versa) · **OR** UNRESOLVED state is not emitted when appropriate.
- **Rule passes if:** contradiction is surfaced (Q8V2-13 UNRESOLVED emitted with both provenance chains) · investigation continues rather than silently choosing.

### CASE G · Dual-path divergence

- **Setup:** memory-guided investigation path and independent investigation path produce different candidates or verdicts.
- **Falsification question:** *"Does NEX1 preserve the disagreement rather than selecting the convenient result?"*
- **Rule fails if:** the memory-guided path is preferred silently · **OR** the independent path is silently discarded · **OR** both are averaged into a false-concordance.
- **Rule passes if:** disagreement is reported · R10-C-4 D dual-path sub-mechanism refuses concordance · Q8 output reflects the divergence.

### CASE H · Shared upstream contamination

- **Setup:** supposedly independent path shares an upstream classifier, vocabulary, or derived artifact with the memory-guided path.
- **Falsification question:** *"Does NEX1 recognise that the two paths are not fully independent?"*
- **Rule fails if:** the composite anti-circularity mechanism claims independence when upstream is shared · **OR** the falsification test does not check upstream lineage.
- **Rule passes if:** shared-upstream detection fires · R10-C-4 D independence claim is downgraded · investigation escalates or defers accordingly.

### Falsification-quality note (per founder Section 10)

**A test passes only when the architecture survives an adversarial case that could realistically produce a false positive.** Tests that merely restate the rule are `WEAK FALSIFICATION TESTS` and must be strengthened. Cases B, E, G, H are the primary anti-false-positive cases; A, C, D, F are the primary anti-false-negative cases.

---

## §4 · R11-B protection specifically re-affirmed

Per founder Section 6 instruction. **The following pathway is explicitly identified as a potential R11-B circumvention and must be defended against:**

```
OLD MEMORY
    ↓
RETRIEVAL
    ↓
MEMORY-GUIDED INVESTIGATION
    ↓
CURRENT EVIDENCE
    ↓
CURRENT EVIDENCE COUNTED AS FRESH
    ↓
SUPPORTING_MAJORITY
```

The architecture MUST instead enforce:

```
MEMORY
  ↓
GUIDES INVESTIGATION
  ↓
PROVENANCE TRACKING
  ↓
CURRENT EVIDENCE CLASSIFICATION
  ↓
INDEPENDENCE CHECK
  ↓
ONLY ELIGIBLE EVIDENCE MAY ENTER R-4
```

- Retrieved experience itself must never enter the SUPPORTING count (R11-B literal preservation).
- Memory-caused evidence must not silently bypass R11-B via mis-tagged provenance (R10-C-2 C + R10-C-4 D).
- Every combination of R10-C decisions must preserve both the literal and the spirit of R11-B.

---

## §5 · Engineering chain (locked)

Per founder Section 11 instruction. **No stage confers the rights of any subsequent stage.**

```
CLAIM
→ DOCUMENTED
→ IMPLEMENTED
→ CONNECTED
→ EXECUTED
→ OBSERVED
→ ADVERSARIALLY TESTED
→ VERIFIED
```

Where the four R10-C prerequisites currently stand:

- **DOCUMENTED:** ✓ (decision instrument · this doc · founder confirmation)
- **IMPLEMENTED:** ✗ NOT_IMPLEMENTED (each option requires future capability per §2)
- **CONNECTED:** ✗
- **EXECUTED:** ✗
- **OBSERVED:** ✗
- **ADVERSARIALLY TESTED:** ✗
- **VERIFIED:** ✗

**Until IMPLEMENTED → ADVERSARIALLY TESTED → VERIFIED is reached, the R10-C prerequisites are architectural direction only.** They do not confer any current runtime capability.

---

## §6 · Sequence to Q8 V2 v2 and Fix 24

Locked. Per founder Section 13 instruction.

```
FOUNDER DECISIONS (this document)                        ✓ complete
        ↓
DOCUMENT-ONLY Q8 V2 v2 REVISION                          pending — must apply
        ↓                                                 · R10-C-1 D dimension definitions
                                                          · R10-C-2 C provenance semantics
                                                          · R10-C-3 D sufficient-mechanism specs
                                                          · R10-C-4 D three sub-mechanism specs
                                                          · C1-C15 forensic corrections
        ↓
FORENSIC REVIEW OF Q8 V2 v2                              pending
        ↓
CORRECTIONS (if any)                                     pending
        ↓
SECOND FORENSIC REVIEW                                   pending
        ↓
FOUNDER APPROVAL                                         pending
        ↓
FIX 24 PHASE A · READ-ONLY PRE-BUILD AUDIT               pending
        ↓
ADVERSARIAL VERIFICATION (Cases A-H)                     pending
        ↓
IMPLEMENTATION (only if all prior steps pass)            pending
```

**No stage may be skipped. No autonomous execution is authorised at any stage.**

---

## §7 · 15-point self-audit

Per founder Section 15 instruction. All 15 checks performed.

| # | Check | Result |
|---|---|---|
| 1 | Did you preserve R10-C? | ✅ YES — freeze `[x]` on R10-C · this doc §0 |
| 2 | Did you preserve R11-B? | ✅ YES — freeze `[x]` on R11-B · this doc §0 + §4 R11-B protection block |
| 3 | Did you preserve all authority boundaries? | ✅ YES — all invariants restated verbatim in §0 |
| 4 | Did you avoid treating future capability as existing capability? | ✅ YES — §2 explicitly enumerates every `FUTURE CAPABILITY · NOT IMPLEMENTED` |
| 5 | Did you avoid modifying Schema V1? | ✅ YES — Schema V1 unchanged; §1 flags every required extension as "REQUIRES SCHEMA EXTENSION" and defers to founder-approved amendment |
| 6 | Did you avoid implementing code? | ✅ YES — zero source-code changes by this task |
| 7 | Did you avoid implementing Q8 V2? | ✅ YES — Q8 V2 remains PENDING_CORRECTION |
| 8 | Did you avoid implementing Fix 24? | ✅ YES — FIX24 remains NOT_IMPLEMENTED |
| 9 | Did you avoid granting autonomous execution? | ✅ YES — no authority granted by this task |
| 10 | Did you remove hidden rankings or recommendations? | ✅ YES — no "best/safest/strongest/lowest-risk" phrasing in this doc; only mechanisms and limitations described |
| 11 | Did you define falsification tests? | ✅ YES — §3 defines eight adversarial cases each with explicit "rule fails if / rule passes if" criteria |
| 12 | Did you identify every required new capability? | ✅ YES — §2 enumerates nine future capabilities |
| 13 | Did you distinguish memory from memory-caused evidence? | ✅ YES — §4 protection pathway + §3 Cases E, H |
| 14 | Did you preserve uncertainty where independence cannot currently be established? | ✅ YES — §5 engineering chain marks four states as `✗ NOT_IMPLEMENTED`; §2 lists provenance as `FUTURE CAPABILITY · NOT IMPLEMENTED` |
| 15 | Did you explicitly identify where Fix 23b is necessary but insufficient? | ✅ YES — §1 R10-C-3 row lists Fix 23b outputs as existing capability and semantic/intent/invariant/side-effect/cross-module dimensions as missing |

**All 15 checks: YES. No stop condition triggered.**

---

## §8 · Final status

```
R10 = R10-C · FOUNDER CONFIRMED

R10-C-1 = D · COMPOSITE · FOUNDER CONFIRMED
R10-C-2 = C · INDEPENDENT VERIFICATION · FOUNDER CONFIRMED
R10-C-3 = D · NECESSARY BUT NOT SUFFICIENT · FOUNDER CONFIRMED
R10-C-4 = D · COMPOSITE ANTI-CIRCULARITY · FOUNDER CONFIRMED

R11 = R11-B · FOUNDER CONFIRMED

Q8_V2_OPERATIONAL_POLICY = PENDING_CORRECTION

FIX24 = NOT_IMPLEMENTED

AUTONOMOUS_EXECUTION = NOT_AUTHORIZED
```

**STOP.** No code. No tests claiming runtime capability. No Q8 V2 implementation. No Fix 24 implementation. No autonomous execution. No additional founder decisions.

**Purpose achieved: architectural direction established · exact capability gap exposed · falsification standards defined.**
