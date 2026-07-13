// Server-side tier gate enforcement.
//
// Every write endpoint that persists an uploaded asset URL calls
// `assertUploadAllowedFromDb()` BEFORE the insert. That reads the
// owner's current cumulative usage from `hammerex_uploads_usage` and
// compares against the tier cap in `lib/tierGates.ts` — the client
// gate is now advisory; this is the load-bearing rule.
//
// On success, the caller inserts a row into `hammerex_uploads_usage`
// with the recorded byte count. Failure returns an UploadGateError
// that endpoints translate into a 402 (payment required — matches
// the freemium messaging).

import { supabaseAdmin } from "@/lib/supabaseAdmin";
import {
  PER_FILE_CAP_BYTES,
  TOTAL_STORAGE_CAP_BYTES,
  requiresProUpload,
  UploadGateError,
  type MembershipTier,
  type UploadKind
} from "@/lib/tierGates";

export type UploadOwnerKind = "merchant" | "reviewer" | "system";

export type AssertOptions = {
  ownerSlug: string;
  ownerKind: UploadOwnerKind;
  uploadKind: UploadKind;
  tier: MembershipTier;
  sizeBytes: number;
};

/** Checks the tier gate against the owner's current usage. Throws
 *  UploadGateError on breach — callers should catch and translate to
 *  a 402 response. Returns silently when the upload is within limits. */
export async function assertUploadAllowedFromDb(opts: AssertOptions): Promise<void> {
  // Per-file cap — same for all tiers (image size, video size, etc.).
  const perFileCap = PER_FILE_CAP_BYTES[opts.uploadKind];
  if (opts.sizeBytes > perFileCap) {
    throw new UploadGateError(
      `File too large — max ${(perFileCap / (1024 * 1024)).toFixed(1)}MB per ${opts.uploadKind}.`,
      "per-file-cap"
    );
  }

  // Free tier can't upload Pro-only kinds at all (video, etc.).
  if (requiresProUpload(opts.uploadKind, opts.tier)) {
    throw new UploadGateError(
      `${opts.uploadKind} upload requires Network Pro. Free tier is access-only for that surface.`,
      "pro-only"
    );
  }

  // Cumulative cap — total bytes used by this owner across all uploads.
  const totalCap = TOTAL_STORAGE_CAP_BYTES[opts.tier];
  const currentUsage = await currentUsageFor(opts.ownerSlug);
  if (currentUsage + opts.sizeBytes > totalCap) {
    throw new UploadGateError(
      `Storage cap hit for tier ${opts.tier} — ${(totalCap / (1024 * 1024)).toFixed(0)}MB max. Upgrade to Pro for more room.`,
      "total-cap"
    );
  }
}

/** Records an upload in hammerex_uploads_usage. Callers invoke this
 *  AFTER the primary insert succeeds so the counter never gets ahead
 *  of the actual persisted asset. */
export async function recordUpload(opts: AssertOptions & { storageUrl?: string }): Promise<void> {
  const insert = await supabaseAdmin
    .from("hammerex_uploads_usage")
    .insert({
      owner_slug: opts.ownerSlug,
      owner_kind: opts.ownerKind,
      upload_kind: opts.uploadKind,
      size_bytes: opts.sizeBytes,
      storage_url: opts.storageUrl ?? null
    });
  if (insert.error) {
    // Don't fail the request over a metering error — log it and move
    // on. The primary write already happened.
    // eslint-disable-next-line no-console
    console.error("[tierGates.recordUpload] insert failed", insert.error);
  }
}

async function currentUsageFor(ownerSlug: string): Promise<number> {
  const res = await supabaseAdmin
    .from("hammerex_uploads_usage")
    .select("size_bytes")
    .eq("owner_slug", ownerSlug);
  if (res.error) {
    // eslint-disable-next-line no-console
    console.error("[tierGates] usage read failed", res.error);
    return 0;
  }
  return (res.data ?? []).reduce((sum, r) => sum + Number(r.size_bytes ?? 0), 0);
}
