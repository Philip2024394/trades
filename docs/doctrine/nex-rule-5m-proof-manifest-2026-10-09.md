# NEX · Rule 5m · Seven-Proof Manifest · PROPOSAL · 2026-10-09

**Status:** PROPOSAL. Requires founder sign-off before any proof claim is treated as sealed.

**Purpose:** Correct the previous completion report, which claimed that "1145 passing
resolver tests implicitly satisfy the 7 Rule-5m proofs." They do not. Rule 5m requires
an explicit, named, independently-verifiable proof set with bound evidence.

**What the sealed doctrine actually says (verified by reading
`docs/doctrine/nex-business-canonical-seed-cohort-and-eval-corpus-design-2026-10-08.md`):**

The sealed doctrine does **not** itemise seven proofs by name. It describes a pipeline:

> seed cohort → eval corpus → resolver measurement → Rule 5j gate check →
> Rule 5m evidence report (produced · "7 proofs")

The "7 proofs" is referenced as the *output* of Rule 5m, not as a named enum. The
specific seven have never been pinned in a sealed artefact. This manifest proposes
them, binds each to evidence, and marks the real status. Founder-level approval of
this proposal is required before "Rule 5m satisfied" is a defensible claim.

---

## Prerequisites · what must exist before any proof can run

| Artefact | Required for | Current state |
|---|---|---|
| `tests/fixtures/canonical/seed-cohort-v1.jsonl` (≥50 founder-approved seeds, R1-R10 coverage) | Proofs 1, 4, 5 | **MISSING** |
| `tests/fixtures/eval/positive-pairs-v1.jsonl` (≥200 founder/admin-labelled positives) | Proofs 4, 5, 7 | **MISSING** |
| `tests/fixtures/eval/negative-pairs-v1.jsonl` (≥200 founder/admin-labelled negatives) | Proofs 4, 5, 7 | **MISSING** |
| `tests/fixtures/eval/ambiguous-pairs-v1.jsonl` (~50 founder/admin-labelled ambiguous) | Proofs 5, 7 | **MISSING** |
| Resolver measurement runner (`scripts/nex-canonical/eval-measurement-runner.ts`) | Proofs 4, 5, 7 | **MISSING** |
| Live canonical pool loaded with the seed cohort (migration or seed script) | Proofs 4, 5 | **MISSING** |

Three of the four prerequisites are entirely absent from the repository. The fourth
(the measurement runner) is also absent. Any claim that Rule 5m is satisfied today
is therefore architecturally impossible. The previous report's conflation of
"resolver tests pass" with "Rule 5m satisfied" is corrected here.

---

## Proposed seven proofs

### Proof 1 · Seed cohort provenance

**Statement:** The seed cohort file exists, contains ≥50 records, every record carries
`provenance.approved_by = "founder"`, and the cohort covers every R1-R10 category
from Rule 5i with ≥3 seeds per category.

**Acceptance:**
- File exists at the sealed path.
- Record count ≥ 50 (upper bound 100).
- Every record has `approved_by === "founder"` and a non-null `approved_at`.
- Each of R1-R10 has ≥3 records whose `risk_categories` array contains it.

**Evidence location (when fulfilled):**
- `tests/fixtures/canonical/seed-cohort-v1.jsonl`
- Verified by `scripts/nex-canonical/eval-prerequisites.test.ts` (does not exist yet)

**Status: MISSING.** Seed cohort file does not exist.

### Proof 2 · Eval corpus provenance

**Statement:** Positive, negative, and ambiguous corpus files exist with ≥200+200+~50
pairs respectively; every pair has `label_decision.labelled_by ∈ {"founder", "admin:*"}`;
every label revision is append-only (never in-place mutated).

**Acceptance:**
- Three JSONL files exist at `tests/fixtures/eval/`.
- Pair counts: ≥200 positive, ≥200 negative, ~50 ambiguous.
- Every pair's `label_decision.labelled_by` matches the sealed pattern.
- No pair has a `superseded_by_pair_id` cycle; every revision chain terminates.

**Evidence location (when fulfilled):**
- `tests/fixtures/eval/*.jsonl`
- Verified by `scripts/nex-canonical/eval-prerequisites.test.ts`

**Status: MISSING.** No eval corpus files exist.

### Proof 3 · Resolver determinism

**Statement:** Given byte-identical candidate + canonical pool + source_registry row,
the resolver verdict is byte-stable. Running the resolver twice on the same inputs
produces identical `kind`, `score`, `target_canonical_business_id`, and
`score_breakdown`.

**Acceptance:**
- A test harness runs the resolver 100× on a fixed representative candidate +
  canonical set and asserts every output is byte-equal to the first.
- No wall-clock, randomness, or environment-variable dependency surfaces.

**Evidence location (verified):**
- `scripts/nex-canonical/canonical-resolver.test.ts` — currently passes
  (reads `scripts/nex-canonical/vitest.local.config.ts` suite · PASS 1145/1145)
- `scripts/nex-canonical/canonical-handoff.test.ts` — pure precheck, no clock,
  no randomness (verified by header invariants in `canonical-handoff.ts §10`)

**Status: PARTIAL.** The resolver code is architecturally pure (verified by module
header invariants). A dedicated "run resolver 100× on same input, assert byte-equal"
test does not yet exist as a named proof. The implicit determinism is defensible
but not provable without the dedicated test.

**Gap to close:** author
`scripts/nex-canonical/rule-5m-proof-3-determinism.test.ts` running the resolver
on a locked fixture 100 times and asserting byte-equal output.

### Proof 4 · Rule-5j HARD gates

**Statement:** On the eval corpus, the resolver's measurement satisfies:
`false_merge_rate ≤ 1%` AND `precision ≥ 98%` (both are HARD; no threshold
relaxation permitted per Rule 5j).

**Acceptance:**
- Measurement runner runs the resolver against every pair in positive +
  negative + ambiguous corpus files.
- Confusion matrix is written to `tests/fixtures/eval/measurement-run-{commit}.json`.
- `false_merge_rate = (merged_negatives + merged_ambiguous) / total_negatives ≤ 0.01`.
- `precision = merged_positives / (merged_positives + merged_negatives) ≥ 0.98`.

**Evidence location (when fulfilled):**
- `tests/fixtures/eval/measurement-run-latest.json`
- Measurement produced by `scripts/nex-canonical/eval-measurement-runner.ts`

**Status: MISSING.** Prerequisites (eval corpus + measurement runner + seed-loaded
canonical pool) do not exist.

### Proof 5 · Rule-5j SOFT gates

**Statement:** On the eval corpus, the resolver's measurement satisfies:
`recall ≥ 70%` AND `abstention_rate_on_ambiguous ≥ 80%` (both SOFT; failure
triggers measured corpus expansion per sealed §6, not threshold relaxation).

**Acceptance:**
- `recall = merged_positives / total_positives ≥ 0.70`.
- `abstention_rate_on_ambiguous = ambiguous_verdicts / total_ambiguous_pairs ≥ 0.80`.

**Evidence location (when fulfilled):**
- Same artefact as Proof 4.

**Status: MISSING.** Same prerequisites as Proof 4.

### Proof 6 · Rule-5l abstention safety at write boundary

**Statement:** Zero `AMBIGUOUS` resolver verdict reaches the canonical write path.
`precheckHandoff` must refuse any `kind === "AMBIGUOUS"` input before producing
any plan.

**Acceptance:**
- Test harness feeds a `ResolverVerdict` of `kind: "AMBIGUOUS"` into
  `precheckHandoff` and asserts result is `{ ok: false, reason: { kind:
  "resolver_ambiguous" } }`.
- Static code audit confirms no code path downstream of `precheckHandoff` accepts
  an AMBIGUOUS verdict.

**Evidence location (verified):**
- `scripts/nex-canonical/canonical-handoff.ts §9.8` — "AMBIGUOUS always blocks ·
  never any plan" (sealed code comment)
- `scripts/nex-canonical/canonical-handoff.test.ts` — includes AMBIGUOUS-blocks
  assertion (currently passes)

**Status: PARTIAL.** The code is sealed to block AMBIGUOUS. A dedicated named
assertion exists in `canonical-handoff.test.ts`. The honest gap: Rule 5m calls
for a FORMAL named proof asserting this invariant, binding its evidence here.

**Gap to close:** promote the existing assertion to a named Rule-5m proof entry
in a dedicated `scripts/nex-canonical/rule-5m-proof-6-abstention-safety.test.ts`
so the proof manifest is unambiguous.

### Proof 7 · Reproducibility of measurement

**Statement:** Every measurement run records the file commit hash of the three
corpus files AND the resolver module hash. Re-running the measurement on the
same hashes produces byte-identical results.

**Acceptance:**
- Measurement runner records `corpus_commit_hashes = { positive: sha256, negative:
  sha256, ambiguous: sha256, seed_cohort: sha256 }` and `resolver_module_hash:
  sha256` in every result artefact.
- A reproducibility test re-runs the measurement on the same hashes and asserts
  byte-equal `measurement-run-*.json`.

**Evidence location (when fulfilled):**
- Measurement runner emits these hashes.
- Reproducibility test at
  `scripts/nex-canonical/rule-5m-proof-7-reproducibility.test.ts`

**Status: MISSING.** No measurement runner exists.

---

## Status summary

| Proof | Status | Blocker |
|---|---|---|
| 1 · Seed cohort provenance | MISSING | Seed cohort file does not exist |
| 2 · Eval corpus provenance | MISSING | 3 corpus JSONL files do not exist |
| 3 · Resolver determinism | PARTIAL | Dedicated 100×-same-input test not authored |
| 4 · Rule-5j HARD gates | MISSING | Prereqs 1+2 + measurement runner missing |
| 5 · Rule-5j SOFT gates | MISSING | Same as Proof 4 |
| 6 · Rule-5l abstention safety | PARTIAL | Named Rule-5m test file not authored |
| 7 · Reproducibility | MISSING | Measurement runner missing |

**Of 7 proposed proofs: 0 PASS, 2 PARTIAL, 5 MISSING.**

This is the correct, honest state. Any live legacy backfill DML remains gated by
Rule 5m. The previous completion report's framing — "Rule-5m proofs are implicit
in existing tests" — was inaccurate and is withdrawn here.

---

## What the next-run build must deliver

To move Proofs 3 and 6 from PARTIAL to PASS (achievable without founder-level
corpus work):

- `scripts/nex-canonical/rule-5m-proof-3-determinism.test.ts`
- `scripts/nex-canonical/rule-5m-proof-6-abstention-safety.test.ts`

To move Proofs 1, 2, 4, 5, 7 from MISSING to PASS (founder-level work required):

- Author `tests/fixtures/canonical/seed-cohort-v1.jsonl` — **founder authorises
  specific seeds**
- Author `tests/fixtures/eval/positive-pairs-v1.jsonl` + negative + ambiguous —
  **founder/admin labels each pair**
- Author `scripts/nex-canonical/eval-measurement-runner.ts` — the runner itself
  is code-authorable, but running it requires the above two artefacts
- Author `scripts/nex-canonical/rule-5m-proof-7-reproducibility.test.ts`

Only after all seven PASS and the resulting `rule-5m-proof.json` artefact is
founder-signed may the live legacy backfill wave proceed.

---

## Aggregator script contract

A thin aggregator (`scripts/nex-canonical/rule-5m-proof-aggregator.ts`,
to be authored this run) will:

1. Check for each prerequisite artefact.
2. Run each proof's dedicated test file.
3. Record PASS / FAIL / MISSING per proof.
4. Emit `rule-5m-proof.json` with the status table above and a cumulative
   `all_seven_pass: boolean`.
5. Refuse to emit `all_seven_pass: true` while any proof is MISSING or FAIL.
6. The emitted artefact is suitable for founder review but is NOT itself a
   proof — the proofs are the underlying evidence it summarises.

---

**Sealed authority:** None. This manifest is a proposal requiring founder
sign-off. The pre-authorisation state of Rule 5m is: NOT MET. The live legacy
backfill wave remains correctly gated.
