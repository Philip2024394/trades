// Storage-cost safety layer.
//
// Canonical membership tier definitions + upload-gating helpers.
// EVERY upload endpoint on the platform MUST route through
// `assertUploadAllowed()` before writing to any storage bucket.
// Skipping this gate = the free tier can bankrupt us on storage.
//
// Design principle (Philip 2026-07-10):
//   Free = access. Paid = upload.
//
// Free members can consume every surface, WhatsApp-handoff every
// action, and post text-only in canteens. They cannot upload media
// that lives on our servers. Pro members can. That single split keeps
// storage costs proportional to revenue forever, at any scale.

// ─── Tier taxonomy ──────────────────────────────────────

export type MembershipTier =
  | "free"       // £0/mo · access + WhatsApp handoff + text chat only
  | "pro"        // £14.99/mo · full profile, product listing, video, all paid apps
  | "premium";   // £29.99/mo · custom domain, priority placement, bulk-buy pools

/** True when the tier includes any paid-only capability. */
export function isPaidTier(tier: MembershipTier): boolean {
  return tier === "pro" || tier === "premium";
}

// ─── Upload categories ──────────────────────────────────

export type UploadKind =
  | "profile-photo"       // avatar / hero image
  | "portfolio-image"     // job photos on profile
  | "canteen-image"       // image posted to a canteen feed
  | "canteen-video"       // video posted to a canteen feed
  | "counter-listing"     // image on The Counter listing
  | "product-image"       // product tile image
  | "trade-center-image"; // Trade Center product / catalogue image

// ─── Per-tier caps ──────────────────────────────────────

/** Total storage bytes allowed for a tier across ALL of their uploads.
 *  Enforced at upload time; when the cap is hit, further uploads return
 *  402 Payment Required and prompt for upgrade. */
export const TOTAL_STORAGE_CAP_BYTES: Record<MembershipTier, number> = {
  free:    200 * 1024,           // 200 KB total (one small profile photo)
  pro:     5   * 1024 * 1024 * 1024,   // 5 GB
  premium: 20  * 1024 * 1024 * 1024    // 20 GB
};

/** Per-file cap so someone can't burn their whole budget on one upload. */
export const PER_FILE_CAP_BYTES: Record<UploadKind, number> = {
  "profile-photo":     200 * 1024,       // 200 KB post-transcode
  "portfolio-image":   500 * 1024,       // 500 KB post-transcode
  "canteen-image":     500 * 1024,
  "canteen-video":     50 * 1024 * 1024, // 50 MB max (60-sec 720p)
  "counter-listing":   500 * 1024,
  "product-image":     500 * 1024,
  "trade-center-image": 800 * 1024
};

/** Which upload categories each tier can perform. Free tier gets a
 *  single profile photo and nothing else — every other creator
 *  capability is Pro-and-up. */
const TIER_ALLOWED_UPLOADS: Record<MembershipTier, ReadonlySet<UploadKind>> = {
  free: new Set<UploadKind>([
    "profile-photo"
  ]),
  pro: new Set<UploadKind>([
    "profile-photo",
    "portfolio-image",
    "canteen-image",
    "canteen-video",
    "counter-listing",
    "product-image",
    "trade-center-image"
  ]),
  premium: new Set<UploadKind>([
    "profile-photo",
    "portfolio-image",
    "canteen-image",
    "canteen-video",
    "counter-listing",
    "product-image",
    "trade-center-image"
  ])
};

// ─── Gate helpers ──────────────────────────────────────

export type UploadGateFailure =
  | { code: "tier-not-allowed"; kind: UploadKind; tier: MembershipTier }
  | { code: "file-too-large"; kind: UploadKind; sizeBytes: number; capBytes: number }
  | { code: "total-cap-exceeded"; tier: MembershipTier; currentBytes: number; capBytes: number };

/** Server-side gate. Every upload endpoint MUST call this before
 *  writing to a bucket. Returns null when allowed; returns a failure
 *  object when the caller should abort with 402 (upgrade required) or
 *  413 (payload too large).
 *
 *  Frontend UI hints do NOT replace this check — a determined user can
 *  bypass any client gate. This function is the load-bearing wall. */
export function checkUploadAllowed(opts: {
  tier: MembershipTier;
  kind: UploadKind;
  sizeBytes: number;
  currentTotalBytes: number;
}): UploadGateFailure | null {
  const { tier, kind, sizeBytes, currentTotalBytes } = opts;

  if (!TIER_ALLOWED_UPLOADS[tier].has(kind)) {
    return { code: "tier-not-allowed", kind, tier };
  }
  const perFile = PER_FILE_CAP_BYTES[kind];
  if (sizeBytes > perFile) {
    return { code: "file-too-large", kind, sizeBytes, capBytes: perFile };
  }
  const totalCap = TOTAL_STORAGE_CAP_BYTES[tier];
  if (currentTotalBytes + sizeBytes > totalCap) {
    return { code: "total-cap-exceeded", tier, currentBytes: currentTotalBytes, capBytes: totalCap };
  }
  return null;
}

/** Throwing variant for endpoint handlers that prefer control flow via
 *  exceptions. Callers should catch the typed error and translate it
 *  to the correct HTTP status (402 for tier + total-cap, 413 for file
 *  size). */
export class UploadGateError extends Error {
  constructor(public readonly failure: UploadGateFailure) {
    super(`Upload gate: ${failure.code}`);
    this.name = "UploadGateError";
  }
}

export function assertUploadAllowed(opts: {
  tier: MembershipTier;
  kind: UploadKind;
  sizeBytes: number;
  currentTotalBytes: number;
}): void {
  const fail = checkUploadAllowed(opts);
  if (fail) throw new UploadGateError(fail);
}

// ─── Frontend hints (never load-bearing) ───────────────

/** UI hint — should this button be gated with a Pro upsell? Free tier
 *  can post text-only comments in canteens; images and video require
 *  Pro. Frontend components use this to render the yellow "Pro" chip
 *  and route free-tier taps to the CanteenVideoUpsellModal. */
export function requiresProUpload(kind: UploadKind, tier: MembershipTier): boolean {
  if (isPaidTier(tier)) return false;
  return kind !== "profile-photo"; // free can do one small profile photo
}

/** Human-readable label for the upgrade prompt shown alongside a gated
 *  action. Kept short so it fits inline with the affected UI. */
export function upgradePromptFor(kind: UploadKind): string {
  switch (kind) {
    case "canteen-video":
    case "trade-center-image":
      return "Included with Network Pro · £14.99/mo";
    case "counter-listing":
    case "product-image":
      return "List products with Network Pro · £14.99/mo";
    default:
      return "Unlock creator features · Network Pro £14.99/mo";
  }
}

// ─── Cost accounting notes ─────────────────────────────
//
// Storage estimates (2026-07):
//   Supabase Storage:        ~£0.02/GB/mo
//   ImageKit delivery:       ~£0.03/GB served
//   Video transcode + serve: ~10x image cost per byte
//
// Guardrail: track storage bytes per user (running total) at the
// application layer, expose it as a Supabase view, and monitor
// cost-per-cohort monthly. When any monthly cohort exceeds £X per
// user in storage cost, tighten caps or force cold-tier migration.
//
// Auto-archive rules to enforce in a Supabase Edge Function / cron:
//   - Free-tier profiles inactive 6+ months → media → cold tier
//   - Counter listings past 90 days → asset deleted (or archived)
//   - Sold Counter listings past 7-day tail → asset moved to cold
//   - Canteen videos past 90 days → asset moved to cold
