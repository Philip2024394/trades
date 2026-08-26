// NEX Sparks · signup grant hook · F2 (2026-08-25).
//
// Philip 2026-08-25 · locked · 2 lifetime free grenades at signup · not
// monthly · not renewable · scarcity teaches value.
//
// Grenade cost is 100 Sparks (see registry). 2 grenades = 200 Sparks. This
// module is called exactly once per user at signup. The idempotency key
// baked in guarantees a retry / duplicate signup / crash-and-restart cannot
// double-grant.

import { grantSparks } from "./index";
import type { SparksAmount } from "./types";

/**
 * Sparks granted to every new user at signup. Sized to enable exactly the
 * "free grenade allowance" Philip locked (2 grenades × 100 Sparks each).
 * Change this constant to change the launch allowance · do NOT change the
 * grenade cost in the registry (that's the action-level requirement).
 */
export const SIGNUP_GRANT_SPARKS = 200;

/**
 * Signup grant idempotency key format · one-per-user forever. Because the
 * ledger enforces UNIQUE(user_id, idempotency_key), a second call for the
 * same user is a safe no-op that returns the current balance.
 */
function signupIdempotencyKey(userId: string): string {
  return `signup_grant:${userId}`;
}

/**
 * Call this exactly once per new user (from your signup flow · Supabase
 * auth webhook · or admin bootstrap). Idempotent · safe to call twice.
 * Returns the user's balance after the grant (or after the no-op if the
 * grant was already applied).
 */
export async function grantSignupSparks(userId: string): Promise<SparksAmount> {
  if (!userId || typeof userId !== "string") {
    throw new Error(`grantSignupSparks: invalid userId ${userId}`);
  }
  return grantSparks({
    userId,
    source: "signup_grant",
    amount: SIGNUP_GRANT_SPARKS,
    idempotencyKey: signupIdempotencyKey(userId),
    note: `Signup grant · ${SIGNUP_GRANT_SPARKS} Sparks · covers 2 grenades`,
  });
}
