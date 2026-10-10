# NEX Family Safety · subscription · TEST MODE doctrine

Sealed 2026-10-10 · FS-4 wave · subscription + entitlement data layer.

## What this is

The subscription slice of the Family Safety product. One migration (202)
adds two tables (`family_safety_entitlement`, `family_safety_payment_attempt`),
one adapter interface (`PaymentAdapter`), one wired adapter
(`TEST_PAYMENT_ADAPTER`), and six pages:

- `/nex-native/family-safety/subscription` · plan info
- `/nex-native/family-safety/subscription/checkout` · simulated checkout
- `/nex-native/family-safety/subscription/success`
- `/nex-native/family-safety/subscription/failure`
- `/nex-native/family-safety/subscription/cancelled`
- `/nex-native/family-safety/subscription/manage`

## Load-bearing invariants (every one is a test)

1. `test_mode = TRUE` at every INSERT · the service refuses writes that
   attempt `test_mode = false` in Phase 1.
2. `simulated = TRUE` at every INSERT.
3. `hasActiveEntitlement(accountId, planId)` is the SINGLE gate for
   feature flags that require Family Safety access.
4. Duplicate payment callback with the same `idempotency_key` resolves
   to `outcome='duplicate_ignored'` without granting a second entitlement.
5. Failure path never writes `state='active'`.
6. Cancel path never writes `state='active'`.
7. All UI pages carry a SIMULATED · TEST MODE banner.
8. Pricing is PLACEHOLDER · no real currency figures are invented until
   the founder approves a commercial model.
9. One FREE plan (`family_safety_pilot_free`) is available so the full
   journey can be exercised with no pricing commitment.
10. Server actions enforce `resolveNexAppSessionFromContext` auth.

## How a real payment provider adds itself later

The payment-adapter interface is the only extension point. A real
provider (Stripe, Xendit, etc.) adds itself WITHOUT touching the
entitlement service or any page:

1. Create a new adapter file next to `test-payment-adapter.ts`
   (e.g. `stripe-payment-adapter.ts`).
2. Export a `PaymentAdapter` whose `id` matches an existing enum slot
   on `payment_provider` in migration 202 (`stripe_tbd`, `xendit_tbd`,
   or add a new slot in a new migration).
3. Call `registerPaymentAdapter(myAdapter)` in a server-side bootstrap
   path (never from client code).
4. Flip the entitlement service's provider resolution from
   hard-coded `test_mode` to a config value when the founder authorises
   switching from test to live.

The `PaymentIntentResult` envelope is the sealed contract. Every
adapter must return it exactly. The entitlement service pattern-matches
on `kind` and writes the appropriate audit row.

## Pricing policy

PLACEHOLDER until the founder approves a commercial model. No approved
pricing fields invent a currency figure. Every non-free plan carries a
"PLACEHOLDER pricing · founder has not approved commercial model" chip.

The free pilot plan (`family_safety_pilot_free`) is marked
`isFreePilot: true` and carries a "FREE · pilot" chip. This is the only
plan that can be activated in Phase 1.

Approved pricing fields in the DB:

- `plan_id` (CHECK constraint sealed · a new paid plan requires a new
  migration + new catalog entry).
- `payment_provider` (CHECK: `test_mode`, `stripe_tbd`, `xendit_tbd`,
  `manual_grant`).

## Author / seal

FS-4 agent · 2026-10-10 · branch `nex/directory-work` · migration 202 ·
founder authorisation on file.
