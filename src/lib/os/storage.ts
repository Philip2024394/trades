// OS Foundation — Storage constants.
//
// Single source of truth for bucket names, path conventions, MIME
// allowlists and size caps. Every app that uploads files calls into
// media.ts which reads these; no app hard-codes bucket names or paths.
//
// Bucket architecture (v1): one shared "product-images" bucket
// (historical name from Hammerex — kept to avoid a data migration).
// Path prefixes segment concerns:
//   product-images/
//     merchant/{merchantId}/…               ← merchant-owned assets (Studio, Products)
//     job-diary/{merchantId}/{jobId}/…      ← Job Diary photos
//     ai-visualiser/{merchantId}/{homeownerId}/… ← homeowner source photos
//     reviews/{merchantId}/{requestId}/…    ← review-submission photos
//     signoff/{merchantId}/{jobId}/…        ← final sign-off photos
//     studio/{merchantId}/…                 ← Studio media library
//
// When the platform outgrows one bucket (probably around 100k
// merchants) migrate to per-app buckets by updating BUCKET_FOR + path
// builders; every route already reads from these constants.
import "server-only";

// ─── Buckets ───────────────────────────────────────────────────────

export const OS_STORAGE_BUCKETS = {
  MEDIA: "product-images"
} as const;

export type OsStorageBucket = keyof typeof OS_STORAGE_BUCKETS;

// ─── Categories → path prefixes ────────────────────────────────────

export const OS_MEDIA_CATEGORIES = [
  "merchant",
  "ai-visualiser",
  "job-diary",
  "reviews",
  "signoff",
  "studio",
  "products"
] as const;

export type OsMediaCategory = (typeof OS_MEDIA_CATEGORIES)[number];

// ─── Path builders ─────────────────────────────────────────────────

export function buildMediaPath(input: {
  category: OsMediaCategory;
  merchantId: string;
  scopeId?: string; // homeownerId / jobId / requestId / productId
  fileName: string;
}): string {
  const parts = [
    input.category,
    input.merchantId,
    input.scopeId,
    input.fileName
  ].filter((v): v is string => Boolean(v && v.length > 0));
  return parts.join("/");
}

// ─── MIME allowlists + size caps by use-case ───────────────────────

export const OS_IMAGE_MIME_ALLOWLIST = new Set([
  "image/jpeg",
  "image/png",
  "image/webp",
  "image/heic",
  "image/heif"
]);

export const OS_DOCUMENT_MIME_ALLOWLIST = new Set([
  "application/pdf",
  "image/jpeg",
  "image/png"
]);

/** Per-category size caps in bytes. When a category needs a different
 *  limit (e.g. product hero at 15MB) it goes here — never inline in a
 *  route. */
export const OS_MEDIA_SIZE_CAPS: Record<OsMediaCategory, number> = {
  merchant: 15 * 1024 * 1024,
  "ai-visualiser": 8 * 1024 * 1024,
  "job-diary": 10 * 1024 * 1024,
  reviews: 8 * 1024 * 1024,
  signoff: 12 * 1024 * 1024,
  studio: 15 * 1024 * 1024,
  products: 15 * 1024 * 1024
};

// ─── Extension inference ───────────────────────────────────────────

export function extFromMime(mime: string): string {
  switch (mime) {
    case "image/jpeg":
      return "jpg";
    case "image/png":
      return "png";
    case "image/webp":
      return "webp";
    case "image/heic":
      return "heic";
    case "image/heif":
      return "heif";
    case "application/pdf":
      return "pdf";
    default:
      return "bin";
  }
}

// ─── Validation helpers ────────────────────────────────────────────

export type MediaValidationOk = { ok: true };
export type MediaValidationErr = {
  ok: false;
  code:
    | "unsupported-mime"
    | "file-too-large"
    | "missing-file"
    | "unknown-category";
  maxBytes?: number;
  mime?: string;
};

export function validateImageUpload(input: {
  mime: string;
  sizeBytes: number;
  category: OsMediaCategory;
}): MediaValidationOk | MediaValidationErr {
  if (!OS_MEDIA_CATEGORIES.includes(input.category)) {
    return { ok: false, code: "unknown-category" };
  }
  if (!OS_IMAGE_MIME_ALLOWLIST.has(input.mime)) {
    return { ok: false, code: "unsupported-mime", mime: input.mime };
  }
  const cap = OS_MEDIA_SIZE_CAPS[input.category];
  if (input.sizeBytes > cap) {
    return { ok: false, code: "file-too-large", maxBytes: cap };
  }
  return { ok: true };
}
