# NEX Emergency Help · Hardening Audit · 2026-10-10

**Status**: Sealed audit — zero corrections applied; the module passed the
six-item hardening audit as-written.

**Scope**: Narrow hardening wave authorised by founder on 2026-10-10. No
new features · no new UI · no new flows. Primary deliverable is expanded
test coverage against the existing Emergency Help feature set.

**Dates in this doctrine are ESTIMATES** · the wave happened in a single
session.

---

## 1 · The six audit items

The founder issued six honest-ceiling corrections to verify against the
sealed Emergency Help module. Each item was read against the live code
under `src/lib/nex-native/emergency/*`,
`src/components/nex-native/emergency/*`,
`src/app/nex-native/emergency-help/**`, `public/nex-emergency-sw.js`, and
`docs/doctrine/nex-emergency-*.md`. Verdicts below.

### 1.1 · No silent location escalation

**Verdict**: ABSENT (code is already correct). No patch applied.

The pending-confirmation flow in
`src/components/nex-native/emergency/EmergencyConfirmationScreen.tsx`
only invokes `navigator.geolocation.getCurrentPosition` /
`watchPosition` after:

1. The user acknowledges the `acknowledging-policy` phase (sessionStorage
   key `nex-emergency-policy-ack-v1`).
2. The user explicitly picks a category (`medical_concern` or
   `safety_concern`).
3. The user taps the `nex-emergency-primary-cta` ("I NEED HELP") button.

`requestLocationThenStart` is wired to the primary CTA's `onClick` and
nowhere else. No `useEffect` triggers a geolocation request on mount or
on category change. The service worker at `/nex-emergency-sw.js` never
touches geolocation.

The sealed load-bearing comment in `EmergencyConfirmationScreen.tsx`
header enforces this invariant:

> Geolocation is requested ONLY on the first tap of "I NEED HELP".
> Never request on mount, never request from the entry card, never
> before the policy ack.

### 1.2 · No automatic law-enforcement contact

**Verdict**: ABSENT (code is already correct). No patch applied.

`src/components/nex-native/emergency/ReportToPolicePanel.tsx` renders a
`<a href="tel:${number}">` affordance. The `tel:` scheme only opens the
device dialer — it never auto-dials. The tel link requires an explicit
user tap. The resolved number is a reference lookup (`resolveEmergencyNumber`
in `local-emergency-numbers.ts`) with 112 as the international fallback.

Load-bearing legal disclaimer `POLICE_HANDOFF_DISCLAIMER` is rendered on
the panel:

> NEX has not contacted emergency services on your behalf. Tapping the
> button above opens your phone's dialer. You must speak to the
> operator and relay the location.

No code anywhere in the module calls out to an external emergency
service API, government endpoint, or third-party relay. Grep for
`police`, `law.?enforcement`, `auto.?dial`, `dialer`, `112`, `911`
across the module returns only the lookup table and the disclaimer.

### 1.3 · No automatic legal holds based on classification scores

**Verdict**: ABSENT (code is already correct). No patch applied.

There is NO classification model, NO scoring, NO legal-hold flag, and
NO retention-override mechanism in the Emergency Help module. The
incident lifecycle in `incident-service.ts` is a pure sealed state
machine (`draft` / `pending_confirmation` / `active` /
`responders_assigned` / `resolved` / `cancelled` /
`revoked_within_window` / `expired`) — none of these states are a
"legal hold". The sweep in `sweepExpired` only flips
`active | responders_assigned → expired` when the deadline has passed
with no accepted responder. Retention of incident rows is governed by
the standard DB lifecycle — not by any model output.

### 1.4 · No fabricated 14-day history promise

**Verdict**: ABSENT (code is already correct). No patch applied.

Grep for `14[-\s]?day`, `14 days`, `history 14` across the entire
module returns zero matches in Emergency Help source. The live-location
chip copy in
`src/components/nex-native/emergency/ActiveIncidentView.tsx`
`LiveLocationChip` is already honest:

- `streaming` → `"Live location sharing · updates every ~15s while this page is open"`
- `denied` → `"Live location unavailable · responders will see your position from when the alert was sent."`
- `unsupported` → `"This browser doesn't support live location · responders will see your position from when the alert was sent."`
- `error` → `"Live location paused · responders will see your position from when the alert was sent."`

The database `nex.emergency_location_update` table (migration 194) is
append-only, but no UI copy claims a specific retention window.

### 1.5 · No background tracking when phone is off

**Verdict**: ABSENT (doctrine already explicit). No patch applied.

`docs/doctrine/nex-emergency-background-capability-2026-10-10.md` §4
reads verbatim:

> | "Track while phone is powered off" | **Impossible.** No OS runs code
> on a device whose battery and SoC are disconnected from power. |

The service worker `/nex-emergency-sw.js` `periodicsync` handler is an
explicit documented no-op:

```js
self.addEventListener("periodicsync", (event) => {
  if (event.tag === "nex-emergency-last-known-location") {
    // Intentional no-op · documented honest limit.
  }
});
```

No code in the module claims capability beyond foreground-tab
`watchPosition` streaming.

### 1.6 · No private-help trigger auto-notifying guardian

**Verdict**: ABSENT (no scaffolded placeholder). No patch applied.

Grep for `guardian`, `can.?we.?talk`, `private.?help` across the
Emergency Help module returns zero matches in any source file. No
Phase 2 scaffolding exists. The Phase 1 architecture has only two
categories (`medical_concern`, `safety_concern`) and a single
pending-alert flow; there is no "quiet signal to a guardian" primitive.

---

## 2 · Audit summary table

| # | Item | Verdict | Patch? |
|---|---|---|---|
| 1 | Silent location escalation | ABSENT | None |
| 2 | Automatic law-enforcement contact | ABSENT | None |
| 3 | Automatic legal holds from scores | ABSENT | None |
| 4 | Fabricated 14-day history promise | ABSENT | None |
| 5 | Background tracking when phone off | ABSENT (doctrine explicit) | None |
| 6 | Private-help auto-notifying guardian | ABSENT | None |

**No code mutations were applied under T2.** The module as sealed on
2026-10-10 was already honest against all six items.

---

## 3 · Test coverage expansion (T3)

The hardening wave's primary deliverable is additional test coverage on
the sealed module. Target: +40 unit tests across the module. Actual
delta per module recorded in the final report; this doctrine lists
WHAT was covered.

### 3.1 · `incident-service.test.ts` (hardening additions)

- Idempotent `confirmPendingAlert` under a second call (already existed —
  extended with an extra assertion that no additional UPDATE fires).
- Rate limit boundary coverage: concurrent=0 + daily=10 returns false
  (daily cap trips alone); concurrent=3 + daily=0 returns false
  (concurrent cap trips alone).
- Sweep behaviour: incident past `expires_at` + state=`active` is
  flipped to `expired` by the SQL guard; the `NOT EXISTS` clause for
  accepted responders is proven in a SQL-shape assertion. Resolved
  incidents are NOT swept (sweep SQL filters on
  `state IN ('active', 'responders_assigned')`).
- Authorization: non-requester cannot cancel/resolve (already in
  baseline — extended with `revokePendingAlert` + `confirmPendingAlert`
  non-requester paths).
- State-machine completeness: every FROM state is enumerated and the
  `canTransition` table is asserted to be exhaustive.

### 3.2 · `recipient-resolver.test.ts` (hardening additions)

- Zero trusted contacts → `layer1 = []` without touching the
  responder-optin table.
- Zero opted-in responders in radius → `layer2 = []` honest empty.
- Both zero → `layer1 = []`, `layer2 = []`; `layer3Available = false`
  (wider_community disabled by default in v1).
- `writeRecipientRows` is idempotent: calling twice with the same
  `(incidentId, recipient)` pair results in `ON CONFLICT DO NOTHING`
  (asserted via SQL shape).

### 3.3 · `trusted-contacts-service.test.ts` (hardening additions)

- `addContact` with ALL identifiers null → `trusted_contact.no_identifier`
  (service-layer enforcement, mirrors DB CHECK).
- Self-add rejection via `trusted_contact.self_contact_not_allowed`
  (owner === contact_account_id).
- Max contacts: the service does NOT enforce a hard cap in v1 — the DB
  policy is `listContacts` clamp (default 50, hard 200). Documented
  gap: no "max 10 per owner" at the service layer. (Hardening test
  only asserts the LIMIT clamp.)

### 3.4 · `emergency-notification-service.test.ts` (hardening additions)

- Idempotency via `idempotency_key`: second call to `fanOutForTransition`
  for the same `(incident, transition)` records zero new audit rows.
  Already covered in baseline — extended with per-channel assertions.
- Honest-blocked SMS always returns `reason='sms_adapter_not_implemented'`
  — the stub NEVER fabricates `ok=true`.
- Email adapter respects BOTH flags: `simulated=false` AND
  `NEX_EMERGENCY_EMAIL_REAL_SEND=true` are required to attempt a real
  send; `simulated=false` without the env flag returns
  `reason='live_send_not_authorised'`.

### 3.5 · Component tests (hardening additions)

- `EmergencyConfirmationScreen`: documents that the component's unmount
  effect fires `revokePending` as a fire-and-forget when a pending
  incident id is held and the countdown has not yet fired. (Hermetic
  structural assertions only — the useEffect cleanup is not easily
  observable from `renderToStaticMarkup`.)
- `ActiveIncidentView`: documents that `LiveLocationChip` renders
  distinct `data-nex-live-location-state` values for each UI state
  (`idle` / `requesting` / `streaming` / `denied` / `unsupported` /
  `error`). The sealed honest copy is asserted per state.

---

## 4 · Playwright hardening spec (T4)

New spec file `tests/e2e/nex-emergency-help-hardening.spec.ts`.

| # | Scenario | Preflight-skip? |
|---|---|---|
| 1 | Offline at tap · `context.setOffline(true)` → honest "You are offline" copy | yes (dev server down) |
| 2 | Location permission denied at tap · browser context `permissions: []` → "Location permission denied" message, alert still fires | yes |
| 3 | Permission revoked mid-countdown · chip shows `denied` state, countdown continues | yes |
| 4 | Multi-tab coordination · tab A triggers incident, tab B's /active surfaces it within poll window; realtime not wired is a documented acceptable limitation | yes |
| 5 | Rate limit enforcement · 3 pending alerts fired via actions, 4th → `rate_limited` | yes |
| 6 | Report-to-police button · `tel:` href is correct for resolved country (default 112), "NEX has not contacted" disclaimer visible | yes |

All scenarios run against desktop + mobile viewports and preflight-skip
when the dev server at `localhost:3008` is unreachable.

---

## 5 · Sweep probe (T5)

`scripts/nex-canonical/_emergency-sweep-probe.mjs` seeds an incident
with `expires_at = now() - interval '1 minute'` + state=`active`,
calls `sweepExpired()`, asserts the row is now `expired` with
`expired_at`-equivalent sentinel on the incident, and cleans up.

Session-identity gated to `nex_dev`: the probe calls
`SELECT current_database()` first and refuses to run against anything
other than `nex_dev`. If the DB is unreachable, the probe exits with
status 2 and an honest "DB unavailable" message.

---

## 6 · Open gaps acknowledged (not fixed in this wave)

Hardening is narrow by design. The following observations are honest
documentation only — no fix was attempted:

### 6.1 · No service-layer "max 10 contacts per owner" cap

`trusted-contacts-service.ts` has no per-owner contact-count enforcement.
`addContact` upserts via conflict keys; `listContacts` clamps the SELECT
LIMIT. If the founder decides a per-owner cap is needed, it belongs
either:

- As a DB CHECK trigger (preferred — single source of truth), or
- As a service-layer `COUNT(*) FROM nex.trusted_contact WHERE
  owner_account_id = $1` pre-insert guard (racier under concurrency).

This hardening wave documented the gap but did not add either.

### 6.2 · No multi-tab realtime for /active

The requester-side ActiveIncidentView polls every 15s. If a second tab
on the same account cancels an incident, the first tab learns within
15s. There is no Supabase realtime subscription wired to
`nex.emergency_incident`. Documented in the Playwright scenario #4 as
an acceptable limitation.

### 6.3 · No service-worker-driven background poll

The service worker at `/nex-emergency-sw.js` only handles `push` and
`notificationclick`. The `periodicsync` handler is a documented no-op.
The honest-ceiling doctrine
`nex-emergency-background-capability-2026-10-10.md` already covers
this; no additional work is needed in hardening.

### 6.4 · Rate-limit DB coupling

`rateLimit()` queries both `nex.emergency_incident` (concurrent) and
`nex.emergency_rate_limit` (24h). The two queries are NOT in a single
transaction; a race between them could permit one extra incident. In
practice the concurrent cap at 3 bounds the race window to a very
small failure mode. Not fixed in this wave.

---

## 7 · References

- `docs/doctrine/nex-emergency-help-foundation-2026-10-10.md` · F4 schema
  seal.
- `docs/doctrine/nex-emergency-help-countdown-2026-10-10.md` · 10-second
  safety window.
- `docs/doctrine/nex-emergency-help-abuse-policy-2026-10-10.md` · policy
  ack gate + rate-limit stance.
- `docs/doctrine/nex-emergency-help-police-handoff-2026-10-10.md` · the
  user-driven handoff rule.
- `docs/doctrine/nex-emergency-live-location-2026-10-10.md` · live
  location pipe.
- `docs/doctrine/nex-emergency-background-capability-2026-10-10.md` ·
  honest ceiling for web platform.
- `docs/doctrine/nex-emergency-pending-confirmation-2026-10-10.md` · L1
  pending-confirmation seal.
- `docs/doctrine/nex-emergency-multi-channel-fanout-2026-10-10.md` · L3
  multi-channel fan-out contract.
- `docs/doctrine/nex-emergency-help-ui-2026-10-10.md` · F5 UI shell.
- `docs/doctrine/nex-emergency-responder-pending-states-2026-10-10.md` ·
  responder-side pending UX.
