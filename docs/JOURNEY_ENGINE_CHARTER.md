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

---

## 11 · Trigger doctrine (Amendment 1.0.2 · added ahead of Phase 5.1.2)

### 11.1 · Invariant #12

> Trigger evaluators are pure event readers. They never mutate platform state directly; they only materialise journey entries through the existing `entry.ts` path.

Together with Invariant #11 (deterministic runtime), this ensures **every journey starts through one controlled, replayable mechanism**.

### 11.2 · Trigger types (locked list)

Six trigger types. Adding a new type requires a doctrine amendment.

| Type | Fires when | Reads from |
|---|---|---|
| `segment_join`         | contact matches the trigger's segment filter | `nex.contacts` + `nex.contact_segments` |
| `analytics_event`      | contact records a canonical analytics event of the configured type | `nex.analytics_events` |
| `compliance_transition`| contact's compliance_state changes to a matched state | `nex.compliance_events` |
| `inactivity`           | contact has no `opened`/`clicked` event for N days | `nex.analytics_events` (absence) |
| `custom_webhook`       | external system POSTs to the trigger's signed inbound URL | `nex.journey_inbound_events` |
| `schedule`             | recurring cron/local-time schedule elapses | wall clock (single read per tick) |

### 11.3 · Trigger versioning

Each trigger is immutable per version, mirroring journeys:

```
Journey
 ├── Trigger (key: click_trigger)
 │    ├── v1 (Archived)
 │    ├── v2 (Active)
 │    └── v3 (Draft)
```

Rules:
- One Active version per `(journey_id, trigger_key)` at a time — enforced by unique index.
- Editing a trigger creates a new draft version.
- In-flight journey entries created by an older version keep their audit trail intact; new entries use the current Active version.

### 11.4 · Canonical `JourneyTriggerEvent` envelope

Every evaluator produces the same shape. No trigger invents its own payload wrapper.

```ts
type JourneyTriggerEvent = {
  trigger_id:      string;           // which trigger fired
  trigger_type:    TriggerType;      // one of the six
  journey_id:      string;           // target journey
  contact_id:      string;           // resolved contact
  event_time:      string;           // ISO · when the underlying event occurred
  payload:         Record<string, unknown>;   // per-type detail (opaque to runtime)
  correlation_id:  string;           // groups related events (one webhook may fire N triggers)
  causation_id:    string;           // what caused this to fire (analytics_event_id, inbound_event_id, tick_id, ...)
};
```

The dispatcher receives envelopes from every evaluator, de-dups them against the trigger's `dedup_window_sec`, and feeds each surviving envelope into `entry.ts` — the same code path `segment_join` already uses. Analytics, webhooks, purchases, CRM, warranty — every trigger enters through one door.

### 11.5 · Custom webhook debug capture

Every inbound webhook — regardless of whether it passed signature verification — records to `nex.journey_inbound_events` with:

- `verified_signature` boolean
- `signature_algorithm` string (e.g. `hmac-sha256`, `basic-auth`, `sigv4`)
- `request_headers` JSONB (redacted: no `authorization` or `cookie` values)
- `raw_body_hash` SHA-256 of the raw request body

That row is the single source of truth for support investigations of any customer integration.

### 11.6 · What triggers MAY NOT do

- Write to `nex.contacts` (compliance, consent, or any field)
- Write to `nex.compliance_events`
- Call any provider adapter directly
- Call `dispatchAlert()` or any alert dispatcher
- Emit `enqueueJob()` for delivery — that's the Runtime's job after journey entry
- Access `Math.random()` or `Date.now()` inside `evaluate()` (time is injected per tick; randomness comes from the deterministic seed in `entry.ts`)

Allowed reads: `nex.analytics_events`, `nex.compliance_events`, `nex.contacts` (read-only), `nex.contact_segments`, `nex.journey_inbound_events`.
Allowed write: `nex.journey_states` **only via** `entry.ts::insertJourneyState()` — never a direct INSERT.

---

## 12 · Experiment doctrine (Amendment 1.0.3 · ahead of Phase 5.2)

### 12.1 · Invariant #13

> Experiment assignment is sticky and deterministic. A contact receives exactly one variant assignment per experiment, and that assignment is reproducible from the immutable experiment/contact inputs.

### 12.2 · Assignment (locked)

```
variant_id = walkAllocation(
  variants,
  fnv1a(experiment_id + ":" + contact_id + ":" + seed) mod 10000
)
```

- Seed is generated at experiment creation and stored on the experiment row (immutable).
- Computed once on first evaluation → persisted to `nex.experiment_assignments` with `UNIQUE(experiment_id, contact_id)`.
- Every subsequent visit reads the persisted assignment — never recomputes. Duplicate ticks cannot reassign.
- Replay across environments produces the same variant.

### 12.3 · What A/B Testing MAY do

- Read analytics events to compute per-variant conversion
- Read/write its own tables (`nex.experiments` · `nex.experiment_variants` · `nex.experiment_assignments`)
- Emit `experiment_id` + `variant_id` metadata via the existing journey command payload → worker → ingest path (populates RESERVED slots on `nex.analytics_events`)

### 12.4 · What A/B Testing MAY NOT do

- Write to `nex.contacts` or any compliance table
- Call any provider adapter directly
- Call any dispatcher (email/webhook/slack)
- Modify `nex.campaigns` or `nex.campaign_recipients`
- Auto-choose a winner or rewrite the journey (that belongs to 5.4 Predictive)
- Recompute an existing assignment (invariant #13)

### 12.5 · Experiment node (added to locked node list · 8th type)

- `experiment` — reads or creates the sticky assignment for the contact, then routes to the variant's `target_node_id`. No side effects on delivery/compliance. Writes an `active_experiments[]` entry to the journey state's `snapshot` so downstream Send nodes can propagate metadata.

### 12.6 · Analytics propagation

Downstream `send_campaign` / `send_campaign_and_wait` nodes include `experiment_id` + `variant_id` in the command payload. The existing worker forwards them to `ingestEvent()` which populates the RESERVED `experiment_id` + `variant_id` fields on `nex.analytics_events`. Zero changes to the frozen analytics schema.

