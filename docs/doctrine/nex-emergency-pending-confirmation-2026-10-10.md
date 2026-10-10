# NEX Emergency Help · Pending-Confirmation & Early-Location Doctrine

**Status**: Sealed 2026-10-10 by L1 (Pending-Alert + Early-Location agent).
**Scope**: Changes the semantics of the 10-second "I NEED HELP" countdown.

---

## 1 · Why T=0 send instead of T=10

### The attacker-removes-phone threat model

The original F5 flow fired `createDraft` + `activate` at the **natural**
end of the 10-second countdown (T=10). The countdown functioned as a
hard submission delay. The user tapped I NEED HELP, saw a heartbeat, and
10 seconds later the server was told anything had happened.

If the user's phone was taken from them at any point between T=0 and
T=9, **no alert ever reached the server.** The countdown window was a
pure defender's cost: a 10-second gift to an attacker who could stop
the alert simply by moving the phone out of the owner's hands.

In the field, 10 seconds is enough for:

- An attacker to see the countdown overlay and swipe to close the tab,
- An attacker to put the phone screen-down or face-down,
- An attacker to force the lock button,
- The user to be moved far enough that location at T=10 is less
  useful than location at T=0.

### The new semantics

The flipped architecture creates the alert row + starts the location
stream at **T=0** (the moment the user taps I NEED HELP after a category
pick), and uses the 10-second countdown as a **revocation window**
instead of a submission delay.

```
Legacy:
  I NEED HELP tap → wait 10s → createDraft + activate → navigate

L1 pending-confirmation:
  I NEED HELP tap → createPendingAlert IMMEDIATELY
                 → start watchPosition stream
                 → 10-second revocation window
                 → confirmPendingAlert at T=10 (or Skip)
                   | CANCEL during window → revokePendingAlert
                   | component unmount → best-effort revoke
```

Up to 10 seconds of real transmission + GPS stream has already left
the device by the time the countdown naturally completes. If the
phone is snatched at T=2, nine seconds of pending-alert plus one GPS
ping are already on the server.

---

## 2 · New states (migration 195)

Two new states extend the sealed state machine on `nex.emergency_incident`:

| State                    | Role                                                                 | Terminal |
| :----------------------- | :------------------------------------------------------------------- | :------- |
| `pending_confirmation`   | Alert row at T=0 · still revocable · fan-out may already have fired | No       |
| `revoked_within_window`  | Terminal · user cancelled during the 10-second safety window        | Yes      |

Two new timestamp columns:

- `pending_confirmed_at timestamptz` — stamped when `pending_confirmation → active`.
- `revoked_within_window_at timestamptz` — stamped when `pending_confirmation → revoked_within_window`.

### Why `revoked_within_window` is distinct from `cancelled`

The emotional distinction matters for responders who may already be
moving. A `cancelled` alert happened AFTER the alert went active (the
alert ran its real duration, then the requester called it off); a
`revoked_within_window` alert happened DURING the 10-second safety
window (the requester likely tapped by mistake and corrected within
seconds).

Responder UIs may surface the two states with different language, and
the fan-out layer (L3) may elect to send different follow-up messages
("Alert cancelled" vs "Alert revoked within safety window").

---

## 3 · Transition rules + authorization

| From                    | To                        | Who          | Stamps                              |
| :---------------------- | :------------------------ | :----------- | :---------------------------------- |
| `pending_confirmation`  | `active`                  | requester    | `activated_at`, `pending_confirmed_at` |
| `pending_confirmation`  | `revoked_within_window`   | requester    | `revoked_within_window_at`          |
| `pending_confirmation`  | `cancelled`               | requester    | `cancelled_at`                      |

Illegal transitions:

- `draft → pending_confirmation` is NOT permitted. The pre-countdown
  surface writes a fresh row directly into `pending_confirmation` via
  `createPendingAlert`. Draft remains for backward-compat callers.
- `active → pending_confirmation` is NOT permitted. States only move
  forward.
- `revoked_within_window → anything` is NOT permitted. Terminal.

The service layer uses `canTransition()` to enforce the above and
throws `incident_service.invalid_state_transition` on illegal paths.

### Idempotency

`confirmPendingAlert` is idempotent: if the row is ALREADY `active`
with `pending_confirmed_at` set (i.e., a prior tick already fired),
the service returns the current row without raising. This covers the
race where a 1 Hz interval tick and a `Skip countdown` tap land in
the same frame.

`revokePendingAlert` is **not** idempotent. The row must be in
`pending_confirmation`. Subsequent calls on a terminal row raise
`invalid_state_transition`. This is deliberate: the only time this
could happen is the component-unmount cleanup firing after an
explicit cancel, which the client already guards via `firedRef`.

---

## 4 · Responder-side behaviour (L2 implements · documented contract)

L2 owns the responder-side UI changes. The data contract L1 publishes:

- `nex.emergency_incident.state = 'pending_confirmation'` means the
  alert IS real but is in its 10-second revocation window.
- Responders may **see** the alert immediately (depending on whether
  the fan-out hook has fired for the pending transition — see §5), but
  engagement actions (`accept`, `decline`, `withdraw`) are **gated at
  the service layer** until the state reaches `active`.
- When the state moves to `revoked_within_window`, L2's UI must
  surface honest copy — not "cancelled" — so the responder understands
  the alert was revoked within the safety window.
- L2 should expose the two states to its testids as separate values so
  Playwright + E2E proofs can distinguish between a cancelled-during-
  active alert and a revoked-within-window alert.

### Why engagement is gated

If a responder tapped Accept while the incident was still
`pending_confirmation`, and the requester then revoked within the
window, the responder would be committed to a non-existent alert. The
service layer blocks this by refusing acceptance in `pending_confirmation`.
L2 is encouraged to reflect this gate visually (greyed-out buttons +
copy explaining the 10-second window).

---

## 5 · Fan-out semantics (L3 implements · documented hook)

L3 owns the multi-channel fan-out layer. L1 publishes a transition-
driven hook contract at
`src/lib/nex-native/emergency/_notification-hook.ts`:

```ts
export interface FanOutArgs {
  incidentId: string;
  requesterAccountId: string;
  transition: "pending_confirmation" | "active" | "revoked_within_window"
            | "cancelled" | "resolved";
  locationLat: number | null;
  locationLng: number | null;
  category: IncidentCategory;
}
export async function fanOutForTransitionStub(args: FanOutArgs): Promise<FanOutResult>;
```

L1's actions call `fanOutForTransitionStub` after each transition. The
stub is a no-op that returns `simulated: true`. When L3 lands at
`./emergency-notification-service.ts`, the import in `actions.ts`
is swapped to the real module. Shape MUST remain source-compatible.

### Doctrine for L3

- **pending_confirmation fan-out** fires FIRST. This is the "move
  fast" send: trusted contacts receive an initial "ALERT" push +
  the current GPS pin (which may be snapshot-only at this instant).
- **active fan-out** fires at T=10 as a FOLLOW-UP: "the alert is
  now confirmed · the 10-second safety window has elapsed · please
  engage". It is NOT a duplicate alert · it's a status update.
- **revoked_within_window fan-out** fires AT MOST ONCE if the
  user cancels during the window. Message copy: "Alert revoked
  within the 10-second safety window". DO NOT lie about the
  distinction between a timeout-cancel and an explicit decline.
- **cancelled fan-out** is distinct from `revoked_within_window`.
  Fires only when the user cancels AFTER the alert went active.
  Message copy: "Alert cancelled by requester".

---

## 6 · The pending alert is REAL

**Load-bearing invariant**: once an incident is in `pending_confirmation`,
it is a **real alert**. The only safety mechanism is the 10-second
revocation window. The alert row is NEVER silently discarded.

Consequences:

- The server-side rate limiter is enforced BEFORE creating a
  pending incident. A user cannot spam `pending_confirmation`.
  Rate limits: 3 concurrent + 10/24h.
- Component unmount during the countdown fires `revokePendingAlert`
  fire-and-forget. This avoids orphan `pending_confirmation` rows
  if the user closes the tab or navigates away.
- `pending_confirmation` is a NON-terminal state. The sweep job
  (`sweepExpired`) does NOT touch `pending_confirmation` rows ·
  only `active` and `responders_assigned` can be swept to `expired`.
  This is intentional: a pending row must resolve explicitly, not by
  timeout.

### Component-unmount revoke sequence

```
useEffect cleanup → if (incidentIdRef.current && !firedRef.current)
                 → revokePendingAlert({reason: "component_unmounted_during_countdown"})
                 → best-effort fire-and-forget · no await on unmount
```

The service accepts an optional `reason` string on `revokePendingAlert`
for L3 to surface in its fan-out copy. In v1 the reason is not
persisted to the DB (the schema does not have a column for it).

---

## 7 · Location streaming during the safety window

The confirmation-screen client starts `watchPosition` streaming
IMMEDIATELY on entering `counting-down`, debounced to ≥2 s client-side.
This is a safety doctrine, not a performance decision:

- The server-side service enforces a 10 s rate limit per incident
  (see migration 194). The 2 s client-side debounce is a courtesy that
  reduces wasted calls.
- A 2 s cadence during a 10 s window means UP TO 5 pings land before
  natural T=10. Each one updates the parent incident row's
  `location_*` columns via `updateIncidentLocation` (same transaction).
- On CANCEL / unmount, the `watchPosition` handle is cleared with
  `clearWatch(watchId)`. The handle lives in a React ref.
- `updateIncidentLocation` only accepts updates for states
  `active | responders_assigned`. Updates during `pending_confirmation`
  are rejected with `incident_not_updatable`. This is intentional:
  the pending window is the location SNAPSHOT window; L1's T=0
  snapshot is passed to `createPendingAlert` as the initial fix.
  Live-location streaming resumes once the alert is confirmed.

> **TODO** · Future refinement: consider allowing updates during
> `pending_confirmation` so the attacker-removes-phone case covers
> MOVEMENT during the window. For v1 the T=0 snapshot is honest and
> the active-view stream handles everything after T=10.

---

## 8 · Honest reporting

Every surface MUST honestly report the state the alert is in:

- `pending_confirmation` → "Sending alert in {N}" with CANCEL + Skip.
- `revoked_within_window` → "Alert revoked within the 10-second safety
  window. Recipients have been notified it was a cancellation."
- `active` → the sealed Active Incident view.

Never fabricate "success" when the stack refused. Never fabricate
"delivered" when the fan-out failed. The stub returns
`simulated: true`; L3's real module must return `simulated: false`
and real `attempted` / `succeeded` / `failed` counts.

---

## 9 · Files touched by the L1 seal

- `deploy/postgres/init/195_nex_emergency_pending_confirmation_states.sql` — widen CHECK + 2 timestamps.
- `scripts/nex-canonical/_apply-migration-195.mjs` — idempotent applier.
- `scripts/nex-canonical/__tests__/migration-195.test.ts` — structural proof.
- `src/lib/nex-native/emergency/types.ts` — extended `IncidentState` union + `EmergencyIncident` fields.
- `src/lib/nex-native/emergency/incident-service.ts` — `createPendingAlert`, `confirmPendingAlert`, `revokePendingAlert`.
- `src/lib/nex-native/emergency/actions.ts` — `createPendingAlertAction`, `confirmPendingAlertAction`, `revokePendingAlertAction`.
- `src/lib/nex-native/emergency/_notification-hook.ts` — stub for L3.
- `src/lib/nex-native/emergency/incident-service.test.ts` — new unit tests.
- `src/components/nex-native/emergency/EmergencyConfirmationScreen.tsx` — flipped flow + unmount revoke.
- `src/components/nex-native/emergency/__tests__/EmergencyConfirmationScreen.test.tsx` — new state-machine proof.
- `src/app/nex-native/emergency-help/_actions.ts` — server-action wrappers (flattened envelope).
- `src/app/nex-native/emergency-help/page.tsx` — mounts the new 4-method `services` prop.
- `tests/e2e/nex-emergency-help.spec.ts` — 03a/03b scenarios refactored for the new semantics.

Files L1 **did not** touch (reserved for other agents):

- `src/components/nex-native/emergency/IncidentAlertCard.tsx` (L2).
- `src/components/nex-native/emergency/ActiveIncidentView.tsx` (L2).
- `deploy/postgres/init/196_*.sql` (L3).
- `src/lib/nex-native/emergency/emergency-notification-service.ts` (L3).
- `src/lib/nex-native/emergency/trusted-contacts-service.ts` (L3).
