// src/lib/nex/live/upload-validation.ts
//
// NEX LIVE · Phase C · Upload validation + ownership verification
// Philip 2026-09-06 · FOUNDER CEREMONIAL AUTHORIZATION · Phase C
//
// PURE VALIDATION MODULE.  No I/O.  No React.  No fetch.  No DOM.
//
// PURPOSE (§2 · §10 · §28 · §29)
//   Server-side validation for uploads: MIME allowlist, size limits,
//   filename safety, media_id ownership verification. Used by the
//   authenticated upload endpoint AND the rights-declaration endpoint
//   to compose the §17 publication authorization gate.
//
// DISCIPLINE
//   · §28 · never trust client-supplied fields for security decisions
//   · §16 · owner_id MUST come from authenticated session
//   · §17 · publication requires ownership + rights declaration + ready
//   · §29 · never expose or use client filenames for storage identity
//   · §30 · never treat uploaded content as executable

import type { Queryable } from "@/lib/nex-media/media-object";

// ── Allowlists ────────────────────────────────────────────────────
// Explicit, not inferred. If a MIME isn't listed, upload is rejected.
// Kept in sync with mimeToExt() in /api/nex-media/upload — this module
// is authoritative; the upload endpoint should defer to us.

export const ALLOWED_VIDEO_MIME: ReadonlySet<string> = new Set([
  "video/mp4",
  "video/webm",
  "video/quicktime",
]);

export const ALLOWED_AUDIO_MIME: ReadonlySet<string> = new Set([
  "audio/mpeg",
  "audio/mp3",
  "audio/ogg",
  "audio/opus",
  "audio/wav",
  "audio/x-wav",
  "audio/webm",
]);

export const ALLOWED_IMAGE_MIME: ReadonlySet<string> = new Set([
  "image/jpeg",
  "image/png",
  "image/webp",
  "image/gif",
  "image/avif",
]);

/** The union used by /api/nex-live/upload-file. Music + video only.
 *  Cover images are handled separately (out of scope for Phase C). */
export const ALLOWED_LIVE_UPLOAD_MIME: ReadonlySet<string> = new Set<string>([
  ...ALLOWED_VIDEO_MIME,
  ...ALLOWED_AUDIO_MIME,
]);

// ── Limits ────────────────────────────────────────────────────────

/** 100 MB · matches /api/nex-media/upload's MAX_UPLOAD_BYTES */
export const MAX_UPLOAD_BYTES = 100 * 1024 * 1024;

/** Reject filenames longer than this even before we discard them —
 *  some multipart parsers allocate on filename length. */
export const MAX_FILENAME_LEN = 512;

// ── File validation ──────────────────────────────────────────────

export type FileValidationInput = {
  mime_type: string;
  byte_size: number;
  filename: string | null;
};

export type FileValidationResult =
  | { ok: true }
  | { ok: false; error_code: FileValidationErrorCode; reason: string };

export type FileValidationErrorCode =
  | "UNSUPPORTED_MEDIA"       // MIME not in allowlist
  | "FILE_TOO_LARGE"          // exceeds MAX_UPLOAD_BYTES
  | "FILE_EMPTY"              // zero-byte file
  | "INVALID_FILE"            // missing mime or size
  | "FILENAME_TOO_LONG"       // filename exceeds MAX_FILENAME_LEN
  | "FILENAME_UNSAFE";        // contains characters we won't process

/** Client + server validation shared. Server MUST also call this
 *  (never trust that the client called it). */
export function validateUpload(input: FileValidationInput): FileValidationResult {
  if (!input.mime_type || typeof input.mime_type !== "string") {
    return { ok: false, error_code: "INVALID_FILE", reason: "mime_type_missing" };
  }
  if (!Number.isFinite(input.byte_size) || input.byte_size < 0) {
    return { ok: false, error_code: "INVALID_FILE", reason: "byte_size_invalid" };
  }
  if (input.byte_size === 0) {
    return { ok: false, error_code: "FILE_EMPTY", reason: "byte_size_is_zero" };
  }
  if (input.byte_size > MAX_UPLOAD_BYTES) {
    return { ok: false, error_code: "FILE_TOO_LARGE", reason: `byte_size_${input.byte_size}_exceeds_${MAX_UPLOAD_BYTES}` };
  }
  const mime = input.mime_type.toLowerCase().trim();
  if (!ALLOWED_LIVE_UPLOAD_MIME.has(mime)) {
    return { ok: false, error_code: "UNSUPPORTED_MEDIA", reason: `mime_type_not_in_allowlist:${mime}` };
  }
  if (input.filename !== null) {
    if (input.filename.length > MAX_FILENAME_LEN) {
      return { ok: false, error_code: "FILENAME_TOO_LONG", reason: `length_${input.filename.length}_exceeds_${MAX_FILENAME_LEN}` };
    }
    if (isFilenameUnsafe(input.filename)) {
      return { ok: false, error_code: "FILENAME_UNSAFE", reason: "filename_contains_path_or_control_chars" };
    }
  }
  return { ok: true };
}

/** §29 filename safety · we DISCARD the filename for storage identity,
 *  but we still reject files whose names could break upstream logging
 *  or parsing. Even discarded filenames may be logged. */
export function isFilenameUnsafe(filename: string): boolean {
  // Path traversal + separators
  if (filename.includes("..") || filename.includes("/") || filename.includes("\\")) return true;
  // Null bytes + control characters (0x00-0x1F, 0x7F)
  for (let i = 0; i < filename.length; i++) {
    const c = filename.charCodeAt(i);
    if (c === 0 || (c >= 1 && c <= 31) || c === 127) return true;
  }
  return false;
}

/** Kind classification · derived from MIME · used by publish flow to
 *  tag the media as MUSIC vs VIDEO. Never trusts client mode field
 *  when MIME disagrees. */
export function kindFromMime(mime: string): "audio" | "video" | null {
  const m = mime.toLowerCase().trim();
  if (ALLOWED_AUDIO_MIME.has(m)) return "audio";
  if (ALLOWED_VIDEO_MIME.has(m)) return "video";
  return null;
}

// ── media_id ownership verification (§16 · §17 immutable) ─────────

export type MediaOwnershipResult =
  | { ok: true; owner_id: string; state: string; visibility: string; mime_type: string }
  | { ok: false; error_code: MediaOwnershipErrorCode; reason: string };

export type MediaOwnershipErrorCode =
  | "MEDIA_NOT_FOUND"
  | "MEDIA_NOT_OWNED"           // authenticated user is NOT the owner
  | "MEDIA_NOT_READY"           // media state ≠ ready
  | "MEDIA_STORAGE_UNAVAILABLE";

/** The single question §17 gates on: "does this authenticated user
 *  actually own this media_id?"
 *
 *  Callers pass in a Queryable db handle (from existing nex-media
 *  media-object.ts pool) so this module remains storage-agnostic. */
export async function verifyMediaOwnership(
  db: Queryable,
  input: { media_id: string; authenticated_supabase_user_id: string },
): Promise<MediaOwnershipResult> {
  if (!input.media_id || typeof input.media_id !== "string") {
    return { ok: false, error_code: "MEDIA_NOT_FOUND", reason: "media_id_missing" };
  }
  if (!input.authenticated_supabase_user_id) {
    return { ok: false, error_code: "MEDIA_NOT_OWNED", reason: "no_authenticated_user" };
  }
  try {
    const r = await db.query<{ owner_id: string; state: string; visibility: string; mime_type: string }>(
      `SELECT owner_id, state, visibility, mime_type
         FROM nex.media_object
        WHERE media_id = $1::uuid
        LIMIT 1`,
      [input.media_id],
    );
    const row = r.rows[0];
    if (!row) return { ok: false, error_code: "MEDIA_NOT_FOUND", reason: `media_id_not_in_nex_media_object` };
    // §16 immutable · owner MUST match authenticated session
    if (row.owner_id !== input.authenticated_supabase_user_id) {
      return { ok: false, error_code: "MEDIA_NOT_OWNED", reason: `owner_mismatch` };
    }
    return {
      ok: true,
      owner_id: row.owner_id,
      state: row.state,
      visibility: row.visibility,
      mime_type: row.mime_type,
    };
  } catch (err) {
    return { ok: false, error_code: "MEDIA_STORAGE_UNAVAILABLE", reason: (err as Error).message.slice(0, 80) };
  }
}

// ── Composite publication gate (§17 · §25) ────────────────────────
// The §17 acceptance criteria composed as one predicate. Callers ask
// this ONCE at publish time; individual failure reasons flow back.

export type PublicationGateInput = {
  authenticated_supabase_user_id: string;
  media_ownership: MediaOwnershipResult;
  has_active_rights_declaration: boolean;
};

export type PublicationGateResult =
  | { ok: true }
  | { ok: false; error_code: PublicationGateErrorCode; reason: string };

export type PublicationGateErrorCode =
  | "AUTHENTICATION_REQUIRED"
  | "MEDIA_NOT_FOUND"
  | "MEDIA_NOT_OWNED"
  | "MEDIA_NOT_READY"
  | "MEDIA_STORAGE_UNAVAILABLE"
  | "RIGHTS_DECLARATION_REQUIRED";

export function passesPublicationGate(input: PublicationGateInput): PublicationGateResult {
  if (!input.authenticated_supabase_user_id) {
    return { ok: false, error_code: "AUTHENTICATION_REQUIRED", reason: "no_session" };
  }
  if (!input.media_ownership.ok) {
    const eo = input.media_ownership;
    return { ok: false, error_code: eo.error_code, reason: eo.reason };
  }
  if (input.media_ownership.state !== "ready") {
    return { ok: false, error_code: "MEDIA_NOT_READY", reason: `state_${input.media_ownership.state}` };
  }
  if (!input.has_active_rights_declaration) {
    return { ok: false, error_code: "RIGHTS_DECLARATION_REQUIRED", reason: "no_active_declaration" };
  }
  return { ok: true };
}
