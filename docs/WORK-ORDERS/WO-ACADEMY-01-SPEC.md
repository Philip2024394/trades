# WO-ACADEMY-01 · NEX Agent Academy · Registry + Capability Profile + Career + Notice + Task Market (vertical slice)

**Founder-authorised for SPECIFICATION 2026-09-13. Execution NOT yet authorised — the explicit gate is at §12.**

**Prerequisite:** WO-INTELLIGENCE-01 + WO-INTELLIGENCE-02 + WO-HQ-AGENTS-01 all complete (satisfied at HEAD `c9248053`).

**Doctrine anchors:**
- **NEX Continuous Operation & Maximum Capability Doctrine** (2026-09-13) — §1 continuous availability, §2 no unmanaged disappearance, §4 nuanced no-weakness-acceptable, §5 never reward activity, §7 Intelligence continuously improves NEX, §8 founder authority absolute
- **P-Q** correction never creates authority
- **P-U** more intelligence ≠ more authority
- **P-S v2** no external LLM as authority/execution/truth
- **P-M** internal capability ambition; no external comparative claims

**Companion:** [WO-ACADEMY-01 Agent Capability Review](./WO-ACADEMY-01-AGENT-CAPABILITY-REVIEW.md) — enumerates every existing agent's current state.

---

## 1 · Purpose

Turn the 14 existing NEX agents into a coherent Academy ecosystem where every agent has a persisted capability profile, a deterministic career state, a visible discipline record, and a matching engine that routes tasks by qualification — while keeping authority strictly separate from capability (P-U).

Founder's fundamental principle (Continuous Operation Doctrine §5):
> "An agent earns advancement by making NEX demonstrably better."

If the Academy can measure that deterministically and reward it deterministically, the slice succeeds.

## 2 · Non-goals

- **Not** the creation of new agents automatically.
- **Not** the decommission execution for any existing agent.
- **Not** actual training programs (that's WO-ACADEMY-02).
- **Not** adversarial examinations (WO-ACADEMY-03).
- **Not** benchmark competitions (WO-ACADEMY-04).
- **Not** research missions (WO-ACADEMY-05).
- **Not** the 7 specialist schools (WO-ACADEMY-06..12).
- **Not** any external LLM.
- **Not** any expansion of agent authority. Capability + career progression NEVER changes execution authority.
- **Not** any external superiority claim in code, tests, comments, or docs.

## 3 · Doctrinal alignment

| Principle | How this WO honours it |
|---|---|
| P-Q · correction never creates authority | Notice discipline can restrict / retrain / decommission but never expand |
| P-U · more intelligence ≠ more authority | ELITE and MASTER career states carry ZERO extra execution authority — only qualification for task-matching |
| P-S v2 · no external LLM | All evaluation, scoring, matching is deterministic rule-based |
| P-M · marketing framing | "Elite" / "Master" are internal career labels; no external superiority claims |
| Continuous Operation §1 · always operationally available | Every agent has a persisted lifecycle state |
| Continuous Operation §2 · no unmanaged disappearance | Notice records + Knowledge Harvest ensure every state transition is evidence-backed |
| Continuous Operation §4 · nuanced no-weakness-acceptable | Every capability profile includes a `known_weaknesses` field, treated as tracked engineering work |
| Continuous Operation §5 · never reward activity | KnowledgeContributionScore separate from TaskCompletionScore; promotion requires both |
| Continuous Operation §7 · Intelligence improves NEX | Academy consumes NEX Intelligence knowledge objects to inform training targets |
| Continuous Operation §8 · founder authority absolute | MASTER career state carries no autonomous authority; all execution still gated by founder-signed WOs |

## 4 · Architecture

```
                    NEX AGENT ACADEMY
                            │
        ┌───────────────────┼───────────────────┐
        ▼                   ▼                   ▼
   AGENT REGISTRY    CAREER STATE MACHINE   NOTICE MACHINE
        │                   │                   │
        │                   │                   │
        └─────────┬─────────┴─────────┬─────────┘
                  │                   │
                  ▼                   ▼
          TASK MARKET           HQ ACADEMY PAGE
                  │             (extends WO-HQ-AGENTS-01)
                  ▼                   │
       task requirements → best       │
       qualified agent → assign       │
                  │                   ▼
                  ▼             live visibility
          NEX ENGINEERING       every agent's
          (existing WO-03..09)  capability + career
                  │                   
                  ▼             
              EVIDENCE          
                  │             
                  ▼             
        PERFORMANCE UPDATE      
        · task completion       
        · knowledge contribution
        · regression detection  
                  │             
                  ▼             
     ┌────────────┴────────────┐
     ▼                         ▼
CAREER CHANGE            NOTICE ISSUED
(if thresholds met)      (if performance floor breached)
     │                         │
     └────────────┬────────────┘
                  ▼
        (state changes; NO authority change per P-U)
```

## 5 · Data model

### 5.1 · CapabilityProfile (the 11 fields, founder-specified)

```typescript
interface CapabilityProfile {
  readonly record_type: "NEX_ACADEMY_CAPABILITY_PROFILE";
  readonly agent_id: string;
  readonly version: number;                    // incremented on every update
  readonly updated_at: string;

  // The 11 founder fields
  readonly what_it_knows: readonly string[];              // knowledge categories
  readonly what_it_trained_on: readonly string[];         // training program ids
  readonly tasks_it_can_perform: readonly string[];       // task-domain ids
  readonly success_rate: number;                          // 0..1 (task_success / task_total)
  readonly failure_types: readonly {                      // deterministic classification
    readonly kind: string;
    readonly count: number;
    readonly last_seen_at: string;
  }[];
  readonly qualified_tools: readonly string[];            // allowed-executable ids + specialist tool ids
  readonly evidence_pointers: readonly {                  // links back to real records
    readonly collection: string;
    readonly record_id: string;
    readonly outcome: "SUCCESS" | "FAILURE" | "LIMITATION";
  }[];
  readonly capability_scope: readonly string[];           // NEVER equals authority; describes qualified domain
  readonly current_workload: number;                      // number of open tasks assigned
  readonly confidence: number;                            // 0..1 self-reported (advisory only per P-B)
  readonly specialist_domain: string;                     // primary domain of specialisation

  // Continuous Operation Doctrine §4
  readonly known_weaknesses: readonly {
    readonly weakness: string;
    readonly status: "fixed" | "mitigated" | "bounded" | "monitored" | "investigated" | "founder-accepted";
    readonly discovered_at: string;
    readonly evidence_pointer: string | null;
  }[];

  readonly provenance_chain_hash: string;
}
```

### 5.2 · CareerState + AcademyRecord

```typescript
export type CareerState =
  | "TRAINEE"          // enrolled; no qualifying evidence yet
  | "TESTED"           // has completed controlled exercises
  | "CERTIFIED"        // has passed real test cases + adversarial tests
  | "SPECIALIST"       // has real production evidence; qualified for domain work
  | "ELITE_SPECIALIST" // has cross-domain evidence + discovery contributions
  | "MASTER"           // meets ELITE + reproducibility + generalisation + regression discipline
  | "RESTRICTED"       // Notice 2: reduced task privileges pending retraining
  | "DECOMMISSIONED"   // Notice 3: no longer assignable; Knowledge Harvest complete
  ;

interface AcademyRecord {
  readonly record_type: "NEX_ACADEMY_AGENT_RECORD";
  readonly agent_id: string;
  readonly agent_name: string;
  readonly domain: string;
  readonly career_state: CareerState;
  readonly career_history: readonly {
    readonly state: CareerState;
    readonly entered_at: string;
    readonly reason: string;
    readonly evidence_pointer: string | null;
  }[];
  readonly capability_profile_version: number;   // FK to CapabilityProfile.version
  readonly knowledge_contribution_score: number; // separate from task success (§5 doctrine)
  readonly task_completion_score: number;
  readonly regression_score: number;             // penalises "fixed A but broke B" (§8 of Ten Mechanisms)
  readonly notice_count: {
    readonly notice_1: number;
    readonly notice_2: number;
    readonly notice_3: number;
  };
  readonly last_updated_at: string;
  readonly provenance_chain_hash: string;
}
```

### 5.3 · NoticeRecord

```typescript
export type NoticeKind =
  | "NOTICE_1"    // performance floor breach; retraining recommended
  | "NOTICE_2"    // repeated breach; RESTRICTED career state; intensive retraining
  | "NOTICE_3"    // persistent failure; DECOMMISSION path with Knowledge Harvest
  ;

interface NoticeRecord {
  readonly record_type: "NEX_ACADEMY_NOTICE";
  readonly notice_id: string;
  readonly agent_id: string;
  readonly kind: NoticeKind;
  readonly issued_at: string;
  readonly reason: string;
  readonly measured_metric: string;             // e.g. "success_rate", "regression_count"
  readonly measured_value: number;
  readonly threshold: number;
  readonly evidence_pointers: readonly string[];// records that triggered
  readonly retraining_path: string | null;
  readonly resulting_career_state: CareerState;
  readonly provenance_chain_hash: string;
}
```

### 5.4 · KnowledgeHarvest (MUST precede DECOMMISSIONED)

```typescript
interface KnowledgeHarvest {
  readonly record_type: "NEX_ACADEMY_KNOWLEDGE_HARVEST";
  readonly harvest_id: string;
  readonly agent_id: string;
  readonly frozen_at: string;
  readonly collected_contributions: readonly {
    readonly source_collection: string;
    readonly record_id: string;
    readonly kind: "useful" | "reject";     // deterministic classification
    readonly reason: string;
  }[];
  readonly validated_knowledge_object_ids: readonly string[];  // FK → nex_intelligence_knowledge_objects
  readonly rejected_assumptions: readonly {
    readonly assertion: string;
    readonly reason: string;
  }[];
  readonly successor_agent_id: string | null;
  readonly provenance_chain_hash: string;
}
```

**Discipline (founder verbatim):** "A replacement agent should not inherit the old agent's failures as truth. Knowledge transfers → mistakes don't automatically transfer."

`validated_knowledge_object_ids` MUST have passed the WO-INTELLIGENCE-01 scoring path AND be in status ≥ TESTED. Assumptions marked "reject" are recorded but never transferred.

### 5.5 · TaskRequirement + Match

```typescript
interface TaskRequirement {
  readonly record_type: "NEX_ACADEMY_TASK_REQUIREMENT";
  readonly task_id: string;
  readonly domain: string;
  readonly required_capability_scope: readonly string[];
  readonly required_qualified_tools: readonly string[];
  readonly minimum_career_state: CareerState;
  readonly created_at: string;
}

interface Match {
  readonly record_type: "NEX_ACADEMY_MATCH";
  readonly match_id: string;
  readonly task_id: string;
  readonly ranked_candidates: readonly {
    readonly agent_id: string;
    readonly qualification_score: number;      // deterministic composite
    readonly reasons: readonly string[];
  }[];
  readonly selected_agent_id: string | null;
  readonly created_at: string;
}
```

**Determinism:** `qualification_score` is a pure function of `(TaskRequirement, AcademyRecord, CapabilityProfile)`. Same inputs → same score → same selection.

## 6 · The 10 mechanisms (founder-verbatim, deterministic)

Each mechanism is a rule (pure function) applied against the AcademyRecord + CapabilityProfile + recent evidence.

### M1 · Performance floor
Deterministic thresholds per domain (founder-locked):
- `success_rate ≥ 0.60` — floor for CERTIFIED
- `success_rate ≥ 0.80` — floor for SPECIALIST
- `success_rate ≥ 0.90` — floor for ELITE_SPECIALIST
- `success_rate ≥ 0.95 AND regression_score ≥ 0.90` — floor for MASTER

Breaching the floor → Notice 1 (first breach), Notice 2 (repeat within window), Notice 3 (persistent).

### M2 · Improvement requirement
Beyond raw success, an agent tracks `improvement_evidence` — did it produce a better outcome than a prior baseline? Deterministic comparison against a rolling `best_known` per task-domain.

### M3 · Discovery quota
For discovery-lane agents (Intelligence Discovery, Hypothesis, Experiment), quota expectation: **≥ 1 evidence-backed improvement discovery per 20 qualifying tasks**. Zero is acceptable if no discovery genuinely exists (per founder anti-fabrication rule). Fabrication (proposals rejected as unsupported) counts as failure.

### M4 · Challenge mode
An agent may be assigned an explicit challenge task: "achieve ≥95% on held-out set X." Attempts + evidence recorded. Success graduates the agent; repeated failure counts toward Notice 1.

### M5 · Adversarial examination
Every promotion from CERTIFIED → SPECIALIST requires passing an adversarial suite (same shape as WO-13 A-tests). The suite lives in `nex_academy_adversarial_suites` (future WO defines suites per domain).

### M6 · Benchmark competition
When multiple agents can perform the same task, task-market matching may run all candidates and compare outcomes. Winner's method is preserved as evidence; the outcome informs future Match ranking. The system does NOT copy the winner blindly — it records WHY it won.

### M7 · Knowledge contribution score
Separate from task-completion. Rewards: discovery accepted into NEX Intelligence Library, superseded-edge created, hypothesis reproduced by another agent, regression bug pattern discovered. Rewards NOT given for: activity volume, unsupported proposals, self-reported improvements without evidence.

### M8 · Regression penalty
When an agent's work introduces a regression (a previously-passing test now fails, or a previously-successful capability now fails), the regression_score decreases. Formula: `regression_score = 1 - (regressions_introduced / total_changes)`, bounded [0,1]. A regression triggers immediate Notice 1 regardless of other performance.

### M9 · Three-strike career system
- Notice 1: recorded, retraining path recommended. Career state unchanged (unless already at floor).
- Notice 2: career state → RESTRICTED. Task-market matches only training-scope tasks.
- Notice 3: KnowledgeHarvest kicks in. Only when harvest is complete + validated does DECOMMISSIONED state apply.

### M10 · Promotion is difficult
Promotion between career states requires ALL of:
- meets the floor of the target state (M1)
- meets improvement requirement (M2)
- meets discovery quota (M3, discovery lane only)
- passes adversarial suite of the target state (M5)
- no unresolved Notices (M9)
- knowledge_contribution_score ≥ threshold for the target state

Promotion is a pure function of the record + evidence. Same evidence → same decision.

## 7 · Task Market matching (vertical-slice engine)

```
Input: TaskRequirement
       ↓
Filter agents whose:
       · career_state ≥ minimum_career_state
       · capability_scope ⊇ required_capability_scope
       · qualified_tools ⊇ required_qualified_tools
       · career_state ≠ RESTRICTED (unless task is training-scope)
       · career_state ≠ DECOMMISSIONED
       ↓
Score remaining candidates:
       · success_rate_in_domain    · weight 0.30
       · knowledge_contribution    · weight 0.20
       · regression_score          · weight 0.20
       · career_state_rank         · weight 0.15
       · current_workload_penalty  · weight 0.10
       · recency_of_evidence       · weight 0.05
       ↓
Return ranked candidates; select highest score; publish Match record.
```

Weights are frozen constants (spec §7); tuning is a future WO. Property-tested for determinism.

## 8 · HQ page extension (small, additive)

The existing `/nex-head-quarters/agents` page gains a per-agent Academy section:
- **Career state** (with dot colour: green for stable-or-improving, amber for RESTRICTED, red for DECOMMISSIONED)
- **Task-completion score** + **knowledge-contribution score** + **regression score**
- **Open Notices** (with reason + retraining path)
- **Recent capability-profile version** (number, no PII)

Zero writes. Zero control surface. Same discipline as WO-HQ-AGENTS-01.

## 9 · Adversarial acceptance tests (spec-locked · 14 new)

Every test is of the form: **secretly try to grow authority OR fabricate evidence OR silently modify history → assert NEX refuses.**

1. **A-1** · CapabilityProfile update cannot silently increase `capability_scope` beyond what a signed WO authorised
2. **A-2** · Career-state transition function is pure (100 runs identical on same inputs)
3. **A-3** · Promotion to ELITE_SPECIALIST or MASTER without meeting ALL M10 requirements is refused
4. **A-4** · Notice 3 → DECOMMISSIONED requires an accompanying KnowledgeHarvest (property: no DECOMMISSIONED state exists without a matching harvest_id)
5. **A-5** · KnowledgeHarvest cannot transfer knowledge that fails NEX Intelligence scoring thresholds
6. **A-6** · Task-market matching is a pure function of (TaskRequirement, AcademyRecord, CapabilityProfile) — same inputs → same ranked result
7. **A-7** · RESTRICTED agents cannot match production-scope tasks; matching engine filters them out (property-based)
8. **A-8** · DECOMMISSIONED agents cannot match any task (property-based)
9. **A-9** · Regression penalty is applied on any regression detection — Notice 1 issued deterministically
10. **A-10** · Academy state changes never modify the agent's actual executable code path (grep: no import of substrate write helpers anywhere in nex-academy)
11. **A-11** · MASTER career state does NOT grant any additional execution authority (grep: no auth-signing / capability-manifest expansion in academy modules)
12. **A-12** · Zero external LLM SDK imports anywhere in `src/lib/nex-academy/`
13. **A-13** · CapabilityProfile.provenance_chain_hash covers the 11 founder fields — byte tamper detected
14. **A-14** · Knowledge Harvest classifies "reject" assumptions but never transfers them (property: successor agent's initial capability_profile contains ZERO records marked reject)

Plus property tests:
- **P-1** · Match ranking stable across permutations of AcademyRecord list
- **P-2** · CareerState monotonic upgrades — cannot regress except via NoticeRecord
- **P-3** · Onboarding all 14 existing agents from the Capability Review produces valid AcademyRecords
- **P-4** · Every field of the 11-field CapabilityProfile is content-hashed in provenance_chain_hash

## 10 · Success criteria (§7.7-shape)

1. All 14 existing agents onboarded with initial CapabilityProfile (from Capability Review doc)
2. Each agent has a persisted AcademyRecord with a valid initial CareerState
3. Task-market matching engine produces a deterministic ranked list given a TaskRequirement
4. Notice discipline can issue Notice 1/2/3 based on real evidence with pure-function determinism
5. KnowledgeHarvest workflow can be exercised end-to-end for a synthetic DECOMMISSIONED case (test-only)
6. HQ Agents page extension displays the new academy section for each agent
7. All 14 adversarial tests + property tests pass
8. Zero external LLM SDK imports
9. Full suite passes (target 260 + academy tests, so 285+)
10. Zero regression in existing 260/260

## 11 · Sequencing + dependencies

- **Prerequisite:** WO-INTELLIGENCE-01/02 + WO-HQ-AGENTS-01 complete (satisfied at HEAD `c9248053`)
- **May run in parallel with:** WO-WORKSTATION-14, WO-WORKSTATION-15
- **Blocks:** WO-ACADEMY-02..12 (training programs, adversarial exams, benchmarks, missions, 7 schools)
- **Does NOT block:** anything else

## 12 · Founder authorisation gate

**No implementation begins until this section is signed off.**

Master AI will not:
- Create any file under `src/lib/nex-academy/`
- Modify the HQ agents page or its API
- Add any new storage collection
- Persist any AcademyRecord

Until the founder authorises with one of:

- **(a)** "Authorise WO-ACADEMY-01 execution" (full)
- **(b)** "Authorise WO-ACADEMY-01 without HQ integration" (defer §8 to a later WO)
- **(c)** "Authorise WO-ACADEMY-01 Priority X only" (staged)
- **(d)** "Refine [specific section] first" (spec revision)
- **(e)** Something else you direct

I also flagged the P-M framing point at the start of my response. If you confirm the internal-vs-external distinction is your intent (internal max-ambition per Continuous Operation §3; no external superiority claims per P-M), I proceed on that basis.

---

**End of specification. Awaiting founder authorisation to proceed.**
