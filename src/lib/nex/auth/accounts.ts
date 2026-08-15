// NEX Auth · customer + owner account registries (Philip 2026-08-14).
//
// In-memory · deterministic · replaced by DB later. Uses local email
// as the identity key.
//
// Constitutional:
//   - Never invent an account
//   - Owner-account permission is per-business (an owner may own multiple)
//   - Cross-business owner access is rejected AT THE ACCOUNT LAYER even
//     when the session claims a business (defence in depth vs. bad session)

// ─── Customer accounts ────────────────────────────────────────────
// One per (email, businessSlug) — a customer of Rowan and of Harborne
// with the same email is two different customer records (different
// contexts, different histories).

type CustomerRecord = { customerId: string; email: string; businessSlug: string; createdAt: string };
const CUSTOMERS = new Map<string, CustomerRecord>(); // key = `${slug}::${email}`

function customerKey(slug: string, email: string): string {
  return `${slug}::${email.toLowerCase().trim()}`;
}

export function upsertCustomer(email: string, businessSlug: string): CustomerRecord {
  const key = customerKey(businessSlug, email);
  const existing = CUSTOMERS.get(key);
  if (existing) return existing;
  const rec: CustomerRecord = {
    customerId: `cust_${Date.now().toString(36)}_${Math.random().toString(36).slice(2, 8)}`,
    email: email.toLowerCase().trim(),
    businessSlug,
    createdAt: new Date().toISOString()
  };
  CUSTOMERS.set(key, rec);
  return rec;
}

export function getCustomer(email: string, businessSlug: string): CustomerRecord | null {
  return CUSTOMERS.get(customerKey(businessSlug, email)) ?? null;
}

// ─── Owner accounts ────────────────────────────────────────────
// One per email · owns a set of businessSlugs. Permissions checked
// AT SESSION-MINT TIME and AT REQUEST-TIME (defence in depth).

type OwnerRecord = { ownerAccountId: string; email: string; ownedBusinesses: Set<string>; createdAt: string };
const OWNERS = new Map<string, OwnerRecord>(); // key = email

export function ownerCanAccess(email: string, businessSlug: string): boolean {
  const rec = OWNERS.get(email.toLowerCase().trim());
  return !!rec && rec.ownedBusinesses.has(businessSlug);
}

export function getOwner(email: string): OwnerRecord | null {
  return OWNERS.get(email.toLowerCase().trim()) ?? null;
}

export function registerOwner(email: string, businessSlugs: string[]): OwnerRecord {
  const key = email.toLowerCase().trim();
  const existing = OWNERS.get(key);
  if (existing) {
    for (const s of businessSlugs) existing.ownedBusinesses.add(s);
    return existing;
  }
  const rec: OwnerRecord = {
    ownerAccountId: `owner_${Date.now().toString(36)}_${Math.random().toString(36).slice(2, 8)}`,
    email: key,
    ownedBusinesses: new Set(businessSlugs),
    createdAt: new Date().toISOString()
  };
  OWNERS.set(key, rec);
  return rec;
}

// ─── Seed ─────────────────────────────────────────────────────────
// One owner per demo business (from Phase 12 seed).

let seeded = false;
export function ensureOwnerAccountsSeeded(): void {
  if (seeded) return;
  seeded = true;
  registerOwner("owner@rowanstaircases.co.uk", ["rowan-staircases"]);
  registerOwner("owner@harborne-plumbing.co.uk", ["harborne-plumbing"]);
}

// ─── Test helpers ─────────────────────────────────────────────────

export function _resetAccountsForTest(): void {
  CUSTOMERS.clear();
  OWNERS.clear();
  seeded = false;
}
