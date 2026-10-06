// src/lib/nex-native/custom-intro-service.ts
//
// NEX Phase 1.0 Custom Intro data layer (server-only).
// -------------------------------------------------------------------------
// Owns the `nex_account_custom_intro` entitlement + upload table created
// in migration 139.
//
// Payment pathway (sealed 2026-10-06):
//   · User requests Custom Intro → routes to NEX1 support chat with
//     intent `custom_intro_500k` (existing · unchanged).
//   · Admin confirms the Rp 500,000 manual payment and inserts the
//     entitlement row via `grantEntitlementManual` (service-role only).
//   · Owner then uploads a video via the self-serve settings page →
//     `recordUploadedVideo` persists the MinIO object key + metadata.
//   · Owner can toggle `enabled` on/off · entitlement + video persist
//     through the OFF state ("OFF does not revoke entitlement" rule).
//
// Resolver pathway (sealed 2026-10-06):
//   · The peer-chat mount gate reads `getActiveCustomIntroForOwner()`
//     for the chat's owner. When it returns a video_url, the resolver
//     uses that INSTEAD of the standard theme intro (BusinessIntro
//     type in ThemePackage is the dormant hook).

import "server-only";
import { nexSupabaseAdmin } from "./supabase-admin";
import type { NexTimestamp, NexUuid } from "./types";
// Shared constants + pure validation live in a client-safe module so
// the "use client" settings surface can import them without pulling
// server-only across the boundary.
export {
  CUSTOM_INTRO_PRICE_IDR,
  CUSTOM_INTRO_STORAGE_BUCKET,
  CUSTOM_INTRO_VIDEO_LIMITS,
  validateVideo,
} from "./custom-intro-config";
export type {
  VideoValidationInput,
  VideoValidationResult,
} from "./custom-intro-config";

export type EntitlementSource = "nex1_support_manual" | "admin_grant" | "promo";

export interface NexAccountCustomIntroRow {
  account_id: NexUuid;
  entitlement_at: NexTimestamp;
  entitlement_source: EntitlementSource;
  video_url: string | null;
  video_duration_ms: number | null;
  video_width: number | null;
  video_height: number | null;
  video_size_bytes: number | null;
  uploaded_at: NexTimestamp | null;
  enabled: boolean;
  updated_at: NexTimestamp;
}

// ---------------------------------------------------------------------------
// Read side
// ---------------------------------------------------------------------------

export async function getCustomIntroRow(
  accountId: NexUuid,
): Promise<NexAccountCustomIntroRow | null> {
  const { data, error } = await nexSupabaseAdmin
    .from("nex_account_custom_intro")
    .select("*")
    .eq("account_id", accountId)
    .maybeSingle();
  if (error) {
    throw new Error(`custom-intro-service.getCustomIntroRow: ${error.message}`);
  }
  return (data as NexAccountCustomIntroRow) ?? null;
}

/** Returns the ACTIVE custom intro for an account · null when the
 *  account is not entitled OR the entitlement exists but no video has
 *  been uploaded OR the owner has toggled it off. Used by the
 *  peer-chat mount gate to decide whether to inject the custom intro
 *  into the resolver. */
export async function getActiveCustomIntroForOwner(
  accountId: NexUuid,
): Promise<{ video_url: string; duration_ms: number | null } | null> {
  const row = await getCustomIntroRow(accountId);
  if (!row) return null;
  if (!row.enabled) return null;
  if (!row.video_url) return null;
  return {
    video_url: row.video_url,
    duration_ms: row.video_duration_ms,
  };
}

export interface CustomIntroPresentationState {
  state: "not_purchased" | "purchased_no_video" | "active" | "disabled";
  row: NexAccountCustomIntroRow | null;
}

/** Presentation-level state for the /settings/custom-intro page. */
export async function getCustomIntroPresentationState(
  accountId: NexUuid,
): Promise<CustomIntroPresentationState> {
  const row = await getCustomIntroRow(accountId);
  if (!row) return { state: "not_purchased", row: null };
  if (!row.video_url) return { state: "purchased_no_video", row };
  if (!row.enabled) return { state: "disabled", row };
  return { state: "active", row };
}

// ---------------------------------------------------------------------------
// Write side · all server-side / admin-granted
// ---------------------------------------------------------------------------

export interface GrantEntitlementInput {
  account_id: NexUuid;
  source?: EntitlementSource;
}

/** Admin-granted entitlement · idempotent · never fails if the account
 *  is already entitled (keeps the existing row intact). Called by the
 *  admin flow after NEX1-chat payment confirmation. */
export async function grantEntitlementManual(
  input: GrantEntitlementInput,
): Promise<NexAccountCustomIntroRow> {
  const existing = await getCustomIntroRow(input.account_id);
  if (existing) return existing;
  const now = new Date().toISOString();
  const { data, error } = await nexSupabaseAdmin
    .from("nex_account_custom_intro")
    .insert({
      account_id: input.account_id,
      entitlement_at: now,
      entitlement_source: input.source ?? "nex1_support_manual",
      enabled: true,
      updated_at: now,
    })
    .select("*")
    .single();
  if (error || !data) {
    throw new Error(
      `custom-intro-service.grantEntitlementManual: ${error?.message ?? "no row returned"}`,
    );
  }
  return data as NexAccountCustomIntroRow;
}

export interface RecordUploadedVideoInput {
  account_id: NexUuid;
  video_url: string;
  duration_ms: number;
  width: number;
  height: number;
  size_bytes: number;
}

/** Persist a validated video upload against the account's entitlement
 *  row. Requires the row to already exist · returns null when the
 *  account is not entitled. */
export async function recordUploadedVideo(
  input: RecordUploadedVideoInput,
): Promise<NexAccountCustomIntroRow | null> {
  const existing = await getCustomIntroRow(input.account_id);
  if (!existing) return null;
  const now = new Date().toISOString();
  const { data, error } = await nexSupabaseAdmin
    .from("nex_account_custom_intro")
    .update({
      video_url: input.video_url,
      video_duration_ms: input.duration_ms,
      video_width: input.width,
      video_height: input.height,
      video_size_bytes: input.size_bytes,
      uploaded_at: now,
      enabled: true,
      updated_at: now,
    })
    .eq("account_id", input.account_id)
    .select("*")
    .single();
  if (error || !data) {
    throw new Error(
      `custom-intro-service.recordUploadedVideo: ${error?.message ?? "update failed"}`,
    );
  }
  return data as NexAccountCustomIntroRow;
}

/** Owner-controlled toggle. Setting enabled=true requires a video_url
 *  to be present (defence in depth · the server action also enforces
 *  this · the DB does not since migration 139 kept the CHECKs minimal
 *  per the comment). Returns the updated row or null if not entitled. */
export async function setEnabledForOwner(
  accountId: NexUuid,
  enabled: boolean,
): Promise<NexAccountCustomIntroRow | null> {
  const existing = await getCustomIntroRow(accountId);
  if (!existing) return null;
  if (enabled && !existing.video_url) {
    throw new Error(
      "custom-intro-service.setEnabledForOwner: cannot enable without an uploaded video",
    );
  }
  const now = new Date().toISOString();
  const { data, error } = await nexSupabaseAdmin
    .from("nex_account_custom_intro")
    .update({ enabled, updated_at: now })
    .eq("account_id", accountId)
    .select("*")
    .single();
  if (error || !data) {
    throw new Error(
      `custom-intro-service.setEnabledForOwner: ${error?.message ?? "update failed"}`,
    );
  }
  return data as NexAccountCustomIntroRow;
}

/** Owner-triggered video removal · keeps the entitlement, clears the
 *  video reference so the next upload creates a new object. Does NOT
 *  physically delete the underlying MinIO object (lifecycle cleanup is
 *  a separate concern · we don't want "undo" to lose the previous
 *  video in Phase 1.0). */
export async function clearUploadedVideoForOwner(
  accountId: NexUuid,
): Promise<NexAccountCustomIntroRow | null> {
  const existing = await getCustomIntroRow(accountId);
  if (!existing) return null;
  const now = new Date().toISOString();
  const { data, error } = await nexSupabaseAdmin
    .from("nex_account_custom_intro")
    .update({
      video_url: null,
      video_duration_ms: null,
      video_width: null,
      video_height: null,
      video_size_bytes: null,
      uploaded_at: null,
      enabled: false,
      updated_at: now,
    })
    .eq("account_id", accountId)
    .select("*")
    .single();
  if (error || !data) {
    throw new Error(
      `custom-intro-service.clearUploadedVideoForOwner: ${error?.message ?? "update failed"}`,
    );
  }
  return data as NexAccountCustomIntroRow;
}

// Video validation + limits + price constants live in
// ./custom-intro-config.ts (client-safe) · re-exported at the top of
// this file for backward compatibility with every importer that was
// pulling them from this module.
