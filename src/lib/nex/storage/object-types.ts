// NEX ObjectStorage · interface types
//
// The abstraction every service uses for binary blobs (images, PDFs,
// CAD files, generated assets, worker outputs). Zero service imports a
// concrete adapter directly — everyone goes through `getObjectStorage()`
// from the registry.
//
// Full contract at `docs/NEX_INFRASTRUCTURE_RUNTIME.md §12`.
//
// Companion `ImageOps` interface (thumbnails, format conversion, resizing)
// is reserved for a future contract section — kept separate from the core
// so non-image blobs (PDF, CAD, ZIP) aren't forced to implement transforms.

/** Metadata that travels with every object. */
export type ObjectMeta = {
  bucket: string;
  key: string;
  version_id: string;              // adapter-assigned per put
  content_hash: string;            // sha256, hex
  size_bytes: number;
  mime_type: string;
  uploaded_at: string;             // ISO
  uploaded_by: string | null;
  business_id: string | null;      // Contract §2 principle 6 · tenancy
  source_ref: string | null;       // e.g. "job:abc" or "chunk:xyz"
  is_delete_marker: boolean;       // soft-delete tombstone
  custom: Record<string, string>;  // small (< 2KB) adapter-safe kv
};

/** Input to `put()` · body + optional metadata. */
export type PutInput = {
  body: Buffer;
  mime_type?: string;              // defaults "application/octet-stream"
  uploaded_by?: string | null;
  business_id?: string | null;
  source_ref?: string | null;
  custom?: Record<string, string>;
};

/** Result of `put()` · confirmed identity of the new object version. */
export type PutResult = {
  bucket: string;
  key: string;
  version_id: string;
  content_hash: string;
  size_bytes: number;
  mime_type: string;
  uploaded_at: string;
};

/** Result of `get()` · metadata + bytes. */
export type ReadResult = {
  meta: ObjectMeta;
  body: Buffer;
};

/** Options for `list()`. */
export type ListOptions = {
  limit?: number;                  // default 100 · max 10000
  since?: string;                  // ISO cutoff on uploaded_at
  order_dir?: "asc" | "desc";      // default "desc"
  include_delete_markers?: boolean; // default false
};

/** Row shape returned by `list()` and `listVersions()`. */
export type ListItem = {
  bucket: string;
  key: string;
  version_id: string;
  content_hash: string;
  size_bytes: number;
  mime_type: string;
  uploaded_at: string;
  is_delete_marker: boolean;
};

/** Options for `presign()`. */
export type PresignOptions = {
  operation: "get" | "put";
  expires_seconds?: number;        // default 900 (15 min)
  content_type?: string;           // for put · what the browser will upload
};

/** Options for `delete()`. */
export type DeleteOptions = {
  /** Hard delete removes bytes. Default is soft (writes delete marker). */
  hard?: boolean;
  /** Target a specific version. Omitted = act on the latest live version. */
  version_id?: string;
};

/**
 * Named capabilities an ObjectStorage adapter may or may not support.
 * Applications route by capability, never by provider name — see
 * NEX_INFRASTRUCTURE_RUNTIME.md §2 principle 9 + §14.
 */
export type ObjectStorageCapability =
  | "nativePresign"           // real signed URLs (R2/S3/Supabase/ImageKit) vs dev URL
  | "nativeVersioning"        // provider-side version history (S3) vs app-layer emulation
  | "imageTransforms"         // native thumbnails/resize/format-conversion
  | "multipartUpload"         // large-blob chunked upload
  | "presignPost"             // browser-direct POST upload
  | "lifecycleRules"          // hot→warm→glacier tiering
  | "serverSideEncryption"    // provider-managed at-rest encryption
  | "publicUrls";             // shareable non-authed URLs

export type ObjectStorageCapabilities = Readonly<Record<ObjectStorageCapability, boolean>>;

// Preference dimensions live in ../types (shared across all interfaces).
// Re-export so ObjectStorage consumers can import from one place.
export type { AdapterProfile, PreferenceName, Tier } from "./types";

/**
 * The one abstract interface every service uses. Seven methods + one
 * capability property. Nothing else.
 *
 * If your service needs something not listed here, either:
 *   (a) compose it from these primitives on the caller side, OR
 *   (b) propose a contract change with a written rationale.
 * Image-specific ops (thumbnails, format conversion, resize) belong on
 * the future `ImageOps` companion interface — never on this one.
 */
export interface ObjectStorage {
  /** Backend identifier for logs + telemetry. Never used for routing. */
  readonly name: string;

  /**
   * What this backend can do. Applications ask `capabilities.imageTransforms`
   * not `if (name === "imagekit")`. See NEX_INFRASTRUCTURE_RUNTIME.md §14.
   */
  readonly capabilities: ObjectStorageCapabilities;

  /** Upload bytes to `bucket/key`. Returns the new version's identity. */
  put(bucket: string, key: string, input: PutInput): Promise<PutResult>;

  /** Fetch a version (default: latest live). Null if not found or delete-marked. */
  get(bucket: string, key: string, versionId?: string): Promise<ReadResult | null>;

  /** Metadata only · no bytes downloaded. Cheap. Null if not found. */
  head(bucket: string, key: string, versionId?: string): Promise<ObjectMeta | null>;

  /** Presigned URL for direct browser upload/download. Adapter-native when available. */
  presign(bucket: string, key: string, options: PresignOptions): Promise<string>;

  /** Rows under a prefix · newest first. */
  list(bucket: string, prefix: string, options?: ListOptions): Promise<ListItem[]>;

  /** Soft delete by default (marker). {hard:true} removes bytes. */
  delete(bucket: string, key: string, options?: DeleteOptions): Promise<void>;

  /** Every version of one key · newest first · includes delete markers. */
  listVersions(bucket: string, key: string): Promise<ListItem[]>;
}

// ── Bucket registry · single source of truth ─────────────────────
// Every string here matches a bucket declared in Contract §12.3.
// Services import this so typos become type errors.

export const BUCKETS = {
  uploads:   "uploads",
  renders:   "renders",
  documents: "documents",
  avatars:   "avatars",
} as const;

export type BucketName = keyof typeof BUCKETS;

// ── Content-hash helper ──────────────────────────────────────────
// Callers who want immutable-by-content keys use this to derive the key
// from the body itself. Any two puts with the same bytes land at the
// same key, giving free deduplication.

import { createHash } from "node:crypto";

export function contentHashKey(body: Buffer, extension?: string): string {
  const hex = createHash("sha256").update(body).digest("hex");
  return extension ? `${hex}${extension.startsWith(".") ? extension : "." + extension}` : hex;
}
