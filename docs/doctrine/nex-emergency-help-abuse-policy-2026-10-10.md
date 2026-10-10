# NEX Emergency Help · Abuse Policy & Enforcement
> Sealed 2026-10-10 · pilot phase (SIMULATED · v1) · enforcement NOT active

## Purpose

NEX Emergency Help is a community safety network. For it to be trusted
by both people requesting help and people who agree to respond, the
feature must be protected from deliberate misuse without ever
discouraging a genuine request for help.

## Guiding principle · the overriding rule

**NEX must never deter a genuine emergency request because a user is
afraid of being punished.** The policy targets intentional misuse, not
honest mistakes or situations the requester cannot fully explain in
the moment. Every enforcement decision applies this principle first.

## The safety warning (sealed wording)

Shown on the confirmation screen as the acknowledgment gate. Must be
tapped through once per browser session before the primary CTA renders.

- Heading · "Important Safety Warning"
- Para 1 · "Emergency alerts are intended for genuine situations where
  you need urgent assistance."
- Para 2 · "False, fabricated, or deliberately misleading emergency
  alerts are strictly prohibited. Users who misuse this feature may
  have their NEX accounts suspended or permanently removed from the
  NEX community."
- Para 3 · "If you are genuinely in danger, do not hesitate to request
  help. If you activate an alert by mistake, cancel it immediately and
  notify the recipients."
- Confirmation · "By continuing, you confirm that you understand and
  agree to use Emergency Help responsibly."
- Primary action · "I Understand — Continue"
- Footer · "Concept design · Not a working emergency service"

Implementation: `src/components/nex-native/emergency/EmergencyConfirmationScreen.tsx`
phase `"acknowledging-policy"` · session-storage key
`"nex-emergency-policy-ack-v1"` (new session re-shows the warning).

## Three-tier enforcement model

### Tier 1 · Accidental activation
Signal · requester cancels the alert within a short window, OR explicit
"I activated this by mistake" tap on the active-incident view.

Response · immediate cancellation propagated to all notified
recipients; a courtesy message is sent to recipients ("The requester
cancelled this alert. No action is required."). No automatic
restrictions. No account flag. Not recorded as a strike.

Rationale · an honest mistake must never translate into a punishment
chill. Protecting the feature means protecting genuine requests from
being deterred.

### Tier 2 · Repeated misuse or reckless false alerts
Signal · recipient-reported false alert, OR rate-limit breaches
beyond the pilot thresholds (3 concurrent / 10 per 24h), OR a review
reveals that the requester had no plausible emergency.

Response · incident is reviewed by a NEX safety operator. Possible
outcomes:
- A written warning plus education material delivered in-app.
- A temporary cooldown on raising further Emergency Help alerts (e.g.
  24-72h), with other NEX functionality unaffected.
- A short-term suspension of the Emergency Help feature on the
  account.

Account-wide suspension is NOT a Tier-2 default · it is reserved for
Tier 3.

### Tier 3 · Deliberate or malicious false alarms
Signal · evidence of intentional fabrication, coordinated abuse,
targeting an individual with false alerts, or any attempt to weaponise
the alert flow to harass responders.

Response · incident is reviewed by a NEX safety operator with a second
operator sign-off. Possible outcomes:
- Permanent removal of Emergency Help from the account.
- Full NEX account suspension, up to permanent removal from the NEX
  community.
- Where applicable, the matter is referred to local authorities (the
  decision to refer requires explicit founder sign-off).

Tier 3 outcomes may be appealed in writing within 30 days (see
Appeals, below).

## Retention and privacy

Enforcement decisions require evidence to be fair. The retention
schedule balances investigation needs against the user's right to
privacy.

- Incident metadata (requester, state transitions, timestamps,
  responder opt-in list, cancellation events) · retained for 180 days
  on NEX Postgres (`nex.emergency_incident`, `nex.incident_recipient`),
  then deleted.
- Location data (lat/lng, accuracy) · retained for 30 days from
  incident closure, then anonymised (lat/lng rounded to 3 decimal
  places · ≈ 110m precision).
- Reports of abuse · retained for 2 years to support repeat-offender
  detection; reporter identity is NEVER exposed to the reported user.
- Appeals and operator sign-offs · retained for 7 years as part of the
  safety audit trail.

The retention sweep is a background job (not yet implemented in v1 ·
tracked under the deferred items register).

## Appeals process

Any account action under Tier 2 or Tier 3 is appealable within 30
days. The appeal must be reviewed by a different operator than the
original decision-maker. Appeals that reveal a mistake or missing
context MUST reverse the action and restore the account.

Appeals are logged in the safety audit trail. A pattern of overturned
decisions by a specific operator triggers an internal review of that
operator's judgement.

## What the system MUST NOT do

- Automatically apply any punishment following a single alert, no
  matter how it was raised.
- Shame or publicly flag the requester on their profile.
- Display response status (accept / decline) to a responder in a way
  that incentivises false acceptances.
- Use the user's location data for any purpose other than this
  specific incident · it is NEVER passed to analytics, marketing, or
  third parties.
- Discourage a genuine request by raising a punishment reminder once
  the incident is active · the warning is shown ONCE on the
  acknowledgment gate, never during active state.

## Pilot phase (SIMULATED · v1)

- No real alerts are broadcast. All incidents carry `simulated=TRUE`.
- Enforcement in this document is NOT active during the pilot ·
  violations do not result in account action.
- The acknowledgment gate, the warning wording, the three-tier model
  and the retention schedule are all authored now so they are ready
  on the day live mode is authorised.
- Live-mode activation requires: (a) explicit founder sign-off on this
  policy, (b) a safety operator rota, (c) retention sweep implemented,
  (d) appeals channel wired.

## Change log

- 2026-10-10 · initial seal · pilot phase, enforcement not active,
  wording approved by founder, three-tier model authored.
