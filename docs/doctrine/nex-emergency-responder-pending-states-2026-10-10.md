# NEX Emergency Help · Responder Pending + Revoked States

**Sealed:** 2026-10-10 · L2 (responder-side pending/revoked UX agent)
**Scope:** `IncidentAlertCard` + `ActiveIncidentView` display contract
for the two new L1 incident states.

---

## New states (shared contract with L1)

L1 is extending `IncidentState` with two members:

| State | When | Terminal? |
|---|---|---|
| `pending_confirmation` | T=0 of the requester's 10-second countdown. The alert row exists, recipients have been resolved and notified, but the requester may still cancel. | No |
| `revoked_within_window` | The requester cancelled during the 10-second window. | **Yes** |

Both states must be rendered honestly by L2's two surfaces: the
responder-facing `IncidentAlertCard` and the requester-facing
`ActiveIncidentView`.

---

## Why engagement is gated during `pending_confirmation`

A responder tapping "I'm on my way" during the 10-second window is a
false positive if the requester cancels. We would then have to tell the
responder "sorry, the person who called for help cancelled before you
accepted," which (a) wastes attention we may need later and (b) erodes
trust in the alert signal. Gating engagement for a bounded 10 seconds
is cheap compared to the cost of a race.

So: during `pending_confirmation`
- Accept and Decline are rendered **disabled** (visible, so the responder
  knows what their options will be, but not actionable).
- The banner tells them *why* the buttons are disabled and *how long*
  the wait is.
- The disabled buttons carry
  `data-nex-emergency-accept-disabled-reason="pending_confirmation"`
  so Playwright and introspection tools can prove the gating reason is
  explicit, not accidental.

## Why Report to Police stays enabled

Report-to-Police is NOT the same category of action as "accept this
responder slot." It is a hand-off to the real emergency services based
on the responder's **independent** judgement of the situation. If a
distant responder sees enough information to be worried about the
requester, they must be able to escalate regardless of what the sealed
10-second window says. The sealed police hand-off doctrine (
`docs/doctrine/nex-emergency-help-police-handoff-2026-10-10.md`)
already treats this button as "never gated by in-app state." L2
inherits that rule and preserves it during the pending window.

## Why `revoked_within_window` is distinct from `cancelled`

A plain `cancelled` incident is "I decided I didn't need help anymore,
sorry for the noise." A `revoked_within_window` incident is "I pressed
the button by accident and realised within ten seconds." The emotional
weight is different:

- `cancelled` → responders may already be moving. We must say "the
  requester cancelled" plainly and respectfully.
- `revoked_within_window` → the alert was never fully "live" from the
  responder's perspective because engagement was gated. The copy should
  mirror this: "the requester cancelled it within the 10-second safety
  window. No action is required."

Keeping these distinct in the data layer (and in the copy) preserves
the "I made a mistake, no judgment" tone. Collapsing them into one
state would make genuine recoveries from an accidental tap feel like
failures, which would deter honest use.

## Why Report to Police stays visible on `revoked_within_window`

A revoked alert MAY still have been real — the requester may have
cancelled under duress, or may have been pressured. We don't surface
this as suspicion, but we do keep the Report-to-Police entry visible
with explicit subtext:

> This alert was cancelled by the requester. Only call if you have
> independent reason to be concerned.

The subtext does the delicate work: it defuses the default read
("someone cancelled, nothing is wrong") while giving the responder
express permission to escalate if their own judgement overrides the
cancel signal.

## Visual language

| Colour | Meaning |
|---|---|
| **Cyan** (`#00AFFF`) | Pending · safe, waiting, in-system guard rail. Used on the responder-side pending banner. |
| **Amber** (`#F59E0B`) | Requester-pending-on-own-view · urgent, counting down. Used on the requester-side pending banner so it is visually distinct from the responder's "please wait" cyan. |
| **Muted grey** | Resolved · no action required. Used for the revoked terminal banner and the generic resolved/cancelled terminal copy. |
| **Red** (`#DC2626`) | Reserved for the Emergency CTA + the Revoke button on the active-pending view (destructive confirmation, mirrors the Cancel button on the active view). |
| **Green** (`#22C55E`) | Success swap · "Alert confirmed · responders notified" shown briefly after the state transitions `pending_confirmation` → `active`. |

## Pending countdown mechanics

- The banner's remaining-seconds display is derived from
  `incident.createdAt + 10s - now()`, floored to zero.
- A `window.setInterval(1_000)` drives the re-render while the component
  is mounted and the state is `pending_confirmation`.
- The display is **declarative**: when `remainingSec <= 0`, the copy
  swaps to `Confirming…`, and we rely on the server poll (and L1's
  state machine) to flip the state to `active` or
  `revoked_within_window`. L2 never advances the state locally.

## Testids

| Testid | Where | Purpose |
|---|---|---|
| `nex-emergency-pending-banner` | IncidentAlertCard | Cyan responder-side pending banner wrapper |
| `nex-emergency-pending-countdown` | IncidentAlertCard | Seconds-remaining display |
| `nex-emergency-revoked-banner` | IncidentAlertCard | Terminal muted banner on revoked incidents |
| `nex-emergency-report-police-revoked-note` | IncidentAlertCard | Subtext on the Report-to-Police entry when revoked |
| `nex-emergency-active-pending-banner` | ActiveIncidentView | Requester-side amber pending banner wrapper |
| `nex-emergency-active-pending-countdown` | ActiveIncidentView | Requester-side seconds-remaining display |
| `nex-emergency-active-pending-revoke` | ActiveIncidentView | Requester-side revoke button (hooks to the same cancel service) |
| `nex-emergency-active-confirmed-banner` | ActiveIncidentView | Green success banner shown for ~15s after `activatedAt` |

## Attributes

- `data-nex-emergency-pending-remaining-sec="<n>"` on the responder
  banner · lets Playwright poll the countdown.
- `data-nex-emergency-accept-disabled-reason="pending_confirmation"`
  on the gated Accept button · proves the gating is explicit.
- `data-nex-emergency-decline-disabled-reason="pending_confirmation"`
  on the gated Decline button · same guarantee.

## Non-goals

- L2 does **not** add new state transitions. L1 owns the state machine.
- L2 does **not** add new notification fan-out. L3 owns multi-channel.
- L2 does **not** persist pending-confirmation UI state. The server is
  the source of truth · the UI re-reads on every poll (15s default)
  and renders what the state says at that moment.

## SIMULATED badge

Both new states must continue to render the universal
`SIMULATED · v1` badge. This is handled by the existing `SimulatedBadge`
component mounted on each view. L2 preserves this invariant.

## Temporary type shim

Until L1's `src/lib/nex-native/emergency/types.ts` lands the extended
`IncidentState` union, L2's two component files carry a local
`ExtendedIncidentState` type and an `extState()` cast helper. Delete
both when L1 lands its types.ts change. The shim is intentionally
narrow (two strings only) to minimise accidental drift.
