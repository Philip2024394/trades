# ES-03 · Nex API & Service Architecture v1.0

**API contract specification · 2026-07-23**
**Purpose:** the definitive interface layer for Nex. Every API endpoint, every event contract, every internal call is specified here. Backend engineers implement directly from this document.

**Related:** ES-01 (engineering decisions) · ES-02 (data model + event catalog) · Master Architecture (product roadmap).

**Critical framing from ES-01:** we build a **modular monolith with strict internal boundaries**, NOT a microservices architecture. "Service" in this document means "module with a public interface." Extraction to separate deployments happens later, when scale data demands it. Everything below is designed to make that extraction possible without pain.

---

## Section 1 — Service Boundaries

### 1.1 Module inventory (services-in-waiting)

Every merchant capability lives under `src/lib/nex/<module>/`. Each module has:

- A public barrel `index.ts` exporting its interface
- Internal files that other modules never import from
- Its own tests co-located
- Its own documentation

Cross-module imports use only barrel-exported symbols. ESLint enforces this via `no-restricted-imports`.

### 1.2 Module list (mapped to Section 5's API endpoints)

| Module           | Path                              | Public surface                                                    |
| ---------------- | --------------------------------- | ----------------------------------------------------------------- |
| auth             | (Supabase Auth)                   | user session · JWT                                                |
| tenancy          | `src/lib/tenancy/`                | merchant identity · team RBAC · settings                          |
| projects         | `src/lib/nex/pi/`                 | project CRUD · project members                                     |
| crm              | `src/lib/nex/cx/`                 | customer CRUD · payment behaviour · reviews                        |
| studio           | (existing)                        | tradesite editor · manifest emission                                |
| sitebook         | (existing)                        | site logs · photos · snags · deliveries                             |
| estimator        | `src/lib/nex/estimator/`          | estimate pipeline · quote versioning                                |
| memory           | `src/lib/nex/memory/`             | write · read · correction · rollup                                  |
| brains           | `src/lib/nex/brains/`             | Trade Brain load · consult · correction                             |
| marketplace      | `src/lib/nex/mp/`                 | listing search · supplier ranking                                   |
| trade-centre     | (existing)                        | product catalogue · orders                                          |
| finance          | `src/lib/nex/fi/`                 | invoices · payments · costs · VAT                                   |
| scheduling       | (existing)                        | job diary · resource allocation                                     |
| notifications    | `src/lib/nex/notify/`             | notification send · delivery tracking                               |
| media            | `src/lib/nex/media/`              | asset upload · variants · signed URLs                               |
| knowledge-graph  | `src/lib/nex/bos/graph.ts`        | node/edge query · adjacency traversal                               |
| twin-live        | `src/lib/nex/twin-live/`          | event append · timeline · perspective · handover                    |
| business-intel   | `src/lib/nex/bi/`                 | business KPI dashboards                                             |
| market-intel     | `src/lib/nex/market/`             | signal query · forecast · reports                                   |
| workforce        | `src/lib/nex/workforce/`          | agent lifecycle · approval inbox · standing brief                   |
| workforce-econ   | `src/lib/nex/employment/`         | employment centre · hire conversation · profiles                    |
| business-builder | `src/lib/nex/builder/`            | onboarding conversation · business generation                       |
| analytics        | `src/lib/nex/analytics/`          | metric events · rollups                                             |
| monitoring       | (external — Sentry + Vercel)      | error + performance telemetry                                       |
| background       | (Vercel functions + pg_cron)      | queue processing · scheduled work                                   |

Every module has scaling isolation: if any module's load pattern diverges 10× from the rest, it becomes an extraction candidate.

### 1.3 Cross-module contract rules

- Types (T) freely imported anywhere
- Pure functions (F) freely called anywhere
- Async operations (A) called only via barrel
- Cross-module database access forbidden — every module's tables are queried through its module
- Cross-module event subscription uses the platform event bus (Section 4)

---

## Section 2 — REST API Standards

### 2.1 Canonical response shape

Every merchant-facing REST endpoint returns:

```typescript
type ApiResponse<T> = {
  ok:        boolean;
  data?:     T;
  evidence?: { source: string; tables: string[]; computed_at: string };
  errors?:   ApiError[];
  meta?:     { pagination?, cache_hit?, request_id, warnings? };
};

type ApiError = {
  code:     string;          // "validation_failed" | "not_found" | ...
  message:  string;          // human-readable
  field?:   string;          // for validation errors
  detail?:  Record<string, unknown>;
};
```

### 2.2 HTTP methods

- `GET` — read, safe, idempotent, cacheable
- `POST` — create, mutation
- `PUT` — replace entire resource
- `PATCH` — partial update
- `DELETE` — soft-delete (populates `deleted_at`)

### 2.3 URL structure

- `/api/nex/<module>/<resource>` — canonical resource endpoints
- `/api/nex/<module>/<resource>/<id>` — specific resource
- `/api/nex/<module>/<resource>/<id>/<action>` — resource actions
- `/api/v<N>/nex/...` — versioned (introduced at first breaking change)

### 2.4 Status codes

- `200` — success with data
- `201` — created
- `202` — accepted (async work started)
- `204` — success no content (delete)
- `400` — validation failed
- `401` — not authenticated
- `403` — not authorised
- `404` — not found
- `409` — conflict (version mismatch, duplicate)
- `422` — semantic validation failure
- `429` — rate limited
- `500` — server error (never leaks stack traces)
- `503` — service unavailable (upstream dependency down)

### 2.5 Request headers

- `Authorization: Bearer <jwt>` — required for authenticated endpoints
- `X-Merchant-Scope: <slug>` — required when user has multiple merchant memberships
- `X-Idempotency-Key: <uuid>` — required for POST/PUT/PATCH on financial endpoints
- `X-Request-ID: <uuid>` — client-provided or server-generated; echoed in response

### 2.6 Response headers

- `X-Request-ID` — echo or generated
- `X-RateLimit-Limit` · `X-RateLimit-Remaining` · `X-RateLimit-Reset`
- `Cache-Control` — per-endpoint
- `ETag` — for cacheable resources

### 2.7 Pagination

Cursor-based (default). Offset-based supported for admin surfaces only.

```
GET /api/nex/projects?cursor=<opaque>&limit=25
```

Response:

```json
{
  "ok": true,
  "data": { "items": [...], "next_cursor": "<opaque>", "has_more": true },
  "meta": { "pagination": { "returned": 25, "limit": 25 } }
}
```

Default limit 25, max 100.

### 2.8 Filtering + sorting

Query parameter conventions:

- `filter[<field>]=<value>` — field equality
- `filter[<field>][gt]=<value>` — comparison operators (gt, gte, lt, lte, in, contains)
- `sort=<field>` or `sort=-<field>` for desc
- Multiple sort fields comma-separated

### 2.9 Field selection

`fields=id,name,status` for sparse fieldsets. Defaults to canonical set per resource.

### 2.10 Rate limiting

Per merchant per endpoint class:

| Tier         | Standard reads | Chat reqs/min | Estimator gen /day | Media uploads/day |
| ------------ | -------------- | ------------- | ------------------ | ----------------- |
| Free         | 60/min         | 20            | 3                  | 50                |
| Starter      | 300/min        | 60            | 20                 | 200               |
| Professional | 600/min        | 120           | unlimited          | 500               |
| Business     | 1200/min       | 300           | unlimited          | 1000              |
| Works        | 3000/min       | 600           | unlimited          | unlimited         |

Rate limit responses return `Retry-After` header.

### 2.11 Idempotency

- Every POST/PUT/PATCH that costs money OR sends external comm requires `X-Idempotency-Key`
- Key deduplication window: 24 hours
- Duplicate requests return original response with `Idempotency-Replay: true` header

### 2.12 Error handling

Errors follow ApiError shape. Common codes:

- `validation_failed` (400) — field-level details
- `not_authenticated` (401)
- `not_authorised` (403) — includes what permission would be needed
- `resource_not_found` (404)
- `version_conflict` (409) — optimistic concurrency; includes current version
- `rate_limited` (429) — with retry-after
- `upstream_unavailable` (503) — with which upstream

Errors never leak internal detail (stack traces, SQL, secrets). Full detail logged with request_id.

---

## Section 3 — Realtime APIs

### 3.1 Delivery mechanism

Supabase Realtime channels. Client subscribes; server pushes.

### 3.2 Channel naming

- `merchant:<slug>` — merchant-wide events
- `approval_inbox:<slug>` — new approvals
- `workforce:<slug>` — agent status
- `twin:<project_id>` — project Twin timeline
- `chat:<session_id>` — chat streaming responses

### 3.3 Message shape

```typescript
{
  kind:         string;      // event kind matching platform events
  merchant_slug: string;
  payload:      unknown;
  observed_at:  string;
}
```

### 3.4 Subscription authorisation

- RLS policies on Supabase Realtime channels
- Client presents JWT on subscribe
- Cross-tenant subscription attempts silently blocked (server-side)

### 3.5 Streaming responses (chat)

Server-Sent Events (SSE) via `/api/nex/chat` with `Accept: text/event-stream`.

Event format:

```
event: token
data: {"content": "chunk"}

event: evidence
data: {"source": "memory", "tables": ["hammerex_nex_memory_company"]}

event: done
data: {"total_tokens": 1234}
```

### 3.6 Reconnect strategy

- Client reconnects with `last_event_id` header
- Server replays events since that ID from `hammerex_nex_platform_events`
- Max replay window: 24 hours

---

## Section 4 — Event Contracts

Per ES-02 Section 4. Contract per event kind is versioned.

### 4.1 Contract shape

```typescript
type EventContract<K extends string, Payload> = {
  kind: K;
  version: number;
  payload_schema: ZodSchema<Payload>;
  publisher_module: string;
  subscriber_modules: string[];
  delivery: "notify" | "queue";
  priority: "urgent" | "normal";
  retention_days: number;
};
```

### 4.2 Contract registry

Every event kind's contract lives in `src/lib/nex/events/contracts/<kind>.ts`. On boot:

- All contracts validated for uniqueness
- Every publisher's emit signature must match its contract
- Every subscriber's handler type-checked against the contract's payload_schema

### 4.3 Versioning + migration

- Additive-only schema changes: version increment optional
- Breaking changes: new contract with incremented version; publishers emit both during transition; subscribers migrate; old version deprecated after 90 days

---

## Section 5 — Endpoint Specifications

For every major endpoint category, high-level spec. Full OpenAPI in `openapi/` folder (generated).

### 5.1 Authentication

Managed by Supabase Auth. Additional Nex endpoints:

- `POST /api/nex/auth/switch-merchant` — switch active merchant (for users with multiple memberships)
- `GET /api/nex/auth/me` — current user + active merchant + capabilities

### 5.2 Users

- `GET /api/nex/users/me` — current user profile
- `PATCH /api/nex/users/me` — update profile
- `GET /api/nex/users/me/teams` — list team memberships

### 5.3 Merchants + tenancy

- `POST /api/nex/merchants` — register new merchant (called by Business Builder)
- `GET /api/nex/merchants/<slug>` — merchant public profile
- `PATCH /api/nex/merchants/<slug>` — update merchant settings (Owner+ only)
- `GET /api/nex/merchants/<slug>/members` — list team
- `POST /api/nex/merchants/<slug>/members` — invite team member
- `PATCH /api/nex/merchants/<slug>/members/<id>` — change role
- `DELETE /api/nex/merchants/<slug>/members/<id>` — remove

### 5.4 Projects

- `POST /api/nex/projects` — create project
- `GET /api/nex/projects` — list (paginated, filterable)
- `GET /api/nex/projects/<id>` — project detail with phases
- `PATCH /api/nex/projects/<id>` — update
- `DELETE /api/nex/projects/<id>` — soft delete
- `POST /api/nex/projects/<id>/phase-transition` — record phase change
- `GET /api/nex/projects/<id>/timeline` — chronological event feed

### 5.5 CRM (customers)

- `POST /api/nex/customers` — create customer
- `GET /api/nex/customers/<id>` — detail
- `GET /api/nex/customers/<id>/payment-history` — payment behaviour
- `GET /api/nex/customers/<id>/reviews` — reviews
- `POST /api/nex/customers/<id>/notes` — add merchant note

### 5.6 SiteBook

- `POST /api/nex/sitebook/<project_id>/entries` — daily log entry
- `POST /api/nex/sitebook/<project_id>/photos` — photo upload (multipart)
- `POST /api/nex/sitebook/<project_id>/snags` — open snag
- `PATCH /api/nex/sitebook/<project_id>/snags/<id>` — update snag
- `POST /api/nex/sitebook/<project_id>/deliveries` — record delivery
- `POST /api/nex/sitebook/<project_id>/sign-off` — record sign-off

### 5.7 Estimator

- `POST /api/nex/estimator/sessions` — start estimator session (multi-input)
- `POST /api/nex/estimator/sessions/<id>/inputs` — add photo/brief/plan
- `POST /api/nex/estimator/sessions/<id>/generate` — trigger generation (async)
- `GET /api/nex/estimator/sessions/<id>/status` — poll (or subscribe realtime)
- `GET /api/nex/estimator/sessions/<id>/estimate` — final estimate
- `POST /api/nex/estimator/sessions/<id>/approve` — approve to send
- `POST /api/nex/estimator/sessions/<id>/send-to-customer` — send interactive proposal

### 5.8 Memory

- `POST /api/nex/memory` — write a memory row (adapters + direct)
- `GET /api/nex/memory` — query with subject/subject_like/filters
- `POST /api/nex/memory/<id>/correction` — append a correction
- `GET /api/nex/memory/rollup` — regional benchmark reads (K-gated)
- `POST /api/nex/memory/opt-out` — merchant opts out of cross-tenant contribution
- `GET /api/nex/memory/transparency` — "your data helped" history

### 5.9 Trade Brains

- `GET /api/nex/brains` — list available Brains for merchant
- `GET /api/nex/brains/<slug>` — Brain detail + module status
- `POST /api/nex/brains/<slug>/consult` — direct consultation (bypass mesh)
- `POST /api/nex/brains/<slug>/correction` — merchant correction to Brain's advice

### 5.10 Marketplace + Trade Centre

- `GET /api/nex/marketplace/search` — search listings
- `POST /api/nex/marketplace/listings` — create listing
- `GET /api/nex/trade-centre/products` — product catalogue
- `POST /api/nex/trade-centre/orders` — place order
- `GET /api/nex/trade-centre/orders/<id>` — order status

### 5.11 Finance

- `POST /api/nex/finance/invoices` — issue invoice
- `GET /api/nex/finance/invoices` — list (filterable by status, customer)
- `POST /api/nex/finance/payments` — record received payment
- `GET /api/nex/finance/vat/window` — current VAT window
- `POST /api/nex/finance/vat/return` — generate return draft

### 5.12 Digital Twin

- `POST /api/nex/twin/<project_id>/events` — append event
- `GET /api/nex/twin/<project_id>/timeline` — chronological timeline
- `GET /api/nex/twin/<project_id>/state` — current state
- `GET /api/nex/twin/<project_id>/state?at=<iso>` — state at time (time travel)
- `GET /api/nex/twin/<project_id>/perspective/<brain_slug>` — Brain-scoped view
- `POST /api/nex/twin/<project_id>/handover` — generate handover pack

### 5.13 Workforce

- `GET /api/nex/workforce/employees` — list hired agents
- `GET /api/nex/workforce/employees/<id>/profile` — agent profile
- `GET /api/nex/workforce/tasks` — task queue view
- `GET /api/nex/workforce/approvals` — approval inbox
- `POST /api/nex/workforce/approvals/<id>/approve`
- `POST /api/nex/workforce/approvals/<id>/reject`
- `POST /api/nex/workforce/emergency-stop` — halt all agent activity
- `POST /api/nex/workforce/resume` — resume after emergency stop
- `GET /api/nex/workforce/audit-log` — filterable audit view

### 5.14 Employment Centre (Workforce Economy)

- `GET /api/nex/employment/candidates` — browsable list
- `GET /api/nex/employment/candidates/<slug>` — candidate profile
- `POST /api/nex/employment/hires` — initiate hire (starts conversation)
- `POST /api/nex/employment/hires/<id>/messages` — hire conversation continuation
- `POST /api/nex/employment/hires/<id>/complete` — finalise hire
- `POST /api/nex/employment/employees/<id>/promote` — accept promotion
- `POST /api/nex/employment/employees/<id>/retire` — retire employee

### 5.15 Market Intelligence

- `GET /api/nex/market/dashboard/<region>` — regional dashboard
- `GET /api/nex/market/forecasts` — forecast list
- `POST /api/nex/market/advisor/query` — AI Market Advisor Q&A
- `GET /api/nex/market/opportunities` — opportunity feed
- `GET /api/nex/market/reports/regional/<region>` — monthly PDF (paid)

### 5.16 Business Builder

- `POST /api/nex/builder/sessions` — start onboarding conversation
- `POST /api/nex/builder/sessions/<id>/answer` — step response
- `GET /api/nex/builder/sessions/<id>/preview` — draft business preview
- `POST /api/nex/builder/sessions/<id>/publish` — go live

### 5.17 Studio

- Studio endpoints already exist in shipped codebase. Documented separately in Studio-specific reference.

### 5.18 Media

- `POST /api/nex/media/upload` — multipart upload (returns asset_id + variants URLs)
- `GET /api/nex/media/<id>` — signed URL for retrieval
- `DELETE /api/nex/media/<id>` — soft delete

### 5.19 Notifications

- `GET /api/nex/notifications` — list for current user
- `POST /api/nex/notifications/<id>/read` — mark read
- `PATCH /api/nex/notifications/preferences` — update channel preferences

### 5.20 Analytics

- Internal endpoints only. Not merchant-facing except aggregated dashboards.

---

## Section 6 — Webhooks

### 6.1 Outbound webhooks (merchant-configurable)

Merchants can register webhooks to receive Nex events at their own URLs.

- `POST /api/nex/webhooks` — register
- `GET /api/nex/webhooks` — list
- `DELETE /api/nex/webhooks/<id>` — remove
- `POST /api/nex/webhooks/<id>/test` — send test event

Webhook delivery:

- Signed with HMAC-SHA256 using merchant-specific webhook secret
- Retry policy: 3 attempts with exponential backoff
- Dead-letter after 3 failures; merchant notified
- Delivery attempts logged; queryable

### 6.2 Inbound webhooks

- `POST /api/nex/webhooks/stripe` — Stripe payment events
- `POST /api/nex/webhooks/companies-house` — registration change notifications (if we register for them)

Each verifies signature; requires idempotency-key.

---

## Section 7 — Internal Service Communication

Rejected in ES-01: RPC frameworks, message brokers. Adopted: direct function calls in-process.

### 7.1 In-process patterns

- **Sync read** — direct function call: `const est = await estimator.buildEstimate({...})`
- **Sync side-effect** — direct function call with typed inputs + typed outputs
- **Async fire-and-forget** — emit event via `platform.emit(kind, payload)`
- **Async durable work** — enqueue task via `queue.enqueue(taskDef, payload)`

### 7.2 Contract stability

- Every public function has typed inputs + typed outputs (TypeScript)
- Every public function has a JSDoc comment describing its contract
- Breaking changes to signatures require a major version bump of the module (semver internal)

### 7.3 Preparing for future extraction

When a module needs extraction:

1. Public function calls become HTTP/RPC calls (adapter pattern)
2. Types remain unchanged
3. Emit becomes remote event bus publish
4. Enqueue becomes remote queue enqueue

Because every module exposes only its barrel, refactor cost is contained.

---

## Section 8 — Authentication

### 8.1 Managed by Supabase Auth

- Email + password
- Magic link
- OAuth (Google, Microsoft, Apple)
- SMS OTP for 2FA
- Session tokens (JWT)

### 8.2 Multi-merchant users

Users can belong to multiple merchants. Every request includes active merchant scope via `X-Merchant-Scope` header OR selected server-side from session.

### 8.3 API tokens (server-to-server)

For merchants integrating with Nex from their own systems:

- Personal Access Tokens (PATs) — scoped to a specific merchant + limited permissions
- Token creation via Studio Settings
- 90-day rotation policy enforced

---

## Section 9 — Authorization (RBAC)

### 9.1 Roles

Per ES-01 §8.2:

- Owner · Admin · Manager (department-scoped) · Member (task-scoped) · Auditor (read-only)

### 9.2 Permission format

```
<module>:<action>:<scope>
```

Examples:

- `finance:invoice:write` — can create/edit invoices
- `finance:invoice:read` — can view invoices
- `workforce:agent:hire` — can hire AI employees
- `workforce:agent:emergency-stop` — can trigger emergency halt

### 9.3 Permission checks

- Every API endpoint declares required permissions in a decorator/middleware
- Missing permission = 403
- Server-side check is authoritative; UI hides unavailable actions

### 9.4 Scope constraints

- Per-department managers see only their department's data
- Auditors see everything read-only, no writes

---

## Section 10 — API Versioning

### 10.1 Path-based major versions

- `/api/v1/nex/...` — first breaking change introduces v1 alongside default (unversioned) route
- Unversioned route is the current stable version

### 10.2 Header-based minor versions

- `X-API-Version: 1.2` — request-specific behaviour

### 10.3 Deprecation policy

- Deprecation announced 6 months before removal
- Response includes `Deprecation: <date>` header + `Link: <migration-doc>; rel="migration"`
- 12-month minimum support after deprecation notice for paid tier customers
- Free-tier merchants get 6 months

### 10.4 Version negotiation

- Client absent version header → server chooses latest stable
- Client requested unsupported version → 400 with details

---

## Section 11 — Retry + Idempotency

### 11.1 Client-side retry

Clients retry:

- 5xx errors (immediate then exponential backoff)
- 429 with `Retry-After` header
- Network errors

Clients do NOT retry:

- 4xx (client errors — usually a bug)
- Idempotency-key duplicates that return original response

### 11.2 Server-side idempotency

- POST/PUT/PATCH for financial + external comms REQUIRE `X-Idempotency-Key`
- 24-hour deduplication window
- Duplicate key + different body → 400 with `idempotency_conflict`

### 11.3 Retry storm protection

- Circuit breaker per external dependency (Anthropic, OpenAI, Stripe)
- Bulkhead: at most 30% of concurrency to any one dependency
- Fallback: graceful degradation when dependency down

---

## Section 12 — Background Workers

### 12.1 Queue architecture

Postgres-backed queue (`hammerex_nex_platform_task_queue`):

- Workers poll or LISTEN for new tasks
- Task acquisition uses `SELECT ... FOR UPDATE SKIP LOCKED`
- Failed tasks retry per Section 4.5 of ES-02

### 12.2 Worker categories

- **Media workers** — image + video transcoding
- **AI workers** — LLM calls, Vision AI analysis
- **Ingest workers** — external feed ingest (Companies House, weather, ONS)
- **Rollup workers** — memory + market signal aggregation (pg_cron scheduled)
- **Notification workers** — email + push send
- **Webhook workers** — outbound webhook delivery

### 12.3 Scaling

- Vercel serverless functions per worker category (auto-scale)
- Concurrency cap per worker category to control cost + upstream API pressure
- Priority queues per category (urgent > normal > background)

### 12.4 Monitoring

- Queue depth per category
- Processing latency per category
- Failure rate per task type
- Alerts on queue depth > threshold OR failure rate > threshold

---

## Section 13 — Notifications Service

### 13.1 Channels

- In-app (delivered via Realtime channels)
- Email (transactional via provider TBD — Postmark evaluated for existing merchant memory)
- WhatsApp (existing merchant infrastructure)
- Web push (progressive enhancement)

### 13.2 Preferences

- Per-user preferences per channel per category
- Merchant-level defaults
- Do-not-disturb windows

### 13.3 Delivery tracking

- Every notification generates delivery receipts
- Failed sends retried per channel policy
- Bounce tracking (email); block on hard bounce

---

## Section 14 — Media Service

Per ES-02 Section 8. API endpoints in Section 5.18.

### 14.1 Upload flow

1. Client requests presigned upload URL via `POST /api/nex/media/presign`
2. Server issues signed URL + records intent in `hammerex_nex_media_upload_intents`
3. Client uploads directly to Supabase Storage
4. Client posts back with `POST /api/nex/media/finalise` including checksum
5. Server verifies + records asset row + enqueues variant generation

Presigned URLs valid 15 minutes.

### 14.2 Retrieval

- Signed URLs generated on demand (5-minute expiry default)
- Public assets bypass signed URLs (avatars, merchant logos with public flag)

---

## Section 15 — Search Service

Reject: dedicated search service (Elasticsearch etc.). Adopt: Postgres tsvector + pgvector hybrid.

### 15.1 Endpoints

- `GET /api/nex/search?q=<query>&scope=<scope>` — global search across merchant data
- Scope: `projects` | `customers` | `documents` | `estimates` | `products` | `all`

### 15.2 Result shape

```json
{
  "ok": true,
  "data": {
    "results": [
      {
        "kind": "project",
        "id": "<uuid>",
        "title": "Smith kitchen",
        "snippet": "12 sqm refit...",
        "match_score": 0.87
      }
    ]
  }
}
```

Hybrid ranking via Reciprocal Rank Fusion of tsvector + pgvector scores.

---

## Section 16 — AI Orchestration Endpoints

Per ES-01 §7. Internal endpoints, not merchant-directly-callable:

- `POST /api/internal/ai/chat` — LLM call routed by ai/ orchestrator
- `POST /api/internal/ai/vision` — Vision AI call
- `POST /api/internal/ai/embed` — embedding generation
- `GET /api/internal/ai/budget/<merchant>` — daily spend view

Every internal AI endpoint requires internal-service authentication (signed JWT with `role: internal`).

---

## Section 17 — Digital Twin APIs

Per Section 5.12 — full spec:

**`POST /api/nex/twin/<project_id>/events`**

- Purpose: append event to Twin log
- Auth: project participant
- Request:
  ```json
  { "kind": "vision.finding", "payload": {...}, "observed_at": "<iso>" }
  ```
- Response: 201 with event_id
- Idempotency: required for events with side effects

**`GET /api/nex/twin/<project_id>/state?at=<iso>`**

- Purpose: reconstruct Twin state at any prior date (time travel)
- Auth: project participant
- Caching: 5-minute Redis (invalidated on new event)
- Response: full Twin state as JSON with evidence chain per component

---

## Section 18 — Trade Brain APIs

Per Section 5.9 — full spec:

**`POST /api/nex/brains/<slug>/consult`**

- Purpose: direct Brain consultation
- Auth: any authenticated merchant on Professional+ tier
- Request:
  ```json
  { "question": "why is the RCD tripping?", "context": {...} }
  ```
- Response: Brain answer with confidence + evidence + follow-up questions if applicable
- Rate limit: per tier

**`POST /api/nex/brains/<slug>/correction`**

- Purpose: merchant records a correction to Brain advice
- Auth: merchant owner
- Impact: merchant-local override; contributes to cross-tenant memory only after K-gating

---

## Section 19 — Marketplace APIs

Per Section 5.10. Key patterns:

**`GET /api/nex/marketplace/search`**

- Query params: `q`, `trade`, `region`, `filter[<attr>]`, `sort`, `cursor`, `limit`
- Response: paginated results with facet counts

---

## Section 20 — Trade Centre APIs

Product catalogue + orders. Per Section 5.10.

---

## Section 21 — Finance APIs

Per Section 5.11. Notable idempotency requirement on every invoice/payment endpoint.

---

## Section 22 — CRM APIs

Per Section 5.5.

---

## Section 23 — SiteBook APIs

Per Section 5.6.

---

## Section 24 — Workforce APIs

Per Section 5.13. Emergency stop endpoint is highest-priority + globally rate-limited:

**`POST /api/nex/workforce/emergency-stop`**

- Purpose: halt all agent activity for merchant
- Auth: any authenticated merchant team member with `workforce:emergency-stop` permission
- Effect: sets `emergency_stop_at` on merchant row; all agent workers check this flag before executing
- Response: confirmation with count of tasks halted
- Latency SLA: <2s from request to full halt

---

## Section 25 — Market Intelligence APIs

Per Section 5.15.

---

## Section 26 — Business Builder APIs

Per Section 5.16.

---

## Section 27 — Studio APIs

Existing endpoints. Documented in Studio-specific reference.

---

## Section 28 — API Gateway

### 28.1 Not a separate service

The API "gateway" is Next.js Route Handlers with a middleware stack:

- Auth middleware (Supabase JWT verification)
- Rate limiter (Redis-backed sliding window)
- Merchant scope resolver
- Request ID injection
- Logging + tracing
- CORS

Every route handler has these applied via a common wrapper.

### 28.2 CORS policy

- Merchant-facing endpoints: allow origins from configured merchant domains
- Public endpoints: allow `*` with strict credential rules
- Preflight cached 24h

---

## Section 29 — Service Discovery

Not applicable in a modular monolith. If services are ever extracted, use service registry (Consul or similar) at that point.

---

## Section 30 — OpenAPI Standards

### 30.1 Source of truth

- OpenAPI 3.1 schema at `openapi/nex.yaml`
- Generated from Zod schemas via `zod-to-openapi`
- Published at `/api/openapi.json` (auto-generated)
- Documentation at `/docs/api` (Swagger UI)

### 30.2 Naming

- resources plural: `projects`, `customers`, `invoices`
- actions on resources verb-suffixed: `/projects/<id>/complete`
- avoid abbreviations: `estimate` not `est`, `project` not `proj`

### 30.3 Style rules

- All lowercase paths
- Hyphens in multi-word (`sign-off` not `signOff`)
- snake_case for JSON body fields
- ISO-8601 dates always in UTC with Z suffix

---

## Section 31 — API Lifecycle + Deprecation

### 31.1 Lifecycle stages

- **Alpha** — internal only, breaking changes possible without notice
- **Beta** — accessible with flag, breaking changes with 2-week notice
- **Stable** — public, deprecation policy applies
- **Deprecated** — supported for 6-12 months (per §10.3)
- **Removed** — 410 Gone response with pointer to replacement

### 31.2 Change communication

- Public endpoints: changelog in `/docs/api/changelog`
- Breaking changes: email to registered API integrators
- SDK auto-updates track stable versions

---

## Section 32 — Engineering Standards

### 32.1 Request validation

- Every endpoint uses Zod schema validation on inputs
- Validation errors return field-level detail
- No untyped inputs reach business logic

### 32.2 Response consistency

- Every endpoint uses shared response wrapper
- No endpoint returns raw arrays; always wrapped in `data.items` for lists

### 32.3 Logging + observability

- Every request logged with request_id, merchant_slug, user_id, duration_ms, status
- Sensitive fields (secrets, PII) redacted
- Trace ID propagated to LLM calls + external API calls

### 32.4 Testing

- Every endpoint has integration test
- Auth + RLS behaviour tested
- Idempotency behaviour tested
- Rate limit behaviour tested

---

## Section 33 — Ready for Implementation

Backend engineers can begin implementation on ratification of ES-01's 5 ADRs and this document. Every endpoint is specified enough to write a Zod schema, a Route Handler, and integration tests today.

---

**End of ES-03 · API & Service Architecture v1.0.**
