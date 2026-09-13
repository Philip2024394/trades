# WO-HQ-HEARTBEAT-01 · 3-minute agent heartbeat + progress monitoring + bounded auto-recovery

**Founder-authorised for SPECIFICATION 2026-09-13. Execution NOT yet authorised — the explicit gate is at §12.**

**Prerequisite:** WO-INTELLIGENCE-01/02 + WO-HQ-AGENTS-01 + WO-ACADEMY-01/02 complete (HEAD `f64f36da`).

**Doctrine anchors:**
- **§11.7 golden rule** · agents never stop working · 3-minute heartbeat · WAITING = "no eligible authorised work"
- **§11.11 dual-signal principle** · liveness ≠ progress · WORKING requires BOTH · anti-fake-activity discipline
- **§5 never reward activity for activity's sake**
- **§22 · no false intelligence** · WAITING is an honest state; STALLED is honest; FAILED is honest
- **P-Q · correction never creates authority** · auto-recovery has bounded permissible actions
- **P-U · more intelligence ≠ more authority** · monitoring adds observation, not authority
- **P-S v2** · no external LLM in the monitor loop

---

## 1 · Purpose

Prove the substrate for continuous autonomous operation before we build the Intelligence Orchestrator on top. Founder verbatim:

> "You don't want to build an orchestrator that dispatches six intelligence agents continuously and only afterward discover that an agent can silently disappear, hang, become stale, or appear alive when it isn't."

Acceptance question:
> "Can NEX distinguish 'agent is alive' from 'agent is making progress' and detect every non-normal state with reason + evidence + bounded recovery — every 3 minutes?"

If yes with deterministic verdicts and honest state reporting, WO-HQ-HEARTBEAT-01 succeeds.

## 2 · Non-goals

- **Not** the Intelligence Orchestrator (that's WO-INTEL-ORCHESTRATOR-01)
- **Not** deep-inspect UI (that's WO-HQ-DEEP-INSPECT-01)
- **Not** data sanitisation (that's WO-DATA-SANITIZER-01)
- **Not** NEX1 coding brain (that's WO-NEX1-CODING-BRAIN-01)
- **Not** any authority expansion. Auto-recovery is bounded to a small allowed action list.
- **Not** any external LLM in the monitor loop
- **Not** modification of any substrate file
- **Not** any push-based agent framework. Slice-1 derives state from GB records the agents already produce.
- **Not** any fake activity generation. If no work is available, WAITING is the correct state (§11.11).

## 3 · Doctrinal alignment

| Principle | How WO-HQ-HEARTBEAT-01 honours it |
|---|---|
| §11.7 golden rule | 3-minute scheduler observes every agent; STALLED / FAILED trigger deterministic recovery |
| §11.11 dual-signal | State derivation requires BOTH liveness AND progress before returning WORKING |
| §22 no-false-intelligence | Six honest states surfaced (ALIVE / WORKING / WAITING / STALLED / FAILED / DEGRADED); no manufactured "OK" state |
| §5 never reward activity | Heartbeat monitor observes; never generates work; anti-fake-activity property-tested |
| P-Q correction never creates authority | Recovery limited to (retry-mission, issue-notice, escalate); never expands scope or grants capability |
| P-U intelligence ≠ authority | Monitor cannot sign, cannot promote, cannot modify substrate |
| P-S v2 no external LLM | Pure deterministic state derivation |
| WO-13 substrate integrity | Monitor lives outside substrate scope |
| WO-ACADEMY-01 notice discipline | FAILED / repeat-DEGRADED issue Notice 1 via existing M8 hook |

## 4 · Architecture

```
                     3-MINUTE SCHEDULER
                             │
                             ▼
     for each agent in AGENT_REGISTRY (14 today):
                             │
              ┌──────────────┼──────────────┐
              ▼              ▼              ▼
       liveness           progress        active
       observation      observation     mission?
              │              │              │
              └──────────────┼──────────────┘
                             ▼
                DETERMINISTIC STATE DERIVATION
                             │
        ┌─────────┬──────────┼──────────┬────────┬────────┐
        ▼         ▼          ▼          ▼        ▼        ▼
      ALIVE   WORKING     WAITING    STALLED  FAILED  DEGRADED
                                        │       │       │
                                        └───────┼───────┘
                                                ▼
                                  BOUNDED AUTO-RECOVERY
                                                │
                    ┌───────────────────────────┼───────────────────┐
                    ▼                           ▼                   ▼
              retry-mission              issue-notice        escalate-to-founder
              (one attempt · new         (WO-ACADEMY-01      (persist
               mission_id · same          M8 pathway)        NoticeRecord
               content)                                       + surface
                                                              in HQ)
                                                │
                                                ▼
                                       AgentHealthCheck record
                                       (persisted with reason +
                                        evidence + action taken)
                                                │
                                                ▼
                                          HQ page shows
                                          new state + recovery action
```

## 5 · Data model

### 5.1 · AgentHeartbeat (per-observation)

```typescript
interface AgentHeartbeat {
  readonly record_type: "NEX_HQ_AGENT_HEARTBEAT";
  readonly heartbeat_id: string;
  readonly agent_id: string;
  readonly observed_at: string;

  // The TWO independent signals (§11.11)
  readonly liveness_signal: {
    readonly is_alive: boolean;
    readonly last_evidence_at: string | null;   // latest record from this agent in GB
    readonly age_ms: number | null;             // observed_at - last_evidence_at
    readonly threshold_ms: number;              // per-agent liveness threshold
  };
  readonly progress_signal: {
    readonly has_active_mission: boolean;
    readonly mission_id: string | null;
    readonly items_processed: number;
    readonly items_expected: number | null;
    readonly evidence_records_produced: number;
    readonly last_progress_at: string | null;
    readonly age_since_progress_ms: number | null;
    readonly stall_threshold_ms: number;
  };

  readonly derived_state: "ALIVE" | "WORKING" | "WAITING" | "STALLED" | "FAILED" | "DEGRADED";
  readonly derivation_reason: string;
  readonly provenance_chain_hash: string;
}
```

### 5.2 · AgentProgressSnapshot (per active mission)

```typescript
interface AgentProgressSnapshot {
  readonly record_type: "NEX_HQ_AGENT_PROGRESS_SNAPSHOT";
  readonly snapshot_id: string;
  readonly agent_id: string;
  readonly mission_id: string;
  readonly observed_at: string;
  readonly items_processed: number;
  readonly items_expected: number | null;
  readonly evidence_record_ids: readonly string[];    // records produced since mission_start
  readonly compute_used_ms: number;
  readonly deadline: string | null;
  readonly last_progress_at: string;
  readonly provenance_chain_hash: string;
}
```

### 5.3 · AgentHealthCheck (per-cycle summary + recovery action)

```typescript
type RecoveryAction =
  | "NONE"
  | "RETRY_MISSION"
  | "ISSUE_NOTICE_1"
  | "ISSUE_NOTICE_2"
  | "ISSUE_NOTICE_3"
  | "ESCALATE_TO_FOUNDER";

interface AgentHealthCheck {
  readonly record_type: "NEX_HQ_AGENT_HEALTH_CHECK";
  readonly check_id: string;
  readonly agent_id: string;
  readonly checked_at: string;
  readonly heartbeat_id: string;                 // FK → AgentHeartbeat
  readonly current_state: AgentHeartbeat["derived_state"];
  readonly previous_state: AgentHeartbeat["derived_state"] | null;
  readonly state_transitioned: boolean;
  readonly action_taken: RecoveryAction;
  readonly action_evidence_pointer: string | null; // e.g. new mission_id, notice_id
  readonly reason: string;
  readonly provenance_chain_hash: string;
}
```

### 5.4 · Storage collections

- `nex_hq_agent_heartbeats`
- `nex_hq_agent_progress_snapshots`
- `nex_hq_agent_health_checks`

## 6 · State derivation (pure function · founder-locked)

**Founder verbatim** (§11.11): "A heartbeat should prove liveness, not falsely prove useful work."

```
Input:
  · liveness_signal (is_alive, age_ms, threshold_ms)
  · progress_signal (has_active_mission, items_processed, age_since_progress_ms, stall_threshold_ms)
  · scheduler_examined_workload (bool)
  · degraded_indicators (recent failure count, resource pressure flag)

Rules (checked IN ORDER · first match wins):

  1. FAILED · dominant · no ambiguity
     If !liveness_signal.is_alive OR liveness_signal.age_ms > threshold_ms:
       → FAILED
       (reason: "no liveness signal · age_ms {N} > threshold {M}")

  2. STALLED · liveness + no progress
     If liveness_signal.is_alive
        AND progress_signal.has_active_mission
        AND progress_signal.age_since_progress_ms > stall_threshold_ms:
       → STALLED
       (reason: "mission active but no progress for {ms}ms")

  3. DEGRADED · intermittent failures OR resource pressure
     If liveness_signal.is_alive
        AND (degraded_indicators.recent_failure_count >= FAIL_THRESHOLD
             OR degraded_indicators.resource_pressure):
       → DEGRADED

  4. WORKING · dual-signal required (§11.11)
     If liveness_signal.is_alive
        AND progress_signal.has_active_mission
        AND progress_signal.age_since_progress_ms <= WORKING_FRESH_MS:
       → WORKING

  5. ALIVE · liveness without mission
     If liveness_signal.is_alive
        AND !progress_signal.has_active_mission
        AND !scheduler_examined_workload:
       → ALIVE
       (reason: "recent liveness · no scheduler pass observed yet")

  6. WAITING · scheduler examined + no eligible work
     If liveness_signal.is_alive
        AND !progress_signal.has_active_mission
        AND scheduler_examined_workload:
       → WAITING
       (reason: "scheduler examined authorised workload · no eligible work under current mandate")

  7. Default (shouldn't reach here):
     → ALIVE
```

Property (§9): same inputs → same state, 100 runs identical.

**Design note:** rule 4 (WORKING) requires BOTH signals. That is the founder's dual-signal enforcement. Rule 6 (WAITING) requires the scheduler to have observed the mandate — this is the founder-locked "WAITING = no eligible authorised work" definition. Rule 5 (ALIVE) covers the "monitor came up before the orchestrator got its first mandate" case honestly.

## 7 · Bounded auto-recovery (per Doctrine §11.7)

Recovery actions are the ONLY things the monitor is permitted to do besides observe. All others are refused.

| State | Permitted recovery |
|---|---|
| `WORKING` | NONE |
| `ALIVE` | NONE |
| `WAITING` | NONE (this is a real signal, not a defect) |
| `STALLED` | `RETRY_MISSION` (ONE attempt, new mission_id, same content, budget refreshed) · if it stalls again next cycle → `ISSUE_NOTICE_1` |
| `DEGRADED` | `ISSUE_NOTICE_1` (via existing WO-ACADEMY-01 M8 hook) |
| `FAILED` | `ISSUE_NOTICE_1` (first time), `ISSUE_NOTICE_2` (repeat within 24h), `ISSUE_NOTICE_3` + `ESCALATE_TO_FOUNDER` (persistent) |

**Prohibited by design (grep-enforced in adversarial tests):**
- Modifying any WO-13 substrate file
- Signing any authorisation
- Creating a new agent
- Expanding a mandate
- Auto-adopting a proposal
- Generating fake work to make an agent look active

## 8 · Vertical slice scope

- 3-minute deterministic scheduler observes every agent in `AGENT_REGISTRY` (14 today)
- State derived from existing GB records (no push-based agent modifications required in slice-1)
- Heartbeat + health-check records persisted every cycle
- Recovery actions dispatched per §7 policy
- HQ agents page extended with a top-level Attention indicator ("N agents require investigation") + per-agent heartbeat state
- All 14 existing agents onboarded — same discipline as WO-ACADEMY-01

## 9 · Real-execution requirements

- Real Node timer / interval (deterministic via `setInterval`, testable via injectable clock)
- Real GB persistence for heartbeat + progress + health-check records
- Real provenance chains
- Real recovery actions using existing WO-ACADEMY-01 notice machinery
- Zero mocks in the state-derivation code path

## 10 · Adversarial acceptance tests (14 · founder-locked shape)

Every test in the "secretly try to fake activity OR grow authority → refused" shape.

1. **A-1** · Heartbeat monitor NEVER creates work · grep-verified: no import of orchestrator dispatch / mission-creation helpers
2. **A-2** · State derivation is pure · 100 runs on same inputs return identical state
3. **A-3** · WORKING requires BOTH liveness AND progress · alive-only (no active mission) returns ALIVE not WORKING · alive + mission + stale-progress returns STALLED not WORKING
4. **A-4** · An agent that fabricates liveness (records exist) but has no progress on its active mission is STALLED, not WORKING
5. **A-5** · No liveness beyond threshold ⇒ FAILED regardless of prior activity
6. **A-6** · Heartbeat monitor never signs any authorisation · grep-verified
7. **A-7** · Heartbeat monitor never expands any mandate or manifest · grep-verified
8. **A-8** · Zero external LLM SDK imports anywhere in `src/lib/nex-hq-heartbeat/`
9. **A-9** · Auto-recovery limited to (RETRY_MISSION, ISSUE_NOTICE_1/2/3, ESCALATE_TO_FOUNDER, NONE) · any other action refused
10. **A-10** · Provenance chain covers all heartbeat fields · one-byte tamper detected
11. **A-11** · Heartbeat monitor never modifies WO-13 substrate scope · grep-verified
12. **A-12** · WAITING requires `scheduler_examined_workload: true` in the input (real signal, not passive placeholder)
13. **A-13** · Anti-fake-activity property · injecting a "make agent look active" input causes state derivation to still return the honest state (not WORKING) unless BOTH signals are present
14. **A-14** · Notice records issued by heartbeat auto-recovery are functionally identical to those issued by the WO-ACADEMY-01 M8 hook (same record_type · same provenance discipline · same career-state consequences)

Property tests:
- **P-1** · State derivation deterministic across 50 random-shape inputs
- **P-2** · All 6 states reachable from realistic input mixtures
- **P-3** · 3-minute cadence honoured with injectable clock

## 11 · Sequencing + dependencies

- **Prerequisite:** WO-INTEL-01/02 + WO-ACADEMY-01/02 + WO-HQ-AGENTS-01 (HEAD `f64f36da`)
- **Blocks:** WO-INTEL-ORCHESTRATOR-01 (orchestrator dispatch relies on liveness monitoring)
- **Enables:** WO-HQ-DEEP-INSPECT-01 (deep-inspect assumes heartbeat + progress observability)
- **Parallel-safe:** WO-DATA-SANITIZER-01 · WO-NEX1-CODING-BRAIN-01

## 12 · Founder authorisation gate

**No implementation begins until this section is signed off.**

Master AI will not:
- Create any file under `src/lib/nex-hq-heartbeat/`
- Add any new storage collection
- Register any interval / scheduler
- Dispatch any recovery action
- Modify any substrate file

Until the founder authorises with one of:

- **(a)** "Authorise WO-HQ-HEARTBEAT-01 execution" (full: scheduler + state derivation + persistence + auto-recovery + HQ extension + adversarial tests + preservation)
- **(b)** "Authorise with modification: [specific]"
- **(c)** "Refine [specific section] first"
- **(d)** Something else you direct

---

**End of specification. Awaiting founder authorisation to proceed.**
