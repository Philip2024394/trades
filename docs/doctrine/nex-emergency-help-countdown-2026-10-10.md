# NEX Emergency Help · Countdown Confirmation
> Sealed 2026-10-10 · pilot phase (SIMULATED · v1) · enforcement NOT active

## Purpose

Replace the earlier two-tap "Yes · send alert now / No · cancel" step
with a **10-second countdown** that acts as the second deliberate
confirmation. The countdown shows a flashing heartbeat badge, a
seconds-remaining counter, and a large CANCEL button. If the user does
nothing, the alert fires when the counter reaches zero. If the user
taps CANCEL at any time before zero, the component returns to its
pre-tap state and no alert is sent.

## Why 10 seconds

- **Short enough** that a user in a genuine emergency is not meaningfully
  delayed. 10 seconds is well under the time it would take to type a
  message, make a phone call, or re-plan a route.
- **Long enough** that an accidental tap can be caught. Combined with
  the earlier policy acknowledgment and the required category pick,
  the countdown is the third deliberate interaction gate. A user who
  pocket-taps or mis-reaches the primary CTA has ten clearly-signalled
  seconds to retract.
- **Flashing heartbeat** signals urgency without being dishonest. The
  animation never implies that help is already on the way · the copy
  explicitly states *"Sending alert in N"*, which is accurate.

## Heartbeat timing · 0.9s cycle

The pulse keyframes animate at a 0.9s cycle · roughly **1.1Hz**. WCAG
2.1 Success Criterion 2.3.1 ("Three Flashes or Below Threshold") caps
general flashing at 3Hz. We are deliberately well below that limit.

Two keyframes animate in parallel:

- `nexEmergencyHeartbeat` · scales the red badge 1.0 → 1.08 → 1.0 and
  pulses an outer box-shadow ring. Attached to the circular seconds
  badge.
- `nexEmergencyHeartbeatText` · fades the "SENDING ALERT IN N" copy
  between opacity 1 and 0.55 on the same beat.

Keyframes are injected once per document via a `<style id="nex-emergency-countdown-heartbeat-keyframes">`
tag so the component stays self-contained and causes no global CSS
collisions.

## Primary vs secondary action

- **CANCEL** is the primary action during the countdown · large,
  red-outlined button, uppercase, matches the standard emergency CTA
  footprint but with the colours inverted (transparent background,
  red border, white text). High contrast on the dark bg.
- **"Skip countdown — send now"** is a secondary muted text link below
  CANCEL. It fires the alert immediately without waiting for the
  counter to reach zero. This acknowledges the founder's "every second
  matters" instinct from the original design brief. If founder
  determines this is confusing or redundant it can be removed in a
  later commit · the primary countdown path is the sealed default.

Why keep the Skip link? A user in a genuine emergency should never
feel the UI is between them and help. Ten seconds is already a trivial
delay, but offering an explicit "send now" button eliminates any sense
that the countdown is forced UX ceremony.

## useEffect cleanup discipline

The countdown driver is a single `React.useEffect` whose dependency on
`phase` ensures:

1. Entering `phase === "counting-down"` resets `secondsRemaining` to
   10, clears any prior interval, and starts a fresh 1-second
   `setInterval`.
2. Transitioning OUT of `"counting-down"` (via CANCEL, Skip, unmount,
   phase change triggered by an error, etc.) clears the interval via
   the effect's return cleanup AND the explicit `clearCountdownInterval`
   call at the top of the effect body.
3. A second, independent `useEffect` with an empty-dependency return
   acts as a belt-and-braces unmount sweep.
4. A `firedRef` boolean guards against double-fire if the final tick
   and the Skip button race in the same frame.

**No alert fires if the countdown is cancelled or the component
unmounts.** The alert fires only on:
- the counter reaching 0 (natural path), or
- an explicit tap of "Skip countdown — send now".

Both paths funnel through the same `fireAlert` callback, which handles
`createDraft` + `activate` + `router.push("/nex-native/emergency-help/active")`.

## Phase state machine

```
acknowledging-policy ─┬─▶ idle ──[tap I NEED HELP]──▶ awaiting-geolocation
                      │                                      │
                      │                                      ▼
                      │                              counting-down ──[CANCEL]──▶ idle
                      │                                      │
                      │                                      ├──[Skip or tick→0]──▶ submitting
                      │                                      │                           │
                      │                                      │                           ├─▶ /active (navigation)
                      │                                      │                           ├─▶ no-responders
                      │                                      │                           └─▶ error
```

The previous phase name `"confirming"` is renamed to `"counting-down"`.
The legacy `nex-emergency-confirm-step` / `nex-emergency-confirm-yes` /
`nex-emergency-confirm-no` testids are retired · tests must reference
`nex-emergency-countdown`, `nex-emergency-countdown-cancel`,
`nex-emergency-countdown-skip`, and the `data-nex-emergency-seconds-remaining`
attribute.

## Test discipline

- Unit tests use `renderToStaticMarkup` + the test-only
  `__testInitialPhase="counting-down"` prop to snapshot the countdown
  block without a DOM event loop.
- Playwright scenario 03a exercises CANCEL during countdown.
- Playwright scenario 03b lets the countdown reach 0 and asserts the
  navigation to `/nex-native/emergency-help/active`.
- Playwright scenario 03c exercises the "Skip countdown" link.

## Non-negotiable invariants (do NOT remove without founder sign-off)

1. The countdown IS a safety feature, not UX ceremony.
2. The flash frequency MUST stay below 3Hz.
3. The interval MUST be cleared on any transition out of
   `counting-down` and on unmount.
4. The alert MUST NOT fire from any phase other than the countdown
   reaching 0 or an explicit Skip tap.
5. The CANCEL button MUST be the visually dominant action during the
   countdown (it is the primary action in that moment).
6. The policy ack and the category pick remain prior gates · the
   countdown does NOT replace them, it replaces only the second-tap
   confirmation that used to follow them.

## Open founder decisions (parked)

- Keep or drop the "Skip countdown — send now" secondary link? Default
  is **keep**.
- Is 10 seconds the right balance? If founder says 5 or 15 is better,
  a single-line constant (`COUNTDOWN_SECONDS` in the component) is the
  only edit required.
- Do we want haptic / audio cues to accompany the heartbeat? Deferred
  to a later infrastructure phase (platform haptic API bridge).
