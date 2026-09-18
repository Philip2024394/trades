# NEX1 · GROWTH BASELINE 0

**Purpose.** Freeze the state of NEX1 immediately after Cycle 2 (Test F verified) so any subsequent autonomous-growth experiment can be measured against a fixed reference. This document is append-only. Do not edit any line above the `----- LOCKED -----` fence.

**Author of the frozen state:** Philip O'Farrell (Git author `Philip2024394`).
**Freeze date:** 2026-09-18.
**Freeze rule:** the baseline must be reproducible from Git alone. Runtime accumulated state (Fix 17 store, discovered-rules store, agent-registry runtime dbs) is empty at freeze time and is not part of the baseline.

---

## Git provenance at freeze

- **HEAD commit at freeze:** `32b91f1d test(nex1): Test F · runtime bias VERIFIED · APPLY step closed`
- **Chain of Cycle 2 commits:**
  - `c98ec068` Test B · cross-experience abstraction VERIFIED (7/7)
  - `e9176970` Test C · cross-session persistence VERIFIED
  - `882cc3a6` Test D · monotonicity + order-independence VERIFIED
  - `3ddae26b` Test E · capability discovery VERIFIED + NO_CHEATING_DETECTED
  - `42a13f04` Test E preservation record (immutable)
  - `32b91f1d` Test F · runtime bias VERIFIED
- **Tag protecting Test E:** `nex1-test-e-verified` → `3ddae26b`
- **Other tags visible in repo:** `nex-router-v1.0-cognitive-foundation`, `v1.0.0` (unrelated to this baseline; recorded for completeness).

## Regression at freeze

```
28 test files · 2152/2152 tests pass · zero LLM at runtime
```

## Static file counts at freeze

| Category | Count | Notes |
|---|---|---|
| `src/lib/nex-agent/code-engine/*.ts` source files | 92 | includes all learning + coding + safety modules |
| `*.test.ts` unit test files | 12 (in code-engine directory) | full regression = 28 test files including subdirs |
| Canonical registered agents | 20 | via `ensureCanonicalAgentsRegistered` — the roster grew from 19 to 20 with Fix 35 addition |
| Micro-brain concrete instances | 3 | `mb_test_shape`, `mb_identifier_hint`, `mb_fix_confidence` |
| Cortex router | 1 | `capability-cortex-router.ts` |
| Fix 35 induction probes | 6 | fixed declarative table |
| Fixture files | 7 | in `src/lib/nex1-fix24-fixtures/` |
| Provenance / discovery docs | 5 | preservation record, invention record, intelligence log, cycle-2 significance, this baseline |

## Runtime persistent stores at freeze

| Store | State at freeze | Purpose |
|---|---|---|
| `data/nex1-investigation-conclusions/entries.jsonl` | **empty** (cleaned by Test F's `resetStores`) | Fix 17 write · Fix 26 read |
| `data/nex1-discovered-capabilities/rules.jsonl` | **empty** (cleaned by Test F's `resetStores`) | Fix 35 rule persistence |
| `data/nex1-agent-registry/` | populated with prior-experiment traces | Agent registry catalog + per-agent JSONL DBs + heartbeats |

The two experience stores are deliberately empty at freeze. Any post-baseline entries constitute measurable state change.

## SHA-256 (first 16 hex) of load-bearing source at freeze

| SHA-16 | File |
|---|---|
| `93af171e147dff7f` | `capability-chat-turn.ts` |
| `134ccc25e2c6bbe5` | `capability-fear.ts` |
| `dc0e330ac7bfd937` | `capability-concern.ts` |
| `2cd176effcc5d7db` | `capability-afraid.ts` |
| `09ff0908d6321868` | `capability-experience-abstraction.ts` |
| `892557bd7ae34959` | `capability-capability-discovery.ts` |
| `b77ba87eed7105ce` | `capability-micro-brain.ts` |
| `5b18a9b853b9b9d6` | `capability-cortex-router.ts` |
| `f83e9e3bbf87301d` | `capability-micro-brains-instances.ts` |
| `9b6138d3125db4f3` | `capability-agent-registry.ts` |
| `29a6465ed39b8e62` | `capability-prior-evidence-comparator.ts` |
| `55434392ade8cc65` | `capability-class2-bridge.ts` |
| `5cb6e77b58cd1b3a` | `capability-specification-extractor.ts` |
| `f85153bc94b9b07c` | `capability-j2-cause-analysis.ts` |
| `0b569501406c13cf` | `investigation-conclusion-store.ts` |
| `03ada775880cff33` | `capability-candidate-ranker.ts` |
| `0b51c8976ceb630f` | `capability-candidate-selector.ts` |

---

## §A · WHAT NEX1 HAS AT BASELINE 0

Every entry below is a *mechanism NEX1 possesses*, not a claim of intelligence.

### A.1 Cognitive-signal agents (each with own executable rulebook)
- **Fear** — `capability-fear.ts` — boundary agent · protected-path + cross-repo + preservation gate
- **Concern** — `capability-concern.ts` — risk-signal aggregator (LOW / ELEVATED / HIGH)
- **Afraid** — `capability-afraid.ts` — session-mood assessor from turn history

### A.2 Learning machinery
- **Fix 17** write · `investigation-conclusion-store.ts` (append-only JSONL)
- **Fix 26** read · `capability-experience-retrieval.ts`
- **Fix 30** aggregate per source_file · `capability-cross-session-learning.ts`
- **Fix 30B** relationship comparator · `capability-prior-evidence-comparator.ts`
- **Fix 34** cross-source-file pattern extractor · `capability-experience-abstraction.ts` (5-dim `ShapeFeatures`, exact + relaxed retrieval)
- **Fix 35** capability discovery · `capability-capability-discovery.ts` (6 fixed induction probes, content-addressed rule_id, persistence to `data/nex1-discovered-capabilities/rules.jsonl`)

### A.3 Agent registry + heartbeat
- **Central catalog:** `data/nex1-agent-registry/agents.json`
- **Own JSONL DB per agent:** `data/nex1-agent-registry/agent-dbs/{id}.jsonl`
- **Heartbeat file per agent:** `data/nex1-agent-registry/heartbeats/{id}.json`
- **Canonical roster:** 20 agents including 3 micro-brains, cortex router, capability_discovery

### A.4 Micro-brain lattice
- **Shared shape:** `capability-micro-brain.ts` (`observe → predict → learn` with own JSONL DB, own rulebook)
- **Concrete instances (3):** `mb_test_shape`, `mb_identifier_hint`, `mb_fix_confidence`
- **Cortex router:** `capability-cortex-router.ts` (5-state consensus aggregation)

### A.5 Coding pipeline (byte-locked operator library)
- Fix 20 J.2 shape classifier (with Fix 33 Case B-prime for local-bare-from-imported-call)
- Fix 21 outcome-field disambiguation
- Fix 22 literal normaliser
- Fix 23a `replace_return_literal` operator
- Fix 23b data-flow tracer
- Fix 23c preservation-check with auto-revert
- Fix 24 Class 2 Bridge (assertion → ExpectedBehaviour, P1 + P9 shapes)
- Fix 25 salience switch (adjacent-test detection + promotion gate)
- Fix 32 coding-loop stage evidence surfacing
- **Byte-locked:** every operator's SHA-16 is recorded above.

### A.6 Orchestration
- `capability-chat-turn.ts` (single-file turn conductor)
- Fix 35 discovery consulted at Fix 25 gate (informational · verified in Test F)

### A.7 Reasoning + selection
- Q7 rank policy · `capability-candidate-ranker.ts`
- Q8 select policy · `capability-candidate-selector.ts`
- Native investigation mode with hypothesis + evidence + comparison + ranking + selection

### A.8 Vocabulary + intent
- `capability-a-founder-intent/` classifier + vocabulary v5
- Paraphrase library (from prior work)

### A.9 Verified experiments (evidence per Cycle 2)
- Test A REFUSED_HONESTLY (fabrication is not possible for shapes outside the operator library)
- Test B cross-source-file abstraction (7/7 adversarial)
- Test C cross-session persistence (fingerprint match across processes)
- Test D monotonicity + order-independence
- Test E capability discovery (rule `rule-0476695f90fd320b` discovered + NO_CHEATING_DETECTED audit 7/7)
- Test F runtime bias (rule `rule-db7815e90f301dce` consulted in `runChatTurn`, informational, load-bearing, non-authoritative)

---

## §B · WHAT NEX1 DOES NOT HAVE AT BASELINE 0

Every entry below is an *honest absence*, not a criticism.

### B.1 No operator invention at runtime
NEX1 cannot synthesise new coding operators from experience. The operator library (Fix 20 / 23a / 23b / 23c / etc.) is hand-authored. Any new operator class requires an author's edit.

### B.2 No probe extensibility at runtime
`INDUCTION_PROBES` in Fix 35 is a fixed table of 6 probes. NEX1 does not add probes at runtime.

### B.3 No language paraphrase understanding
No module for recognising two paraphrased strings as equivalent. Vocabulary classifier exists but paraphrase-similarity does not.

### B.4 No conversational reference across ≥4 turns
Conversation-head bindings exist but no deterministic reference resolver validated across a 4+ turn conversation with mid-conversation partial update.

### B.5 No cross-domain transfer
No test has demonstrated a rule discovered in domain X applying to a genuinely different domain Y.

### B.6 No failure-as-learning
No module writes a failure record to Fix 17 when the coding-loop refuses. Failure information is not persisted as first-class learning input.

### B.7 No probabilistic / statistical models
Everything is exact-match or deterministic rule fire. No confidence weighting from data (weights are hand-authored tables).

### B.8 No autonomous exploration
NEX1 does not initiate its own experiments. It responds to inputs.

### B.9 No self-modification of source
NEX1 does not edit its own source code. Every source change requires a human author.

### B.10 No LLM at runtime
This is a constitutional constraint, not a gap — recorded here because it bounds what any autonomous-growth experiment can prove.

### B.11 No HTTP-verified path this session
The Next.js dev server has been stuck in a Tailwind file-watcher cache for the last several sessions. Every runtime experiment in Cycle 2 was direct-module. This is a tooling gap, not a NEX1 gap.

### B.12 No demonstrated switch-branch / conditional-branch / array-mutation / class-method operator
Test A verified NEX1 refuses these families honestly. It cannot fix them.

### B.13 No demonstrated multi-modal reasoning
Text-only. No image, audio, or code-execution-in-sandbox capabilities.

### B.14 No demonstrated generalisation ACROSS shape families
Fix 34 groups by exact feature signature. Cross-family generalisation (e.g. numeric family patterns applying to string family) has not been proven.

### B.15 No demonstrated meta-rules (rules about rules)
Fix 35 discovers rules over experiences. No module discovers rules over discovered rules.

---

## §C · The precise starting state statement

> *At Baseline 0 (git `32b91f1d`, tag `nex1-test-e-verified` still valid), NEX1 possesses 92 source files across the code-engine tree, 20 canonical registered agents, 3 micro-brains, 6 induction probes, a byte-locked operator library, 2152/2152 tests passing, and evidence for six Cycle-2 experiments. All runtime accumulated experience stores are empty. Everything not listed in §A does not exist. The absences in §B are honest gaps, some by design (B.10, B.9) and some as measurable frontiers (B.1–B.7).*

---

## §D · What "growth" would mean, measured against §A and §B

Using the founder's Growth-Level rubric:

- **Level 1 (Knowledge growth):** entries appear in `data/nex1-investigation-conclusions/entries.jsonl` or `data/nex1-discovered-capabilities/rules.jsonl` that were not seeded by the experiment engineer.
- **Level 2 (Derived knowledge):** Fix 34 or Fix 35 produces a pattern/rule that could not be predicted from the seed data alone — e.g., a new invariant kind fires unexpectedly, or a pattern group emerges from data that the engineer did not group.
- **Level 3 (Reusable capability):** the derived knowledge applies correctly to inputs materially different from the training set (novel domain, novel value type, novel path family).
- **Level 4 (Cross-context transfer):** a rule induced from evidence in domain X applies successfully to a genuinely different domain Y (§B.5 absence would be closed).
- **Level 5 (Autonomous capability formation):** NEX1 identifies a limitation, derives what is needed, forms a reusable capability, validates it, persists it, and later uses it without a developer specifying the capability.

Levels 4 and 5 currently have no evidence.

---

## §E · Reproduction recipe

To independently verify Baseline 0:

1. `git checkout 32b91f1d`
2. `npx vitest run src/lib/nex-agent/code-engine/` → must produce `28 test files · 2152 passed`.
3. Verify tag: `git tag -l nex1-test-e-verified` → must exist.
4. Verify SHA-16 of the 17 files in the hash table above matches this record.

Any deviation falsifies the baseline.

---

## §F · Two-ledger rule (from founder's protocol §11)

Every subsequent state change must be classified into exactly one of:

- **LEDGER A · NEX1 GROWTH** — changes genuinely attributable to NEX1's own data-derived processes.
- **LEDGER B · HUMAN ENGINEERING** — anything manually added by the engineer during the experiment.

Never blur the two. The experiment report will not count Ledger B additions as growth.

---

----- LOCKED -----

*Do not edit above this fence. Amendments belong below in a separate Growth-Baseline-Update section that references this locked state by SHA-256 of Baseline 0 itself.*
