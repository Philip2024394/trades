# NEX Evolution Roadmap · 2026-09-13

**Assembled per Master Founder Prompt §30 "First Action".** Inspection of current state → proposed WO sequence with rationale → weaknesses / risks → dependency graph → recommendation for next WO.

**Anchor commit at time of assembly:** `10725a175a737addafeab045cd474b6e769315d1` (WO-ACADEMY-01 landed).

---

## 1 · Inspection of current state

### 1.1 · Delivered subsystems (evidence-backed)

| Subsystem | Commit | Tests | Preservation bundle |
|---|---|---:|---|
| WO-01 · durable project state | (in the wo01..13 chain) | 17 | folded into WO-12 bundle |
| WO-02 · Ed25519 authorisation | ” | 28 (incl. WO-13 test additions) | ” |
| WO-03 · code-gen pipeline + challenger | ” | (in orchestrator suite) | ” |
| WO-04 · Broker executor + observer | ” | ” | ” |
| WO-05 · real subprocess build | ” | ” | ” |
| WO-06 · real runtime + HTTP health | ” | ” | ” |
| WO-07 · specialist adapters | ” | ” | ” |
| WO-08 · GB evidence persistence | ” | ” | ” |
| WO-09 · correction/rebuild loop | ” | ” | ” |
| WO-11 · first real 3-page app | ` 32b4e037` | 17 tests | folded into WO-12 bundle |
| **WO-12** · real failure-driven correction | `ab956909` → `52c39df0` | 2 tests | `NEX-WO12-EVIDENCE-2026-09-13` |
| **WO-13** · substrate hardening + attestation | `f471b32c` → `9ffd8d0e` | 16 adversarial + 1 wo2 | `NEX-WO13-EVIDENCE-2026-09-13` |
| **WO-INTELLIGENCE-01** · Discovery Core | `dd518e8f` → `39c795f2` | 23 (7 pos + 16 adv) | `NEX-WO-INTELLIGENCE-01-EVIDENCE-2026-09-13` |
| **WO-INTELLIGENCE-02** · continuous knowledge growth | `c9248053` | 19 (7 prop + 12 adv) | `NEX-WO-INTELLIGENCE-02-EVIDENCE-2026-09-13` |
| **WO-HQ-AGENTS-01** · live agent observation | `3f5fdbd1` | 14 (8 adv + 6 prop) | `NEX-WO-HQ-AGENTS-01-EVIDENCE-2026-09-13` |
| **WO-ACADEMY-01** · registry + capability + career + notice + task market | `10725a17` | 26 (14 adv + 4 prop + 8 mech) | `NEX-WO-ACADEMY-01-EVIDENCE-2026-09-13` |

**Suite total:** 286/286 across 16 test files. **Doctrine anchors:** P-A..P-Z with P-S v2 revision + NEX Continuous Operation Doctrine (2026-09-13, 12 sections plus §11.1/§11.2/§11.3 addenda).

### 1.2 · Existing architecture (functional)

- **Authorisation:** Ed25519 founder-key manifest (signed, attestation-verified via WO-13); per-action authorisation with trace/nonce/expiry/chain-hash; every filesystem mutation Broker-gated
- **Substrate integrity:** SHA-256 attested table over 7 security-critical files; drift refused at every authorise call
- **Storage:** GB abstraction (JsonlStorage default; Postgres/dual-write via `NEX_STORAGE_BACKEND`); 6 orchestrator + 6 intelligence + 6 academy collections registered
- **Execution:** real Node subprocess for build/runtime/specialist; real HTTP for runtime health; deterministic content-hash + provenance-chain on every persistent record
- **Intelligence Discovery Core:** four-mode discovery (pattern/conflict/connection/combination); deterministic hypothesis → real experiment → scoring → promotion; source-class taxonomy + Node.js docs adapter; revisit loop (immutable old objects); held-out generalisation split
- **HQ observation:** 14 named agents across two lanes; per-agent lifecycle state + Academy overlay
- **Agent Academy:** 14 agents onboarded with capability profiles + career states + score records; 10 mechanisms as pure functions; deterministic career transitions; notice discipline; Knowledge Harvest workflow

### 1.3 · What is NOT yet implemented

- Training programs · **WO-ACADEMY-02 (this document's target)**
- Adversarial examinations · WO-ACADEMY-03
- Benchmark competitions · WO-ACADEMY-04
- Research missions · WO-ACADEMY-05
- 7 specialist schools · WO-ACADEMY-06..12
- Controlled new-agent creation · WO-ACADEMY-13
- Compute Governor · WO-COMPUTE-01
- Remote worker architecture · WO-COMPUTE-02
- Multi-agent teams · WO-TEAM-01
- Phase 9 Vision (real eyes)
- Phase 14 Guardian
- T3-C native Job Object
- WO-WORKSTATION-14 (authority adversarial)
- WO-WORKSTATION-15 (crash/restart durability)

## 2 · Proposed WO sequence

### 2.1 · Founder default sequence (from Master Prompt §26)

```
WO-ACADEMY-01  ✓ complete
      ↓
WO-ACADEMY-02  Training Engine                 ← NEXT (this Roadmap's recommendation)
      ↓
WO-ACADEMY-03  Adversarial Examination
      ↓
WO-ACADEMY-04  Benchmark Competition
      ↓
WO-ACADEMY-05  Research Missions
      ↓
WO-ACADEMY-06..12  Specialist Schools (7 separate WOs)
      ↓
WO-COMPUTE-01  Resource Governor
      ↓
WO-COMPUTE-02  Remote Worker Architecture
      ↓
WO-TEAM-01     Multi-Agent Teams
      ↓
WO-ACADEMY-13  Controlled New-Agent Proposal/Creation
```

### 2.2 · Where I would deviate from the founder default (§26 grants this discretion)

**Proposed adjustment: bring WO-COMPUTE-01 forward — probably before WO-ACADEMY-04.**

Reason: WO-ACADEMY-02 (Training) runs bounded per-run experiments — small work, current infrastructure handles it. WO-ACADEMY-03 (Adversarial Exam) also bounded per exam. But **WO-ACADEMY-04 (Benchmark Competition)** and **WO-ACADEMY-05 (Research Missions)** are structurally the first WOs that could saturate a laptop. Introducing the Compute Governor before those two protects the founder workstation exactly at the point where load actually appears.

Recommended revised sequence:
```
WO-ACADEMY-02  Training Engine                 ← next
WO-ACADEMY-03  Adversarial Examination
WO-COMPUTE-01  Resource Governor (moved earlier)
WO-ACADEMY-04  Benchmark Competition
WO-COMPUTE-02  Remote Worker
WO-ACADEMY-05  Research Missions
WO-ACADEMY-06..12  Specialist Schools
WO-TEAM-01     Multi-Agent Teams
WO-ACADEMY-13  Controlled New-Agent Proposal/Creation
```

This is a recommendation, not a change. Founder decides.

### 2.3 · Parallel tracks (do not derail the Academy line)

Independent from the main line:
- **WO-WORKSTATION-14** (authority adversarial) · workstation-substrate hardening
- **WO-WORKSTATION-15** (crash/restart durability) · workstation-substrate hardening
- **Phase 9 Vision** · perception-layer capability (separate authorisation; requires its own doctrine)
- **Phase 14 Guardian** · safety-monitoring layer (separate authorisation; per P-V/P-W)
- **T3-C native Job Object** · OS-level substrate

Recommendation: keep WO-14/15 parallel to Academy-02..03. Guardian benefits from Academy-04's benchmarking existing.

## 3 · Weaknesses + risks identified

### 3.1 · Currently-tracked engineering weaknesses (per Continuous Operation Doctrine §4)

| Weakness | Status | Where surfaced |
|---|---|---|
| Flaky WO-12 test (parallel-race with other tests' storage cleanups) | monitored | flagged at WO-INTELLIGENCE-02 preservation |
| WO-04 executor: runtime tampering during a write not monitored (secure-boot layer) | founder-accepted | onboarding for wo4-broker-executor |
| WO-05: no per-executable version pinning + no signed binary attestation | monitored | onboarding for wo5-build-executor |
| WO-06 health-check body match is substring only, no schema validation | bounded | onboarding for wo6-runtime-executor |
| WO-07 only Node.js — no TS/Python/other-language specialists | bounded | onboarding for wo7-node-syntax-specialist |
| WO-09 rule library small (v0.1) — mixed-signal failures not handled | bounded | onboarding for wo9-corrector |
| WO-13 no post-startup mutation monitoring (secure-boot / TPM) | founder-accepted | onboarding for wo13-substrate-guard |
| Intelligence Discovery — stopword list small; classifier weights hand-tuned | monitored | onboarding for intelligence-discovery |
| Intelligence Hypothesis — 4 templates only | bounded | onboarding for intelligence-hypothesis |
| Intelligence Experiment — ONE experiment kind | bounded | onboarding for intelligence-experiment |
| Intelligence Proposals — text only, no structured diff | bounded | onboarding for intelligence-proposal |

Per Master Founder Prompt §22, every one of these is **tracked** (not hidden or overclaimed).

### 3.2 · Risks specific to WO-ACADEMY-02 (Training Engine)

| Risk | Mitigation |
|---|---|
| Training becomes activity-for-activity's-sake (§5 doctrine violation) | Every training run MUST show measured improvement delta or be recorded as `NO_IMPROVEMENT`. No promotion. |
| Training "improves" one metric while breaking another (regression) | Post-training regression check against baseline; regression triggers Notice 1 immediately (already wired in WO-ACADEMY-01 M8). |
| Training-outcome data can't be reproduced | Deterministic seed for training + fixture data; provenance chain over baseline + outcomes. |
| Training produces rule-proposals that expand agent authority | ARCHITECTURE decision: training produces PROPOSALS ONLY. Rule addition to a specialist requires a founder-signed WO (existing WO-03 pipeline). Training NEVER touches WO-13 substrate files. |
| Founder inbox floods with training reports | Training reports are batched per program run; only meaningful improvements produce a proposal. `NO_IMPROVEMENT` results persist but don't emit a proposal. |
| P-S v2 violation via "learning" that turns into ML | Training is deterministic rule/threshold/pattern-library expansion. No gradient descent. No LLM. |

### 3.3 · Cross-cutting architectural risks

- **Test suite growth** — 286 tests, running in ~4 seconds. At current rate, each WO adds 15-25 tests. WO-ACADEMY-02..12 could add 300+ tests, keeping suite under a minute is reasonable but flakiness pressure will grow.
- **Storage collections** — 18 collections registered so far. Growth is manageable but every new collection needs cleanup discipline in tests to avoid the WO-12-style parallel race.
- **Founder inbox load** — Intelligence proposals + Academy training reports + eventually Research Mission reports could overwhelm without triage. Suggest a proposal-triage helper as a Phase-2 concern.

## 4 · Dependency graph (delivered → future)

```
                 ┌─────────────────────┐
                 │ Continuous Operation │
                 │ Doctrine + P-S v2    │
                 └──────────┬──────────┘
                            │
                            ▼
        ┌───────────────────┴───────────────────┐
        │                                       │
        ▼                                       ▼
   Substrate WOs                      Intelligence WOs
   (WO-01..13)                        (WO-INTEL-01, 02)
        │                                       │
        └──────────────┬────────────────────────┘
                       │
                       ▼
              WO-HQ-AGENTS-01
                       │
                       ▼
              WO-ACADEMY-01
                (registry + profile + career + notice + task market)
                       │
                       ▼
         ┌─────────────┴─────────────┐
         │                           │
         ▼                           ▼
   WO-ACADEMY-02                Parallel: WO-14, WO-15
   Training Engine ← NEXT       Phase 9 Vision, Phase 14 Guardian
         │
         ▼
   WO-ACADEMY-03
   Adversarial Exam
         │
         ▼
   [WO-COMPUTE-01 moved here per §2.2]
         │
         ▼
   WO-ACADEMY-04 Benchmark
         │
         ▼
   WO-ACADEMY-05..12 (schools + research)
         │
         ▼
   WO-TEAM-01
         │
         ▼
   WO-ACADEMY-13 (new-agent proposal)
```

## 5 · Recommendation

**Next WO: WO-ACADEMY-02 · Training Engine** (spec at `docs/WORK-ORDERS/WO-ACADEMY-02-SPEC.md`).

Vertical slice: real training program for the WO-07 Node-Syntax Specialist. Rule-library expansion via deterministic evidence + baseline/post-training measurement + regression check + emitted proposal (NOT auto-promotion). Founder decides whether the proposed rule addition warrants a signed WO.

**Explicit non-goals** (belong to future WOs, §26): adversarial examinations, benchmark competitions, research missions, specialist schools, multi-agent teams, new-agent creation, compute governor.

**Founder authorisation gate** at §12 of the WO-ACADEMY-02 spec. Master AI does NOT begin implementation until the founder signs.
