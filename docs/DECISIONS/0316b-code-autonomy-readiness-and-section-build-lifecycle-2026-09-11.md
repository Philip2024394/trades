# ADR-0316b · Code-Autonomy Readiness Audit + Section-Build Lifecycle · 🔒 DOCTRINE LOCKED · Phase D.1 (design only)

**Status:** 🔒 DOCTRINE LOCKED · founder-authorised Phase D.1 extension 2026-09-11 · design only · zero code · zero substrate mutation · Phase D.3 implementation itself remains BLOCKED pending separate authorisation
**Founder:** Philip · authorised via verbatim "Yes — this is the right direction, and I would lock it in" (2026-09-11) with three explicit corrections
**Consumes:** ADR-0316 HQ Consolidation Target Architecture · ADR-0316a HQ Security Agent Design (4-way Guardian split) · ADR-0314f Guardian Responsibility Reconciliation · ADR-0314g Acquisition Fabric · ADR-0314i Stage 1b Founder Decisions (particularly D-1b-7 determinism + §9 anti-competing-substrate) · Work Map v1.1 (`docs/nex-work-map.json`) · file-capability-map (`docs/nex-file-capability-map.json`) · locked-doctrines (`docs/nex-locked-doctrines.json`) · feedback memories especially `feedback_calendar_time_is_not_constitutional_authority.md` · `feedback_observation_is_not_constitutional_authority.md`

**Doctrine version:** `code_autonomy_readiness.v1.0.0` · **Applies to:** every future NEX1 · NEX2 · NEX3 · Master AI code change from Phase D onward

---

## Section 1 · Founder verbatim authorisation (with three corrections)

> *"Yes — this is the right direction, and I would lock it in. But I would make a few important corrections before calling it 'ultimate safe.'"*
>
> — Philip · 2026-09-11 · post-audit lock-in

**Founder correction #1 (activation rule):**

> *"I would not lock 'one activation per hour.' Instead: Only one capability may be in ACTIVATING at a time. A second activation cannot begin until the first has passed its activation verification/observation gate. That is much better than a clock-based rule and fits your constitutional principle: Calendar time is not authority."*

**Founder correction #2 (preview isolation):**

> *"A feature flag is good, but a flag alone is not sufficient isolation. NEX1 could potentially change: database schema · APIs · shared components · environment configuration · dependencies · background workers before the UI flag is turned on. Therefore the actual safety model should be: NEX1 + Team → isolated build → Security Agent → tests / impact tests / accessibility → build artifact → PREVIEW ENVIRONMENT → Founder Preview → Founder changes → rebuild + Security + tests → Founder APPROVE → ACTIVATION GATE → Founder clicks LIVE → Production activation → post-activation verification → ACTIVE. The preview environment/artifact is important because the founder needs to see the actual thing that is about to go live, not merely a feature flag sitting inside the existing production application."*

**Founder correction #3 (never claim absolute impossibility):**

> *"'Cannot harm NEX' → strong enforced controls, but never claim absolute impossibility."*

**Founder scope note (Stage 1b nex.evidence collision remains separate):**

> *"The current nex.evidence collision remains a separate unresolved Stage 1b issue. We should not allow the exciting NEX1 autonomy work to accidentally bypass that constitutional work."*

**Founder authorisation gate (this ADR only · not implementation):**

> *"What I would authorize now: ADR-0316b doctrine only. ... no implementation in the ADR itself. Then we can build the security machinery against that locked target."*

---

## Section 2 · Purpose

Lock the **target operating model** for NEX1/NEX2/NEX3/Master AI code autonomy · with founder-authored corrections applied · so the Security Agent + surrounding machinery (Phase D.3-D.11) can be built against a fully-specified doctrine.

**This ADR authors NO code.** It records:
- The audit of 46 code-autonomy readiness gaps
- The scoped-authority principle for NEX1
- The 8-state section-build card lifecycle
- Preview architecture (build artifact + isolated preview environment · NOT just feature flag)
- The corrected activation rule (one-at-a-time · verification gate · not calendar-time)
- Founder-only activation + emergency revert
- Work Map as canonical master inventory (protects against redundant audits)
- Extended Phase D sub-phase plan (D.3 → D.11)
- Honest safety framing ("strong enforced controls" · not "absolute impossibility")

---

## Section 3 · NEX1 scoped authority (locked)

**Corrected framing** (per founder correction #3): NEX1 does NOT receive an unrestricted write key.

**Locked scope of NEX1 authority:**

> *"NEX1 can propose/build code at scale within registered capabilities, under enforced Security, test, impact, preview and founder-activation controls."*

### 3.1 · What NEX1 may do (within enforced controls)

- Propose code changes touching files that own a CAP-XXX in the file-capability registry (ADR-0316a Phase D.2 · `docs/nex-file-capability-map.json`)
- Author new tests for a capability's public surface
- Surface retro-benefit opportunities via the Work Map
- Consume the Work Map + locked-doctrine registries · Security Agent inspects every proposal
- Append to the growth ledger only when Security Agent ACCEPTS

### 3.2 · What NEX1 may NOT do (locked absolute)

- Author code outside a registered CAP-XXX (fails-closed with `sec.file_outside_registry`)
- Modify the Work Map · file-capability-map · or locked-doctrines registries (Security Agent is read-only on all three)
- Modify Stage 1a foundation (`src/lib/nex/truth-engine/verifier/**` · `runner/**` · `guardian/**` · Stage 1a migrations) without founder-authored amendment ADR
- Bypass any Guardian tier (Lab · TE · R-10 · Security)
- Modify · disable · or delete tests without a founder-authored justification
- Introduce new npm packages · external dependencies · secrets · third-party assets without founder amendment
- Modify UI theme design tokens (once locked in D.3.b)
- Break the public API of any capability (additive changes only)
- Introduce cyclic dependencies in the `impact_boost_to` graph
- Activate any capability to live (activation is founder-only · always)
- Rollback any active capability (rollback is founder-only · always)

### 3.3 · Consequence of unauthorised action

Any attempted violation surfaces at the Security Agent as a `sec.*` REJECT · logged in the audit trail with `agent_id` · never silently permitted · never retried until founder amendment.

---

## Section 4 · Locked activation rule (founder correction #1)

**Rejected framing** (Master AI's original recommendation): *"max one activation per hour."*

**Reason for rejection**: calendar time is not constitutional authority (per `feedback_calendar_time_is_not_constitutional_authority.md`). A clock cannot promote a change.

**Locked rule (founder-authored):**

> **Only one capability may be in the `ACTIVATING` state at any moment. A second activation cannot begin until the first has passed its activation verification / observation gate.**

### 4.1 · Activation verification gate (locked)

For every capability entering `ACTIVATING`, the gate MUST demonstrate:

- **Deterministic post-activation behaviour** — same input · same output · byte-identical across N runs (D-1b-7 discipline extended to Phase D)
- **No sibling regression** — every capability in `impact_boost_to[CAP-X]` has its test suite pass at parity with pre-activation
- **No Guardian rejection** — Lab-Guardian · TE-Guardian · R-10 (when live) · Security Agent all return ACCEPT
- **Growth ledger entry** — Security Agent's `strength_delta` recorded with source evidence

**Only after the gate passes** does the capability move `ACTIVATING → ACTIVE`. Only then may another capability enter `ACTIVATING`. This creates a natural throughput regulator that responds to real system state · not to a clock.

### 4.2 · What this doctrine does NOT say

- It does NOT say "one activation per hour"
- It does NOT say "wait N minutes"
- It does NOT authorise Master AI to compute an "activation readiness score" and act on it
- It does NOT permit auto-advancement based on absence-of-problems

The gate is deterministic · state-based · never time-based.

---

## Section 5 · Preview architecture (founder correction #2)

**Rejected framing** (Master AI's original recommendation): *"feature flag alone."*

**Reason for rejection**: a feature flag inside the existing production application does not protect against changes to database schema · APIs · shared components · environment config · dependencies · background workers. The founder MUST see **the actual artifact that will go live** · not a flag-gated variant of production.

### 5.1 · Locked preview architecture

```
NEX1 + Team
     ↓
isolated build (working tree · never touches production checkout)
     ↓
Security Agent inspects proposed diff
     ↓
tests / impact-graph tests / accessibility scan / determinism proof
     ↓
build artifact (versioned · content-addressed · immutable)
     ↓
PREVIEW ENVIRONMENT (isolated deployment · full stack · not shared with production)
     ↓
Founder Preview (founder-only URL · stable · shareable)
     ↓
[Founder requests changes]  →  rebuild → Security → tests → new artifact → new preview
     ↓
Founder APPROVE
     ↓
ACTIVATION GATE (§4 verification gate)
     ↓
Founder clicks LIVE
     ↓
Production activation (build artifact promoted · not rebuilt)
     ↓
post-activation verification (§4.1 checks re-run against live)
     ↓
ACTIVE (growth ledger entry · card status flip on Work Map)
```

### 5.2 · Locked requirements for the preview environment

- **Isolated deployment** — its own hostname / process / database schema where applicable (never shares state with production)
- **Full stack** — front-end · API · DB migrations applied in isolation · background workers running against isolated state
- **Immutable build artifact** — the exact bytes that will be promoted to production. Zero re-build between preview approval and live activation.
- **Session-scoped access** — founder-only preview URL with signed session cookie · never public · never search-indexed
- **Stable + shareable** — founder can bookmark · come back later · nothing has moved
- **Emergency-severable** — Security Agent kill switch can shut down any preview instantly
- **Never touches production data** — preview writes never reach production `nex.*` · `nex_lab_*` · `nex_test.*` · Supabase (unless the change under review is specifically a controlled production-write experiment · which requires separate founder authorisation)

### 5.3 · Locked flag discipline (as SECONDARY layer on top of preview)

After preview approval + founder activation:

- Newly-activated capability may (optionally) still ship behind an emergency-revert feature flag
- Flag defaults ON at activation moment (unlike the earlier flag-only proposal)
- Flag exists solely to enable Emergency Revert (§7) · not to gate visibility

**Feature flag is a fallback safety mechanism · not the primary preview isolation.**

---

## Section 6 · The 8-state section-build card lifecycle (locked)

### 6.1 · States

| State | Icon | Meaning | Transition triggers |
|---|---|---|---|
| 🔨 BUILDING | heartbeat | NEX1 + team authoring code · Security Agent inspects each commit | Founder authorises capability start · Security Agent ACCEPT on each proposed diff |
| 🧪 TESTING | spinner | All tests + impact-graph siblings + accessibility + determinism proof running | On last commit of the build phase |
| 👁 AWAITING PREVIEW | yellow badge | Build artifact produced · preview environment being provisioned · founder has NOT yet clicked Preview | Testing phase ACCEPT |
| 🔍 IN REVIEW | blue badge | Founder has opened the preview URL · session cookie active · viewing the live artifact | Founder clicks Preview |
| 🔁 REQUEST UPDATE | orange badge | Founder has typed instructions for change · queued for NEX1/Claude · returns to 🔨 | Founder types + submits update request |
| 🔴 REJECTED | red badge | Founder rejects · returns to build queue with reason | Founder clicks Reject |
| ✅ APPROVED | green badge · Activate button unlocked | Founder has approved · Activate Live button becomes clickable IF activation gate green | Founder clicks Approve · gate re-checked |
| ⏳ ACTIVATING | pulsing gold | Post-activation verification in progress · no other capability may activate | Founder clicks Activate Live |
| 🟢 ACTIVE | solid green | Live in production · growth ledger appended · Emergency Revert always visible | Activation gate passes |
| ⚫ REVERTED | grey | Was live · founder emergency-reverted · state preserved for audit | Founder clicks Emergency Revert |

### 6.2 · Illegal state transitions

- No state may skip the Security Agent (BUILDING → TESTING → AWAITING PREVIEW is enforced sequence)
- Nothing may transition to APPROVED without founder click
- Nothing may transition to ACTIVATING while another capability is in ACTIVATING (§4)
- Nothing may transition to ACTIVE without passing the activation verification gate (§4.1)
- ACTIVE → REVERTED only via founder emergency click

### 6.3 · Concurrency rules

- Multiple capabilities may be in 🔨 BUILDING · 🧪 TESTING · 👁 AWAITING PREVIEW · 🔍 IN REVIEW · 🔁 REQUEST UPDATE · ✅ APPROVED at once
- Only **one** capability may be in ⏳ ACTIVATING at once (§4)
- 🟢 ACTIVE capabilities are unbounded in count (that's the growth pattern)

---

## Section 7 · Work Map card anatomy (founder-locked visual mockup)

Every CAP-XXX card on `/nex-head-quarters/work-map` renders per founder specification:

```
┌──────────────────────────────────────┐
│ CAP-XXX · <Capability name>          │
│                                      │
│ 🟢 COMPLETE — WAITING FOUNDER       │
│                                      │
│ Security       ✓ ACCEPTED            │
│ Tests          ✓ N/N                 │
│ Impact tests   ✓ PASS                │
│ Accessibility  ✓ AA                  │
│ Preview        ✓ READY               │
│                                      │
│ [ OPEN PREVIEW ]                     │
│ [ VIEW BUILD FILES ]                 │
│ [ REQUEST CHANGES ]                  │
│                                      │
│ Founder approval: ⏳                 │
│                                      │
│ [ ACTIVATE LIVE ]  🔒               │
└──────────────────────────────────────┘
```

**Activate Live remains locked (🔒) until all required gates are green** (Security · Tests · Impact tests · Accessibility · Preview ready · another activation not already in progress).

After founder approves + activates:

```
🟢 ACTIVE

Activated by:  Founder
Version:       vX.X.X
Activated at:  <ISO timestamp>
Security run:  <run_id>
Build:         <artifact_id>

[ EMERGENCY REVERT ]
```

**Emergency Revert is always visible on every ACTIVE card. Founder-only.**

### 7.1 · Locked card requirements

- Every card includes a **Security run ID** referencing the audit trail
- Every card includes a **Build artifact ID** for reproducibility
- Every card includes the **agent identity** that proposed the changes (NEX1 · NEX2 · NEX3 · master-ai · founder)
- Every activation logs to the growth ledger with `activated_by · activated_at · security_run_id · build_artifact_id · gate_signatures[]`

---

## Section 8 · Work Map as canonical master inventory (locked)

**Founder-locked principle:**

> *"Your Work Map should become more than a progress dashboard. It becomes the master inventory of NEX."*

Every capability record must maintain:

- CAP-XXX identity (immutable)
- Audit references (which ADRs audit this)
- Architecture references (which ADRs specify the target)
- Implementation references (which files own this)
- Database references (which tables · schemas · migrations)
- UI references (which pages · which URLs · which components)
- Test references (test files + counts + coverage)
- Dependencies (`impact_boost_to` + `impact_boosted_by`)
- Preview state (current preview artifact ID · URL)
- Founder approval state (current lifecycle state)
- Live version (semver + build artifact ID)
- Emergency revert path (feature flag ID + rollback ADR link)
- Last audit date + last founder review date

### 8.1 · Already-audited protection (locked)

**Founder-locked rule:**

> *"When we later look at Images, NEX doesn't say: 'Let's audit images again.' It says: CAP-XXX — Image/Visual Intelligence · Audited: 2× · Architecture: defined · Existing assets: identified · Existing storage: identified · Implementation: incomplete · Database mapping: outstanding · Next authorised work: X. That is exactly the protection you were asking for."*

Security Agent doctrine DOC-017 (already locked in `docs/nex-locked-doctrines.json`) enforces this: no new audit ADR may duplicate an AUD-XXX already flagged `do_not_repeat: true` in the Work Map.

### 8.2 · Completion identifies actual files/pages/storage (locked)

Every capability marked ACTIVE in the Work Map MUST identify:

- Actual file paths in `implementation_references` (never abstract references)
- Actual database tables / schemas in `storage_home`
- Actual UI URLs in `ui_url`
- Actual test files in `tests`

**Incomplete identification = capability is not truly ACTIVE. Card state is IMPLEMENTED at best.**

---

## Section 9 · Code-autonomy readiness · 46 gap audit (locked as constitutional record)

Records the 46 identified gaps grouped by category. Each gap has priority + proposed remediation sub-phase (D.3.a etc.).

### 9.1 · Category 1 · Code-safety pipeline (7 gaps)

| # | Gap | Priority | Remediation sub-phase |
|---|---|---|---|
| 1 | No pre-commit gate wired to Security Agent | CRITICAL | D.3.a |
| 2 | Security Agent not in CI/CD | CRITICAL | D.3.a |
| 3 | No signed / attested commits | MEDIUM | D.3.a |
| 4 | No mandatory change-reason field | MEDIUM | D.3.a |
| 5 | No diff-size limits | MEDIUM | D.3.a |
| 6 | No atomicity discipline | MEDIUM | D.3.a |
| 7 | No autonomous-agent identity headers | HIGH | D.3.a |

### 9.2 · Category 2 · Test discipline (5 gaps)

| # | Gap | Priority | Remediation sub-phase |
|---|---|---|---|
| 8 | Test deletion has no protection | CRITICAL | D.7 |
| 9 | No test-coverage floor for new capabilities | HIGH | D.7 |
| 10 | No cross-capability integration tests | HIGH | D.7 |
| 11 | No deterministic-test requirement | HIGH | D.7 |
| 12 | No coverage regression detection | MEDIUM | D.7 |

### 9.3 · Category 3 · UI theme + world-class button/link quality (8 gaps)

| # | Gap | Priority | Remediation sub-phase |
|---|---|---|---|
| 13 | No automated theme linter | CRITICAL | D.3.b |
| 14 | No design token lock | HIGH | D.3.b |
| 15 | No component-reuse enforcement | HIGH | D.3.b |
| 16 | No icon library discipline | MEDIUM | D.3.b |
| 17 | No button/link quality checks | HIGH | D.3.b |
| 18 | No accessibility floor | CRITICAL | D.3.b |
| 19 | No visual regression tests | MEDIUM | D.11 |
| 20 | No responsive breakpoint discipline | MEDIUM | D.11 |

### 9.4 · Category 4 · Feature-growth invariants (5 gaps)

| # | Gap | Priority | Remediation sub-phase |
|---|---|---|---|
| 21 | Growth ledger designed but not built | CRITICAL | D.3 |
| 22 | No strength-only assertion | HIGH | D.10 |
| 23 | No anti-regression assertion on boosted siblings | CRITICAL | D.7 · D.10 |
| 24 | Retro-benefits surfaced but not tracked | MEDIUM | D.10 |
| 25 | No "additive-only" invariant | HIGH | D.10 |

### 9.5 · Category 5 · Cross-section safety (4 gaps)

| # | Gap | Priority | Remediation sub-phase |
|---|---|---|---|
| 26 | Impact graph not enforced in CI | CRITICAL | D.7 |
| 27 | Public API stability undefined | HIGH | D.7 |
| 28 | No dependency-cycle detection | MEDIUM | D.7 |
| 29 | No orphan-symbol detection | MEDIUM | D.11 |

### 9.6 · Category 6 · Autonomy boundaries (6 gaps)

| # | Gap | Priority | Remediation sub-phase |
|---|---|---|---|
| 30 | NEX1 write-access still Phase A observation-only | BLOCKER | D.4 |
| 31 | No autonomous-PR proposal path | HIGH | D.4 · D.4.a |
| 32 | No founder review queue | CRITICAL | D.4.a |
| 33 | No circuit breaker / kill switch | CRITICAL | D.4.a |
| 34 | No agent identity attribution | HIGH | D.3 · D.4.a |
| 35 | No rate limits on agent proposals | MEDIUM | D.4.a |

### 9.7 · Category 7 · Emergency + observation (4 gaps)

| # | Gap | Priority | Remediation sub-phase |
|---|---|---|---|
| 36 | No substrate-drift detector | HIGH | D.8 |
| 37 | No constitutional-change detector | HIGH | D.8 |
| 38 | No test-count drift alarm | MEDIUM | D.8 |
| 39 | No alert channel | MEDIUM | D.8 |

### 9.8 · Category 8 · Missing capabilities / registrations (4 gaps)

| # | Gap | Priority | Remediation sub-phase |
|---|---|---|---|
| 40 | 5 UNASSIGNED fallback patterns in file-capability-map | MEDIUM | D.9 |
| 41 | Some sidebar entries have no CAP-XXX owner | HIGH | D.9 · ADR-0316 D.4 |
| 42 | No auto-CAP-suggest for uncovered paths | MEDIUM | D.9 |
| 43 | No CAP-README per capability | MEDIUM | D.9 |

### 9.9 · Category 9 · Security beyond code (3 gaps)

| # | Gap | Priority | Remediation sub-phase |
|---|---|---|---|
| 44 | No secrets scanning | CRITICAL | D.3.a · D.11 |
| 45 | No supply-chain integrity check | HIGH | D.11 |
| 46 | No PII protection in fixtures/logs | HIGH | D.11 |

---

## Section 10 · Extended Phase D sub-phase plan (locked)

Each sub-phase is a separate founder authorisation. **Master AI does NOT autonomously advance.**

| Sub-phase | Deliverable | Substrate impact | Depends on |
|---|---|---|---|
| **D.2** (COMPLETE 2026-09-11) | File-capability + locked-doctrine registries | JSON only | ADR-0316a |
| **D.3** (BLOCKED · task #166) | Security Agent code + `/api/nex/hq-security/inspect` + `/nex-head-quarters/security` UI + `nex.security_growth_ledger` schema | new tables · new code | ADR-0316a · D.2 |
| **D.3.a** (new · BLOCKED) | Pre-commit hook + CI/CD wiring + secrets scanning + change-reason enforcement + agent identity headers | no substrate | D.3 |
| **D.3.b** (new · BLOCKED) | Design-token registry + UI theme linter + a11y scanner + component-reuse enforcement | JSON registries + linter code | D.3 |
| **D.4** (BLOCKED) | NEX1 delegation integration · Security Agent becomes required gate | agent behaviour change | D.3 · D.3.a |
| **D.4.a** (new · BLOCKED) | Founder review queue + circuit breaker + agent rate limits + emergency-stop API | UI page + kill-switch API | D.4 |
| **D.5** (BLOCKED) | Rogue-page removal (12 flagged in Work Map) | file deletions | founder decision per-page |
| **D.6** (BLOCKED) | `/nex-app` + `/nexapp` reconciliation | separate ADR | founder decision |
| **D.7** (new · BLOCKED) | Cross-capability integration test framework + test-coverage floor + public API stability + deterministic-test requirement + anti-regression on siblings | test config + CI | D.3 · D.3.a |
| **D.8** (new · BLOCKED) | Substrate-drift detector + constitutional-change detector + test-count drift + alert channel | cron worker + alert config | D.3 |
| **D.9** (new · BLOCKED) | CAP-README authoring + auto-CAP-suggest + UNASSIGNED fallback resolution + sidebar-entry capability assignment | docs + registry updates | ADR-0316 §4.2 audit |
| **D.10** (new · BLOCKED) | Strength-delta measurement + retro-benefit tracking + additive-only invariant enforcement | growth ledger schema extension | D.3 |
| **D.11** (new · BLOCKED) | Supply-chain integrity + PII protection + visual regression tests + responsive breakpoint linter + orphan-symbol detection | tooling only | D.3.b · D.7 |

**Preview environment infrastructure** (per §5) is authored across D.3 (basic isolated build) + D.4.a (preview UI + session-scoped access) + D.11 (visual regression testing on preview).

**Activation verification gate** (per §4.1) is authored under D.3 (Security Agent's post-activation check) + D.7 (impact-graph sibling verification) + D.8 (substrate-drift detection).

---

## Section 11 · Safety framing (founder correction #3 · honest)

**Rejected framing** (Master AI's original recommendation): *"NEX cannot be silently harmed."*

**Reason for rejection**: absolute impossibility claims are dishonest. Every system has edge cases · every guardian has coverage gaps · every environment has unknown unknowns.

**Locked framing (founder-authored):**

> *"Strong enforced controls · but never claim absolute impossibility."*

### 11.1 · The four safety guarantees the pattern DOES enforce

1. **Nothing goes live without founder click** — activation is founder-only · always
2. **New sections build in isolation** — preview environment is separate · production untouched during build
3. **Sibling regression detected before activation** — impact-graph tests must pass to unlock Activate Live
4. **Every activation is reversible** — Emergency Revert always visible · flag flip + rollback path

### 11.2 · What this pattern does NOT guarantee

- **Zero-defect activation** — bugs may still ship despite Security Agent · tests · preview
- **Zero-latency revert** — Emergency Revert is fast but not instantaneous · some state may already have been mutated
- **Zero side-effects during preview** — preview environment writes to isolated substrate · but shared services (external APIs · rate-limit budgets · logs) may still be touched
- **Full coverage** — 36 locked doctrines + 46 gap remediation covers the known failure modes · not the unknown

### 11.3 · Founder-visible caveat locked

Every Work Map card MUST display a caveat footer:

> *"Strong enforced controls. Not absolute. Founder retains final approval + Emergency Revert authority always."*

---

## Section 12 · Master Work Map role locked

**Locked principle:**

> *"Every capability has: CAP ID → audit → architecture → implementation → files → database → UI → tests → dependencies → preview → founder approval → live version."*

The Work Map JSON (`docs/nex-work-map.json`) is the canonical answer to *"has NEX done this before?"* Any Master AI or NEX1 investigation begins by consulting the Work Map.

### 12.1 · Enforcement rule locked

Master AI MUST NOT initiate any audit · architecture exercise · implementation · migration · consolidation · crawler work · or UI change without first consulting the Work Map. **No exceptions.**

Security Agent DOC-017 (do-not-repeat register) already enforces this at code-inspection time.

### 12.2 · Work Map maintenance discipline locked

Every capability status transition (DISCOVERED → AUDITED → IMPLEMENTED → ACTIVE) requires:
1. An ADR authorising the transition
2. Updated Work Map entry with new status · new date · new implementation references
3. Growth ledger append (when activation happens)

**Silent status updates are forbidden.**

---

## Section 13 · Nex.evidence collision · explicitly OUT of scope

**Founder-locked scope note:**

> *"The current nex.evidence collision remains a separate unresolved Stage 1b issue. We should not allow the exciting NEX1 autonomy work to accidentally bypass that constitutional work."*

### 13.1 · Locked doctrine

Phase D (Code Autonomy Readiness · this ADR + ADR-0316 + ADR-0316a) is **PARALLEL** to Stage 1b apply. Neither depends on the other. Both remain BLOCKED pending their own founder authorisations:

- **Stage 1b sub-step 1b.2** (apply migration): BLOCKED at `nex.evidence` collision. Founder direction required (options α / β / γ / δ per prior report). Task #161 tracks.
- **Phase D.3** (Security Agent implementation): BLOCKED pending founder authorisation. Task #166 tracks.

**Neither authorisation cascades to the other.** Master AI does not use Phase D excitement to bypass Stage 1b resolution.

### 13.2 · What this ADR does NOT do to Stage 1b

- Does NOT propose a resolution to the nex.evidence collision (that's a separate founder decision)
- Does NOT authorise applying the Stage 1b.1 migration
- Does NOT modify the Stage 1b Wiring bridge (ADR-0314h) or Stage 1b Founder Decisions (ADR-0314i)
- Does NOT resume Stage 1b implementation
- Does NOT interact with Truth Engine · TE-Guardian · rule modules · fixtures · runner (Stage 1a foundation preserved untouched)

---

## Section 14 · Enforcement implications (doctrine · not implemented by this ADR)

- **Every Security Agent implementation ADR (D.3)** must implement the 8-state lifecycle · the activation-gate check · the growth ledger · the founder review queue.
- **Every UI theme linter ADR (D.3.b)** must consume the CLAUDE.md rules · the design-token registry · and enforce them as code-inspection rules.
- **Every preview environment implementation** must satisfy §5.2 requirements (isolated deployment · full stack · immutable artifact · session-scoped · stable · severable · never touches production data).
- **Every card on the Work Map** must render per §7 anatomy with all required fields (Security run ID · build artifact ID · agent identity · gate signatures · Emergency Revert · caveat footer).
- **Every activation** must pass §4.1 gate before entering ACTIVE · logs to growth ledger with signature chain.
- **Every audit ADR** must consult Work Map do-not-repeat register (§12) before being authored.
- **Every capability transition to ACTIVE** must identify actual files · database tables · UI URLs · test files (§8.2). Abstract references fail Security Agent inspection.

---

## Section 15 · What this ADR did NOT do

- ❌ No code authored
- ❌ No migrations authored
- ❌ No substrate mutation (`nex.*` · `nex_test.*` · `nex_lab_*` · Supabase all frozen)
- ❌ No Security Agent code (Phase D.3)
- ❌ No pre-commit hook or CI wiring (D.3.a)
- ❌ No theme linter (D.3.b)
- ❌ No preview environment provisioned
- ❌ No founder review queue built (D.4.a)
- ❌ No circuit breaker / emergency-stop API
- ❌ No growth ledger schema or writes
- ❌ No NEX1 delegation-loop change
- ❌ No Work Map JSON modification
- ❌ No file-capability-map modification
- ❌ No locked-doctrines modification
- ❌ No Stage 1b resumption
- ❌ No nex.evidence collision resolution
- ❌ No Guardian tier renamed · retired · or merged
- ❌ No rogue-page removal
- ❌ No `/nex-app` + `/nexapp` reconciliation
- ❌ No UI theme rules changed
- ❌ No test suite modified
- ❌ No autonomous operation authorised
- ❌ No absolute-impossibility claim locked (replaced with "strong enforced controls" per founder correction #3)
- ❌ No calendar-time activation rule locked (replaced with one-at-a-time verification gate per founder correction #1)
- ❌ No feature-flag-alone preview locked (replaced with build artifact + preview environment per founder correction #2)

---

## Section 16 · Decision provenance footer

| Field | Value |
|---|---|
| **Decision** | Phase D code-autonomy readiness doctrine locked with three founder corrections applied: (1) activation rule is one-at-a-time + verification gate (NOT calendar-time · calendar time is not authority); (2) preview architecture is isolated build artifact + preview environment (NOT feature flag alone · flag is secondary fallback only); (3) safety framing is "strong enforced controls" (NOT absolute impossibility). 46 code-autonomy gaps recorded across 9 categories. 8-state section-build card lifecycle locked. NEX1 scoped-authority principle locked (never unrestricted write key). Work Map established as canonical master inventory · already-audited protection · actual-files-identified requirement. Extended Phase D sub-phases D.3 · D.3.a · D.3.b · D.4 · D.4.a · D.5 · D.6 · D.7 · D.8 · D.9 · D.10 · D.11 · each own founder authorisation. Nex.evidence Stage 1b collision explicitly OUT of scope · runs parallel · neither authorisation cascades. |
| **Decided by** | Philip |
| **Decision date** | 2026-09-11 |
| **ADR** | 0316b · this file · consumed by every future Phase D sub-phase ADR · every capability-transition ADR · every founder review of NEX1 code proposal |
| **Effective from** | `code_autonomy_readiness.v1.0.0` |
| **Supersedes** | Master AI's original workflow proposal (feature-flag-only preview · calendar-time activation · absolute-safety framing all rejected per founder corrections) |
| **Reason** | Founder verbatim (three corrections + scope note): calendar time is not authority · preview must be actual isolated artifact not flagged production · never claim absolute impossibility · nex.evidence stays a separate unresolved Stage 1b concern. |

---

## Section 17 · Cross-references

**Consumed by (future ADRs):**
- Every Phase D sub-phase ADR (D.3 · D.3.a · D.3.b · D.4 · D.4.a · D.7 · D.8 · D.9 · D.10 · D.11)
- Every capability-transition ADR (any capability moving DISCOVERED → AUDITED → IMPLEMENTED → ACTIVE)
- Every NEX1 · NEX2 · NEX3 code proposal
- Every founder activation event
- Every Emergency Revert event
- Every constitutional amendment to Work Map · file-capability-map · locked-doctrines

**Consumes:**
- ADR-0316 HQ Consolidation Target Architecture
- ADR-0316a HQ Security Agent Design (4-way Guardian split)
- ADR-0314f Guardian Responsibility Reconciliation (3-way · extended to 4)
- ADR-0314g Acquisition Fabric target architecture
- ADR-0314h Stage 1b Wiring bridge (parallel · not depended on)
- ADR-0314i Stage 1b Founder Decisions (D-1b-1 · D-1b-7 · §9)
- ADR-0314e Truth Engine Verifier (foundation preserved)
- ADR-0314a.2.s Stage 1a Exit Report (foundation preserved)
- Work Map v1.1 (`docs/nex-work-map.json`)
- File-capability-map v1.0.0 (`docs/nex-file-capability-map.json`)
- Locked-doctrines v1.0.0 (`docs/nex-locked-doctrines.json`)
- Feedback memories: `feedback_calendar_time_is_not_constitutional_authority.md` · `feedback_observation_is_not_constitutional_authority.md` · `feedback_thresholds_are_founder_policy_not_ai_statistics.md` · `feedback_one_canonical_knowledge_substrate.md` · `feedback_guardian_duality_lab_te_r10.md` · `feedback_no_crawler_zoo_acquisition_fabric_target.md`
- CLAUDE.md (UI theme rules · project rules)

**Referenced by future candidate slots:**
- ADR-0316c Preview Environment Design (D.3 sub-doctrine)
- ADR-0316d NEX1 Scoped-Authority Amendment (if founder expands NEX1 scope)
- ADR-0316e Emergency Revert Protocol (D.4.a implementation doctrine)

---

## Section 18 · Master AI STOPS · awaiting founder review

**Master AI does NOT autonomously proceed to Phase D.3 · D.3.a · D.3.b · D.4 · D.4.a · D.5 · D.6 · D.7 · D.8 · D.9 · D.10 · D.11.** Each sub-phase requires separate founder authorisation.

**Master AI does NOT autonomously resume Stage 1b implementation.** The nex.evidence collision awaits separate founder direction (task #161).

**Current position after ADR-0316b:**

- Phase A · Stage 1a · 🟢 COMPLETE
- Phase B · Guardian reconciliation (3-way) · 🟢 LOCKED
- Phase C · Acquisition Fabric · 🟢 LOCKED
- Stage 1b Wiring + Founder Decisions · 🟢 LOCKED · apply halted at nex.evidence collision (task #161)
- Work Map v1.1 · 🟢 ACTIVE
- Phase D.1 · HQ Consolidation Target · 🟢 LOCKED (ADR-0316)
- Phase D.1 · Security Agent Design (4-way) · 🟢 LOCKED (ADR-0316a)
- Phase D.2 · registries authored · 🟢 SHIPPED
- **Phase D.1 · Code-Autonomy Readiness + Section-Build Lifecycle · 🟢 LOCKED (this ADR · ADR-0316b)**
- Phase D.3 · D.3.a · D.3.b · D.4 · D.4.a · D.5 · D.6 · D.7 · D.8 · D.9 · D.10 · D.11 · 🔴 BLOCKED pending own founder authorisation

**Substrate posture:** unchanged · everything frozen · Gate 3 remains OPEN · Stage 1a foundation preserved · Lab-Guardian ledger preserved · specialist tables preserved · nex.evidence collision preserved.

**Founder decision points now open:**

1. Approve ADR-0316b as locked doctrine (this ADR complete)
2. Direct nex.evidence collision resolution (separate track · task #161)
3. Authorise Phase D.3 (Security Agent implementation) as next code-authoring sub-phase
4. Or select any single sub-phase D.3.a · D.3.b · D.4 · D.4.a · D.5 · D.6 · D.7 · D.8 · D.9 · D.10 · D.11 for authoring · Master AI does not choose order

---

**End of ADR-0316b · Code-Autonomy Readiness + Section-Build Lifecycle · doctrine locked · every sub-phase implementation remains BLOCKED pending founder authorisation · nex.evidence collision remains parallel unresolved Stage 1b item.**
