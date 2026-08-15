// NEX Auth · barrel (Philip 2026-08-14).

export { signSession, verifySession, serializeSessionCookie, serializeClearCookie } from "./session-signer";
export type { SignedSessionPayload } from "./session-signer";
export {
  upsertCustomer, getCustomer,
  ownerCanAccess, getOwner, registerOwner, ensureOwnerAccountsSeeded,
  _resetAccountsForTest
} from "./accounts";

export const SESSION_COOKIE_NAME = "nex_session";

// ============================================================================
// Phase 18 · scoped cookie names · one account may hold MANY concurrent
// sessions (owner-for-A + customer-for-A + owner-for-B + …). Cookies are
// namespaced by (role, businessSlug) so they coexist without stomping.
// ============================================================================

export function ownerCookieName(businessSlug: string): string {
  return `nex_owner_${sanitiseSlug(businessSlug)}`;
}

export function customerCookieName(businessSlug: string): string {
  return `nex_customer_${sanitiseSlug(businessSlug)}`;
}

function sanitiseSlug(slug: string): string {
  return String(slug ?? "").toLowerCase().replace(/[^a-z0-9-]/g, "-");
}
