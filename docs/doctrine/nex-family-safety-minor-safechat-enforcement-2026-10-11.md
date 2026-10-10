# NEX Family Safety · Minor SafeChat Enforcement

Authored 2026-10-10 by CC-4. Dates are ESTIMATES.

## 1 · Founder decision D

**SafeChat is ALWAYS ON for minor accounts. The parent cannot disable
it.**

This is a founder-sealed child-safeguarding commitment, not a UI
default. The system enforces it at three layers:

1. **DB default** · `nex.account_minor_profile.safechat_always_on
   boolean NOT NULL DEFAULT TRUE`.
2. **Service enforcement** · `minor-safechat-enforcer.ts` refuses to
   write `FALSE` while `is_minor=TRUE`, returning the error reason
   `safechat_always_on_locked_for_minor`.
3. **UI invariant** · The parent's dashboard renders the minor
   SafeChat panel as read-only. There is no toggle. The copy explains
   this explicitly.

## 2 · Enforcer interface

Location (CC-3): `src/lib/nex-native/family-safety/minor-safechat-enforcer.ts`.

```ts
export interface SafeChatFlags {
  readonly loggingEnabled: boolean;
  readonly userFacingEnabled: boolean;
}

/**
 * The authoritative resolver for an account's SafeChat flags.
 *
 * Minor accounts always resolve to { loggingEnabled: true,
 * userFacingEnabled: true } · the GLOBAL SafeChat flag CANNOT turn
 * these off for a minor.
 */
export async function resolveSafeChatFlagsForAccount(
  accountId: string,
): Promise<SafeChatFlags>;

/**
 * Server action that attempts a mutation. Rejects with the specific
 * reason code if the account is a minor.
 */
export async function tryDisableSafeChatForAccount(
  accountId: string,
): Promise<
  | { readonly ok: true }
  | {
      readonly ok: false;
      readonly reason: "safechat_always_on_locked_for_minor" | "not_permitted";
    }
>;
```

## 3 · Why parent cannot disable

Allowing a parent to turn off SafeChat for a minor would:

- Create a mechanism of **domestic abuse** — a coercive parent could
  remove the one safety signal that protects the child from them.
- Create an **unsafe liability surface** — NEX would be the system that
  "could have stopped it".
- Create a **legal gap** — Indonesian child-protection law treats
  SafeChat-grade monitoring as the safety floor; disabling it for a
  minor would void that floor.

The sealed doctrine is: **the only path to turn off SafeChat for a minor
account is to no longer be a minor.** That transition is owned by the
age-transition workflow (CC-3) and is bounded by the child's 16th
birthday.

## 4 · Interaction with the global SafeChat flag

NEX has a system-wide `NEX_SAFECHAT_ENABLED` flag that gates SafeChat
for the whole product. The minor enforcer **overrides** the global flag
in the following direction:

| Global flag | `is_minor=TRUE` | `is_minor=FALSE` |
| ----------- | --------------- | ---------------- |
| ON          | ON (always)     | per account      |
| OFF         | ON (always)     | OFF              |

In other words: the global flag can only ever turn SafeChat OFF for
NON-minor accounts. A minor is always protected regardless of global
state. This is why `resolveSafeChatFlagsForAccount` returns
`{ loggingEnabled: true, userFacingEnabled: true }` for every minor
regardless of the environment.

The sealed classifier version (`DEFAULT_CLASSIFIER_VERSION = "1.1.0"`)
is independent of this enforcement. CC-4's spec S27 verifies the
classifier version remains at `1.1.0` and has not been silently promoted
to `1.1.1`.

## 5 · Future SafeChat hook consumption contract

CC-3's enforcer is the SINGLE source of truth for SafeChat flags on an
account. The future refactor of the sealed `src/lib/nex-native/safechat`
pipeline will CONSUME this contract rather than reading its own flag
sources. The flow becomes:

```
message in
  ↓
resolveSafeChatFlagsForAccount(senderAccountId)
  ↓                                     ↓
loggingEnabled=TRUE?                    userFacingEnabled=TRUE?
  ↓                                     ↓
run classifier,                        if content triggers,
log result                              surface to user
```

Note that for a minor sender the parent sees a SUMMARY of flagged
content (via the sealed dashboard SafeChat summary panel), never the
message bodies. "Summary" is deliberately coarse: category + count,
never content. This is the sealed FS-3 ceiling and is not relaxed by
this wave.

## 6 · What CC-4 verifies in Playwright

Spec: `tests/e2e/nex-family-safety-minor-safechat-enforcement.spec.ts`.

- **S26** — Direct attempt to set `safechat_always_on=FALSE` on a minor
  must fail with reason `safechat_always_on_locked_for_minor`. The spec
  tests the OBSERVED post-condition via Supabase service role (DB-level
  trigger / RLS backs the enforcer); until CC-3's migration companion
  ships the DB-level enforcement, this scenario is `test.fixme()` with
  the honest note that vitest covers the service-layer path.
- **S27** — Grep the sealed classifier source for the default version
  constant and assert it equals `"1.1.0"`. This is testable today.
- **S28** — Dynamic import of the enforcer module, call
  `resolveSafeChatFlagsForAccount(minorAccountId)`, assert
  `{ loggingEnabled: true, userFacingEnabled: true }`. `test.fixme()`
  until the module ships.

## 7 · Dates

Dates are **ESTIMATES**. The CC-3 enforcer is expected the same wave as
this doctrine document; the Playwright specs are green-lit the moment
the module lands.
