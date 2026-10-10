# NEX Emergency Help · Live-Location Implementation (H3 · v1)

**Sealed 2026-10-10 (H3)** · implementation companion to
`nex-emergency-background-capability-2026-10-10.md`.

This doc records how foreground live-location streaming is wired in
v1. It is NOT the capability doctrine (that's the sibling file). This
is the "what builds live today" guide for anyone touching the pipe.

---

## 1 · Data layer · migration 194

**Table**: `nex.emergency_location_update`

| column | type | notes |
|---|---|---|
| `update_id` | uuid PK (gen_random_uuid) | one row per accepted ping |
| `incident_id` | uuid NOT NULL FK → `nex.emergency_incident(incident_id)` ON DELETE CASCADE | always resolves to a live incident |
| `lat` | double precision NOT NULL · CHECK (-90, 90) | WGS84 |
| `lng` | double precision NOT NULL · CHECK (-180, 180) | WGS84 |
| `accuracy_meters` | integer NULL · CHECK (>= 0) | `GeolocationCoordinates.accuracy` rounded |
| `heading_degrees` | double precision NULL · CHECK (0, 360) | `coords.heading` |
| `speed_mps` | double precision NULL · CHECK (>= 0) | `coords.speed` |
| `source` | text NOT NULL DEFAULT `'browser_watch_position'` · CHECK sealed 3-value | `browser_watch_position` / `manual_pin` / `service_worker_sync` |
| `simulated` | boolean NOT NULL DEFAULT TRUE | **always TRUE in v1** |
| `captured_at` | timestamptz NOT NULL | `position.timestamp` from the browser |
| `received_at` | timestamptz NOT NULL DEFAULT now() | server-side ingest time |

**Index**: `emergency_location_update_incident_time_idx (incident_id,
captured_at DESC)` — hot-path for "latest ping for this incident".

**Doctrine**:
- Append-only. No UPDATE statements against this table in the service.
- Rows are automatically cascaded away when the parent incident is
  deleted (cleanup/purge paths stay simple).
- The service writes the latest values ALSO onto
  `nex.emergency_incident.location_*` in the same transaction so a
  reader of the incident row sees the latest fix without a JOIN.

Applied via `scripts/nex-canonical/_apply-migration-194.mjs` with the
sealed `current_database() = 'nex_dev'` identity gate.

---

## 2 · Service shape

**File**: `src/lib/nex-native/emergency/incident-service.ts`

```typescript
export async function updateIncidentLocation(args: {
  incidentId: string;
  actorAccountId: string;
  lat: number;
  lng: number;
  accuracyMeters?: number | null;
  headingDegrees?: number | null;
  speedMps?: number | null;
  capturedAt: string;
  source?: LocationUpdateSource;
}): Promise<{ updateId: string; appliedAt: string }>;
```

### Gates (in order)

1. **Shape validation** — rejects empty actor, empty incidentId,
   out-of-range coordinates, negative accuracy / speed, invalid
   heading, unparseable `capturedAt`.
2. **Authorisation** — SELECT the incident row; the actor MUST equal
   `requester_account_id`. Anything else → `not_authorized`.
3. **State gate** — incident state MUST be `active` or
   `responders_assigned`. Draft, resolved, cancelled, expired →
   `incident_not_updatable`.
4. **Rate limit** — MAX(captured_at) for this incident must be more
   than 10 seconds older than this ping. Burst → `rate_limited`.
5. **Insert + mirror** — INSERT into `emergency_location_update` with
   `simulated = TRUE`, then UPDATE the parent incident's `location_*`
   columns to the latest values.

### Constants

- `LOCATION_UPDATE_MIN_INTERVAL_SECONDS = 10` — sealed server-side rate.
- `LOCATION_UPDATE_SOURCES` — sealed `['browser_watch_position',
  'manual_pin', 'service_worker_sync']`.

---

## 3 · Server action

**File**: `src/lib/nex-native/emergency/actions.ts`

```typescript
export async function updateIncidentLocationAction(args: {
  incidentId: string;
  lat: number;
  lng: number;
  accuracyMeters?: number | null;
  headingDegrees?: number | null;
  speedMps?: number | null;
  capturedAt: string;
  source?: LocationUpdateSource;
}): Promise<EmergencyActionResult<{ updateId: string; appliedAt: string }>>;
```

Thin wrapper around `updateIncidentLocation`. Resolves the actor via
`_session.resolveActorAccountId()`. Possible result envelopes:

| `reason` | cause |
|---|---|
| `not_authenticated` | no session |
| `feature_disabled` | feature flag off |
| `not_found` | incident does not exist |
| `not_authorized` | actor is not the requester |
| `incident_not_updatable` | state is draft/resolved/cancelled/expired |
| `rate_limited` | burst within 10s |
| `invalid_input` | shape failure |
| `db_unavailable` | pool unreachable |

The `incident_not_updatable` reason is **new** in v1 and is reserved
for live-location (and future "write-only on live" surfaces).

---

## 4 · Client wiring in `ActiveIncidentView`

**File**: `src/components/nex-native/emergency/ActiveIncidentView.tsx`

### Startup gate (critical)

Live location is NEVER requested on mount. Only after the component
has confirmed an active incident exists for the viewer
(`state.kind === "ready"` AND `incident.state in {active,
responders_assigned}`) does the watchPosition effect start. This is a
sealed doctrine from the capability document.

### Permission request flow

- `navigator.geolocation.watchPosition(onPos, onErr, options)` with
  `{ enableHighAccuracy: true, maximumAge: 5_000, timeout: 20_000 }`.
- The browser prompts the user. If granted, `onPos` fires repeatedly;
  if denied, `onErr` fires once with `PERMISSION_DENIED`.
- UI state transitions: `idle` → `requesting` → `streaming` | `denied`
  | `error` | `unsupported`.

### Client-side debounce

- `liveLocationMinIntervalMs` (default 15s) is the minimum interval
  between pings SENT to the server.
- Fixes that arrive faster still update the UI chip (accuracy stays
  honest) but do NOT ingest. This keeps server load low AND avoids
  tripping the service-layer rate limit under normal operation.

### Unmount

- `clearWatch(watchId)` ends the stream.
- `cancelled = true` guard prevents racy state updates after unmount.

### UI chip (`data-testid="nex-emergency-live-location-chip"`)

Five sealed states with sealed copy:

| state | copy |
|---|---|
| `requesting` | "Requesting location permission…" |
| `streaming` | "Live location sharing · updates every ~15s while this page is open" (+ "accuracy ±N m" when > 100 m) |
| `denied` | "Live location unavailable · responders will see your position from when the alert was sent." |
| `unsupported` | "This browser doesn't support live location · responders will see your position from when the alert was sent." |
| `error` | "Live location paused · responders will see your position from when the alert was sent." |

The "while this page is open" caveat is MANDATORY and non-negotiable.

### Service worker registration

```typescript
navigator.serviceWorker.register("/nex-emergency-sw.js", {
  scope: "/nex-native/emergency-help/",
})
```

- Registered on first mount with a silent catch (bonus plumbing).
- Scope limited to the emergency-help subtree.
- Push payload format expected: `{ title, body, data: { incidentId } }`.
- Clicking a notification opens
  `/nex-native/emergency-help/incident/${incidentId}` (or the generic
  landing page if `incidentId` is missing).

---

## 5 · SIMULATED badge

Every v1 write carries `simulated = TRUE`. The ActiveIncidentView
renders `<SimulatedBadge />` in every state. There is no live mode in
v1; the service layer enforces `simulated = TRUE` at insert time.

---

## 6 · Rate limit interaction with the client debounce

- Server limit: 1 ping per 10 s per incident (hermetic test proves it).
- Client debounce: 15 s (prop-overridable).
- Normal operation: client sends at 15 s cadence; server never
  rate-limits.
- Pathological case (two tabs open on the same incident): the server
  rate limit catches bursts. The client UI remains in `streaming` state
  rather than `error` because the ping failure is swallowed; the next
  fix will succeed.

---

## 7 · Degraded states (honest downgrades)

| condition | behaviour |
|---|---|
| Permission denied | one-shot message, no auto-retry, chip shows `denied` state. |
| Browser doesn't support geolocation | `unsupported` chip, no watch started. |
| Browser doesn't support service workers | silent skip, no error chrome. |
| Poor accuracy (> 100 m) | chip appends "accuracy ±N m" so the user knows the fix is coarse. |
| Watch error (timeout, no satellites) | chip downgrades to `error`, requester keeps page open to re-attempt. |

---

## 8 · Future-proofing

Deliberately in place for later phases (NOT shipped v1):

- `source = 'service_worker_sync'` row type is sealed in the CHECK
  constraint so the eventual service-worker periodic-sync hook has a
  type to write.
- Service worker periodic-sync handler is an honest no-op.
- Push notifications ship when VAPID keys + a server-side sender land.
- Native companion app (iOS CLLocationManager · Android
  ForegroundService) consumes the SAME `updateIncidentLocation`
  service with `source = 'service_worker_sync'` or a dedicated native
  source value.

---

**Related docs**
- `docs/doctrine/nex-emergency-background-capability-2026-10-10.md` ·
  why the UI copy is what it is.
- `docs/doctrine/nex-emergency-help-foundation-2026-10-10.md` · F4
  foundation + sealed state machine.
- `docs/doctrine/nex-emergency-help-ui-2026-10-10.md` · F5 UI shell.
