# Trade Operating System · Volume 1 · Part 4
## Event Bus Architecture v2.0

**Audience:** Senior Platform Engineers, Distributed Systems Engineers, AI Runtime Engineers
**Source:** ChatGPT design-brief architecture series, Part 4 of 5.

---

## Philosophy

The Event Bus is the **central nervous system** of the Trade OS.

The biggest mistake many systems make is allowing one module to directly call another. Once Vehicle depends on Website depends on Print, everything depends on everything and the system becomes impossible to maintain.

### Event Driven Architecture

Everything communicates through Events:

```
               Brand Updated
                     ↓
               Event Bus (NATS)
                     ↓
 ┌──────────┬──────────┬────────────┬────────────┐
 ▼          ▼          ▼            ▼
Vehicle   Website    Print      Marketing
Studio    Studio     Studio      Studio
 ▼          ▼          ▼            ▼
Generate   Generate   Generate    Generate
```

**Nobody knows the others exist.**

---

## Core Principles

1. **No Studio ever calls another Studio.**
2. **Everything is asynchronous.**
3. **Events are immutable.** Never edit. Never delete.
4. **Events are facts, not commands.** `BrandUpdated` (good). `UpdateVehicle()` (bad). Events describe what happened, not what should happen.

---

## Event Categories

Six domains:

### Brand Events
`BrandCreated · BrandUpdated · BrandPublished · BrandRolledBack · BrandArchived`

### Identity Events
`LogoChanged · ColourChanged · TypographyChanged · ToneChanged · PositioningChanged`

### Asset Events
`AssetRequested · AssetGenerating · AssetGenerated · AssetApproved · AssetRejected · AssetPublished`

### Memory Events
`MemoryUpdated · PreferenceLearned · PreferenceRejected · ConfidenceUpdated`

### Export Events
`ExportStarted · ExportCompleted · ExportFailed`

### System Events
`StudioInstalled · StudioRemoved · AIModelChanged · CompilerUpdated`

---

## Event Envelope

Every event shares exactly the same structure:

```ts
export interface EventEnvelope<T> {
  id:               string;
  type:             string;
  timestamp:        string;
  version:          number;
  merchantId:       string;
  organisationId:   string;
  brandVersion:     string;
  correlationId:    string;
  causationId:      string;
  producer:         string;
  payload:          T;
}
```

Every event is traceable.

### Example

Merchant changes Primary Colour Gold → Navy. Published event:

```json
{
  "id": "evt_90341",
  "type": "Brand.ColourChanged",
  "timestamp": "2026-07-22T08:42:11Z",
  "brandVersion": "2.3",
  "producer": "BrandService",
  "payload": {
    "field": "primary",
    "old": "#FFD400",
    "new": "#001F54"
  }
}
```

No Studio receives API calls. They receive this envelope.

---

## Event Topics

Split into topic streams:

`brand.* · asset.* · memory.* · export.* · generation.* · system.*`

Much faster than one queue.

---

## Subscriber Registration

```ts
export interface EventSubscriber {
  event:       string;
  priority:    number;
  handler:     string;
  retry:       boolean;
  deadLetter:  boolean;
}
```

### Example

Vehicle Studio subscription:
```ts
{ event: "Brand.ColourChanged", priority: 1, handler: "GeneratePreview", retry: true, deadLetter: true }
```

Website Studio subscription:
```ts
{ event: "Brand.ColourChanged", priority: 2, handler: "UpdateTheme" }
```

On startup: Load Manifest → Register Events → Subscribe → Ready. No manual wiring.

---

## Ordering Guarantees

Some events must remain ordered:

```
BrandCreated
     ↓
LogoChanged
     ↓
BrandPublished
```

Wrong order would break regeneration.

**Ordering guarantee: per merchant, per brand. Never global.** Merchant A's events can run simultaneously with Merchant B's events.

---

## Retry Policy

Never lose events. Failures happen.

Recommended: 3 retries with backoff 5s → 30s → 2min → Dead Letter Queue.

### Dead Letter Queue

If something keeps failing:
```
BrandUpdated → Vehicle Studio → Crash → Dead Letter Queue
```

Operations dashboard shows: Merchant, Brand Version, Studio, Reason. Human clicks Retry.

---

## Event Storage

Every event stored forever. Append-only table:

```
events
- id
- type
- payload
- merchant_id
- organisation_id
- brand_version
- created_at
- processed
```

Never update. Append only.

---

## Event Replay — huge feature

Website bug fixed. Replay `BrandUpdated` → Website Studio → Regenerate. No regeneration from scratch.

---

## Event Versioning

Never break subscribers. `BrandUpdated v1 → BrandUpdated v2`. Subscriber chooses supported version.

---

## Priority

- **Priority 1** — `BrandPublished · LogoChanged · BrandRolledBack`
- **Priority 2** — `AssetGenerated · MemoryUpdated`
- **Priority 3** — Analytics · Notifications · Recommendations

---

## Correlation IDs

Merchant changes logo → 18 assets regenerate. Without IDs, impossible to debug.

Everything shares Correlation ID `brand_239483`. Logs show one request touching Logo → Vehicle → Website → Marketing → Print → Export.

---

## TypeScript Interfaces

```ts
export interface EventBus {
  publish<T>(event: EventEnvelope<T>): Promise<void>;
  subscribe<T>(event: string, handler: EventHandler<T>): Promise<void>;
  unsubscribe(event: string, handlerId: string): Promise<void>;
  replay(stream: string, from: Date, to?: Date): Promise<void>;
}

export interface EventHandler<T> {
  name: string;
  handle(event: EventEnvelope<T>): Promise<void>;
}

export interface EventRegistry {
  register(subscriber: EventSubscriber): Promise<void>;
  remove(subscriberId: string): Promise<void>;
  list(): EventSubscriber[];
}
```

---

## Processing Pipeline

```
Publish Event
       ↓
Validation
       ↓
Persist Event
       ↓
Message Broker
       ↓
Subscriber Queue
       ↓
Handler
       ↓
Success? ── Yes ──▶ Complete
     │
    No
     │
     ▼
Retry Policy
     │
     ▼
Dead Letter Queue
```

---

## Recommended Technology Stack

| Layer | Recommendation |
|-|-|
| Event Broker | NATS JetStream (primary) |
| Enterprise alternative | Apache Kafka |
| Workflow Engine | Temporal |
| Queue | BullMQ (Redis) |
| Event Store | PostgreSQL (append-only) |
| Cache | Redis |
| Monitoring | OpenTelemetry + Grafana |
| Logs | Loki or Elasticsearch |
| Tracing | Jaeger |

**Why NATS JetStream** for this platform (hundreds of thousands of merchants, many small AI jobs):
- Very low latency
- Simple pub/sub semantics
- Durable streams
- Message replay
- Horizontal scalability
- Easier operational overhead than Kafka for this workload

---

## Full Event Flow Example

Merchant changes Primary Colour Gold → Navy:

```
Brand.ColourChanged
        ↓
Event Bus
        ├── Vehicle Studio    → Generate Preview
        ├── Website Studio    → Update Theme Tokens
        ├── Print Studio      → Queue Regeneration
        ├── Marketing Studio  → Refresh Templates
        ├── Brand Vault       → Show "18 assets affected"
        └── Analytics         → Record Change
```

None of these subscribers know about each other. They only react to the published fact.

---

## Final Architecture Rule

The Event Bus is the **backbone of the Trade Operating System**, not a messaging utility.

Every meaningful state change becomes an immutable event. Every Studio is an independent subscriber. This gives you loose coupling, replayability, audit history, parallel execution, resilience, and the ability to add entirely new Studios without changing existing code. That property is what allows the platform to scale cleanly from a handful of capabilities to dozens of interconnected Studios.

---

## Networkers-specific implementation notes

- **NATS JetStream is a new infrastructure dep.** Not present today. Recommend deferring until we have 2+ Studios that need to cross-talk. First cut: in-process event bus in Node (a simple typed emitter with async handlers) written to a Postgres `hammerex_events` append-only table. Same interface, cheaper start.
- **Event store table** `hammerex_events` — new migration. Schema per the spec. Add when Part 5 arrives + we build the runtime.
- **Correlation IDs** — inject at every API entry point via middleware. Existing pattern from beacon/notify already uses UUID request IDs; extend.
- **Ordering per (merchant, brand)** — Postgres FIFO by `(merchant_id, brand_id, created_at)` for the interim in-process bus. When we migrate to NATS, use subject-partitioning by merchant.
- **Retry + DLQ** — build the `hammerex_events_dead_letter` table alongside the main events table. Admin surface at `/admin/events/dead-letter` for manual retry.
- **Event versioning** — every event type name carries `.v1` / `.v2` suffix (`Brand.ColourChanged.v1`). Subscribers declare which versions they handle.
