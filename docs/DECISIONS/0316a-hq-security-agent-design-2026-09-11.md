# ADR-0316a · HQ Security Agent Design · 4th Guardian Tier · 🔒 DOCTRINE LOCKED · Phase D.1 (design only)

**Status:** 🔒 DOCTRINE LOCKED · founder-authorised Phase D.1 2026-09-11 · design only · zero code · zero substrate mutation · Security Agent implementation itself remains BLOCKED pending separate D.3 authorisation
**Founder:** Philip · authorised via verbatim "continue" 2026-09-11 following D.1 proposal
**Consumes:** ADR-0316 HQ Consolidation Target Architecture · ADR-0314f Guardian Responsibility Reconciliation (three-way split extended to four) · ADR-0314g Acquisition Fabric target architecture · ADR-0314e Truth Engine Verifier · Work Map v1.1 (`docs/nex-work-map.json`) · CLAUDE.md UI theme rules · all locked doctrines and feedback memories

**Doctrine version:** `hq_security_agent.v1.0.0` · **Applies to:** every future code change proposed by NEX1 · NEX2 · NEX3 · Master AI · or any autonomous agent

---

## Section 1 · Founder verbatim authorisation

> *"add security agent for hq that knows each and every section of hq which is the ultimate blueprint for nex application. the security knows each section and is fully aware of nex1 programming and will suggest always that code does not break system but builds more powerful intelligence for nex and its operational systems and benefit for users and the features will always grow without effecting the nex app ui theme standards."*
>
> — Philip · 2026-09-11

> *"continue"*
>
> — Philip · 2026-09-11 · D.1 execution authorisation

---

## Section 2 · The problem this ADR solves

NEX now has three Guardian tiers (per ADR-0314f):
- **Lab-Guardian** — inspects **candidate data** at acquisition boundary
- **TE-Guardian** — inspects **verdict envelopes** at Truth-Engine boundary
- **R-10** (Stage 2 pending) — inspects **AUTHORITATIVE promotion** authorisation

**Nothing inspects CODE.** When NEX1 (or Master AI) proposes a code change, no automated gate:
- Verifies the change respects locked doctrines
- Identifies which CAP-XXX capabilities the change touches
- Walks the `impact_boost_to` graph to catch sibling regressions
- Enforces UI theme rules (no em dashes in hero · no Sparkles/AI-star icons · `object-contain` · 13px floor · dark-green CTA `#166534` · etc.)
- Verifies existing tests still pass or requires explanation
- Surfaces relevant `retro_benefits_available`
- Prevents anti-competing-substrate accidents

Result: every autonomous code change is a race between NEX1's caution and the possibility of breaking a sibling capability. That caps NEX's autonomous-growth rate at the pace of manual review.

**This ADR locks the 4th Guardian tier · HQ Security Agent · that inspects code before it lands.**

---

## Section 3 · The four-way responsibility split (locked)

Extends ADR-0314f three-way split by adding a code-tier gate:

### 3.1 · Locked responsibilities

| Guardian | Answers | Substrate | Rejection prefix |
|---|---|---|---|
| **Lab-Guardian** | *"Is this candidate well-formed and safe to enter the NEX knowledge pipeline?"* | candidate rows | `lab.` |
| **TE-Guardian** | *"Does this verdict satisfy NEX's constitutional truth requirements?"* | verdict envelopes | `te.` |
| **R-10** | *"Is this particular object type authorised to become AUTHORITATIVE?"* | promotion authorisation | `r10.` |
| **HQ Security Agent (NEW)** | *"Does this proposed CODE CHANGE (a) respect all locked doctrines · (b) preserve sibling capabilities · (c) enforce UI theme · (d) advance NEX intelligence without regression?"* | proposed code changes | `sec.` |

### 3.2 · Boundary invariants (locked · seven rules)

1. **HQ Security Agent MUST NOT decide constitutional truth.** That is TE-Guardian territory.
2. **HQ Security Agent MUST NOT decide candidate acceptance.** That is Lab-Guardian territory.
3. **HQ Security Agent MUST NOT decide AUTHORITATIVE promotion.** That is R-10 territory.
4. **HQ Security Agent MUST NOT execute code changes.** It inspects and returns ACCEPT/REJECT decisions · callers execute.
5. **HQ Security Agent MUST NOT invent capabilities.** Its only source of truth for capability identity is `docs/nex-work-map.json`.
6. **HQ Security Agent MUST NOT modify Work Map.** Read-only consumer.
7. **HQ Security Agent MUST NOT bypass any other Guardian.** If a proposed code change would require bypassing Lab-Guardian · TE-Guardian · or R-10 in the resulting runtime, the change is REJECTED at inspection time.

**No rule ever lives in two Guardian tiers.**

---

## Section 4 · Blueprint awareness

The Security Agent's authority to inspect depends on knowing which file belongs to which capability.

### 4.1 · File-path → CAP-XXX registry (D.2 · pending)

- `docs/nex-file-capability-map.json` — JSON registry mapping `src/**/*` (and `db/**/*` · `scripts/**/*` · `docs/DECISIONS/**/*`) to owning CAP-XXX identities.
- Authored under Phase D.2 (separate founder authorisation).
- Deterministic · maintained by same annotation script as Work Map.
- Missing mapping = REJECT with reason `sec.file_outside_registry` (fail-closed · no silent acceptance of unknown files).

### 4.2 · Cross-section impact graph (already exists)

Work Map v1.1 already carries `impact_boost_to` (39 edges) and `retro_benefits_available` (8 opportunities). Security Agent walks this graph:

- **Change to file X → touches CAP-A**
- **CAP-A has `impact_boost_to: [CAP-B, CAP-C]`** → siblings B and C at risk of regression
- **Security Agent verifies**: does the change preserve the invariants CAP-A relies on to boost B and C? If unclear · REJECT with `sec.sibling_regression_risk`.

### 4.3 · Locked doctrine registry (read from ADR files)

Security Agent consumes locked doctrines from `docs/DECISIONS/*.md`. Non-exhaustive list at v1.0.0:

- §7.3-B1 five-axis architecture (LAM Object Type ≠ Domain ≠ Category ≠ Operational Scope ≠ Agent/Runtime Identity)
- §7.6.5 G4 (Activity ≠ Domain)
- §7.7 H1 (`other` ≠ `unknown` · named fail-closed reasons)
- §7.8 J1 (physical ≠ logical authority)
- §7.9 L1 (Business ≠ Services)
- §7.10 M1 (Domain axis closed at 9)
- R-DOMAIN-01 anti-substitution
- R-10 gate-model
- ADR-0314f Guardian responsibility split (three-way · extended to four here)
- ADR-0314g Acquisition Fabric no-crawler-zoo
- ADR-0314i D-1b-1 through D-1b-7 (7 Stage 1b founder decisions)
- ADR-0314i §9 anti-competing-substrate invariant
- Feedback memories: observation ≠ constitutional authority · thresholds are founder policy · calendar time ≠ constitutional authority · one canonical Knowledge substrate · entity + location first-class · knowledge-gap-driven acquisition

Extension registry (`docs/nex-locked-doctrines.json`) authored under D.2 alongside the file-capability map.

---

## Section 5 · Pre-change inspection responsibilities

For every proposed code change, the Security Agent produces a **SecurityDecision** carrying:

### 5.1 · Seven mandatory sub-checks

1. **File-registry check** — every touched file has a CAP-XXX owner in the registry. Missing = REJECT.
2. **Capability impact analysis** — the set of CAP-XXX touched by the change. Includes transitive touches via `impact_boost_to`.
3. **Doctrine compliance check** — walks the locked doctrine registry. Any change that would introduce a competing-substrate table · silently convert UNKNOWN to FALSE · silently promote to AUTHORITATIVE · invent a threshold · autonomously modify a policy value = REJECT.
4. **UI theme check** — enforces CLAUDE.md UI standards:
   - No em dashes in hero copy
   - No AI-star / Sparkles icons
   - `object-contain` for images unless full-bleed hero
   - 13px text floor on donut app + dashboards · 12px WCAG floor elsewhere
   - Dark green CTA `#166534` (in-stock indicator `#10B981` reserved)
   - Yellow accents + CTAs on packages page only
   - No third-party image copy (ADR-0022)
   - Evidence-or-silence · no fabricated stats
   - No emojis unless explicitly requested
5. **Test integrity check** — existing tests still pass. If a test needs to change, the change must include a WHY explanation. Any test deletion = REJECT unless the WHY explicitly authorises removal.
6. **Retro-benefit surfacing** — if the change touches a CAP-XXX that has `retro_benefits_available`, surface them as candidate follow-up work · not required · surfaced only.
7. **Guardian-bypass detection** — if the change would let anything reach production `nex.*` without passing Lab-Guardian → Truth Engine → TE-Guardian → R-10 in the runtime = REJECT with `sec.guardian_bypass_attempted`.

### 5.2 · Decision output shape

```json
{
  "decision": "ACCEPT" | "REJECT" | "ACCEPT_WITH_SUGGESTIONS",
  "capability_impact": ["CAP-011", "CAP-032", ...],
  "sibling_regression_risk": ["CAP-013", ...],
  "doctrine_violations": [{"code": "sec.competing_substrate_attempted", "detail": "..."}],
  "theme_violations": [{"code": "sec.hero_em_dash", "detail": "line 47"}],
  "test_delta_required": [{"file": "...", "reason": "..."}],
  "retro_benefits_surfaced": [{"target_cap": "CAP-041", "suggested_sub": "..."}],
  "guardian_bypass": null | {"tier": "TE" | "R-10" | "Lab", "detail": "..."},
  "reason_codes": ["sec.file_outside_registry", ...]
}
```

### 5.3 · Rejection code namespace

All Security Agent rejection codes use the `sec.` prefix per Guardian-namespace discipline (ADR-0314f §5):

- `sec.file_outside_registry`
- `sec.sibling_regression_risk`
- `sec.doctrine_violation`
- `sec.competing_substrate_attempted`
- `sec.theme_violation`
- `sec.test_deletion_unauthorised`
- `sec.guardian_bypass_attempted`
- `sec.threshold_invention_attempted`
- `sec.policy_invention_attempted`
- `sec.canonical_knowledge_conflation`
- `sec.calendar_time_authority_attempted`
- `sec.observation_as_authority_attempted`
- `sec.crawler_zoo_attempted`
- `sec.mapping_registry_missing`
- `sec.work_map_write_attempted` (Security is read-only on Work Map)

---

## Section 6 · Feature-growth ledger

Every ACCEPT decision appends to `nex.security_growth_ledger` (substrate authored under D.3):

- `change_id` · `verdict` · `capability_impact[]` · `siblings_boosted[]` · `invariants_preserved[]` · `retro_benefits_surfaced[]` · `verdict_at`
- Founder sees: which CAP-XXX just got smarter · which siblings got boosted · which invariants held.

**This ledger becomes NEX's growth diary.** Read-only for the Router and English Brain. Never queried as truth (per ADR-0314i §9 anti-competing-substrate).

---

## Section 7 · Interfaces

### 7.1 · Machine gate (for NEX1 · NEX2 · NEX3 · Master AI)

```
POST /api/nex/hq-security/inspect
Body: {
  proposed_change_files: [{path, before_hash, after_hash, diff}],
  proposed_diff: string,
  description: string,
  claiming_capability: "CAP-XXX" | null
}
Response: SecurityDecision (§5.2)
```

- Cache: `no-store, must-revalidate`
- Headers: `X-NEX-Security-Verdict` · `X-NEX-Capability-Impact-Count` · `X-NEX-Guardian-Bypass-Detected`

### 7.2 · Founder-facing UI

`/nex-head-quarters/security` (server-rendered):
- Recent inspections (last 50) · status pills · click for detail
- Violations flagged (grouped by rejection code)
- Feature-growth ledger view (which CAP-XXX got smarter · when · why)
- Doctrine compliance summary (which locked doctrines the recent changes touched)
- Retro-benefit opportunities surfaced but not yet acted on

Sidebar entry: **Security** under `core` group.

### 7.3 · Read-only access to Work Map

Security Agent consumes `docs/nex-work-map.json` at each inspection. Never writes. Any write attempt is a Guardian violation of §3.2 rule 6.

---

## Section 8 · Integration with NEX1 delegation loop

Wave 4 Y-W4-3 established the delegation loop (MASTER AI THINKS → PROGRAMMER ACTS → MASTER AI MEASURES → MASTER AI LEARNS). Under Phase D.4 (separate authorisation), the loop becomes:

```
MASTER AI THINKS (proposes code change)
        ↓
HQ SECURITY AGENT INSPECTS  ← required gate
        ↓
    ┌───┴────┐
    │        │
 REJECT    ACCEPT
    │        │
    ▼        ▼
  discard  PROGRAMMER ACTS (executes change)
    │        │
    │        ▼
    │     MASTER AI MEASURES
    │        │
    │        ▼
    │     MASTER AI LEARNS
    │        │
    │        ▼
    │     FEATURE-GROWTH LEDGER appends
    │
    └── founder-visible in /nex-head-quarters/security
```

**No code change lands into production or nex_test.* schemas without a Security Agent ACCEPT.** Human-authored code (Founder direct edits · Master AI in autonomous mode) bypasses via founder-issued override (`sec.founder_override:<reason>` recorded).

---

## Section 9 · Enforcement implications (doctrine · not implemented by this ADR)

- **Every NEX1 code delegation** must invoke `/api/nex/hq-security/inspect` before execution. Master AI must consult before writing code in autonomous mode.
- **Every new file created** must be added to the file-capability registry in the same commit or the Security Agent will REJECT subsequent changes touching it.
- **Every new capability** must gain a CAP-XXX in Work Map before any code implementing it is authored. The Security Agent will REJECT unregistered CAP-XXX references.
- **Every new locked doctrine** (feedback memory · ADR clause) must be added to `docs/nex-locked-doctrines.json` for the Security Agent to enforce it.
- **UI theme rules** are additive · not subtractive. New rules added via founder-authored amendment to CLAUDE.md · never silently removed.
- **The Security Agent is a GATE · not a PLANNER.** It does not decide what to build · it decides whether a proposed change is safe.

---

## Section 10 · Sub-phases (each own founder authorisation)

- **D.2** — Author file-path → CAP-XXX registry (`docs/nex-file-capability-map.json`) + locked-doctrine registry (`docs/nex-locked-doctrines.json`) · doctrine + config only · zero code
- **D.3** — Implement Security Agent code + `/api/nex/hq-security/inspect` + `/nex-head-quarters/security` UI + `nex.security_growth_ledger` schema · substrate migration required
- **D.4** — Wire into NEX1 delegation loop as required gate · agent behaviour change
- **D.5** — Consumer-facing rogue-page removal (from ADR-0316) · deletes 12 flagged pages
- **D.6** — `/nex-app` + `/nexapp` consolidation (separate ADR)

Sub-phases D.5 and D.6 are inherited from ADR-0316 · re-authorised here for completeness.

---

## Section 11 · What this ADR did NOT do

- ❌ No code authored
- ❌ No migrations authored
- ❌ No file-capability registry created (D.2)
- ❌ No locked-doctrine registry created (D.2)
- ❌ No Security Agent code written (D.3)
- ❌ No API endpoint created (D.3)
- ❌ No UI page created (D.3)
- ❌ No substrate table created (D.3 `nex.security_growth_ledger`)
- ❌ No NEX1 delegation loop change (D.4)
- ❌ No rogue pages removed (D.5)
- ❌ No `/nex-app` + `/nexapp` reconciliation (D.6)
- ❌ No Work Map modification
- ❌ No UI theme rules changed
- ❌ No test suite modified
- ❌ No autonomous code writing authorised
- ❌ No Stage 1b resumption
- ❌ No Guardian tier renamed · retired · or merged

---

## Section 12 · Decision provenance footer

| Field | Value |
|---|---|
| **Decision** | Four-way Guardian responsibility split locked: Lab-Guardian (data) · TE-Guardian (verdicts) · R-10 (authorisation) · **HQ Security Agent (code)**. Security Agent inspects proposed code changes · walks impact_boost_to graph · enforces UI theme + locked doctrines + Guardian-bypass detection · surfaces retro-benefits · maintains feature-growth ledger. Rejection prefix `sec.`. Interfaces: `/api/nex/hq-security/inspect` machine gate + `/nex-head-quarters/security` founder UI. Boundary invariants: never decides truth · never decides authorisation · never decides candidate acceptance · never executes · never invents capabilities · never writes Work Map · never bypasses other Guardians. Implementation itself in sub-phases D.2 → D.4 · each own founder authorisation. |
| **Decided by** | Philip |
| **Decision date** | 2026-09-11 |
| **ADR** | 0316a · this file · consumed by D.2 registry authoring · D.3 Security Agent implementation · D.4 NEX1 delegation wiring |
| **Effective from** | `hq_security_agent.v1.0.0` |
| **Supersedes** | none · extends ADR-0314f from three-way to four-way Guardian responsibility split |
| **Reason** | Founder verbatim: *"add security agent for hq that knows each and every section of hq which is the ultimate blueprint for nex application. the security knows each section and is fully aware of nex1 programming and will suggest always that code does not break system but builds more powerful intelligence for nex and its operational systems and benefit for users and the features will always grow without effecting the nex app ui theme standards."* This ADR locks the constitutional role · boundary invariants · interfaces · and staged implementation path. |

---

## Section 13 · Cross-references

**Consumed by (future ADRs):**
- Sub-phase D.2 file-capability + locked-doctrine registries
- Sub-phase D.3 Security Agent implementation
- Sub-phase D.4 NEX1 delegation integration
- Every future NEX1 · NEX2 · NEX3 code delegation ADR
- Every future capability implementation ADR (Layer C · D · E of Acquisition Fabric)

**Consumes:**
- ADR-0316 HQ Consolidation Target Architecture (this Phase D.1 pair)
- ADR-0314f Guardian Responsibility Reconciliation (three-way split · extended here to four-way)
- ADR-0314g Acquisition Fabric target architecture (no-crawler-zoo · applied to HQ)
- ADR-0314e Truth Engine Verifier
- ADR-0314i Stage 1b Founder Decisions (§9 anti-competing-substrate applies to Security Agent's ledger)
- Work Map v1.1 (`docs/nex-work-map.json`) — source of truth for capability identity + impact graph
- CLAUDE.md — UI theme rules
- All feedback memories at `.claude/projects/*/memory/feedback_*.md`
- All locked doctrines in `docs/DECISIONS/*.md`

**Referenced by (future candidate slots):**
- ADR-0318 Security Agent Threshold Amendment (if founder needs to relax any check)
- ADR-0319 Security Agent Growth Ledger Schema

---

## Section 14 · Master AI STOPS · awaiting founder review

**Master AI does NOT autonomously proceed to D.2 · D.3 · D.4 · D.5 · D.6.** Each requires separate founder authorisation.

**Current position after Phase D.1 complete (both ADRs):**

- Phase A · Stage 1a · 🟢 COMPLETE
- Phase B · Guardian reconciliation (3-way) · 🟢 LOCKED
- Phase C · Acquisition Fabric · 🟢 LOCKED
- Stage 1b Wiring + founder decisions · 🟢 LOCKED · apply halted at nex.evidence collision
- Work Map v1.1 · 🟢 ACTIVE
- **Phase D.1 · HQ Consolidation Target · 🟢 LOCKED (ADR-0316)**
- **Phase D.1 · HQ Security Agent Design (4th Guardian tier) · 🟢 LOCKED (this ADR · ADR-0316a)**
- Phase D.2 · file-capability + locked-doctrine registries · 🔴 BLOCKED pending founder authorisation
- Phase D.3 · Security Agent implementation · 🔴 BLOCKED
- Phase D.4 · NEX1 delegation integration · 🔴 BLOCKED
- Phase D.5 · rogue-page removal · 🔴 BLOCKED
- Phase D.6 · `/nex-app` + `/nexapp` reconciliation · 🔴 BLOCKED
- Stage 1b resumption · 🔴 BLOCKED (independent of Phase D · nex.evidence collision awaits founder direction)

**Substrate posture:** unchanged · everything frozen · Gate 3 remains OPEN · Stage 1a foundation preserved · Lab-Guardian ledger preserved · specialist tables preserved.

**Guardian architecture now formally four-tier:**

```
Acquisition
    ↓
Lab-Guardian ──── inspects data ──────► sec.data.*
    ↓
Truth Engine
    ↓
TE-Guardian ───── inspects verdicts ───► te.*
    ↓
R-10 ──────────── inspects authorisation ► r10.*
    ↓
AUTHORITATIVE

BEFORE any of the above runs, code that would MAKE the above run must first pass:

Code change proposal
    ↓
HQ SECURITY AGENT ── inspects code ─────► sec.*
    ↓
Only ACCEPT reaches the runtime pipeline
```

---

**End of ADR-0316a · HQ Security Agent Design (4th Guardian Tier) · doctrine locked · implementation itself remains BLOCKED pending Phase D.2 founder authorisation.**
