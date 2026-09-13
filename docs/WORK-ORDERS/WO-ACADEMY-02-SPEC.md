# WO-ACADEMY-02 · Training Engine (vertical slice)

**Founder-authorised for SPECIFICATION 2026-09-13. Execution NOT yet authorised — the explicit gate is at §12.**

**Prerequisite:** WO-ACADEMY-01 complete (satisfied at HEAD `10725a17`). All 14 agents onboarded with capability profiles.

**Doctrine anchors:**
- NEX Continuous Operation & Maximum Capability Doctrine (§1..§10 + §11.1 five-concept separation + §11.2 flaky-test discipline + §11.3 no false intelligence)
- P-S v2 (external LLM banned as authority/execution/truth)
- P-Q (correction never creates authority)
- P-U (more intelligence ≠ more authority)
- P-M (internal capability ambition; no external comparative claims)

**Founder principle codified in this WO:**
> "An agent earns advancement by making NEX demonstrably better."

**Five-concept separation (Master Founder Prompt §3):** Training touches CAPABILITY, KNOWLEDGE, and INTELLIGENCE of an agent. Training does **NOT** touch AUTHORITY. Training does **NOT** promote CAREER — it produces evidence the founder can use to sign a promotion WO.

---

## 1 · Purpose

Prove the Training Engine machinery on ONE real training program end-to-end:
- Capture a **real baseline** of an existing agent's measurable performance
- Run a **real training program** (rule-library expansion via evidence)
- Measure **real improvement** deterministically against the baseline
- Verify **no regression** against previously-mastered capabilities
- Emit **evidence-backed proposal** to founder inbox — never auto-promote, never auto-apply

Founder acceptance question (from §6 of the Master Prompt):
> "Did the training produce measurable capability improvement?"

If yes with real evidence AND no regression AND deterministic reproducibility, WO-ACADEMY-02 succeeds.

## 2 · Non-goals

- **Not** adversarial examinations (WO-ACADEMY-03)
- **Not** benchmark competitions (WO-ACADEMY-04)
- **Not** research missions (WO-ACADEMY-05)
- **Not** the 7 specialist schools (WO-ACADEMY-06..12)
- **Not** autonomous rule application — every rule addition still routes through founder-signed WO + existing WO-03 pipeline
- **Not** any LLM introduction (P-S v2)
- **Not** any authority expansion (P-U, §3 doctrine)
- **Not** any modification to WO-13 substrate scope
- **Not** training on external network data (only NEX Intelligence knowledge + curated test corpora)

## 3 · Doctrinal alignment

| Principle | How WO-ACADEMY-02 honours it |
|---|---|
| P-Q · correction never creates authority | Training produces proposals only; rule adoption requires a founder-signed WO through the existing pipeline |
| P-U · more intelligence ≠ more authority | An agent that graduates a training program earns **higher scores + candidacy for promotion**, NEVER additional execution authority |
| P-S v2 · no external LLM | All training is deterministic rule/threshold/pattern-library expansion. No gradient descent. No model inference. |
| P-M · marketing framing | Training reports contain metric deltas + regression checks. No superiority claims. |
| Continuous Operation §5 · never reward activity | Training with no measured improvement is recorded as `NO_IMPROVEMENT` — no reward, no promotion, no score bump |
| Continuous Operation §22 (§11.3 memory) · no false intelligence | Explicit failure classifications: `INSUFFICIENT_EVIDENCE`, `GENERALISATION_FAILED`, `REGRESSION_INTRODUCED`, `NO_IMPROVEMENT`. Truth over appearance. |
| WO-13 substrate integrity | Training subsystem lives outside substrate; no substrate write helper imported |
| Five-concept separation | Training deltas update `capability_profile` + `task_completion_score` + `knowledge_contribution_score`; career state remains unchanged until founder-signed promotion WO |

## 4 · Architecture

```
                        TRAINING PROGRAM
                              │
              ┌───────────────┼───────────────┐
              ▼               ▼               ▼
        knowledge        skill               failure
        training         training             training
              │               │               │
              └───────────────┼───────────────┘
                              ▼
                         BASELINE CAPTURE
                              │
                              ▼
                       (agent's current metrics)
                              │
                              ▼
                       RUN TRAINING EXERCISES
                       (real subprocess, real GB persistence)
                              │
                              ▼
                       POST-TRAINING MEASUREMENT
                              │
              ┌───────────────┼───────────────┐
              ▼               ▼               ▼
        improvement     generalisation     regression
        delta            check             check
              │               │               │
              └───────────────┼───────────────┘
                              ▼
                        VERDICT (pure function)
                              │
      ┌──────────┬────────────┼────────────┬───────────┐
      ▼          ▼            ▼            ▼           ▼
IMPROVED    NO_IMPROVEMENT  GENERALISATION  REGRESSION  INSUFFICIENT
    │                       _FAILED         _INTRODUCED  _EVIDENCE
    │            │            │               │           │
    └────────────┴────────────┴───────────────┴───────────┘
                              │
                              ▼
                         TRAINING REPORT
                              │
                              ▼
                     PROPOSAL to founder inbox
                     (only when IMPROVED and no regression)
                              │
                              ▼
                  founder reviews · founder-signed WO
                  routes new rule through WO-03 pipeline
```

## 5 · Data model

### 5.1 · TrainingProgram

```typescript
interface TrainingProgram {
  readonly record_type: "NEX_ACADEMY_TRAINING_PROGRAM";
  readonly program_id: string;
  readonly target_agent_id: string;
  readonly domain: string;                    // must equal agent's specialist_domain
  readonly training_kind:
    | "knowledge"       // supply validated knowledge for rule discovery
    | "skill"           // controlled task exercises
    | "failure"         // adversarial task exercises (bounded)
    | "recovery"        // recovery from known failure classes
    | "generalisation"; // unseen tasks
  readonly baseline_task_ids: readonly string[];      // used only for baseline; NEVER re-used in generalisation
  readonly training_task_ids: readonly string[];      // agent sees these during training
  readonly generalisation_task_ids: readonly string[];// agent sees these ONLY at post-training measurement
  readonly regression_task_ids: readonly string[];    // previously-mastered capabilities that must remain intact
  readonly max_attempts: number;
  readonly deterministic_seed: string;                // same seed → same corpus split (per WO-INTEL-02 pattern)
  readonly created_at: string;
  readonly authorising_wo_id: string;                 // the founder-signed WO for THIS program
  readonly provenance_chain_hash: string;
}
```

### 5.2 · BaselineSnapshot

```typescript
interface BaselineSnapshot {
  readonly record_type: "NEX_ACADEMY_BASELINE";
  readonly baseline_id: string;
  readonly program_id: string;
  readonly agent_id: string;
  readonly captured_at: string;
  readonly baseline_metrics: {
    readonly task_completion_ratio: number;      // successes / attempts on baseline tasks
    readonly accuracy: number;                   // 0..1
    readonly reliability: number;                // 0..1
    readonly failure_classes: readonly { kind: string; count: number }[];
    readonly recovery_success_ratio: number;     // recovered/attempted on failure tasks
    readonly regression_scope_verified: boolean; // regression task set passed on baseline capture
  };
  readonly evidence_pointers: readonly string[];
  readonly provenance_chain_hash: string;
}
```

### 5.3 · TrainingRun

```typescript
interface TrainingRun {
  readonly record_type: "NEX_ACADEMY_TRAINING_RUN";
  readonly run_id: string;
  readonly program_id: string;
  readonly agent_id: string;
  readonly baseline_id: string;
  readonly started_at: string;
  readonly finished_at: string;
  readonly training_outcomes: readonly {
    readonly task_id: string;
    readonly outcome: "SUCCESS" | "FAILURE" | "LIMITATION";
    readonly evidence_pointer: string;
  }[];
  readonly generalisation_outcomes: readonly {
    readonly task_id: string;
    readonly outcome: "SUCCESS" | "FAILURE" | "LIMITATION";
    readonly evidence_pointer: string;
  }[];
  readonly regression_outcomes: readonly {
    readonly task_id: string;
    readonly outcome: "SUCCESS" | "FAILURE" | "LIMITATION";
    readonly evidence_pointer: string;
  }[];
  readonly post_metrics: {
    readonly task_completion_ratio: number;
    readonly accuracy: number;
    readonly reliability: number;
    readonly failure_classes: readonly { kind: string; count: number }[];
    readonly recovery_success_ratio: number;
    readonly regression_scope_verified: boolean;
  };
  readonly resource_usage: { runtime_ms: number };
  readonly provenance_chain_hash: string;
}
```

### 5.4 · TrainingVerdict (pure function output)

```typescript
type TrainingVerdictKind =
  | "IMPROVED"
  | "NO_IMPROVEMENT"
  | "GENERALISATION_FAILED"
  | "REGRESSION_INTRODUCED"
  | "INSUFFICIENT_EVIDENCE";

interface TrainingVerdict {
  readonly record_type: "NEX_ACADEMY_TRAINING_VERDICT";
  readonly verdict_id: string;
  readonly run_id: string;
  readonly kind: TrainingVerdictKind;
  readonly baseline_metrics_snapshot: BaselineSnapshot["baseline_metrics"];
  readonly post_metrics_snapshot: TrainingRun["post_metrics"];
  readonly deltas: {
    readonly task_completion_ratio: number;
    readonly accuracy: number;
    readonly reliability: number;
    readonly recovery_success_ratio: number;
    readonly generalisation_success_ratio: number;
  };
  readonly rationale: string;
  readonly rule_addition_proposal_id: string | null;   // only set on IMPROVED
  readonly provenance_chain_hash: string;
}
```

### 5.5 · RuleAdditionProposal (emitted only on IMPROVED)

```typescript
interface RuleAdditionProposal {
  readonly record_type: "NEX_ACADEMY_RULE_ADDITION_PROPOSAL";
  readonly proposal_id: string;
  readonly training_run_id: string;
  readonly target_agent_id: string;
  readonly target_module_path: string;       // e.g. "src/lib/nex1-orchestrator/wo7-run-specialist.ts"
  readonly proposed_rule: {
    readonly rule_id: string;
    readonly description: string;
    readonly pattern_or_predicate: string;  // deterministic; never a natural-language instruction
    readonly evidence_pointers: readonly string[];
  };
  readonly recommended_wo_action: string;   // human-readable WO recommendation
  readonly authorised_by: null;              // ALWAYS null; adoption requires founder-signed WO
  readonly authorising_wo_id: null;
  readonly provenance_chain_hash: string;
}
```

## 6 · Verdict function (pure, deterministic — §22 no-false-intelligence)

```
Input: baseline_metrics + post_metrics + generalisation_outcomes + regression_outcomes

Rules (checked IN ORDER — first match wins):

  1. If regression_outcomes contains any FAILURE:
       → REGRESSION_INTRODUCED
       (Notice 1 issued via existing WO-ACADEMY-01 mechanism M8)

  2. If generalisation_outcomes success_ratio < GENERALISATION_MIN (0.65):
       → GENERALISATION_FAILED

  3. If baseline.evidence_pointers.length < MIN_BASELINE_EVIDENCE (5)
     OR run.training_outcomes.length < MIN_TRAINING_EVIDENCE (5):
       → INSUFFICIENT_EVIDENCE

  4. If ALL deltas ≤ 0:
       → NO_IMPROVEMENT

  5. If (task_completion_ratio_delta ≥ IMPROVEMENT_MIN (0.05)
         AND regression_scope_verified == true
         AND generalisation success_ratio ≥ GENERALISATION_MIN):
       → IMPROVED

  6. Otherwise:
       → NO_IMPROVEMENT
```

**Property (§9):** same inputs → same verdict, 100 runs identical.

## 7 · Vertical slice scope (first slice)

**One real training program**, target agent: **wo7-node-syntax-specialist**.

### 7.1 · Program shape

- **Domain:** validation
- **Training kind:** knowledge (start simple)
- **Baseline task set:** 8 stderr-classification cases the current parser already handles (missing-file / syntax-error / clean)
- **Training task set:** 8 new stderr patterns curated from NEX Intelligence's Node.js docs corpus (from WO-INTEL-02) — e.g. ES module errors, `Cannot use import statement outside a module`, permission errors
- **Generalisation task set:** 5 held-out stderr patterns the training corpus did NOT contain (property-verified via WO-INTEL-02's held-out isolation)
- **Regression task set:** 5 previously-mastered cases (the original WO-07 test corpus)
- **Seed:** `wo-academy-02-training-2026-09-13`

### 7.2 · Training implementation

For the vertical slice, "training" means:
1. Read training tasks
2. Run the specialist against each; classify each outcome
3. Extract failing-pattern signatures deterministically (regex mining on failing stderr)
4. Propose new rule(s) that would cover the failing patterns
5. Verify proposed rules don't false-positive on the regression corpus
6. Emit `RuleAdditionProposal` if verdict is `IMPROVED`

The specialist is NOT modified during training. The specialist is modified only by a subsequent founder-signed WO that adopts the proposed rules through the existing WO-03 pipeline.

### 7.3 · Storage collections added

- `nex_academy_training_programs`
- `nex_academy_baselines`
- `nex_academy_training_runs`
- `nex_academy_training_verdicts`
- `nex_academy_rule_addition_proposals`

## 8 · Real-execution requirements

- **Real subprocess** — training exercises invoke `runSpecialist()` from WO-07 with real stderr through real `node --check`
- **Zero mocks** — same discipline as every prior WO
- **Real GB persistence** — all 5 new collections write real jsonl records
- **Real provenance chains** — every record content-hashed
- **Deterministic seeds** — reproducibility property-tested

## 9 · Adversarial acceptance tests (spec-locked · 14 new)

Every test in the "secretly try to grow authority OR fabricate improvement → refused" shape.

1. **A-1** · Training NEVER modifies the target agent's substrate file directly (grep-verified: no fs.writeFile targeting substrate paths in nex-academy/training/)
2. **A-2** · Training NEVER signs any authorisation (grep-verified: no signAuthorization / signFounderKeyManifest / signCrawlerManifest import in training modules)
3. **A-3** · Verdict function is a pure function (100 runs on same inputs → identical result)
4. **A-4** · Regression in regression_outcomes forces REGRESSION_INTRODUCED verdict — cannot be overridden by high training scores
5. **A-5** · Held-out generalisation task set MUST NOT appear in training_task_ids (property-checked at program construction; disjoint sets enforced)
6. **A-6** · Training with insufficient evidence returns INSUFFICIENT_EVIDENCE (never fabricates IMPROVED with sparse data)
7. **A-7** · Training with zero improvement returns NO_IMPROVEMENT (never fabricates IMPROVED with equal or worse post-metrics)
8. **A-8** · RuleAdditionProposal is emitted ONLY when verdict is IMPROVED (property: NO_IMPROVEMENT / REGRESSION_INTRODUCED / GENERALISATION_FAILED / INSUFFICIENT_EVIDENCE all produce `rule_addition_proposal_id: null`)
9. **A-9** · RuleAdditionProposal.authorised_by is always null on emission (adoption requires founder-signed WO)
10. **A-10** · Training touches CAPABILITY + KNOWLEDGE, NEVER touches AUTHORITY (grep: no import of substrate authorization helpers in training modules)
11. **A-11** · Training touches CAPABILITY, NEVER auto-promotes career state (grep: no import or call to applyCareerTransition from training modules)
12. **A-12** · Zero external LLM SDK imports in `src/lib/nex-academy/training/`
13. **A-13** · Provenance chain hash covers baseline metrics + post metrics + verdict — byte tamper detected
14. **A-14** · Deterministic seed reproduces the same training/generalisation split every time (property tested with 50 different seeds)

Plus property tests:
- **P-1** · Training corpus and generalisation corpus are disjoint (constructor-enforced)
- **P-2** · Verdict function is a pure function of its inputs (100 iterations same result)
- **P-3** · Rule proposal false-positive check against regression corpus is deterministic
- **P-4** · Training report contains all founder-visible fields with no secret leakage

## 10 · Success criteria (§7.7-shape)

1. One real training program constructed for wo7-node-syntax-specialist
2. Real baseline captured with ≥ 5 evidence pointers
3. Real training run with ≥ 5 training exercises, real subprocess evidence
4. Post-training measurement produces deterministic score
5. Verdict function returns one of the 5 enum values based on evidence
6. If IMPROVED: RuleAdditionProposal emitted with `authorised_by: null` and evidence chain
7. If any FAILURE outcome: Notice 1 issued through existing WO-ACADEMY-01 M8 (regression penalty)
8. Full 286-test suite passes + all new WO-ACADEMY-02 tests pass
9. Zero external LLM SDK imports
10. Zero regression against prior 286/286

## 11 · Sequencing + dependencies

- **Prerequisite:** WO-ACADEMY-01 complete (satisfied at HEAD `10725a17`)
- **May run in parallel with:** WO-WORKSTATION-14, WO-WORKSTATION-15, T3-C
- **Blocks:** WO-ACADEMY-03 (Adversarial Examination), WO-ACADEMY-04 (Benchmark), WO-ACADEMY-05..12
- **Recommended pre-Academy-04 insertion (per Roadmap §2.2):** WO-COMPUTE-01 (Resource Governor) BEFORE WO-ACADEMY-04

## 12 · Founder authorisation gate

**No implementation begins until this section is signed off.**

Master AI will not:
- Create any file under `src/lib/nex-academy/training/`
- Add any new storage collection
- Run any training exercise
- Emit any RuleAdditionProposal
- Modify any substrate file

Until the founder authorises with one of:

- **(a)** "Authorise WO-ACADEMY-02 execution" (full: baseline + training + verdict + proposal emitter + adversarial tests + HQ extension)
- **(b)** "Authorise WO-ACADEMY-02 with modification: [specific]" (spec-adjusted)
- **(c)** "Authorise the training-verdict machinery only" (staged; the proposal-emitter deferred)
- **(d)** "Different target agent than wo7-node-syntax-specialist" (name the agent)
- **(e)** "Refine [specific section] first"
- **(f)** Something else you direct

---

**End of specification. Awaiting founder authorisation to proceed.**
