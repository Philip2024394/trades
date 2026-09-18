# Test E · Immutable Preservation Record

**Purpose.** Freeze the exact state at which Test E (Capability Discovery)
was runtime-verified with the anti-cheating audit certified, before any
subsequent code change (Test F onwards) touches the tree. This document is
append-only. Do not edit any line after the `----- LOCKED -----` fence.

**Founder authorisation to preserve this record:** *"Preserve the exact
Test E state. Don't overwrite it. You now have `3ddae26b` and
`rule-0476695f90fd320b`. Those should become permanent provenance
evidence. Then run Test F from that exact committed state."*

## Preservation created

- **Date:** 2026-09-18
- **Author of the Test E work:** Philip O'Farrell (Git author `Philip2024394` for every commit in the chain)
- **Frozen commit:** `3ddae26b` (short) · `3ddae26b test(nex1): Test E · capability discovery VERIFIED · anti-cheating certified`
- **Git tag:** `nex1-test-e-verified` → points at `3ddae26b` (annotated tag, message: `Test E · Capability Discovery · VERIFIED + NO_CHEATING_DETECTED · immutable preservation before Test F`)

## The discovered capability record (data-derived, not source-encoded)

- **rule_id:** `rule-0476695f90fd320b`
- **discovered_at (approx):** 2026-09-18
- **shape_signature:**
  - `has_signature_format: true`
  - `value_type: "number"`
  - `path_dir_root: "src"`
  - `path_dir_second: "lib"`
  - `selection_state: "SELECTED"`
- **support_count:** 3
- **invariants induced from evidence:**
  1. `selected_candidate_has_double_colon_separator`
  2. `selected_candidate_prefix_equals_source_file`
  3. `selected_candidate_suffix_is_numeric`
  4. `all_entries_share_path_prefix` · `extra.path_prefix: "src/lib/family"`
- **first_seen:** 2026-09-16T00:00:00Z
- **last_seen:** 2026-09-18T00:00:00Z

## Adversarial rule from Test E (different data → different rule_id)

- **rule_id:** `rule-b2044a2efb6ba920` (from string-suffix training set — proves data-derivation)

## Receipt integrity · SHA-256 at preservation time

Any subsequent change to these files will visibly break the hash chain
recorded here. This is the primary integrity check for the preservation.

| Path | SHA-256 | bytes |
|---|---|---|
| `data/nex1-discovery-experiments/test-e-session-1-receipt.json` | `96b22cee8a61bb9cad677c6fe2a0367229a0b235dcd86dc5d6ea7d074a2b2e59` | 951 |
| `data/nex1-discovery-experiments/test-e-capability-discovery-receipt.json` | `833d1f17ccc3317bbfcbc6d97ad916ebe127211a71a8833e2e05dcdc8d3105ba` | 3500 |
| `data/nex1-discovery-experiments/test-e-anti-cheating-audit-receipt.json` | `6af42254c8f71194a76ee550cbc02331d713ce8f0b4dbae4dab1f737a0a73960` | 2984 |
| `src/lib/nex-agent/code-engine/capability-capability-discovery.ts` | `892557bd7ae3495977fbd9396165817994b76041872dbe86b392567932ebd79d` | 15596 |
| `src/lib/nex-agent/code-engine/capability-capability-discovery.test.ts` | `1c1c5e9fd6a5905a46220ebe47d20f6359109adf4ed091e79e0b620d811193cc` | 9727 |
| `scripts/nex1-discovery-experiments/test-e-capability-discovery.mjs` | `38617dd8941827bec33a43edae473dc3111d1b3fed77146ea5cc2e8219218cb8` | 11543 |
| `scripts/nex1-discovery-experiments/test-e-anti-cheating-audit.mjs` | `f42955aeffe79b9a35e0e770d98b7de21f69bbe41f187053b2e12c8a20fb6137` | 15940 |

## Verification status at preservation time

- **Test E correctness matrix:** 8 of 8 cases PASS.
- **Anti-cheating audit:** 7 of 7 falsifiability audits PASS · verdict `NO_CHEATING_DETECTED`.
- **Regression at commit `3ddae26b`:** 28 test files · 2152/2152 tests pass.
- **Zero LLM at runtime.** Grep of `capability-capability-discovery.ts` for `openai|anthropic|claude|gemini|groq|ollama` returned nothing.

## The precise claim locked at this state

*"NEX1 has, without an LLM at runtime, deterministically induced a specific
first-class capability record (`rule-0476695f90fd320b`) from three
accumulated experiences, persisted it, applied it to a novel input never
named in any code, and correctly refused inputs outside the induced family.
Seven independent anti-cheating audits — testing load-bearing behaviour,
data-derivation, invariant-conditioned parsing, universal quantification,
content-addressed identity, and source-code integrity — all pass. The
discovery is not hidden encoding."*

Nothing broader has been proven at this state. Nothing broader should be
inferred from this record.

## Progress on the founder's central question at this state

- **DISCOVER** ✅ — the specific rule + invariants
- **VALIDATE** ✅ — 7-audit anti-cheating certification
- **STORE** ✅ — `data/nex1-discovered-capabilities/rules.jsonl` (append-only)
- **APPLY to a different situation** 🟡 — retrieval + prediction work in a controlled harness. Runtime coding-loop bias is the subject of the next experiment (Test F). Not proven at this state.

## Restore + audit recipe

To independently reproduce Test E's evidence from this preservation:
1. `git checkout nex1-test-e-verified` (this checks out commit `3ddae26b`)
2. Run `npx tsx scripts/nex1-discovery-experiments/test-e-capability-discovery.mjs` — must produce a receipt whose SHA-256 matches the value in this document.
3. Run `npx tsx scripts/nex1-discovery-experiments/test-e-anti-cheating-audit.mjs` — must produce a receipt whose SHA-256 matches the value in this document.
4. Run `npx vitest run src/lib/nex-agent/code-engine/` — must report `2152 passed`.

Any deviation from the recorded hashes or counts falsifies the preservation.

## Legal / IP note (unchanged from main provenance record)

This record is technical evidence. It is not a substitute for legal IP
protection. Consult qualified patent / copyright counsel before public
disclosure or filing decisions.

----- LOCKED -----

*Do not edit above this fence. Amendments belong below in a Test-E-Update
section that references this locked state by SHA-256.*
