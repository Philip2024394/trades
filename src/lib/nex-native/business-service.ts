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
