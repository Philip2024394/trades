# Communications Centre · Architecture v1.0

**Status:** frozen · 2026-08-08
**Author of record:** Philip
**Purpose:** the reference every future contribution is measured against. This is not a roadmap. It describes what IS.

**Amendments:**
- **1.0.1 (2026-08-08)** — 11th invariant added (Journey Runtime is deterministic) ahead of Phase 5.1. See `docs/JOURNEY_ENGINE_CHARTER.md` for the accompanying Journey Engine doctrine.
- **1.0.2 (2026-08-08)** — 12th invariant added (Trigger evaluators are pure event readers) ahead of Phase 5.1.2. Charter updated with trigger versioning + canonical `JourneyTriggerEvent` envelope + `schedule` added to the locked trigger-type set.

If a proposed change would violate one of the invariants below, the architecture — not just the implementation — is at risk. Reject the change until the invariant is explicitly re-negotiated in an amendment to this document.

---

## 1 · Subsystem boundaries (immutable)

```
Composer
    ↓
Renderer
    ↓
Campaign Builder
    ↓
Audience Engine
    ↓
Scheduler + Queue
    ↓
Worker
    ↓
Provider Adapter
    ↓
Analytics Events
    ↓
Rollups + Dashboards + Compliance Engine + Alert Rules + Dispatchers
```

Every arrow is a one-way dependency. Reverse dependencies (Renderer knowing about Provider, Scheduler knowing about Composer, etc.) are prohibited.

Ownership map:

| Subsystem | Owns | Never touches |
|---|---|---|
| Composer | `body_blocks` | rendered HTML, recipients, scheduling |
| Renderer | HTML + plain text derivation from blocks | recipients, providers, delivery |
| Campaign Builder | campaign lifecycle + metadata + segment references | contact lists, adapters, dispatch |
| Audience Engine | segment definitions + preview + compliance flags at preview time | delivery, adapters, rendering |
| Scheduler + Queue | job durability, lease, retry, backoff, correlation | provider selection, content, dispatch |
| Worker | pipeline execution (expand → send_batch → finalise) | provider SDKs, rule evaluation, dispatch |
| Provider Adapter | one provider's `send()` + `health()` + `env_hints()` | contacts, compliance, analytics, rules |
| Analytics Events | canonical event stream (`nex.analytics_events`) | contacts, delivery mechanics |
| Rollups | incremental aggregation | events (they are the input), delivery |
| Compliance Engine | contact compliance state | rules, dispatch, delivery mechanics |
| Alert Rules | condition detection on platform snapshot | side effects, delivery |
| Dispatchers | delivering already-evaluated alerts | evaluation, rules, contacts |

---

## 2 · Canonical event model (locked)

Every downstream capability — dashboards, campaign analytics, segment engagement scoring, compliance ratchets, alert conditions — derives from ONE stream: `nex.analytics_events`.

**Ten event types** (locked · new types require an amendment):
```
queued · delivered · deferred · opened · clicked ·
bounced · complaint · unsubscribed · failed · suppressed
```

**Standardised fields on every event:**
- `event_id` UUID
- `event_type` (one of ten)
- `event_timestamp` (when it OCCURRED · may be in the future for simulated engagement)
- `ingested_at` (when the row was inserted)
- `campaign_id · recipient_id · segment_id`
- `provider · country · domain`
- `provider_message_id · user_agent · ip · link_url · latency_ms`
- `metadata` JSONB — provider-native fields preserved for forensics

**Reserved future fields** (populated as NULL today, no schema change required to activate):
- `conversion_value · revenue · attribution_window`
- `journey_id · automation_id · experiment_id · variant_id`

**Ingest path:**
```
POST /api/nex/analytics/ingest
     ↓
INSERT into nex.analytics_events
     ↓
Fan-out UPSERT into 6 rollup tables
     ↓
Hand off to Compliance Engine
```

The same endpoint accepts events from every source: real provider webhooks, the simulator, in-app triggers, back-fills. Ingest logic is identical regardless of source.

---

## 3 · Compliance state machine (locked)

Structured state on `nex.contacts.compliance_state`:

```
                ┌───────────────────────────────────┐
                ↓                                   │
   ┌─────────────────┐                             │
   │     allowed     │                             │
   └────────┬────────┘                             │
            │                                       │
    ┌───────┼───────┐───────┬────────┐              │
    ↓       ↓       ↓       ↓        ↓              │
suppressed suppressed  unsubscribed  complaint  manual_block
   soft      hard                                   │
    │       │        │           │            │    │
    │       │        │           │            │    │
    └───────┴────────┴─── policy-gated reinstate ──┘
    (single-click undo)     (needs confirmed=true + reason)
```

**Locked policy across providers:**

| Canonical event | Action |
|---|---|
| `bounced` (hard) | → `suppressed_hard` immediately |
| `bounced` (soft) | counter++ · at threshold → `suppressed_soft` |
| `complaint` | → `complaint` immediately |
| `unsubscribed` | → `unsubscribed` immediately · sets `unsubscribe_at` |
| `delivered` | reset soft-bounce counter (configurable) |
| admin action | → `manual_block` (only path) |

`classifyBounce()` normalises SES / Mailgun / Postmark / SendGrid provider-native metadata into `hard / soft / unknown` so the policy stays provider-agnostic.

**Reinstate policy:**

| From state | Reinstate | Requires |
|---|---|---|
| `suppressed_soft` · `suppressed_hard` | allowed | reason (≥3 chars) |
| `unsubscribed` · `complaint` · `manual_block` | requires_confirmation | `confirmed: true` + reason (≥3 chars) |
| `allowed` | denied | — |

**Audit:** every state change writes ONE row to `nex.compliance_events` (INSERT-only). Never UPDATE or DELETE.

**Idempotency:** duplicate webhooks (same `provider_message_id` when already in `suppressed_hard`) MUST NOT double-log the state transition. Analytics still records the raw webhook; compliance records only real transitions.

---

## 4 · Alert pipeline (locked)

```
Platform Snapshot        ← one DB round-trip per tick
     ↓
Rule Evaluators          ← 13 pure functions · no I/O
     ↓
Alert instance           ← nex.alerts (unique open per rule)
     ↓
Severity gate            ← NEX_ALERTS_MIN_SEVERITY
     ↓
Dispatchers              ← email · webhook · slack · future
     ↓
nex.alert_dispatches     ← immutable audit row per attempt
```

**Rules are pure.** No I/O. No SDK calls. They read `PlatformSnapshot` + rule `params` and return `{ fires, detail, snapshot }`. This makes them testable, cheap, and safely runnable N times per tick.

**Dispatchers are dumb.** They deliver an already-evaluated `Alert` to a channel. They MAY refuse (`skipped`, honestly recorded) when unconfigured. They MAY fail (`failed`, honestly recorded) on network error. They NEVER re-evaluate rules.

**Lifecycle:** `open → acknowledged → resolved`. A unique index on `(rule_id) WHERE state = 'open'` enforces "one open alert per rule at a time." Dedup means re-firing bumps `trigger_count` + `last_triggered_at` without re-dispatching inside `dedup_window_sec`. Auto-resolve when the condition clears on the next tick.

**Correlation via `incident_id`:** a rule with `root_cause_of` (e.g. `database_unavailable` roots four queue/worker rules) stamps its own `alert_id` on dependents' `incident_id` so the UI groups them.

**13 rules (locked scope):** documented in `src/lib/nex/alerts/catalogue.ts`. Adding rules is allowed; removing/renaming rules is a doctrine amendment.

---

## 5 · Provider adapter contract (locked)

```ts
export interface DeliveryProviderAdapter {
  id: string;
  label: string;
  send(msg: EmailMessage): Promise<ProviderSendResult>;
  isConfigured(): boolean;
  env_hints(): ProviderEnvHint[];
  health?(): Promise<{ ok: boolean; detail?: string }>;
}
```

**Every adapter returns the same normalised result:**

```ts
type ProviderSendResult =
  | { ok: true;  provider_message_id: string; latency_ms: number; provider_metadata?: ... }
  | { ok: false; error: string; retriable: boolean; latency_ms: number;
                 retry_after_ms?: number; provider_metadata?: ... };
```

**Adapter isolation.** Only the file for a given provider may import that provider's SDK or hit that provider's HTTP endpoint. Application code — worker, compliance, analytics, rules, dispatchers — MUST NEVER import a provider directly. Verified by convention (no eslint rule yet; a `no-restricted-imports` config is on the backlog).

**Registered adapters (2026-08-08):**
- `simulator` (default · fast-mode via `NEX_SIMULATOR_FAST_MODE=true`)
- `smtp` (via optional `nodemailer`)
- `ses` (v2 REST + built-in SigV4 · zero SDK deps)
- `sendgrid` (REST v3)
- `mailgun` (REST v3 · EU region supported)
- `postmark` (REST)
- `chaos` (test-only · never selected in production)

**Switching provider = single env var:** `NEX_DELIVERY_PROVIDER=<id>`. Zero code changes required.

**Webhook translation.** Each provider ships an inbound translator (`webhook_translate.ts`) that converts provider-native payload into the canonical 10-type event stream. Analytics never sees provider-specific shapes. Signature verification (`webhook_verify.ts`) rejects unsigned payloads with `401` and honest reasons — never trust unverified webhooks.

---

## 6 · Invariants (violation = architecture at risk)

1. **Events are the single source of truth.** Every dashboard, rollup, compliance ratchet, and alert condition derives from `nex.analytics_events`. No side-channel counters.
2. **Compliance Engine is the sole writer to contact compliance state.** Provider adapters don't touch contacts. Analytics ingest doesn't touch contacts. Anything that needs to change compliance goes through `applyCanonicalEvent()` · `manualSuppress()` · `manualReinstate()`.
3. **Dispatchers never evaluate rules.** They deliver already-evaluated alerts. Adding a new channel MUST NOT require touching any rule.
4. **Adapters never touch anything but their provider.** No contact reads, no analytics writes, no compliance mutation. Everything downstream sees the canonical `ProviderSendResult`.
5. **Campaigns store SEGMENT REFERENCES, never contact lists.** Send-time uses a fresh audience query so unsubscribes/never-contact/new contacts are always current.
6. **Recipient snapshot is IMMUTABLE.** Written once at expansion (`ON CONFLICT DO NOTHING`). New contacts added to segments after expansion do NOT retroactively join.
7. **Audit trails are INSERT-only.** `nex.compliance_events` · `nex.alert_dispatches` · `nex.delivery_job_attempts` · `nex.benchmark_runs` · `nex.recovery_runs` are never UPDATE'd or DELETE'd.
8. **Duplicate webhooks are idempotent at the compliance layer.** Same `provider_message_id` in the same state does not double-log the state transition (analytics still records the raw event for forensics).
9. **Worker leases are TTL'd and reclaimable.** `SELECT ... FOR UPDATE SKIP LOCKED` + `lease_expires_at` means a crashed worker's jobs get picked up by the next live worker without manual intervention.
10. **The Compliance Engine + Alert Engine + Analytics layer + Provider adapter interface + Canonical event schema are frozen at v1.0.** Extending is allowed; modifying is a doctrine amendment requiring Philip's explicit sign-off.
11. **Journey Runtime is deterministic.** Given the same journey definition, immutable recipient snapshot, event history, and current state, it MUST always produce the same emitted commands. (Amendment 1.0.1 · added ahead of Phase 5.1 · full doctrine in `docs/JOURNEY_ENGINE_CHARTER.md`.)
12. **Trigger evaluators are pure event readers.** They never mutate platform state directly; they only materialise journey entries through the existing `entry.ts` path. Every trigger — segment_join, analytics_event, compliance_transition, inactivity, custom_webhook, schedule, and every future trigger type — produces the same `JourneyTriggerEvent` envelope and enters journeys through one controlled, replayable mechanism. (Amendment 1.0.2 · added ahead of Phase 5.1.2 · full doctrine in `docs/JOURNEY_ENGINE_CHARTER.md` §11.)

---

## 7 · What "frozen at v1.0" means

The following interfaces are the platform API. Future work extends them; it does not modify them.

- `EmailMessage` shape (worker → adapter)
- `ProviderSendResult` shape (adapter → worker)
- `AnalyticsEvent` shape (10 types + 21 fields)
- `ContactCompliance` shape (6 states)
- `Alert` shape + lifecycle
- `PlatformSnapshot` shape (rules read this)
- `RuleEvaluator` contract
- Every `DeliveryProviderAdapter` method signature

Adding fields via reserved slots (already declared but NULL) is allowed. Adding new event types, new compliance states, or new rule categories requires an amendment.

---

## 8 · Files that define the platform API

- `src/lib/nex/delivery/types.ts` — provider contract + core delivery shapes
- `src/lib/nex/analytics/types.ts` — canonical event + rollup shapes
- `src/lib/nex/compliance/types.ts` — compliance state + audit shape
- `src/lib/nex/alerts/types.ts` — alert + rule + snapshot shapes
- `src/lib/nex/composer/types.ts` — block model
- `src/lib/nex/campaigns/types.ts` — campaign lifecycle
- `src/lib/nex/segments/types.ts` — audience filter shape

Every one of these is a contract. Changing them is a v1.0 amendment.

---

## 9 · Phase 5 boundary check

Future work (Journeys · A/B · Attribution · Predictive) is expected to be additive:

- **Journeys** — new `nex.journeys` + `nex.journey_steps` + `nex.journey_states` tables. Journey execution ENQUEUES campaign jobs via the existing worker. No changes to the worker, adapter, analytics, compliance, or alert layers.
- **A/B Experiments** — populate the reserved `experiment_id · variant_id` fields on `nex.analytics_events`. New analytics views group by these fields. Zero core changes.
- **Revenue Attribution** — populate reserved `conversion_value · revenue · attribution_window`. New analytics views. Zero core changes.
- **Predictive Intelligence** — new `nex.predictions_*` tables. Reads from `nex.analytics_events` + rollups. Zero core changes.

If any Phase 5 change requires touching the frozen interfaces, that's a red flag — the layering has broken and needs an amendment before proceeding.

---

## 10 · Validation status at v1.0 (2026-08-08)

- **4f.6 Health monitoring** — SystemHealthPanel + `/api/nex/system/health` shipped
- **4f.7 Stress harness** — 13 metrics captured per run · `nex.benchmark_runs` history for regression tracking · first baseline: 50 recipients / 7.5s / p95 220ms in simulator mode
- **4f.8 Recovery suite** — 8/8 automated scenarios PASS · 3 operational drills documented with reproducible steps
- **4f.9 Operational alerts** — 13 rules · lifecycle + dedup + correlation · 3 dispatchers (email/webhook/slack) with immutable audit

**Communications Centre v1.0 is declared complete.** Phase 5 (marketing automation) may begin, subject to the boundary rule in §9.
