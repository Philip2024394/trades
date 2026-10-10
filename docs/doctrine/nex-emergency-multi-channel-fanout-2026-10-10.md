# NEX Emergency Help · Multi-Channel Fan-Out Doctrine

**Sealed 2026-10-10 · L3**

This doctrine covers the service that actually sends the emergency
alert to recipients. It replaces the "notification hook is a no-op"
posture from the F4 foundation.

## 1 · Why multi-channel

The attacker-removes-phone threat model is the load-bearing frame.
A single-channel system is fragile:

- If an attacker takes the phone, in-app push to the owner's phone
  will not reach their trusted contacts.
- If a trusted contact's phone is off, SMS alone fails silently.
- If an email is in a rarely-opened inbox, email alone fails
  silently.

A multi-channel fan-out MAXIMISES the probability that at least one
channel reaches at least one trusted contact in time. We do NOT rely
on any single channel being the one that works.

## 2 · Channels in v1 · what is working, what is honest-blocked

| Channel         | v1 PILOT      | Live-mode prerequisites                        |
|-----------------|---------------|------------------------------------------------|
| Email           | WORKING       | SMTP env vars + `NEX_EMERGENCY_EMAIL_REAL_SEND=true` + founder sign-off |
| SMS             | HONEST-BLOCKED | Twilio (or peer) agreement + credentials + wiring |
| WhatsApp        | HONEST-BLOCKED | WhatsApp Business API agreement + wiring       |
| In-app NEX push | HONEST-BLOCKED | VAPID keys + push subscription infra wired     |

Honest-blocked means: the adapter stub returns `ok=false` with a
sealed reason, and the fan-out audit log records the attempt
faithfully. We NEVER fabricate delivery. The reason an operator
reads in the audit log is the exact reason the stub returned.

Email reuses the sealed SMTP transport at
`src/lib/nex/listing-chat/smtp.ts` (`enqueueEmail`), the same code
path the owner-claim invite uses. No new email infra.

## 3 · Why trusted contacts can be email-only or phone-only

Most people's real-world trusted contacts (parent, partner, close
neighbour) are not on NEX. If the trusted-contact list only accepts
NEX accounts, most lists stay empty, and the fan-out has nowhere to
go. Migration 196 drops the NOT NULL on `contact_account_id` and
adds `contact_email` + `contact_phone`, with a CHECK that at least
one of the three identifiers is present.

Partial unique indexes keep each identifier unique per owner where
present (nulls do not collide):

- `(owner_account_id, contact_account_id)` WHERE account id present
- `(owner_account_id, lower(contact_email))` WHERE email present
- `(owner_account_id, contact_phone)` WHERE phone present

Surrogate PK `trusted_contact_id uuid` replaces the composite PK so
email-only / phone-only rows have a stable id.

## 4 · Fan-out semantics per transition

The L1 state machine fires five transitions. Each has a sealed
message type and a sealed recipient scope:

| Transition              | Recipient scope                                        | Message intent                                                                 |
|-------------------------|--------------------------------------------------------|--------------------------------------------------------------------------------|
| `pending_confirmation`  | Trusted contacts only                                  | FIRST-FAN-OUT · "may need help · 10-second safety window · keep phone nearby"  |
| `active`                | Trusted contacts + nearby opted-in responders          | CONFIRMED-FAN-OUT · "confirmed · needs help now"                               |
| `revoked_within_window` | Trusted contacts (anyone who received the first)       | REVOKED-FAN-OUT · "cancelled by the requester within the 10-second safety window · no action required" |
| `cancelled`             | Everyone previously notified                           | CLOSED-FAN-OUT · "cancelled by the requester · no further action required"    |
| `resolved`              | Everyone previously notified                           | CLOSED-FAN-OUT · "resolved · thank you"                                        |

The emotional distinction between `revoked_within_window` and
`cancelled` matters for responders who may already be moving. The
sealed wording for `revoked_within_window` is the exact string:

> "The alert sent moments ago was cancelled by the requester within
> the 10-second safety window · no action required."

## 5 · Idempotency guarantees

The idempotency key is a sha256 of
`sha256(incidentId:transition:channel:recipient_identifier)`.

Guarantees:

- Firing the same transition twice (e.g. L1 retries after a crash)
  does NOT send twice. The DB layer's
  `UNIQUE(idempotency_key)` on `nex.emergency_fanout_log` swallows
  the second insert. The service treats the conflict as
  `alreadyLogged=true`.
- Firing a DIFFERENT transition for the same (incident, channel,
  recipient) DOES log and attempt again, because the key is
  transition-scoped. This is correct behaviour: the recipient needs
  separate messages for `pending_confirmation` vs `revoked_within_window`.
- The email adapter is advisory-idempotent via the `providerMessageId`
  it returns; the audit log is authoritative.

## 6 · Audit log + retention

A dedicated table `nex.emergency_fanout_log` (migration 197). High
write volume · deliberately separate from `nex.cross_db_reconcile_log`
(slow-cadence reconciler stream).

Opaque recipient identifiers · raw PII never enters the audit:

- `account:<uuid>` for NEX account ids
- `email:<sha16>` for email addresses (lower-cased before hashing)
- `phone:<sha16>` for phone numbers (normalised before hashing)

Retention aligned with the sealed abuse-policy doctrine
(`nex-emergency-help-abuse-policy-2026-10-10.md`): **180 days**.
Operator-owned sweep job (not shipped in this phase) deletes rows
older than that cutoff.

## 7 · Live-mode activation checklist

Live-mode fan-out is a founder decision. Before flipping ANY
non-simulated send:

1. Founder sign-off on the exact sealed wording for all five
   transitions (see `_email-adapter-for-emergency.ts ·
   composeEmergencyEmailBody`). The current wording is a draft;
   small edits should land as a doctrine amendment commit, not an
   ad-hoc code change.
2. SMS provider agreement (Twilio, Vonage, or local equivalent).
   The adapter contract already carries a `provider_unavailable`
   reason for soft failures. Replace `_sms-adapter-stub.ts` with a
   real adapter following the same return-value contract.
3. WhatsApp Business API agreement if WhatsApp is in-scope.
4. VAPID keys for in-app push + the service worker subscription
   path wired through `/nex-emergency-sw.js` (H3's work).
5. `NEX_EMERGENCY_EMAIL_REAL_SEND=true` AND `NEX_EMERGENCY_LIVE_MODE=true`
   both set in the production environment.
6. Service layer passes `simulated=false` into the fan-out args.
   Both the env flag AND the arg are required.

## 8 · What this doctrine does NOT cover

- The policy for who may be added as a trusted contact (handled by
  the service-layer self-contact and dedup guards).
- The requester-side 10-second countdown UI (owned by L1).
- The responder-side pending/revoked chrome (owned by L2).
- The expiration sweep that transitions `active → expired` after
  30 minutes (operator-owned background job).
- The policy for how a nearby opted-in responder's name is
  presented to the requester (recipient-resolver scope).

## 9 · Operator seam · how L3 wires into L1

L1 owns `src/lib/nex-native/emergency/_notification-hook.ts` (the
stub). L3 owns `emergency-notification-service.ts` (the real
implementation).

L1's hook resolves the real module via dynamic `import()` at call
time. The hook is a tiny shim that calls `fanOutForTransition(args)`
on the real module and swallows any resolution error (so a boot
with the real module missing degrades to the sealed no-op).

If L1 ships the stub as a literal no-op (not an import-resolver
pattern), the operator seam is a two-line swap in L1's hook:

```typescript
export async function fanOutForTransition(args: FanOutArgs): Promise<FanOutResult> {
  try {
    const real = await import("./emergency-notification-service");
    return real.fanOutForTransition(args);
  } catch {
    return {
      incidentId: args.incidentId,
      transition: args.transition,
      attempted: 0,
      succeeded: 0,
      failed: [],
      honestBlocked: [],
      simulated: true,
    };
  }
}
```

This swap is in L1's scope. L3 cannot do it. The service module
is side-effect-free on import so the swap is safe.

## 10 · Doctrine references

- `nex-emergency-help-foundation-2026-10-10.md` (F4 foundation)
- `nex-emergency-help-countdown-2026-10-10.md` (10-second window)
- `nex-emergency-help-abuse-policy-2026-10-10.md` (retention)
- `nex-emergency-help-police-handoff-2026-10-10.md` (police channel · out of scope here)
- `nex-emergency-live-location-2026-10-10.md` (H3 location stream)
