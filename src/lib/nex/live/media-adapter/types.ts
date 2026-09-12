// src/lib/nex/live/media-adapter/types.ts
//
// NEX LIVE · Phase A · Media Infrastructure Abstraction (interfaces only)
// Philip 2026-09-06 · FOUNDER AUTHORIZATION · PHASE A
//
// PURPOSE (§24)
//   Provider-independence boundary. NEX identity, content ownership,
//   discovery and conversation MUST NEVER depend on a specific storage
//   / transcoding / streaming / CDN provider.
//
// SHAPE
//   Four adapter interfaces:
//     · StorageAdapter     — put/get/delete of raw bytes
//     · ProcessingAdapter  — transcoding, thumbnail generation
//     · StreamingAdapter   — ingest + playback URL issuance
//     · DeliveryAdapter    — signed / private URL issuance for delivery
//
//   Any provider (ImageKit · Supabase Storage · S3 · Cloudflare Stream ·
//   Mux · own infrastructure) implements these interfaces. Phase A ships
//   the interfaces only. Phase D chooses the first concrete provider.
//
// DISCIPLINE (§26)
//   No adapter method returns a fabricated success. Every method's return
//   type carries explicit success/failure state. Uploads that fail must
//   surface as failed, not silently succeed.

// ── Common types ────────────────────────────────────────────────────

/** Opaque handle to a piece of media stored via ANY adapter. The shape
 *  is deliberately provider-agnostic. Callers never parse this. */
export type MediaRef = string;

export type MediaKind =
  | "video"
  | "audio"
  | "image"
  | "livestream_ingest"
  | "livestream_playback";

export type MediaBinding = {
  media_ref: MediaRef;
  kind: MediaKind;
  mime_type: string;
  byte_size: number | null;      // null when not yet known (e.g. streaming ingest)
  duration_ms: number | null;    // null until transcoded
  width_px: number | null;
  height_px: number | null;
  checksum_sha256: string | null;
  created_at_iso: string;
};

// ── Result envelopes — explicit success/failure ─────────────────────

export type AdapterResult<T> =
  | { ok: true; value: T }
  | { ok: false; error: AdapterError };

export type AdapterErrorCode =
  | "UNAUTHENTICATED"
  | "UNAUTHORIZED"
  | "NOT_FOUND"
  | "INVALID_INPUT"
  | "PROVIDER_UNAVAILABLE"
  | "QUOTA_EXCEEDED"
  | "RATE_LIMITED"
  | "PROCESSING_FAILED"
  | "MODERATION_BLOCKED"
  | "UNKNOWN_ERROR";

export type AdapterError = {
  code: AdapterErrorCode;
  message: string;                        // free-text · never rendered to end-user verbatim
  provider_error_ref: string | null;      // optional provider correlation id
};

// ── Storage adapter ────────────────────────────────────────────────

export type StoragePutInput = {
  uploader_nex_id: string;
  kind: MediaKind;
  mime_type: string;
  byte_stream: unknown;                   // Phase D binds this to Buffer / ReadableStream
  filename_hint: string | null;
};

export interface StorageAdapter {
  readonly providerId: string;
  put(input: StoragePutInput): Promise<AdapterResult<MediaBinding>>;
  get(ref: MediaRef): Promise<AdapterResult<MediaBinding>>;
  delete(ref: MediaRef): Promise<AdapterResult<null>>;
}

// ── Processing adapter ─────────────────────────────────────────────

export type ProcessingJobInput = {
  source_ref: MediaRef;
  target_kind: MediaKind;
  requested_variants: ReadonlyArray<"thumbnail" | "poster" | "web_720p" | "web_1080p" | "audio_192k">;
};

export type ProcessingJobResult = {
  source_ref: MediaRef;
  outputs: ReadonlyArray<{ variant: string; ref: MediaRef; binding: MediaBinding }>;
};

export interface ProcessingAdapter {
  readonly providerId: string;
  transcode(input: ProcessingJobInput): Promise<AdapterResult<ProcessingJobResult>>;
}

// ── Streaming adapter ──────────────────────────────────────────────

export type StreamIngestSession = {
  session_id: string;
  ingest_url: string;                     // provider-issued
  ingest_key_ref: string;                 // opaque · never logged
  playback_ref: MediaRef;                 // paired playback handle
  expires_at_iso: string;
};

export interface StreamingAdapter {
  readonly providerId: string;
  openIngest(input: { owner_nex_id: string }): Promise<AdapterResult<StreamIngestSession>>;
  closeIngest(session_id: string): Promise<AdapterResult<null>>;
}

// ── Delivery adapter ───────────────────────────────────────────────

export type DeliveryUrlInput = {
  ref: MediaRef;
  purpose: "public_playback" | "signed_private" | "thumbnail" | "download";
  ttl_seconds: number;
};

export interface DeliveryAdapter {
  readonly providerId: string;
  issueUrl(input: DeliveryUrlInput): Promise<AdapterResult<{ url: string; expires_at_iso: string }>>;
}

// ── Aggregate registry surface ─────────────────────────────────────
// Phase D will register concrete adapters here. Phase A ships the type.

export type MediaAdapterRegistry = {
  storage: StorageAdapter;
  processing: ProcessingAdapter;
  streaming: StreamingAdapter;
  delivery: DeliveryAdapter;
};
