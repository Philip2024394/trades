# NEX Emergency Help · Police Hand-off Doctrine

Sealed 2026-10-10 by the Radius + Report-to-Police agent (H2).

## 1. Why NEX never auto-calls emergency services

NEX is a social directory and member-coordination platform. It is **not** a
licensed emergency-response integrator. Operating a system that initiates
calls to real emergency services introduces three cliffs we are not
positioned to cross in v1:

1. **Legal.** Most jurisdictions regulate who may originate traffic to
   the public safety answering point (PSAP). In the United States,
   NG9-1-1 compliance (RFC 6881, i3) requires an originating service
   provider (OSP) relationship with each PSAP region. In the EU, 112
   call origination falls under the ETSI TS 103 479 framework. In
   Indonesia, the national Call Center 112 is operated by regional
   governments under Permenkominfo No. 10/2016, with routing contracts
   per city. We do not hold any of these relationships.
2. **Safety.** A bad auto-call (false positive, misrouted location,
   wrong operator language) wastes finite emergency capacity and can
   displace someone genuinely in need. A human-in-the-loop call,
   placed by someone who can describe the situation in words the
   operator understands, is strictly safer.
3. **Liability.** If NEX "calls on your behalf" and the call fails to
   complete, or completes to the wrong PSAP, or completes but conveys
   wrong information, we have accepted the duty of care. Hand-off
   dialing keeps the duty with the responder, who already consented to
   be in the responder pool.

## 2. The two load-bearing invariants

### Invariant 1 — Disclosure must always be visible

Every surface that offers an emergency-services button MUST render the
exact disclaimer:

> "NEX has not contacted emergency services on your behalf. Tapping
> the button above opens your phone's dialer. You must speak to the
> operator and relay the location."

This string is exported from
`src/components/nex-native/emergency/ReportToPolicePanel.tsx` as the
constant `POLICE_HANDOFF_DISCLAIMER` and is enforced by unit tests. Do
not reword without:

1. Legal review.
2. A paired edit of the test asserting the verbatim string.
3. An update to this doctrine document.

### Invariant 2 — The number is dialed from the user's device

The `href="tel:<number>"` attribute MUST contain only the resolved
emergency number literal. **Never** append lat/lng, commas, pluses,
URL params, or SIP paths. Rationale:

- Many dialers refuse `tel:` URIs with non-digit characters outside
  `+ * # , ;` (RFC 3966 subset).
- Mixed-content URIs confuse the user into believing NEX is routing
  the call. The whole point of hand-off dialing is that the responder
  initiates the call themselves.

Coordinates are rendered in a separate, selectable code block beside
the dial button. The responder is expected to read them to the
operator by voice (which is also what the local operator will accept
anyway — PSAPs are not configured to receive lat/lng over the
signalling plane for calls originated outside their OSP contract).

## 3. Country-number source register

The seed table lives at
`src/lib/nex-native/emergency/local-emergency-numbers.ts`. It covers
20 countries chosen for the v1 pilot footprint:

| Code | Country       | General | Police | Ambulance | Fire |
|------|---------------|---------|--------|-----------|------|
| ID   | Indonesia     | 112     | 110    | 118       | 113  |
| AU   | Australia     | 000     | 000    | 000       | 000  |
| GB   | United Kingdom| 999     | 999    | 999       | 999  |
| US   | United States | 911     | 911    | 911       | 911  |
| NZ   | New Zealand   | 111     | 111    | 111       | 111  |
| JP   | Japan         | 110     | 110    | 119       | 119  |
| CN   | China         | 110     | 110    | 120       | 119  |
| IN   | India         | 112     | 100    | 102       | 101  |
| DE   | Germany       | 112     | 110    | 112       | 112  |
| FR   | France        | 112     | 17     | 15        | 18   |
| ES   | Spain         | 112     | 091    | 061       | 080  |
| IT   | Italy         | 112     | 113    | 118       | 115  |
| BR   | Brazil        | 190     | 190    | 192       | 193  |
| ZA   | South Africa  | 10111   | 10111  | 10177     | 10111|
| KR   | South Korea   | 112     | 112    | 119       | 119  |
| TH   | Thailand      | 191     | 191    | 1669      | 199  |
| SG   | Singapore     | 999     | 999    | 995       | 995  |
| MY   | Malaysia      | 999     | 999    | 999       | 994  |
| PH   | Philippines   | 911     | 911    | 911       | 911  |
| VN   | Vietnam       | 113     | 113    | 115       | 114  |

International fallback (ITU-T E.161): **112**. Used for unknown,
missing, or malformed country codes.

### Verification obligation before live mode

Before the `SIMULATED · v1` chip is flipped off for any country, the
operator MUST verify every row for that country against the current
official directive. Minimum sources:

- Government interior / home-affairs ministry web page.
- The national telecom regulator's emergency-dialing circular.
- The relevant Wikipedia entry (as a *starting* cross-check, not an
  authority).

Numbers do change — e.g. Indonesia's rollout of 112 as a unified line
alongside the long-standing 110/113/118 split; several European
member states' migration from legacy 999 to 112; the US's
jurisdiction-level transition from CAMA to NG9-1-1. The register in
this doctrine must be re-checked annually and whenever a founder
authorises activation in a new country.

## 4. SIMULATED chip in v1

The `ReportToPolicePanel` renders the `SimulatedBadge` by default
(`simulated={true}`). This mirrors every other Emergency Help
surface in v1. Rationale: a responder testing the pilot flow must
never mistake it for a live hand-off and feel pressured to dial a
real number. The chip disappears via the explicit `simulated={false}`
prop — nothing else — once the live-mode flag flips (per the
`SimulatedBadge` doctrine).

## 5. Future: notarised calls via Twilio Programmable Voice (DEFERRED)

Scenario: a responder is willing to be the person who talks to the
operator, but the founder's product research shows that in several
pilot countries the responder's local provider blocks `tel:` URIs
originated from in-app WebViews, or the responder is on a tablet with
no cellular radio. In that scenario we would want NEX itself to bridge
a Twilio-originated call to the responder on one leg and to the local
PSAP on the other, with a recorded audit trail ("notarised call").

This is **deferred** until all of the following land:

1. A per-jurisdiction legal review of OSP-equivalence requirements.
2. A per-country PSAP routing contract or carrier termination
   agreement that is lawful without such contract (very narrow set).
3. A separate consent flow where the responder opts in to NEX
   originating a bridged call rather than opening their dialer.
4. A redaction/retention policy for the recorded audit trail.
5. A funding and insurance model that covers call-failure liability.

Until all five land, Twilio bridging stays off the roadmap. The
hand-off dial model is the sealed v1 architecture.

## 6. Radius default

The recipient-resolver default radius is sealed at **10 km** (prior
value 5 km, widened 2026-10-10 per founder directive). The constant
lives at `DEFAULT_RADIUS_KM` in
`src/lib/nex-native/emergency/recipient-resolver.ts` and is
overridable via the `NEX_EMERGENCY_DEFAULT_RADIUS_KM` env var within
the resolver's valid range `[1, 25]`. Values outside the range silently
fall back to 10 to prevent misconfiguration from throwing at
call-time.

Note: the resolver itself still requires an explicit `radiusKm`
argument from every caller. The default constant is for upstream
service layers that want a canonical value.

## 7. Load-bearing anti-patterns

- Never claim NEX contacted / notified / alerted emergency services.
- Never put lat/lng in the `tel:` href.
- Never auto-dial.
- Never translate the disclaimer without legal review per locale.
- Never hide the SIMULATED chip based on viewport, scroll, or any
  condition except the explicit `simulated={false}` prop.
- Never remove the hand-off entry on a non-terminal incident — the
  responder may change their mind at any moment during the response
  window.
- Never add the Report-to-Police entry on terminal incidents — the
  emergency is over and surfacing the dial button would be noise.

## 8. Files

- `src/lib/nex-native/emergency/recipient-resolver.ts` ·
  `DEFAULT_RADIUS_KM = 10` with env override.
- `src/lib/nex-native/emergency/local-emergency-numbers.ts` ·
  20-country seed + international fallback + `resolveEmergencyNumber`.
- `src/components/nex-native/emergency/ReportToPolicePanel.tsx` ·
  composable panel with coordinates block + copy button + disclaimer.
- `src/components/nex-native/emergency/IncidentAlertCard.tsx` ·
  compact entry button `data-testid="nex-emergency-report-police"`
  mounting the panel inline (collapsed by default).
- Tests: `local-emergency-numbers.test.ts`,
  `ReportToPolicePanel.test.tsx`, updates to
  `IncidentAlertCard.test.tsx` and `recipient-resolver.test.ts`.
