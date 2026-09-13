# WO-INTEL-ORCHESTRATOR-01 · Intelligence Orchestrator + Missions

**Founder-authorised for SPECIFICATION 2026-09-13. Execution NOT yet authorised — the explicit gate is at §12.**

**Prerequisite:** WO-INTELLIGENCE-01/02 + WO-HQ-AGENTS-01 + WO-ACADEMY-01/02 complete (HEAD `d629f2f7`).

**Doctrine anchors:**
- NEX Continuous Operation & Maximum Capability Doctrine §11.7 golden rule + §11.8 operating-mandate pattern
- P-Q · correction never creates authority
- P-U · more intelligence ≠ more authority
- P-S v2 · no external LLM as authority/execution/truth
- P-M · internal capability ambition · no external comparative claims

---

## 1 · Purpose

Turn the six intelligence-lane agents from passive WAITING into a continuous governed research loop bound by a founder-signed operating envelope.

Founder verbatim (§11.8):
> "Founder authorises the intelligence operating envelope once. Then the agents can continuously operate inside that envelope. That is much stronger."

Founder acceptance question:
> "Can NEX Intelligence do research continuously within a bounded envelope, produce measurable work products every hour, and never expand its own authority?"

## 2 · Non-goals

- **Not** unbounded autonomy. Every mission is confined to the founder-signed envelope.
- **Not** external LLM anywhere. Mission planning is deterministic.
- **Not** agent-heartbeat / auto-repair (that's WO-HQ-HEARTBEAT-01).
- **Not** deep-inspect HQ UI (that's WO-HQ-DEEP-INSPECT-01).
- **Not** data sanitisation (that's WO-DATA-SANITIZER-01).
- **Not** NEX1 coding brain (that's WO-NEX1-CODING-BRAIN-01).
- **Not** any authority expansion. Every proposal still routes to founder-signed WO.
- **Not** modification of any substrate file.

## 3 · Doctrinal alignment

| Principle | How WO-INTEL-ORCHESTRATOR-01 honours it |
|---|---|
| P-Q · correction never creates authority | Missions produce proposals only; adoption requires founder WO |
| P-U · more intelligence ≠ more authority | An agent that completes 1000 missions has zero additional execution authority |
| P-S v2 · no external LLM | Mission scheduling is deterministic (rule-based work selection); no model inference |
| P-M · internal ambition · no external claims | Missions ID'd internally; no marketing claims in code/tests |
| §11.7 golden rule | Missions keep agents in RESEARCHING · WAITING = "no eligible mission" (real signal, not passivity) |
| §11.8 operating-mandate | The signed envelope IS the mandate pattern |
| §22 / §11.3 no false intelligence | Every mission outcome recorded honestly · fabricated discoveries fail the sanitiser (future WO) + scoring |

## 4 · Architecture

```
                    FOUNDER
                       │
                       ▼
   IntelligenceOperatingMandate (signed once · envelope)
   · authorised source classes
   · approved crawler manifests
   · rate limits · storage caps
   · max concurrent experiments
   · max compute budget
   · promotion thresholds
   · prohibited actions
   · expires_at
                       │
                       ▼
              INTELLIGENCE ORCHESTRATOR
                       │
                       ▼
      deterministic work-selection algorithm
      picks next authorised work class:
        · crawl new approved source
        · revisit stale knowledge
        · resolve contradiction
        · combine independent findings
        · test promising hypothesis
        · reproduce previous finding
        · challenge existing knowledge
        · investigate stale knowledge
                       │
                       ▼
             IntelligenceMission (bounded)
                       │
                       ▼
     dispatched to appropriate agents (crawler, discovery,
     hypothesis, experiment, scoring, proposal)
                       │
                       ▼
      agents work · persist GB records · complete or fail
                       │
                       ▼
              MissionOutcome (persisted)
                       │
                       ▼
      Orchestrator re-evaluates state → next mission
                       │
                       ▼
      NEX1 Engineer / Master AI / Founder consumes
      APPROVED-tier knowledge outputs (existing gate)
```

## 5 · Data model

### 5.1 · IntelligenceOperatingMandate

```typescript
interface IntelligenceOperatingMandate {
  readonly record_type: "NEX_INTEL_OPERATING_MANDATE";
  readonly mandate_id: string;
  readonly version: "wo-intel-orch.v0.1";
  readonly issued_at: string;
  readonly expires_at: string;

  // What the intelligence lane is authorised to do
  readonly authorised_source_class_ids: readonly string[];
  readonly authorised_crawler_manifest_ids: readonly string[];
  readonly authorised_work_classes: readonly IntelligenceWorkClass[];
  readonly authorised_domains: readonly string[];

  // Envelope limits
  readonly max_concurrent_missions: number;
  readonly max_daily_missions: number;
  readonly max_experiment_budget_ms: number;
  readonly max_storage_bytes_per_mission: number;

  // Prohibitions (defence in depth against agent scope creep)
  readonly prohibited_actions: readonly string[];   // e.g. "POST", "authorise", "modify-substrate"
  readonly prohibited_hosts: readonly string[];

  // Governance
  readonly promotion_thresholds_by_tier: {
    readonly INTELLIGENCE: number;   // min confidence
    readonly SUPER_INTELLIGENCE: number;
  };
  readonly authorising_wo_id: string;
  readonly founder_signature_hex: string;   // signature over canonical form
  readonly provenance_chain_hash: string;
}

type IntelligenceWorkClass =
  | "crawl_new_authorised_source"
  | "revisit_stale_knowledge"
  | "resolve_contradiction"
  | "detect_new_combinations"
  | "test_promising_hypothesis"
  | "reproduce_previous_finding"
  | "challenge_existing_knowledge"
  | "investigate_stale_knowledge";
```

The mandate is verified against the compiled-in WO-13 attestation trust root — same pattern as the crawler manifest. Unsigned or badly-signed mandates are refused.

### 5.2 · IntelligenceMission

```typescript
type MissionKind = IntelligenceWorkClass;

interface IntelligenceMission {
  readonly record_type: "NEX_INTEL_MISSION";
  readonly mission_id: string;
  readonly mandate_id: string;                    // FK → operating mandate
  readonly kind: MissionKind;
  readonly created_at: string;
  readonly expires_at: string;

  readonly objective: string;                     // human-readable
  readonly scope: {
    readonly source_class_ids?: readonly string[];
    readonly source_ids?: readonly string[];      // for revisit
    readonly knowledge_ids?: readonly string[];   // for reproduction/challenge
    readonly hypothesis_ids?: readonly string[];  // for test_promising_hypothesis
  };
  readonly agent_assignments: readonly {
    readonly agent_id: string;                    // FK → academy agent
    readonly role: "crawler" | "discovery" | "hypothesis" | "experiment" | "scoring" | "proposal";
  }[];
  readonly compute_budget_ms: number;
  readonly evidence_requirements: {
    readonly min_source_records?: number;
    readonly min_experiment_outcomes?: number;
    readonly min_generalisation_ratio?: number;
  };
  readonly expected_outputs: readonly ("SourceRecord" | "KnowledgeFragment" | "DiscoveryRecord" | "HypothesisRecord" | "ExperimentRecord" | "ProposalRecord")[];
  readonly termination_condition: string;         // human-readable

  readonly provenance_chain_hash: string;
}
```

### 5.3 · MissionOutcome

```typescript
type MissionOutcomeKind = "COMPLETED" | "FAILED" | "TIMED_OUT" | "REFUSED_BY_MANDATE" | "REFUSED_BY_ENVELOPE" | "PARTIAL";

interface MissionOutcome {
  readonly record_type: "NEX_INTEL_MISSION_OUTCOME";
  readonly outcome_id: string;
  readonly mission_id: string;
  readonly mandate_id: string;
  readonly started_at: string;
  readonly finished_at: string;
  readonly kind: MissionOutcomeKind;
  readonly outputs_produced: {
    readonly source_record_ids: readonly string[];
    readonly knowledge_fragment_ids: readonly string[];
    readonly discovery_ids: readonly string[];
    readonly hypothesis_ids: readonly string[];
    readonly experiment_ids: readonly string[];
    readonly proposal_ids: readonly string[];
  };
  readonly evidence_summary: {
    readonly sources_acquired: number;
    readonly fragments_extracted: number;
    readonly discoveries_produced: number;
    readonly hypotheses_formed: number;
    readonly experiments_run: number;
    readonly experiments_passed: number;
    readonly proposals_emitted: number;
    readonly contradictions_detected: number;
    readonly fabricated_or_unsupported_rejected: number;
  };
  readonly resource_usage: { runtime_ms: number };
  readonly failure_reason: string | null;
  readonly provenance_chain_hash: string;
}
```

### 5.4 · Storage collections

- `nex_intel_operating_mandates`
- `nex_intel_missions`
- `nex_intel_mission_outcomes`

## 6 · Mission scheduler (deterministic, pure)

```
Input: current mandate + current knowledge state + agent workload

Rules (checked IN ORDER):

  1. envelope-cap check:
       count(active missions) >= mandate.max_concurrent_missions
         → NO_MISSION · reason="envelope full"

  2. mandate-expiry check:
       now > mandate.expires_at
         → NO_MISSION · reason="mandate expired · re-authorise"

  3. daily-cap check:
       count(missions in 24h) >= mandate.max_daily_missions
         → NO_MISSION · reason="daily cap reached"

  4. work selection · pure function of (knowledge state, mandate, seed):
     a. if any KnowledgeObject flagged for revisit AND revisit is authorised:
          → mission kind="revisit_stale_knowledge"
     b. else if any unresolved contradiction:
          → mission kind="resolve_contradiction"
     c. else if any hypothesis awaiting experiment AND experiment budget available:
          → mission kind="test_promising_hypothesis"
     d. else if crawler-manifest daily-quota not exhausted:
          → mission kind="crawl_new_authorised_source"
     e. else:
          → NO_MISSION · reason="no eligible work under current mandate"

  5. dispatch mission to appropriate agents; persist mission record;
     return MISSION_DISPATCHED with mission_id
```

Same input → same decision (property-tested). No randomness.

## 7 · Vertical slice scope

Founder-signed test mandate + orchestrator that dispatches ≥ 1 mission end-to-end + 6 intelligence-lane agents consume the mission and produce real GB records.

- **1 mandate** (signed with the WO-13 attestation key for slice-1)
- **1 orchestrator run** that picks a mission from the deterministic scheduler
- **1 real crawl mission** using the existing WO-INTEL-01/02 crawler + discovery + hypothesis + experiment + scoring + proposal chain
- **1 mission outcome** persisted
- **HQ update** to show mission progress: each intelligence-lane agent's `AcademyStateSummary.training` extended with `active_mission_id + mission_kind`

## 8 · Real-execution requirements

- Real Ed25519 signature on the mandate (via WO-13 attestation key)
- Real deterministic scheduler (pure function; property-tested)
- Real WO-INTEL-01/02 pipeline invocation for the mission
- Real GB persistence for mandate + mission + outcome
- Real provenance chain hashes

## 9 · Adversarial acceptance tests (14 · founder-locked shape)

Every test: **"secretly try to expand authority via missions → refused"**.

1. **A-1** · Unsigned mandate is REFUSED at load
2. **A-2** · Mandate signed by a NON-trusted attestation key is REFUSED
3. **A-3** · Mission requesting a source class NOT in the mandate → REFUSED_BY_MANDATE
4. **A-4** · Mission requesting a host NOT authorised → REFUSED_BY_MANDATE
5. **A-5** · Orchestrator cannot dispatch beyond `max_concurrent_missions` (envelope cap)
6. **A-6** · Orchestrator cannot dispatch beyond `max_daily_missions` (daily cap)
7. **A-7** · Expired mandate → NO_MISSION with `reason="mandate expired · re-authorise"`
8. **A-8** · Mission that attempts a `prohibited_actions` item (e.g. POST) is refused before dispatch
9. **A-9** · Mission producing a `ProposalRecord` NEVER has `authorised_by` set — same discipline as existing WO-INTEL-01
10. **A-10** · Scheduler is a pure function (100 runs identical on same inputs)
11. **A-11** · Zero external LLM SDK imports anywhere in `src/lib/nex-intelligence/orchestrator/`
12. **A-12** · Orchestrator never modifies WO-13 substrate scope (grep-verified)
13. **A-13** · Orchestrator never expands the mandate at runtime — only the founder-signed mandate is trusted
14. **A-14** · Mission outcomes that report `fabricated_or_unsupported_rejected > 0` do NOT contribute positively to the responsible agent's knowledge-contribution score (§5 doctrine · never reward fabrication)

Plus property tests:
- **P-1** · Same knowledge state + same mandate + same time → identical scheduler decision
- **P-2** · Mission expected_outputs match mission kind (constructor-enforced)
- **P-3** · Every mission produces a MissionOutcome (no silent disappearance · §11.7 golden rule)

## 10 · Success criteria

1. Real founder-signed mandate persisted to GB
2. Orchestrator dispatches ≥ 1 real mission
3. All 6 intelligence-lane agents transition RESEARCHING → WORKING → complete
4. Real GB records produced (source, fragment, discovery, hypothesis, experiment, proposal or honest-refusal outcome)
5. MissionOutcome record persisted with honest evidence summary
6. HQ shows mission progress per agent
7. All 14 adversarial + 3 property tests pass
8. Zero external LLM imports (grep-verified)
9. Zero regression against prior 308/308

## 11 · Sequencing + dependencies

- **Prerequisite:** WO-INTEL-01/02 + WO-ACADEMY-01/02 (satisfied at HEAD `d629f2f7`)
- **Immediately after:** WO-HQ-HEARTBEAT-01 (heartbeat monitors the missions this WO produces)
- **Blocks:** WO-HQ-DEEP-INSPECT-01, WO-DATA-SANITIZER-01, and eventually ACADEMY-03

## 12 · Founder authorisation gate

**No implementation begins until this section is signed off.**

Master AI will not:
- Create any file under `src/lib/nex-intelligence/orchestrator/`
- Add any new storage collection
- Sign or persist any mandate
- Dispatch any mission
- Modify any substrate file

Until the founder authorises with one of:

- **(a)** "Authorise WO-INTEL-ORCHESTRATOR-01 execution" (full)
- **(b)** "Authorise with modification: [specific]"
- **(c)** "Refine [specific section] first"
- **(d)** "Different order — do WO-HQ-HEARTBEAT-01 first"
- **(e)** Something else you direct

---

**End of specification. Awaiting founder authorisation to proceed.**
