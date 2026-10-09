# ADR · NEX Cross-DB Owner Link · 2026-10-09

**Status:** Proposed (requires founder sign-off before implementation).
**Replaces:** `directory-service.ts:42-45` cross-DB stub that currently returns
`null`.

## Context

The sealed canonical spine lives in NEX Postgres (`D:/trades/deploy/postgres/
init/`). Owner identity lives in Supabase (`nex_business`, `nex_account`
tables). The two databases are physically separate:

- Postgres FK from `nex.business_canonical.canonical_business_id` to Supabase
  `nex_business.id` is **impossible** at the DB layer.
- Postgres FK from `nex.business_claim.claimed_by_account_id` to Supabase
  `nex_account.id` is **impossible** at the DB layer.

The sealed `nex.business_claim` (migration 176) explicitly makes
`claimed_by_account_id` a text (non-FK) column, documenting the cross-DB
boundary. This ADR specifies the application-layer invariant that enforces
the same property that a DB FK would enforce if it were possible.

## Decision

The cross-DB owner link is enforced by **three invariants + one typed
lookup contract**.

### Invariant 1 · Monotonic claim promotion

A canonical row's `lifecycle_state` transitions to `OWNER_CLAIMED` ONLY via
the write path authored in `src/lib/nex-native/claims/claim-service.ts`
(to be implemented by the I/O layer of this ADR). That write path is the
single source of truth for owner-claim promotion.

### Invariant 2 · Account-id presence at write

The write path refuses to write `OWNER_CLAIMED` without a non-blank
`claimed_by_account_id` string. This is enforced in
`src/lib/nex-native/claims/claim-logic.ts :: decideVerifyClaim`
(reject_blank_account) and by migration 176's CHECK
`ck_bcl_state_fields_consistency` (VERIFIED rows must have claimed_by
NOT NULL).

### Invariant 3 · Account existence verification at write time

Before the write path promotes to VERIFIED, the service calls the Supabase
`nex_account` lookup through the typed contract below. If the lookup
fails or returns no account, the claim is refused with
`reject_account_not_found` (a new discriminated case to add to
`VerifyClaimDecision`). The absence of a DB FK is replaced by this
synchronous cross-DB round-trip.

### Typed lookup contract

```ts
export interface AccountExistenceLookup {
  /** Returns true iff the account exists AND is active in Supabase.
   *  Throws on network/credential failure; the caller must catch and
   *  treat as "lookup unavailable" rather than silently approving.
   *  The lookup is cached at a documented TTL (see §Caching below). */
  (accountId: string): Promise<boolean>;
}
```

The lookup is injected into the claim service; the service does NOT
import Supabase directly. This keeps claim-logic.ts pure and makes the
service testable with a fake lookup.

## Consequences

### Correctness guarantees

- A claim verified against a non-existent Supabase account is refused.
- A canonical row's `OWNER_CLAIMED` always has a valid
  `claimed_by_account_id` traceable to a real account AT WRITE TIME.
- The lookup can be stubbed in unit tests; integration tests use a real
  (dev) Supabase instance.

### Known weaknesses (vs. a real FK)

- **Time-of-check vs. time-of-use.** If a Supabase account is deleted
  AFTER the claim is verified, the Postgres `claimed_by_account_id`
  becomes a dangling pointer. Mitigation: a nightly reconciliation job
  (future wave) checks every `OWNER_CLAIMED` canonical against the
  Supabase account's current state and flags orphaned rows for admin
  review.
- **Supabase lookup availability.** If Supabase is unreachable, no new
  claims can verify. Acceptable; failing closed is correct.
- **Caching risk.** A cached-TRUE lookup on an account deleted mid-cache
  could admit a claim. Mitigation: cache TTL is bounded (recommend 60s)
  and the reconciliation job catches late deletions.

### Caching

- The `AccountExistenceLookup` SHOULD cache positive results for ≤60s to
  avoid pounding Supabase during claim verification sprees.
- Negative results SHOULD NOT be cached — a user may create their account
  in Supabase moments before entering their claim code; a negative cache
  would race-condition against account creation.

### Reverse direction: canonical lookup from account

Supabase surfaces that need "which business does this account own?" use
the reverse lookup:

```ts
export interface BusinessesOwnedByAccount {
  (accountId: string): Promise<readonly {
    readonly canonical_business_id: string;
    readonly name_canonical: string;
    readonly entity_type: string;
  }[]>;
}
```

Implemented by querying `nex.business_claim` WHERE
`claimed_by_account_id = $1 AND state = 'VERIFIED'`. This lookup lives
in the Directory service module; the Supabase side consumes it over
the same HTTP contract as any other service.

## Implementation plan

1. **Service module** · `src/lib/nex-native/claims/claim-service.ts`
   - Imports `claim-logic.ts` for pure decisions.
   - Takes `pg Pool` + `AccountExistenceLookup` as constructor-time deps.
   - Writes the 3-table transaction per `planAcceptedClaimWrite`.
2. **Supabase lookup implementation** · a thin module that uses the
   existing Supabase client singleton and queries `nex_account` by id.
3. **Reconciliation job** · a scheduled task that scans `OWNER_CLAIMED`
   canonicals against Supabase; writes `orphaned_at` to a new
   lifecycle-log transition `transition_reason = 'orphan_detected'`
   when a mismatch is found.
4. **Directory service cutover** · remove the `null` stub at
   `src/lib/nex-native/directory/directory-service.ts:42-45`; replace
   with a resolved call into `BusinessesOwnedByAccount`.

## Alternatives considered

### FDW (Foreign Data Wrapper)

Setting up `postgres_fdw` from NEX Postgres to Supabase would allow a
cross-DB FK-like referential integrity check. Rejected because:
- Supabase does not expose stable TCP endpoints suitable for FDW.
- The FDW connection pool is a shared operational dependency and a
  cross-cutting failure mode.
- The application-layer invariant is simpler to reason about and test.

### Push model (Supabase → NEX)

Every account-create/delete in Supabase fires a webhook that updates a
local `nex.known_accounts` mirror table. Rejected because:
- Webhook delivery is not transactional with Supabase's own writes.
- Mirror drift adds a second source of truth to reconcile.
- The reconciliation job in the Decision above is simpler.

## Status progression

- 2026-10-09 · ADR authored. **Requires founder sign-off.**
- (future) · Approved. Implementation begins.
- (future) · Implementation complete. Directory service stub replaced.
- (future) · Reconciliation job scheduled. Orphan detection operational.

## References

- `D:/trades/deploy/postgres/init/176_nex_business_claim.sql` — the
  `claimed_by_account_id text NULL` column with cross-DB documentation.
- `D:/trades/src/lib/nex-native/claims/claim-logic.ts` — the pure
  decision functions that this ADR's service module wraps.
- `D:/trades/src/lib/nex-native/directory/directory-service.ts:42-45` —
  the current stub returning `null` that this ADR eventually replaces.
