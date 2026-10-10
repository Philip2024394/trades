// src/lib/nex-native/account-gate/account-exists-reader.ts
//
// NEX Settings Header · Account-Gate Reader (server-only)
// -----------------------------------------------------------------------
// Sealed 2026-10-10.
//
// Single source of truth for the HEADER-level account gate. The Settings
// button in the shared NEX page header renders either:
//
//   · UNLOCKED   · when the current viewer has a nex_account row       →
//                  render the normal gear icon + Link to /settings.
//   · LOCKED     · when the current viewer has NO nex_account row      →
//                  render the 3D-styled LockedSettingsIcon + onClick
//                  opens the CreateAccountPrompt modal.
//
// This file wraps the sealed `resolveNexAppSessionFromContext` helper
// (src/lib/nex-native/app/session.ts) and reduces its rich result to
// the three bits the UI needs:
//
//   · accountExists           · true iff session has a non-null account
//   · signedInWithoutAccount  · true iff Supabase auth user exists but
//                                no nex_account row has been resolved.
//                                In the current app this is a very
//                                transient state (session.ts auto-
//                                provisions on first sign-in), but the
//                                prompt copy still accounts for it so
//                                we never show misleading "create a
//                                fresh account" copy to someone who is
//                                already partway through onboarding.
//
// Safe-default on error: if the resolver throws (DB down, network
// hiccup, malformed JWT etc.) we return
// `{ accountExists: false, signedInWithoutAccount: false }`. The lock
// state IS the gate · a failed resolver must NOT silently reveal
// Settings. Users may dismiss the prompt per-tap if they already have
// an account but can't sign in — that path is handled on the sign-in
// surface, not the header.
//
// Load-bearing anti-patterns:
//   · Never bypass `resolveNexAppSessionFromContext`. Reading cookies
//     directly duplicates auth logic and will drift.
//   · Never leak the specific resolver error up to the UI. The gate
//     keeps the lock on and lets the user retry.
//   · Never cache the result · auth state can change per-request.

import "server-only";
// NOTE · we lazy-import `resolveNexAppSessionFromContext` inside the
// function body so that unit tests (which inject a `resolveSession`
// stub) do not trigger `src/lib/nex-native/supabase-admin.ts`'s
// hard-fail on missing env vars at module-load time. The dynamic
// import is a one-time cost in production (ES modules cache).

export interface AccountExistsSnapshot {
  /** True iff the current viewer has a non-null nex_account.id. */
  readonly accountExists: boolean;
  /**
   * True iff the viewer has a Supabase auth session but no NEX account
   * row yet. In the sealed app this is a very narrow window because
   * `session.ts` auto-provisions on first resolve; still exposed so the
   * CreateAccountPrompt can switch copy from "Create account" to
   * "Finish setup".
   */
  readonly signedInWithoutAccount: boolean;
}

/** Shape used by the test seam · never consumed by production code. */
export interface AccountExistsReaderDeps {
  resolveSession?: () => Promise<unknown>;
}

/**
 * Reads the current viewer's account-gate state. Server-only.
 *
 * NEVER returns a rejected Promise · a thrown resolver is folded into
 * the safe default `{ accountExists: false, signedInWithoutAccount: false }`.
 */
export async function readAccountExists(
  deps: AccountExistsReaderDeps = {},
): Promise<AccountExistsSnapshot> {
  let resolve = deps.resolveSession;
  if (!resolve) {
    const mod = await import("../app/session");
    resolve = mod.resolveNexAppSessionFromContext as () => Promise<unknown>;
  }
  try {
    const session = (await resolve()) as
      | null
      | {
          supabaseUserId?: string | null;
          account?: { id?: string | null } | null;
        };

    if (!session) {
      // Anonymous visitor · no Supabase auth · no account.
      return { accountExists: false, signedInWithoutAccount: false };
    }

    const accountId =
      session.account && typeof session.account.id === "string"
        ? session.account.id
        : null;
    const supabaseUserId =
      typeof session.supabaseUserId === "string" && session.supabaseUserId.length > 0
        ? session.supabaseUserId
        : null;

    if (accountId) {
      return { accountExists: true, signedInWithoutAccount: false };
    }

    if (supabaseUserId) {
      return { accountExists: false, signedInWithoutAccount: true };
    }

    return { accountExists: false, signedInWithoutAccount: false };
  } catch {
    // Safe default · the lock stays on. The user can create or sign in.
    return { accountExists: false, signedInWithoutAccount: false };
  }
}
