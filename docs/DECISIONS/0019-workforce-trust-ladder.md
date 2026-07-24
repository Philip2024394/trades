# ADR-0019: Workforce Trust Ladder · 4 Levels · Level 4 Auto-Execute Opt-In Only · Emergency Stop Non-Negotiable

Status: Draft (awaiting signoff)
Date: 2026-07-23
Related: `docs/PHASE_32_AUTONOMOUS_AI_WORKFORCE_BLUEPRINT.md` · `docs/ES-01_ENGINEERING_EXECUTION_BIBLE.md` §14.1 (correction #8) · `docs/PHASE_15_AB_BLUEPRINT`

## Context

Phase 32 Workforce ships 5-25 AI agents that act on behalf of the merchant. Every action must be safe by construction, not by careful design of individual features. The autonomy framework governs what agents can do without human approval.

The Phase 32 blueprint originally specified a 7-level trust ladder. ES-01 §14.1 correction #8 challenged this as too complex for merchants to distinguish. Correction: **simplify to 4 levels · with Level 4 auto-execute strictly opt-in per action class with hard caps.**

This ADR locks:
1. The 4-level ladder
2. Default level per agent per action class
3. Level 4 auto-execute preconditions
4. Level 5 emergency stop as non-negotiable safety valve
5. Audit requirements per level

## Decision

### 1 · The 4-level trust ladder

| Level | Name | What the agent can do |
|-------|------|-----------------------|
| **1** | Observe | Watches signals · produces internal notes only · merchant sees nothing daily |
| **2** | Draft | Prepares drafts (estimates · messages · POs) · merchant approves each individually · **DEFAULT for all new agents** |
| **3** | Prepare | Assembles multi-step packages ready for one-click execution · merchant approves the package · agent runs the chain |
| **4** | Auto-Execute (whitelist) | Explicitly whitelisted action classes execute autonomously within caps |
| **5** | Emergency Intervention | Merchant "big red button" · halts all agent activity across the workforce · **non-negotiable** |

Level 5 is not a graduation state · it's a merchant capability always available at all times regardless of agent levels.

### 2 · Default level per agent

- **Every new agent starts at Level 2 (Draft).** No agent begins at Prepare or Auto-Execute.
- Level 3 promotion requires: merchant explicit opt-in + minimum 30 days at Level 2 with ≥90% approval rate on drafts.
- Level 4 promotion requires: merchant explicit opt-in per action class + minimum 100 approved Level 2/3 events for that action class + hard cap configuration.

Trust is earned per agent per action class. Not granted broadly.

### 3 · Level 4 auto-execute · strict preconditions

Only these action classes are ELIGIBLE for Level 4 auto-execute:

- **Procurement Mgr** · auto-order of pre-approved stock items below merchant-set daily spend cap
- **Marketing Mgr** · auto-publish of pre-scheduled + pre-approved posts (content already approved individually)
- **Finance Mgr** · auto-send of first-touch overdue reminders below merchant-set invoice-value cap
- **Document Controller** · auto-file received documents into correct Twin folder

Every Level 4 whitelisted action:
- Has hard daily spend cap set by merchant
- Emits an audit event on every execution (not just anomalies)
- Is revocable by merchant at any time (returns agent to Level 3 for that class)
- Is suspended entirely if agent's Level 2/3 approval rate for that class drops below 85%

**No other action classes are eligible for Level 4 without a superseding ADR.** Specifically NOT eligible ever:
- Sending customer-facing communications with new content
- Financial transfers or payments to third parties
- Legal document signing
- Scope commitments to customers
- Any action that would require professional certification (Gas Safe · Part P · structural)

### 4 · Level 5 emergency stop · non-negotiable

Every merchant surface has a persistent Emergency Stop control. When triggered:

- All agent activity halts within 2 seconds SLA
- All Level 4 auto-executions in flight complete OR abort (per action-class idempotency)
- All queued actions pause · nothing new executes
- Merchant receives confirmation
- Resume requires explicit merchant action · never automatic

Emergency stop is available regardless of:
- Merchant tier
- Agent hierarchy state
- Which agents are hired

### 5 · Audit requirements per level

| Level | Audit requirement |
|-------|-------------------|
| Level 1 (Observe) | Read log only · no writes to audit |
| Level 2 (Draft) | Every draft created + every merchant decision (approve/reject/edit) logged |
| Level 3 (Prepare) | Level 2 requirements + package composition logged · one-click execution logged |
| Level 4 (Auto-Execute) | Level 3 requirements + every autonomous execution logged with pre-condition + action + post-condition + spent-against-cap |
| Level 5 (Emergency Stop) | Triggering event + halt confirmation + resume timestamp logged |

Every log entry immutable · retention per ES-02 §9 · legally admissible.

### 6 · Downgrade and revocation

- Merchant can downgrade any agent's level at any time
- Merchant can revoke Level 4 whitelist per action class instantly
- Auto-downgrade triggers:
  - Approval rate drops below 85% for that agent/class
  - Merchant cancels 3+ auto-executed actions within 24h
  - Agent action causes external harm (defined per action class)

Downgrade is not punitive · it's recalibration.

## Consequences

**Positive:**
- 4 levels are distinguishable by non-technical merchants (7 were not per ES-01 correction)
- Default Level 2 means no agent surprises merchants at onboarding · trust builds deliberately
- Emergency Stop non-negotiable creates fundamental safety guarantee
- Level 4 opt-in with hard caps eliminates most classes of autonomous-agent risk
- Audit requirements calibrate to level · Level 1 not burdened with heavy logging

**Negative:**
- Approval fatigue at Level 2 remains a risk · addressed by weekly digest (Validation Report improvement C-5)
- Level 4 restriction means some "obviously safe" automations require Level 3 approval even at scale
- Downgrade auto-triggers may be sensitive to Vision AI false-positives · calibration required

**Neutral:**
- Level 3 → Level 4 promotion requires merchant explicit action · gentle nudging via Nex Chat acceptable · pressure tactics forbidden per Business Builder V2 §14.7

## Alternatives Considered

- **Original 7-level ladder** (Phase 32 blueprint) · rejected · complexity cost per ES-01 correction
- **Only 2 levels: Observe + Auto** · rejected · no draft-review muscle · violates draft-not-execute default
- **Level 4 opt-in but without hard caps** · rejected · unbounded exposure risk · one bad agent decision can destroy merchant trust
- **Emergency Stop as opt-in feature** · rejected · fundamental safety guarantee must be default-on
- **Automated Level graduation without merchant opt-in** · rejected · trust growth must be explicit merchant decision
- **Level 4 eligible for customer-facing communications with content templates** · rejected · content variation risk too high · every customer comm requires human eye on the specific message

## Implementation Impact

- `hammerex_nex_workforce_agent_levels` new table (per agent per merchant per action class)
- `hammerex_nex_workforce_level_events` new table (level changes with audit trail)
- `hammerex_nex_workforce_pauses` new table (per Emergency Stop + granular pause per ES-01)
- `hammerex_nex_workforce_audit_log` immutable log with level context
- Runtime enforcement: every agent action checks its current level before executing
- Emergency Stop SLA: 2-second global halt · implemented via feature flag + agent worker polling
- Merchant UI: level indicator per agent · promotion prompts · Emergency Stop button persistent
- Approval Inbox per Level 2 default · digest per Validation Report C-5

## Dependencies

- **Blocks:** Phase 32 Workforce V0 · Phase 33 Workforce Economy V0 · every Workforce Economy hire flow
- **Blocked by:** ADR-0016 (Memory Privacy for audit log retention) · legal review of autonomous action liability apportionment
- **Related ADRs:** ADR-0017 (Trade Brain Contract · Brains inform agent action rationale) · ADR-0020 pending (Workforce Economy Honesty)

## Enforcement

- Runtime agent worker enforces level before every action · integration test verifies
- CI test verifies default Level 2 for every new agent registered
- Level 4 whitelist changes require merchant explicit confirmation with 2FA
- Emergency Stop tested weekly in staging · SLA measured
- Quarterly review of agent approval rates · auto-downgrade triggers audited

## Sign-off Required

- [ ] CTO
- [ ] Product Lead
- [ ] Legal Counsel (autonomous action liability)
- [ ] AI Safety Lead (if appointed per ES-10 §12.3)
