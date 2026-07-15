// Washer bag operations — the ONE place that writes to
// hammerex_washer_bag + hammerex_washer_transactions. Every code
// path that grants, deducts, purchases, or refunds a washer goes
// through these helpers so:
//   1. The transactions log always matches the bag balance.
//   2. The 30-day idempotency rule is enforced in a single place.
//   3. The signup-grant is guaranteed one-off.
//
// See supabase/migrations/20260719120000_washers.sql for the schema
// and project_washers_lead_gen_model.md for the model.

import { createHash } from "crypto";
import { supabaseAdmin } from "./supabaseAdmin";

export type WasherPackId = "small" | "medium" | "large";

export type WasherPack = {
  id: WasherPackId;
  washers: number;
  priceGbp: number;
  label: string;
};

export const WASHER_PACKS: Record<WasherPackId, WasherPack> = {
  small:  { id: "small",  washers: 50,   priceGbp: 4.99,  label: "Starter bag" },
  medium: { id: "medium", washers: 200,  priceGbp: 14.99, label: "Site bag" },
  large:  { id: "large",  washers: 1000, priceGbp: 49.99, label: "Trade bag" }
};

export const SIGNUP_GRANT_WASHERS = 10;
export const IDEMPOTENCY_WINDOW_DAYS = 30;

export type WasherBag = {
  listingId: string;
  balance: number;
  autoTopup: boolean;
  autoTopupPack: WasherPackId;
  autoTopupThreshold: number;
  signupGrantAwarded: boolean;
};

export type WasherTransactionKind = "grant" | "deduct" | "purchase" | "refund" | "idempotent-skip";

export type DeductResult =
  | { ok: true; balance: number; idempotent: false; transactionId: string }
  | { ok: true; balance: number; idempotent: true;  transactionId: string }
  | { ok: false; reason: "merchant-not-found" | "db-error"; message: string };

/** Normalise a phone number to E.164-ish digits then sha256 it. We
 *  never store the raw phone in the transactions log — only the hash —
 *  so idempotency lookups don't leak PII. */
export function hashPhone(raw: string): string {
  const digits = raw.replace(/[^0-9]/g, "");
  return createHash("sha256").update(digits).digest("hex");
}

/** Resolve a merchant listing id from the merchant slug. Powers the
 *  deduct API which receives merchantSlug from client. */
async function resolveListingIdBySlug(slug: string): Promise<string | null> {
  const res = await supabaseAdmin
    .from("hammerex_trade_off_listings")
    .select("id")
    .eq("slug", slug)
    .maybeSingle();
  if (res.error || !res.data) return null;
  return res.data.id as string;
}

/** Ensure the merchant has a bag row. Creates one (0 balance) if
 *  missing. Signup grant is applied here so the first-ever call also
 *  seeds the 10 free washers. */
export async function ensureWasherBag(listingId: string): Promise<WasherBag | null> {
  const existing = await supabaseAdmin
    .from("hammerex_washer_bag")
    .select("*")
    .eq("listing_id", listingId)
    .maybeSingle();
  if (existing.error) return null;
  if (existing.data) return shapeBag(existing.data);

  // First touch — create the bag + apply the one-off signup grant.
  const inserted = await supabaseAdmin
    .from("hammerex_washer_bag")
    .insert({
      listing_id: listingId,
      balance: SIGNUP_GRANT_WASHERS,
      auto_topup: true,
      auto_topup_pack: "medium",
      auto_topup_threshold: 5,
      signup_grant_awarded: true
    })
    .select()
    .single();
  if (inserted.error || !inserted.data) return null;

  // Log the signup grant.
  await supabaseAdmin.from("hammerex_washer_transactions").insert({
    listing_id: listingId,
    kind: "grant",
    delta: SIGNUP_GRANT_WASHERS,
    balance_after: SIGNUP_GRANT_WASHERS,
    source: "signup-grant",
    detail: null
  });

  return shapeBag(inserted.data);
}

/** Deduct one washer, or skip if this guest phone already burned a
 *  washer with this merchant in the last 30 days. Writes a
 *  transaction row for BOTH cases (kind='deduct' or 'idempotent-skip')
 *  so the log stays complete. */
export async function deductOneWasher(input: {
  merchantSlug: string;
  guestPhoneHash: string;
  source: string;
  detail?: Record<string, unknown>;
}): Promise<DeductResult> {
  const listingId = await resolveListingIdBySlug(input.merchantSlug);
  if (!listingId) {
    return { ok: false, reason: "merchant-not-found", message: `No listing for slug ${input.merchantSlug}` };
  }

  const bag = await ensureWasherBag(listingId);
  if (!bag) {
    return { ok: false, reason: "db-error", message: "Failed to load washer bag" };
  }

  // Idempotency check — has this guest already burned a washer with
  // this merchant in the last IDEMPOTENCY_WINDOW_DAYS?
  const sinceIso = new Date(Date.now() - IDEMPOTENCY_WINDOW_DAYS * 24 * 60 * 60 * 1000).toISOString();
  const recent = await supabaseAdmin
    .from("hammerex_washer_transactions")
    .select("id")
    .eq("listing_id", listingId)
    .eq("kind", "deduct")
    .gte("created_at", sinceIso)
    .filter("detail->>guestPhoneHash", "eq", input.guestPhoneHash)
    .limit(1);

  if (!recent.error && recent.data && recent.data.length > 0) {
    // Log the skip so the admin can see repeat contacts on the same
    // merchant — data useful for both accounting and product decisions.
    const skip = await supabaseAdmin
      .from("hammerex_washer_transactions")
      .insert({
        listing_id: listingId,
        kind: "idempotent-skip",
        delta: 0,
        balance_after: bag.balance,
        source: input.source,
        detail: {
          ...(input.detail ?? {}),
          guestPhoneHash: input.guestPhoneHash,
          reason: "same-guest-within-30d"
        }
      })
      .select("id")
      .single();
    return {
      ok: true,
      balance: bag.balance,
      idempotent: true,
      transactionId: skip.data?.id ?? ""
    };
  }

  // Decrement the bag balance. We clamp at 0 so an empty bag still
  // records the intent (as a deduct with balance_after=0) — the
  // merchant may auto-topup between now and the next check, but the
  // lead itself is real.
  const nextBalance = Math.max(0, bag.balance - 1);
  const bagUpdate = await supabaseAdmin
    .from("hammerex_washer_bag")
    .update({ balance: nextBalance })
    .eq("listing_id", listingId);
  if (bagUpdate.error) {
    return { ok: false, reason: "db-error", message: bagUpdate.error.message };
  }

  const tx = await supabaseAdmin
    .from("hammerex_washer_transactions")
    .insert({
      listing_id: listingId,
      kind: "deduct",
      delta: -1,
      balance_after: nextBalance,
      source: input.source,
      detail: {
        ...(input.detail ?? {}),
        guestPhoneHash: input.guestPhoneHash
      }
    })
    .select("id")
    .single();

  return {
    ok: true,
    balance: nextBalance,
    idempotent: false,
    transactionId: tx.data?.id ?? ""
  };
}

/** Credit a purchased pack — writes the transaction and bumps the
 *  bag balance. Called from the Stripe webhook once the payment
 *  intent succeeds. */
export async function creditPack(input: {
  merchantSlug: string;
  pack: WasherPackId;
  stripeSessionId?: string;
}): Promise<{ ok: true; balance: number } | { ok: false; message: string }> {
  const pack = WASHER_PACKS[input.pack];
  const listingId = await resolveListingIdBySlug(input.merchantSlug);
  if (!listingId) return { ok: false, message: "merchant-not-found" };
  const bag = await ensureWasherBag(listingId);
  if (!bag) return { ok: false, message: "bag-load-failed" };

  const nextBalance = bag.balance + pack.washers;
  const bagUpdate = await supabaseAdmin
    .from("hammerex_washer_bag")
    .update({ balance: nextBalance })
    .eq("listing_id", listingId);
  if (bagUpdate.error) return { ok: false, message: bagUpdate.error.message };

  await supabaseAdmin.from("hammerex_washer_transactions").insert({
    listing_id: listingId,
    kind: "purchase",
    delta: pack.washers,
    balance_after: nextBalance,
    source: `pack-purchase:${input.pack}`,
    detail: {
      packId: input.pack,
      packWashers: pack.washers,
      packPriceGbp: pack.priceGbp,
      stripeSessionId: input.stripeSessionId ?? null
    }
  });

  return { ok: true, balance: nextBalance };
}

/** Read a merchant's bag balance + auto-topup config. Powers the
 *  merchant admin page (/trade-off/edit/[slug]/washers). */
export async function loadWasherBag(merchantSlug: string): Promise<WasherBag | null> {
  const listingId = await resolveListingIdBySlug(merchantSlug);
  if (!listingId) return null;
  return ensureWasherBag(listingId);
}

/** Read the last N transactions for a merchant. Powers the recent
 *  activity list on the washers page. */
export async function loadRecentTransactions(
  merchantSlug: string,
  limit: number = 20
): Promise<Array<{
  id: string;
  kind: WasherTransactionKind;
  delta: number;
  balanceAfter: number;
  source: string;
  detail: Record<string, unknown> | null;
  createdAt: string;
}>> {
  const listingId = await resolveListingIdBySlug(merchantSlug);
  if (!listingId) return [];
  const res = await supabaseAdmin
    .from("hammerex_washer_transactions")
    .select("id, kind, delta, balance_after, source, detail, created_at")
    .eq("listing_id", listingId)
    .order("created_at", { ascending: false })
    .limit(limit);
  if (res.error || !res.data) return [];
  return res.data.map((r) => ({
    id: r.id as string,
    kind: r.kind as WasherTransactionKind,
    delta: r.delta as number,
    balanceAfter: r.balance_after as number,
    source: r.source as string,
    detail: (r.detail as Record<string, unknown> | null) ?? null,
    createdAt: r.created_at as string
  }));
}

function shapeBag(row: Record<string, unknown>): WasherBag {
  return {
    listingId: row.listing_id as string,
    balance: row.balance as number,
    autoTopup: row.auto_topup as boolean,
    autoTopupPack: row.auto_topup_pack as WasherPackId,
    autoTopupThreshold: row.auto_topup_threshold as number,
    signupGrantAwarded: row.signup_grant_awarded as boolean
  };
}
