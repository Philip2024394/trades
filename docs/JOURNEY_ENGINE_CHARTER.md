# Journey Engine Charter · Phase 5.1

**Status:** frozen · 2026-08-08
**Author of record:** Philip
**Companion to:** `docs/COMMUNICATIONS_CENTRE_ARCHITECTURE_v1.0.md`

This charter sits alongside the v1.0 doctrine. Every rule below applies to every Journey-related contribution from 5.1 onward. Violating any rule means the code cannot be merged — the same standard the ten platform invariants hold every other contribution to.

---

## 1 · Journey Runtime Doctrine

The Journey Runtime has **exactly four responsibilities**:

1. Read the journey definition
2. Read the current journey state
3. Evaluate the next node
4. Emit commands / events

The Journey Runtime **does not**:

- Send messages
- Choose providers
- Write compliance state
- Modify contact records
- Execute campaigns

Everything downstream of "emit command" is done by the existing Communications Centre kernel. The Journey Runtime is a state machine, not a messaging engine.

---

## 2 · Versioned journey definitions

Journey definitions are **immutable once published**. Updates create a new version:

```
Welcome Journey
 ├── v1  (Archived)
 ├── v2  (Active)
 └── v3  (Draft)
```

Rules:

- A contact entering `v2` remains on `v2` until completion — even if `v3` becomes Active mid-flight.
- New entrants use the currently-Active version.
- Analytics groups by `(journey_id, journey_version)` so cohort comparisons stay meaningful.
- Archiving a version does NOT retroactively affect in-flight contacts.

---

## 3 · Immutable execution history

`nex.journey_events` is INSERT-only. Every transition writes a row:

```
JourneyStarted
     ↓
WaitEntered
     ↓
WaitExpired
     ↓
CampaignCommandEmitted
     ↓
CampaignCompleted
     ↓
BranchTaken
     ↓
GoalReached
     ↓
JourneyCompleted
```

Benefits: full replayability · debug tooling · deterministic analytics · audit trail.

---

## 4 · Commands, not actions

The Runtime NEVER thinks in terms of "send an email." It emits **commands** that the existing kernel executes:

```
JourneyRuntime
     ↓
JourneyCommand      ← declarative · never side-effectful
     ↓
Campaign Scheduler  ← already validated in v1.0
     ↓
Existing Workers    ← untouched
```

This preserves every one of the ten v1.0 invariants.

---

## 5 · Future-proof node model

Node types dispatch by type. There is no special-case logic per node type outside the dispatcher.

**MVP (locked six):**
- Start
- Wait
- SendCampaign
- Branch
- Goal
- Stop

**Reserved for later (add via new dispatcher case only):**
- Webhook
- DelayUntilDate
- SplitTest
- Loop
- WebhookTrigger
- AIDecision
- ScoreBranch

Adding a node type requires: (a) new case in the dispatcher, (b) new type in the union, (c) no changes to the runtime shape or existing cases.

---

## 6 · The 11th Invariant · Determinism

Added to the v1.0 doctrine as invariant #11 (see `COMMUNICATIONS_CENTRE_ARCHITECTURE_v1.0.md` §6):

> **Journey Runtime is deterministic. Given the same journey definition, immutable recipient snapshot, event history, and current state, it MUST always produce the same emitted commands.**

Consequences:

- **Easier testing** — one input, one output, no time-of-day flakiness
- **Replay support** — feed the event history into a fresh runtime and reach the same terminal state
- **Debugging** — reproduce a production issue in isolation
- **Future distributed execution** — no coordination needed across worker instances
- **Deterministic analytics** — cohort behaviour is reproducible

Determinism implications for implementation:

- Randomness inside runtime is forbidden. If a node needs a random choice (e.g. A/B split), the random value is drawn once at journey entry, stored on the journey state, and consumed deterministically.
- Time inside runtime is read once per tick from a single source (`NOW()` at tick start) and passed to every evaluator. No `Date.now()` inside a rule.
- Any external lookup (contact fields, segment membership, campaign availability) is captured on the journey state at entry — subsequent evaluations use the captured snapshot, not fresh reads. Fresh reads reintroduce non-determinism.

---

## 7 · Boundary tripwires (enforced in review)

Automated checks + hand review reject the following in `src/lib/nex/journeys/*`:

- `import` from `../delivery/adapters/*`
- `import` `send` / any provider function
- Direct call to `provider.send()`
- Direct write to `nex.contacts.compliance_*`
- Direct write to `nex.compliance_events`
- Direct call to `dispatchAlert()` or any dispatcher
- `Date.now()` or `Math.random()` inside `runtime.ts` (must be injected at tick entry)

Allowed:
- `enqueueJob({ job_type: "campaign.send_batch", ... })` via the existing worker queue
- Read-only calls to `getCampaign`, `getContactCompliance`, `getSegment`
- Writes to `nex.journeys`, `nex.journey_states`, `nex.journey_events` (the Runtime's own store)

---

## 8 · MVP scope for 5.1

- Schema `023_journeys.sql` — `nex.journeys` (definition + versioning), `nex.journey_states` (per-contact position + entered_version + wait_until + random_seed), `nex.journey_events` (immutable audit).
- 6 node types (locked list above).
- Trigger: `contact joins segment` only.
- Runtime `tick()` — deterministic advance for every state whose `wait_until <= now`.
- SendCampaign node emits `enqueueJob({ job_type: "campaign.send_batch", campaign_id, payload: { journey_id, journey_version, node_id, contact_id } })` — the existing worker executes.
- Emitted analytics events populate the reserved `journey_id` (+ new `journey_version` metadata) slot. Zero schema change on `nex.analytics_events`.
- Basic JourneyPanel UI in the Comms Centre — list, activate, pause, archive; view execution history for any contact.

## 9 · Post-5.1 additive layers

Each of these must slot in via new tables + new dispatcher cases + reads from the existing event stream. If any require touching the frozen v1.0 interfaces, work stops and an amendment is filed.

- **5.1.2** additional triggers (purchase · quote created · warranty registered · inactivity · custom events)
- **5.2** A/B testing (SplitTest node · variants routed to campaign variants · reserved `experiment_id · variant_id` slots on events)
- **5.3** Attribution (touchpoint chains from `journey_id` chains on events · reserved `revenue · conversion_value · attribution_window` slots)
- **5.4** Predictive (AIDecision · ScoreBranch nodes · send-time optimisation reads engagement rollups)

## 10 · Ratification

This charter is ratified alongside v1.0 doctrine. Any change to sections 1-6 above is a governance amendment and bumps the platform release version.
