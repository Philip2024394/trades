// src/lib/nex-native/business-service.ts
//
// business-service · CRUD on nex_business.
//
// Doctrine:
//   · Identity Doctrine · owner_account_id UUID FK to nex_account
//   · Commercial Doctrine · basic listing is free · no pay-to-list
//   · Fail loudly on missing owner · never fabricate the FK

import "server-only";
import { nexSupabaseAdmin } from "./supabase-admin";
import type {
  NexBusinessInsert,
  NexBusinessProfilePatch,
  NexBusinessRow,
  NexUuid,
  NexWeeklyHours,
} from "./types";
import { NEX_WEEK_DAYS } from "./types";

const PROFILE_LIMITS: Record<string, number> = {
  description: 2000,
  logo_url: 1024,
  address: 500,
  public_phone: 64,
  public_email: 320,
  website_url: 1024,
  payment_instructions: 2000,
  status_message: 200,
  instagram_handle: 64,
  facebook_handle: 64,
  tiktok_handle: 64,
  linkedin_handle: 64,
  x_handle: 64,
};

// Allow `/` so LinkedIn `company/xyz` and `in/xyz` work · matches migration 027 CHECK.
const SOCIAL_HANDLE_PATTERN = /^[A-Za-z0-9._/-]{1,64}$/;
const SOCIAL_FIELDS = ["instagram_handle", "facebook_handle", "tiktok_handle", "linkedin_handle", "x_handle"] as const;

function normaliseSocialHandle(raw: string | null, field: string): string | null {
  if (raw === null) return null;
  // Strip leading @ (common user habit) · trim whitespace
  const trimmed = raw.trim().replace(/^@+/, "");
  if (trimmed.length === 0) return null;
  if (!SOCIAL_HANDLE_PATTERN.test(trimmed)) {
    throw new Error(
      `business-service.updateBusinessProfile: ${field} must match ^[A-Za-z0-9._-]{1,64}$ · got ${trimmed.slice(0, 32)}`
    );
  }
  return trimmed;
}

function normalisePatchField(raw: string | null | undefined, cap: number, field: string): string | null | undefined {
  if (raw === undefined) return undefined;      // caller did not touch this field
  if (raw === null) return null;                 // caller explicitly clears
  const trimmed = raw.trim();
  if (trimmed.length === 0) return null;         // empty string == clear · never a blank artefact
  if (trimmed.length > cap) {
    throw new Error(
      `business-service.updateBusinessProfile: ${field} max ${cap} chars · got ${trimmed.length}`
    );
  }
  return trimmed;
}

/**
 * Very light validators · defence-in-depth beyond DB CHECK. Do NOT try to
 * be a full URL / email parser. Reject the obviously wrong shapes so the
 * public page never renders "javascript:" or something similar.
 */
function assertUrlShape(url: string | null, field: string): void {
  if (url === null) return;
  if (!/^https?:\/\//i.test(url)) {
    throw new Error(
      `business-service.updateBusinessProfile: ${field} must start with http:// or https:// · got ${url.slice(0, 32)}…`
    );
  }
}

function assertEmailShape(email: string | null): void {
  if (email === null) return;
  // Deliberately lenient · a full RFC parser is not worth the risk.
  if (!/^[^@\s]+@[^@\s]+\.[^@\s]+$/.test(email)) {
    throw new Error(
      `business-service.updateBusinessProfile: public_email malformed · got ${email.slice(0, 32)}…`
    );
  }
}

/** Read one business by NEX UUID · null when not found. */
export async function getBusinessById(id: NexUuid): Promise<NexBusinessRow | null> {
  const { data, error } = await nexSupabaseAdmin
    .from("nex_business")
    .select("*")
    .eq("id", id)
    .maybeSingle();
  if (error) throw new Error(`business-service.getBusinessById: ${error.message}`);
  return (data as NexBusinessRow) ?? null;
}

/** Read one business by public slug · null when not found. */
export async function getBusinessBySlug(slug: string): Promise<NexBusinessRow | null> {
  const { data, error } = await nexSupabaseAdmin
    .from("nex_business")
    .select("*")
    .eq("slug", slug)
    .maybeSingle();
  if (error) throw new Error(`business-service.getBusinessBySlug: ${error.message}`);
  return (data as NexBusinessRow) ?? null;
}

/** Batch-fetch business rows by id. Preserves the caller's id order in
 *  the returned array; missing ids are silently dropped. Deduplicates
 *  input ids · empty input returns []. Sealed 2026-09-28 · Bridge 30 ·
 *  used by the chat page Business tab to filter unverified rows in
 *  one query instead of N. */
export async function listBusinessesByIds(
  ids: readonly NexUuid[],
): Promise<NexBusinessRow[]> {
  const unique = Array.from(new Set(ids)).filter(Boolean);
  if (unique.length === 0) return [];
  const { data, error } = await nexSupabaseAdmin
    .from("nex_business")
    .select("*")
    .in("id", unique);
  if (error) throw new Error(`business-service.listBusinessesByIds: ${error.message}`);
  const rows = (data as NexBusinessRow[]) ?? [];
  const byId = new Map(rows.map((r) => [r.id, r]));
  return unique.map((id) => byId.get(id)).filter((r): r is NexBusinessRow => !!r);
}

/** List every business owned by a given account. */
export async function listBusinessesByOwner(
  ownerAccountId: NexUuid
): Promise<NexBusinessRow[]> {
  const { data, error } = await nexSupabaseAdmin
    .from("nex_business")
    .select("*")
    .eq("owner_account_id", ownerAccountId)
    .order("created_at", { ascending: false });
  if (error) throw new Error(`business-service.listBusinessesByOwner: ${error.message}`);
  return (data as NexBusinessRow[]) ?? [];
}

/** Create a new business. Fails if the owner account doesn't exist (FK). */
export async function createBusiness(input: NexBusinessInsert): Promise<NexBusinessRow> {
  // Tier gate · Gratis: 1 business per account · Bisnis: 5 · Pro: 5.
  // Migration 046 · Indonesia launch package doctrine 2026-09-27.
  await (await import("./tier-gate")).assertCanCreateBusiness(input.owner_account_id);
  const { data, error } = await nexSupabaseAdmin
    .from("nex_business")
    .insert({
      owner_account_id: input.owner_account_id,
      display_name: input.display_name,
      slug: input.slug,
    })
    .select("*")
    .single();
  if (error || !data) {
    throw new Error(
      `business-service.createBusiness: ${error?.message ?? "no row returned"}`
    );
  }
  return data as NexBusinessRow;
}

/**
 * Update merchant-editable profile fields · idempotent · partial patch.
 * Empty string clears (== null). Length caps enforced app-side plus DB
 * CHECK. URL fields require http(s):// prefix. public_email requires a
 * minimal x@y.z shape.
 *
 * Fields NOT touched by the caller (undefined) are left alone. Fields
 * explicitly set to null are cleared. Fields set to a string are trimmed
 * and validated.
 */
export async function updateBusinessProfile(
  id: NexUuid,
  patch: NexBusinessProfilePatch
): Promise<NexBusinessRow> {
  const update: Record<string, string | boolean | null> = {};
  const textFields: Array<keyof NexBusinessProfilePatch> = [
    "description", "logo_url", "address",
    "public_phone", "public_email", "website_url",
    "payment_instructions", "status_message",
  ];
  // Social handles use their own normalisation (strip leading @ · pattern check)
  for (const f of SOCIAL_FIELDS) {
    const raw = patch[f];
    if (raw === undefined) continue;
    update[f] = normaliseSocialHandle(raw, f);
  }
  for (const f of textFields) {
    const raw = patch[f];
    if (typeof raw === "boolean") continue; // guard: text fields never accept booleans
    const normalised = normalisePatchField(raw as string | null | undefined, PROFILE_LIMITS[f]!, f);
    if (normalised !== undefined) update[f] = normalised;
  }
  const boolFields: Array<"accepts_cod" | "accepts_pickup"> = ["accepts_cod", "accepts_pickup"];
  for (const f of boolFields) {
    const v = patch[f];
    if (v === undefined) continue;
    if (typeof v !== "boolean") {
      throw new Error(
        `business-service.updateBusinessProfile: ${f} must be boolean · got ${typeof v}`
      );
    }
    update[f] = v;
  }
  // status_message_expires_at · nullable ISO timestamp string · optional
  if (patch.status_message_expires_at !== undefined) {
    const v = patch.status_message_expires_at;
    if (v === null) {
      update["status_message_expires_at"] = null;
    } else if (typeof v === "string") {
      const t = v.trim();
      if (t.length === 0) {
        update["status_message_expires_at"] = null;
      } else {
        const parsed = new Date(t);
        if (Number.isNaN(parsed.getTime())) {
          throw new Error(
            `business-service.updateBusinessProfile: status_message_expires_at is not a valid ISO timestamp · got ${t.slice(0, 32)}`
          );
        }
        update["status_message_expires_at"] = parsed.toISOString();
      }
    } else {
      throw new Error(
        `business-service.updateBusinessProfile: status_message_expires_at must be null or string · got ${typeof v}`
      );
    }
  }
  if ("logo_url" in update)     assertUrlShape(update["logo_url"] as string | null,     "logo_url");
  if ("website_url" in update)  assertUrlShape(update["website_url"] as string | null,  "website_url");
  if ("public_email" in update) assertEmailShape(update["public_email"] as string | null);

  if (Object.keys(update).length === 0) {
    // No-op · return current row · idempotent.
    const current = await getBusinessById(id);
    if (!current) {
      throw new Error(`business-service.updateBusinessProfile: business ${id} not found`);
    }
    return current;
  }

  const { data, error } = await nexSupabaseAdmin
    .from("nex_business")
    .update(update)
    .eq("id", id)
    .select("*")
    .single();
  if (error || !data) {
    throw new Error(
      `business-service.updateBusinessProfile(${id}): ${error?.message ?? "no row returned"}`
    );
  }
  return data as NexBusinessRow;
}

// ---------------------------------------------------------------------------
// updateBusinessHours · Slice 3b · migration 031
// ---------------------------------------------------------------------------

const HHMM = /^([01][0-9]|2[0-3]):[0-5][0-9]$/;

function toMinutes(hhmm: string): number {
  const [h, m] = hhmm.split(":");
  return Number(h) * 60 + Number(m);
}

/** Deep-validate a NexWeeklyHours value · same shape as the DB CHECK plus
 *  HH:MM format and open<close. Returns a fresh normalised object OR throws.
 *  Null on any day means closed. */
export function normaliseWeeklyHours(input: unknown): NexWeeklyHours {
  if (input === null || typeof input !== "object" || Array.isArray(input)) {
    throw new Error("business-service.hours: must be an object with mon..sun keys");
  }
  const raw = input as Record<string, unknown>;
  const out: Partial<NexWeeklyHours> = {};
  for (const day of NEX_WEEK_DAYS) {
    if (!(day in raw)) {
      throw new Error(`business-service.hours: missing day '${day}'`);
    }
    const v = raw[day];
    if (v === null) {
      out[day] = null;
      continue;
    }
    if (typeof v !== "object" || v === null || Array.isArray(v)) {
      throw new Error(`business-service.hours.${day}: must be null or {open,close}`);
    }
    const dv = v as Record<string, unknown>;
    const open = dv.open;
    const close = dv.close;
    if (typeof open !== "string" || typeof close !== "string") {
      throw new Error(`business-service.hours.${day}: open+close must be HH:MM strings`);
    }
    if (!HHMM.test(open)) {
      throw new Error(`business-service.hours.${day}.open: '${open}' is not HH:MM`);
    }
    if (!HHMM.test(close)) {
      throw new Error(`business-service.hours.${day}.close: '${close}' is not HH:MM`);
    }
    if (toMinutes(open) >= toMinutes(close)) {
      throw new Error(`business-service.hours.${day}: open (${open}) must be earlier than close (${close})`);
    }
    out[day] = { open, close };
  }
  return out as NexWeeklyHours;
}

/** Set (or clear) the weekly hours for a business.
 *  Pass `null` to clear · pass a full 7-day object to set.
 *  Validation is done here (DB CHECK is only the object-with-7-keys shape). */
import { NEX_BUSINESS_CATEGORIES } from "./site-templates";

/** Bridge 14 · update the vertical + discovery keywords on a
 *  business row. Category must be one of NEX_BUSINESS_CATEGORIES or
 *  null (unset). Keywords are trimmed, deduped, and capped at 20 to
 *  keep the array manageable. Empty array clears back to NULL. */
export async function updateBusinessCategoryAndKeywords(
  id: NexUuid,
  input: {
    category?: string | null;
    keywords?: string[] | null;
  },
): Promise<NexBusinessRow> {
  const patch: Record<string, string | string[] | null> = {};
  if (input.category !== undefined) {
    if (input.category === null || input.category === "") {
      patch.business_category = null;
    } else {
      if (!(NEX_BUSINESS_CATEGORIES as readonly string[]).includes(input.category)) {
        throw new Error(
          `business-service.updateBusinessCategoryAndKeywords: unknown category '${input.category}'`,
        );
      }
      patch.business_category = input.category;
    }
  }
  if (input.keywords !== undefined) {
    if (!Array.isArray(input.keywords) || input.keywords.length === 0) {
      patch.search_keywords = null;
    } else {
      const cleaned = Array.from(
        new Set(
          input.keywords
            .map((k) => (typeof k === "string" ? k.trim() : ""))
            .filter((k) => k.length > 0 && k.length <= 60),
        ),
      ).slice(0, 20);
      patch.search_keywords = cleaned.length > 0 ? cleaned : null;
    }
  }
  const { data, error } = await nexSupabaseAdmin
    .from("nex_business")
    .update(patch)
    .eq("id", id)
    .select("*")
    .single();
  if (error || !data) {
    throw new Error(
      `business-service.updateBusinessCategoryAndKeywords: ${error?.message ?? "no row returned"}`,
    );
  }
  return data as NexBusinessRow;
}

/** Bridge 16a · canonical buyer-safety chips a seller can declare.
 *  Order in this list drives display order in the shop landing +
 *  seller selector. */
export const NEX_PAYMENT_METHODS = [
  "cod",
  "qris_delivery",
  "courier_cod",
  "meetup",
  "escrow",
  "paypal",
] as const;

export type NexPaymentMethod = (typeof NEX_PAYMENT_METHODS)[number];

// ---------------------------------------------------------------------------
// Shipping scope · Migration 108 · sealed 2026-09-30
// ---------------------------------------------------------------------------
// The six values covering the real-world spread of how a NEX shop can
// fulfil an order. Seller picks on /manage/shop · cover pages render
// the resolved label as the primary section heading.
//
// Constants + type live in ./shipping-scope (client-safe · no
// "server-only" import) so cover client components can consume them.
// Server-side mutation stays here alongside the Supabase client.
// ---------------------------------------------------------------------------

export {
  NEX_SHIPPING_SCOPES,
  NEX_SHIPPING_SCOPE_META,
  type NexShippingScope,
} from "./shipping-scope";
import {
  NEX_SHIPPING_SCOPES,
  type NexShippingScope,
} from "./shipping-scope";

/** Update the shop's shipping scope. Pass null to clear. */
export async function updateShippingScope(
  businessId: NexUuid,
  scope: NexShippingScope | null,
): Promise<void> {
  if (scope !== null && !(NEX_SHIPPING_SCOPES as readonly string[]).includes(scope)) {
    throw new Error(
      `business-service.updateShippingScope: invalid scope "${scope}"`,
    );
  }
  const { error } = await nexSupabaseAdmin
    .from("nex_business")
    .update({ shipping_scope: scope })
    .eq("id", businessId);
  if (error) {
    throw new Error(
      `business-service.updateShippingScope(${businessId}): ${error.message}`,
    );
  }
}

/** Human-friendly labels + emoji · consumed by the seller selector,
 *  the shop-landing chip strip, and the /safe-trade explainer. */
export const NEX_PAYMENT_METHOD_META: Record<
  NexPaymentMethod,
  { emoji: string; label: string; blurb: string }
> = {
  cod: {
    emoji: "💵",
    label: "C.O.D",
    blurb: "Driver collects rupiah cash at your door · local only",
  },
  qris_delivery: {
    emoji: "📱",
    label: "QRIS on Delivery",
    blurb: "Scan the seller's QR when the package arrives · no cash",
  },
  courier_cod: {
    emoji: "📦",
    label: "Courier C.O.D",
    blurb: "JNE / J&T / SiCepat holds your payment · remits to seller after delivery",
  },
  meetup: {
    emoji: "🤝",
    label: "Meet in Person",
    blurb: "Inspect the item live · pay cash on the spot",
  },
  escrow: {
    emoji: "🔒",
    label: "Escrow (Rekber)",
    blurb: "Third-party holds your money until you confirm receipt · Rekber, Xendit, Midtrans",
  },
  paypal: {
    emoji: "🌏",
    label: "PayPal Goods & Services",
    blurb: "International · PayPal Buyer Protection · verified sellers only",
  },
};

/** Bridge 21 · replace the seller's return policy. Full replacement ·
 *  the seller admin form does read-modify-write. Enforces Indonesian
 *  legal minimums (7-day window · 3-day refund · defective always
 *  accepted) · rejects attempts to weaken below the floor. */
import {
  NEX_RETURN_REASONS,
  NEX_RETURN_SHIPPING_PAID_BY,
  NEX_RETURN_LEGAL_MIN_WINDOW_DAYS,
  NEX_RETURN_LEGAL_MIN_REFUND_DAYS,
  NEX_RETURN_POLICY_DEFAULT,
  type NexReturnPolicy,
  type NexReturnReason,
  type NexReturnShippingPaidBy,
} from "./types";

export async function updateReturnPolicy(
  id: NexUuid,
  input: Partial<NexReturnPolicy>,
): Promise<NexBusinessRow> {
  // Start from the legal-min default so callers can safely
  // partial-update.
  const current = { ...NEX_RETURN_POLICY_DEFAULT, ...input };

  // Enforce legal floors · never weaken.
  const windowDays = Math.max(
    NEX_RETURN_LEGAL_MIN_WINDOW_DAYS,
    Math.min(90, Math.floor(Number(current.window_days) || 0)),
  );
  const refundDays = Math.max(
    NEX_RETURN_LEGAL_MIN_REFUND_DAYS,
    Math.min(14, Math.floor(Number(current.refund_days) || 0)),
  );
  const restockingFee = Math.max(
    0,
    Math.min(25, Math.floor(Number(current.restocking_fee_percent) || 0)),
  );

  // Enforce always-accepted reasons · defective + wrong_item are
  // non-negotiable per Indonesian consumer protection law.
  const alwaysAccepted: NexReturnReason[] = ["defective", "wrong_item"];
  const reasons = new Set<NexReturnReason>(alwaysAccepted);
  for (const r of current.accepts_reasons ?? []) {
    if ((NEX_RETURN_REASONS as readonly string[]).includes(r)) {
      reasons.add(r as NexReturnReason);
    }
  }

  const shippingPaidBy: NexReturnShippingPaidBy =
    (NEX_RETURN_SHIPPING_PAID_BY as readonly string[]).includes(
      current.shipping_paid_by,
    )
      ? current.shipping_paid_by
      : "buyer_unless_defective";

  const nonReturnable = Array.from(
    new Set(
      (current.non_returnable ?? [])
        .map((s) => (typeof s === "string" ? s.trim() : ""))
        .filter((s) => s.length > 0 && s.length <= 60),
    ),
  ).slice(0, 12);

  const notesRaw = (current.notes ?? "").toString().trim();
  const notes = notesRaw.length > 0 ? notesRaw.slice(0, 2000) : null;

  const policy: NexReturnPolicy = {
    accepts_returns: current.accepts_returns !== false,
    window_days: windowDays,
    refund_days: refundDays,
    accepts_reasons: Array.from(reasons),
    shipping_paid_by: shippingPaidBy,
    restocking_fee_percent: restockingFee,
    non_returnable: nonReturnable,
    notes,
  };

  const { data, error } = await nexSupabaseAdmin
    .from("nex_business")
    .update({ return_policy: policy })
    .eq("id", id)
    .select("*")
    .single();
  if (error || !data) {
    throw new Error(
      `business-service.updateReturnPolicy: ${error?.message ?? "no row"}`,
    );
  }
  return data as NexBusinessRow;
}

/** Bridge 17d · flip the seller's safe-trade commitment. Buyers
 *  see one of two binary messages at the top of every commerce
 *  chat based on this flag. */
export async function setSafeTradeActivated(
  id: NexUuid,
  activated: boolean,
): Promise<NexBusinessRow> {
  const { data, error } = await nexSupabaseAdmin
    .from("nex_business")
    .update({ safe_trade_activated: activated })
    .eq("id", id)
    .select("*")
    .single();
  if (error || !data) {
    throw new Error(
      `business-service.setSafeTradeActivated: ${error?.message ?? "no row"}`,
    );
  }
  return data as NexBusinessRow;
}

/** Bridge 16e · update the seller's city + human-readable opening
 *  hours. Both are optional · pass null to clear. */
export async function updateBusinessCityAndHours(
  id: NexUuid,
  input: { city?: string | null; hoursDisplay?: string | null },
): Promise<NexBusinessRow> {
  const patch: Record<string, string | null> = {};
  if (input.city !== undefined) {
    const v = (input.city ?? "").trim();
    if (v.length > 0 && (v.length < 1 || v.length > 80)) {
      throw new Error(
        `business-service.updateBusinessCityAndHours: city must be 1-80 chars`,
      );
    }
    patch.city = v.length > 0 ? v : null;
  }
  if (input.hoursDisplay !== undefined) {
    const v = (input.hoursDisplay ?? "").trim();
    if (v.length > 200) {
      throw new Error(
        `business-service.updateBusinessCityAndHours: hours_display max 200 chars`,
      );
    }
    patch.hours_display = v.length > 0 ? v : null;
  }
  const { data, error } = await nexSupabaseAdmin
    .from("nex_business")
    .update(patch)
    .eq("id", id)
    .select("*")
    .single();
  if (error || !data) {
    throw new Error(
      `business-service.updateBusinessCityAndHours: ${error?.message ?? "no row"}`,
    );
  }
  return data as NexBusinessRow;
}

/** Bridge 23b · Update the seller's Events profile jsonb. Booleans
 *  default false, seat_capacity clamps to a sane range, and the free-
 *  text field caps at 1000 chars so it can never blow up an About
 *  page render.
 *
 *  Called from the /manage/venue owner page. Non-venue businesses
 *  can technically call this too · the About surface just won't
 *  render the section if no fields are set. */
export async function updateBusinessEventsProfile(
  id: NexUuid,
  input: {
    hosts_parties?: boolean;
    seat_capacity?: number | null;
    outside_catering?: boolean;
    has_live_music_or_dj?: boolean;
    can_book_private_party?: boolean;
    has_sound_system_pa?: boolean;
    other_event_info?: string | null;
  },
): Promise<NexBusinessRow> {
  const clean: Record<string, unknown> = {};
  if (input.hosts_parties !== undefined) {
    clean.hosts_parties = !!input.hosts_parties;
  }
  if (input.seat_capacity !== undefined) {
    if (input.seat_capacity == null) {
      clean.seat_capacity = null;
    } else if (
      Number.isFinite(input.seat_capacity) &&
      input.seat_capacity >= 0
    ) {
      clean.seat_capacity = Math.min(Math.floor(input.seat_capacity), 5000);
    }
  }
  if (input.outside_catering !== undefined) {
    clean.outside_catering = !!input.outside_catering;
  }
  if (input.has_live_music_or_dj !== undefined) {
    clean.has_live_music_or_dj = !!input.has_live_music_or_dj;
  }
  if (input.can_book_private_party !== undefined) {
    clean.can_book_private_party = !!input.can_book_private_party;
  }
  if (input.has_sound_system_pa !== undefined) {
    clean.has_sound_system_pa = !!input.has_sound_system_pa;
  }
  if (input.other_event_info !== undefined) {
    const v = (input.other_event_info ?? "").trim();
    clean.other_event_info = v.length > 0 ? v.slice(0, 1000) : null;
  }
  const { data, error } = await nexSupabaseAdmin
    .from("nex_business")
    .update({ events_profile: clean })
    .eq("id", id)
    .select("*")
    .single();
  if (error || !data) {
    throw new Error(
      `business-service.updateBusinessEventsProfile: ${error?.message ?? "no row"}`,
    );
  }
  return data as NexBusinessRow;
}

/** Bridge 25d · Save seller pickup lat/lng for the /cart bike-
 *  delivery estimator. Both must be finite decimal degrees within
 *  WGS84 range · pass null/null to clear. */
export async function updateBusinessLocation(
  id: NexUuid,
  input: { lat: number | null; lng: number | null },
): Promise<NexBusinessRow> {
  const patch: Record<string, number | null> = {};
  if (input.lat === null && input.lng === null) {
    patch.location_lat = null;
    patch.location_lng = null;
  } else {
    if (
      !Number.isFinite(input.lat as number) ||
      !Number.isFinite(input.lng as number) ||
      (input.lat as number) < -90 ||
      (input.lat as number) > 90 ||
      (input.lng as number) < -180 ||
      (input.lng as number) > 180
    ) {
      throw new Error(
        "business-service.updateBusinessLocation: lat/lng out of range",
      );
    }
    patch.location_lat = input.lat;
    patch.location_lng = input.lng;
  }
  const { data, error } = await nexSupabaseAdmin
    .from("nex_business")
    .update(patch)
    .eq("id", id)
    .select("*")
    .single();
  if (error || !data) {
    throw new Error(
      `business-service.updateBusinessLocation: ${error?.message ?? "no row"}`,
    );
  }
  return data as NexBusinessRow;
}

/** Bridge 23c · Upload a venue photo to Supabase storage and return
 *  the public URL. Reuses the existing nex-peer-chat-attachments
 *  bucket (public read, image MIMEs allowed, 25MB cap). Path prefix
 *  is `venue/<businessId>/…` so we can later run per-business
 *  cleanup without touching chat uploads.
 *
 *  Only accepts images · videos / audio are rejected. Called from
 *  the /manage/venue gallery editor's file-picker path. */
export async function uploadVenuePhoto(
  businessId: NexUuid,
  file: File,
): Promise<{ url: string }> {
  const MAX = 25 * 1024 * 1024;
  if (file.size > MAX) {
    throw new Error(`Photo exceeds ${MAX / (1024 * 1024)}MB cap`);
  }
  const mime = (file.type || "").toLowerCase();
  const IMAGE_MIMES: Record<string, string> = {
    "image/png": "png",
    "image/jpeg": "jpg",
    "image/jpg": "jpg",
    "image/webp": "webp",
    "image/avif": "avif",
    "image/gif": "gif",
    "image/heic": "heic",
    "image/heif": "heif",
  };
  const ext = IMAGE_MIMES[mime];
  if (!ext) {
    throw new Error(
      `Only images allowed (png · jpg · webp · avif · gif · heic) · got ${
        file.type || "unknown"
      }`,
    );
  }
  const objectPath = `venue/${businessId}/${Date.now()}-${Math.random()
    .toString(36)
    .slice(2, 8)}.${ext}`;
  const bucket = nexSupabaseAdmin.storage.from("nex-peer-chat-attachments");
  const bytes = new Uint8Array(await file.arrayBuffer());
  const { error } = await bucket.upload(objectPath, bytes, {
    contentType: file.type,
    upsert: false,
  });
  if (error) {
    throw new Error(`business-service.uploadVenuePhoto: ${error.message}`);
  }
  const { data: pub } = bucket.getPublicUrl(objectPath);
  return { url: pub.publicUrl };
}

/** Bridge 23b · Overwrite the seller's venue gallery. Client uploads
 *  URLs one-at-a-time via the storage bucket · this action replaces
 *  the whole array (order matters · the first URL is used as the
 *  gallery cover). Caps at 6 URLs · empty array clears. */
export async function updateBusinessVenueGallery(
  id: NexUuid,
  urls: string[],
): Promise<NexBusinessRow> {
  const cleaned = urls
    .map((u) => (typeof u === "string" ? u.trim() : ""))
    .filter((u) => u.length > 0 && u.length <= 800)
    .slice(0, 6);
  const { data, error } = await nexSupabaseAdmin
    .from("nex_business")
    .update({ venue_gallery: cleaned })
    .eq("id", id)
    .select("*")
    .single();
  if (error || !data) {
    throw new Error(
      `business-service.updateBusinessVenueGallery: ${error?.message ?? "no row"}`,
    );
  }
  return data as NexBusinessRow;
}

/** Bridge 16a · update the seller's accepted payment methods.
 *  Validates every value against NEX_PAYMENT_METHODS and enforces
 *  at least one selection (cod fallback). */
export async function updateBusinessPaymentMethods(
  id: NexUuid,
  methods: string[],
): Promise<NexBusinessRow> {
  const allowed = new Set(NEX_PAYMENT_METHODS);
  const cleaned = Array.from(
    new Set(
      methods
        .map((m) => (typeof m === "string" ? m.trim() : ""))
        .filter((m): m is NexPaymentMethod => allowed.has(m as NexPaymentMethod)),
    ),
  );
  // Enforce at least one method · fall back to cod if the seller
  // somehow submitted an empty form (cod is always safe).
  const final = cleaned.length > 0 ? cleaned : ["cod"];
  const { data, error } = await nexSupabaseAdmin
    .from("nex_business")
    .update({ accepted_payment_methods: final })
    .eq("id", id)
    .select("*")
    .single();
  if (error || !data) {
    throw new Error(
      `business-service.updateBusinessPaymentMethods: ${error?.message ?? "no row returned"}`,
    );
  }
  return data as NexBusinessRow;
}

export async function updateBusinessHours(
  id: NexUuid,
  hours: NexWeeklyHours | null,
): Promise<NexBusinessRow> {
  const value = hours === null ? null : normaliseWeeklyHours(hours);
  const { data, error } = await nexSupabaseAdmin
    .from("nex_business")
    .update({ hours: value })
    .eq("id", id)
    .select("*")
    .single();
  if (error || !data) {
    throw new Error(
      `business-service.updateBusinessHours(${id}): ${error?.message ?? "no row returned"}`
    );
  }
  return data as NexBusinessRow;
}
