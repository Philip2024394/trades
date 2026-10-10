# NEX Emergency Help · UI doctrine · 2026-10-10

Sealed by the Emergency Help UI parallel agent (F5). This file is
the regression anchor for the UI slice of NEX Emergency Help v1 ·
F1-F4 contribute parallel scopes (directory, cross-DB reconciler,
accommodation, emergency schema + services).

## Scope

The UI slice covers:

- Pinned "Emergency Help" entry at the top of NEX Settings.
- "Do you need help?" 2-tap confirmation.
- Requester-facing active-incident view with 15-second polling.
- Responder-facing incident alert page.
- Responder opt-in management (safety guidance + radius slider).
- Trusted contacts list (add + remove, 10-max).
- Prior-incidents history view.
- A universal `SIMULATED · v1` chip visible on every surface.

## Page routes authored

| Route | Purpose |
|---|---|
| `/nex-native/settings` | Modified · pinned emergency entry at TOP |
| `/nex-native/emergency-help` | "Do you need help?" 2-tap confirmation |
| `/nex-native/emergency-help/active` | Requester-facing active incident |
| `/nex-native/emergency-help/history` | Prior incidents (honest empty state) |
| `/nex-native/emergency-help/responder` | Responder opt-in management |
| `/nex-native/emergency-help/trusted-contacts` | Trusted contacts list |
| `/nex-native/emergency-help/incident/[id]` | Responder-facing alert view |

## Component inventory

| Component | File |
|---|---|
| `EmergencyHelpEntryCard` | `src/components/nex-native/emergency/EmergencyHelpEntryCard.tsx` |
| `EmergencyConfirmationScreen` | `src/components/nex-native/emergency/EmergencyConfirmationScreen.tsx` |
| `ActiveIncidentView` | `src/components/nex-native/emergency/ActiveIncidentView.tsx` |
| `IncidentAlertCard` | `src/components/nex-native/emergency/IncidentAlertCard.tsx` |
| `ResponderOptInForm` | `src/components/nex-native/emergency/ResponderOptInForm.tsx` |
| `TrustedContactsList` | `src/components/nex-native/emergency/TrustedContactsList.tsx` |
| `SimulatedBadge` | `src/components/nex-native/emergency/SimulatedBadge.tsx` |
| `EmergencyHelpEntry` (settings wrapper) | `src/app/nex-native/settings/_emergency-help-entry.tsx` |

Supporting modules:

- `src/components/nex-native/emergency/_palette.ts` · emergency colour tokens.
- `src/components/nex-native/emergency/_mock-service.ts` · temporary mock
  of the F4 server actions. **Delete when F4 lands.**
- `src/components/nex-native/emergency/types.ts` · local copy of the F4
  shared contract types. **Delete when F4 lands and switch imports to
  `@/lib/nex-native/emergency/types`.**
- `src/app/nex-native/emergency-help/_actions.ts` · "use server" shim
  forwarding to the mock. Switch to F4's canonical actions once F4
  ships.

## 2-tap discipline (sealed)

The "I NEED HELP" button MUST implement a 2-tap confirmation:

1. First tap (`[data-testid="nex-emergency-primary-cta"]`) · requests
   browser geolocation + reveals the confirmation step
   (`[data-testid="nex-emergency-confirm-step"]`). The alert is NOT
   submitted yet. Geolocation permission denial is honest: a note is
   shown that the alert can still be sent without a location.
2. Second tap (`[data-testid="nex-emergency-confirm-yes"]`) · calls
   `createDraftServerAction` + `activateServerAction` and routes to
   the active view.

Regression anchors:

- `EmergencyConfirmationScreen.test.tsx` asserts the confirm-step
  testid is ABSENT on the first paint.
- The Playwright scenario `03 · First tap ... reveals confirm step`
  asserts the ordering in a real browser.

## Location sharing lifecycle

| Phase | Action |
|---|---|
| Mount | **NO** geolocation request. The entry card does not request. |
| First tap of "I NEED HELP" | Call `navigator.geolocation.getCurrentPosition`. On deny or error, surface an honest note; proceed with location unset if the user confirms. |
| Second tap (confirm Yes) | Submit draft with captured `{lat, lng, accuracy}` (or null trio). |
| Server activation | F4's data layer broadcasts to recipients (SIMULATED in v1). |
| Resolve / cancel / expire | Any terminal state stops the client-side polling loop; location sharing conceptually ends. |

## SIMULATED · v1 universal contract

The chip renders via `<SimulatedBadge />`. Only `isEmergencyLiveMode()`
can suppress it (defaults to `false` in v1 · always visible). The
Playwright scenario `08 · SIMULATED badge on every page` enforces that
every emergency-help route carries the badge.

## Honest state matrix

| Situation | Surface | Message |
|---|---|---|
| Offline (navigator.onLine false) | Confirmation screen | "You are offline · reconnect and reopen" |
| Geolocation permission denied | Confirmation step | "Location permission denied. You can still send the alert · responders will not see your position." |
| Server returns no-eligible-responders | Confirmation screen | "No eligible responders nearby" |
| No active incident on `/active` | Active view | "No active emergency · return to Settings" |
| Incident state = expired | Active view | "Alert expired · no one accepted in the window" + Re-raise button |
| Responder page before ack | Opt-in form | Opt-in button is `disabled` |
| Responder page after opt-in | Opt-in form | Radius slider + "Opt out" + "Save radius" |

## Doctrine (load-bearing)

1. **SIMULATED badge everywhere** · never conditionally hidden except
   via the sealed `live` prop + `isEmergencyLiveMode()`.
2. **No auto-opt-in** · a user is never a responder without explicit
   consent + safety-guidance acknowledgement.
3. **Wider community recipient layer DISABLED** · v1 only broadcasts to
   trusted contacts + nearby opted-in responders. The
   `RecipientLayer` type reserves `"wider_community"` for a later
   phase.
4. **No real map** · the active-view placeholder is intentional. No
   iframes, Mapbox, Google Maps or Leaflet in v1.
5. **No chat primitive mutation** · the responder's alert in v1 is a
   standalone page at `/nex-native/emergency-help/incident/[id]`.
   Chat timeline integration is deferred to the NEX-wide realtime +
   push phase (see MEMORY: "NEX-wide inbound-message realtime + push
   notifications PARKED").
6. **No local storage for alert state** · all state is server-side
   via `nex_emergency_*` tables (F4 scope). The client only polls.
7. **Red = emergency only** · never recolour Vault / Socials chrome
   from the emergency palette.

## Known deferred items

- Real map embed on the active view (OSM tile preview + routing).
- Native geolocation permission UX pre-primer.
- Chat-timeline integration for responder alerts.
- Push notifications to responders (parked NEX-wide realtime phase).
- Friend-picker UI for trusted contacts (v1 is free-text account id).
- Simulated-recipient simulator (fixture responders accepting with
  simulated ETAs).
- Internationalisation · all strings are English literals · documented
  technical debt pending Phase B.7 i18n refactor commit.

## Founder decisions still required

- **ETA picker options** · v1 uses `[3, 5, 10, 15]` minutes. Needs
  founder sign-off that these are the sealed options.
- **Max trusted contacts** · v1 enforces 10 (client + server). Needs
  founder confirmation that 10 is correct.
- **Default responder radius** · v1 defaults to 5 km. Needs founder
  confirmation.
- **Wider-community layer** · when, if ever, to enable the third
  recipient layer and under what safety-review controls.

## Scope boundaries

**Did NOT touch**:

- F1 (directory fixes 1-3): `scripts/nex-canonical/canonical-handoff.ts`
  and directory source files.
- F2 (cross-DB reconciler): `deploy/postgres/init/191_*.sql` and
  `src/lib/nex-native/cross-db-reconciler/*`.
- F3 (accommodation): `deploy/postgres/init/192_*.sql` and
  accommodation runners.
- F4 (Emergency schema + services): `deploy/postgres/init/193_*.sql`
  and `src/lib/nex-native/emergency/*`.

The only file touched outside this agent's declared scope list is
`src/app/nex-native/settings/page.tsx` · which was in-scope per the
task brief (T1: investigate + modify OR create). The modification is
additive · the existing settings rows are preserved verbatim.
