# NEX Emergency Help · Background Capability Doctrine

**Sealed 2026-10-10 (H3)** · load-bearing · do not weaken the UI copy.

This doctrine fixes the honest ceiling of what NEX can and cannot do
with location tracking across platforms. The product MUST NEVER claim
capabilities beyond what the implementing platform actually permits.

---

## 1 · The honest ceiling of a web app

NEX today is a web app. That shapes everything downstream. A web page
runs in a browser tab; the browser decides what the page can do when
the tab is backgrounded, closed, the device sleeps, or the hardware
powers down.

The founder asked for background tracking "even if the phone has been
switched off". The honest answer is **no software on any platform can
run on a phone that is physically powered down.** That is not a NEX
limitation; it is a universal computing constraint. Anyone who claims
otherwise is lying or misusing the word "tracking".

The remaining question is what NEX can do in the *gaps* between
foreground web, backgrounded web, and native always-on.

---

## 2 · What IS possible on NEX today (v1 pilot, web)

**Foreground geolocation streaming**
- `navigator.geolocation.watchPosition` fires continuously while the
  requester's ActiveIncidentView page is open in a visible browser tab.
- Updates are sent to the server every ~15 seconds (client debounce +
  server-side 10s rate limit).
- Each update refreshes `nex.emergency_incident.location_*` so a
  responder reading the incident always sees the latest known position.

**Service-worker-handled push notifications (scaffold)**
- The service worker at `/nex-emergency-sw.js` can show a notification
  when the server delivers a Web Push payload.
- The notification wakes the responder's browser briefly even when the
  NEX tab is closed.
- Scope is deliberately limited to `/nex-native/emergency-help/`.
- VAPID keys + server-side push sender are deferred (founder decision).

**Permission-gated geolocation**
- The browser prompts the user the first time `watchPosition` is called.
- Denied is terminal · we do not retry infinitely.

---

## 3 · What is limited by the web platform

**Browser-background location**
- **iOS Safari**: effectively blocks web geolocation when the tab is
  not foreground. The watchPosition stream pauses. No reliable
  workaround exists for mobile Safari in 2026.
- **Android Chrome**: permits very short bursts via the Periodic
  Background Sync API, but the browser throttles aggressively (minutes
  to hours between fires, user-engagement-weighted). This is bonus
  plumbing, not a substitute for always-on tracking.
- **Desktop browsers**: similar · background-tab geolocation is paused
  by all major engines to conserve battery and privacy.

**Push notification cadence**
- Browsers may collapse or defer push notifications. Delivery is best
  effort. We cannot guarantee a responder sees an alert within N
  seconds unless the responder's device is awake and connected.

---

## 4 · What is impossible on ANY platform

| Claim | Reality |
|---|---|
| "Track while phone is powered off" | **Impossible.** No OS runs code on a device whose battery and SoC are disconnected from power. |
| "Track if battery is dead" | **Impossible.** Dead battery = no CPU = no code. |
| "Track if SIM is removed and WiFi is off" | GPS fixes may still happen locally, but no telemetry can leave the device without a radio. |
| "Track if the user explicitly denied location permission" | **Impossible on every platform.** Permission denial is the user's decision; respecting it is non-negotiable. |

Any UI copy that implies these capabilities would be a lie. The product
chrome MUST avoid phrases like "always-on tracking", "we see you
everywhere", or "constant location sharing". The required honest phrase
is **"while this page is open"**.

---

## 5 · What requires a native companion app

A native iOS or Android app can achieve substantially more, with the
user's informed consent:

**iOS native (CLLocationManager · "Always Allow")**
- Background location updates when the app is suspended.
- Significant-location-change events wake the app periodically.
- Silent push notifications can wake the app to send a fix.
- Still cannot run on a powered-off phone.

**Android native (ForegroundService + FusedLocationProviderClient)**
- A foreground service displays a persistent notification and runs
  while the device is awake.
- Background location requires the `ACCESS_BACKGROUND_LOCATION`
  permission and user consent.
- Doze mode and App Standby throttle background work; a native app
  must play by Android's power rules.
- Still cannot run on a powered-off phone.

**Bidirectional voice**
- Native apps can keep a VoIP call or a long-polling WebSocket alive
  longer than a backgrounded web page. Not shipped in v1.

**NEX stance**: a native companion is on the roadmap but has not been
authorised to build. The web pilot proves demand and gathers the
doctrine before the native investment.

---

## 6 · What NEX implements today (v1 pilot)

Scoped to the ActiveIncidentView page in a visible foreground tab:

1. `watchPosition` streams GPS updates while the page is open.
2. Each update is debounced to ~15s and ingested via
   `updateIncidentLocationAction` → `updateIncidentLocation`.
3. Server-side rate limit of **1 ping per 10 s per incident**.
4. Append-only history in `nex.emergency_location_update` (migration
   194). Parent `nex.emergency_incident.location_*` is updated to the
   latest values in the same transaction.
5. Every row is `simulated = TRUE` in v1.
6. Service worker scaffold at `/nex-emergency-sw.js` installs on first
   mount and is ready to show push notifications when VAPID keys land.
7. Honest UI: a "Live location sharing · updates every ~15s while this
   page is open" chip surfaces the exact capability, no more.

Nothing in the v1 pilot:
- Reads location when the tab is not open.
- Pretends to work on a powered-off device.
- Auto-retries after a permission denial.
- Uses background sync for anything beyond a documented no-op.

---

## 7 · What is deferred to a native app phase

- iOS native build with CLLocationManager + "Always Allow" permission.
- Android native build with ForegroundService + background permission.
- Native silent-push wake for responders.
- Bidirectional voice between requester and accepted responder.
- Native geofencing for arrival detection.

These require explicit founder authorisation. The web pilot gives us
the service shape, the DB schema (migration 194 is forward-compatible),
and the honest UI copy that will carry forward.

---

## 8 · Doctrine · never claim capability we don't have

Load-bearing rules for every surface that mentions location:

1. **The caveat "while this page is open" is MANDATORY** on any
   requester-facing live-location chip until a native companion ships.
2. **Never render "live location" chrome before an active incident is
   confirmed.** The server render must not reveal the live-location
   affordance until `state.kind === "ready"` with a live incident.
3. **Never auto-retry a permission denial.** One prompt per visit;
   denial is terminal with an honest downgrade message.
4. **Permission-denied copy MUST state what responders CAN still see**
   ("your position from when the alert was sent"). Users must not
   believe help has stopped.
5. **Marketing / product copy must not reference "always-on",
   "ambient", "24/7", or "tracking anywhere".** If these words appear
   in a mock or spec, strike them before implementation.
6. **This doctrine is binding for every future emergency surface.**
   New surfaces that need live location must consume
   `updateIncidentLocationAction`, mirror the chip language, and point
   back to this document in their own doctrine.

---

**Related docs**
- `docs/doctrine/nex-emergency-live-location-2026-10-10.md` · how the
  live-location pipe is wired (service, action, UI, rate limits).
- `docs/doctrine/nex-emergency-help-foundation-2026-10-10.md` · F4
  foundation schema and sealed doctrine.
- `docs/doctrine/nex-emergency-help-ui-2026-10-10.md` · F5 UI shell.
- `docs/doctrine/nex-emergency-help-abuse-policy-2026-10-10.md` · abuse
  prevention + rate-limit stance.
