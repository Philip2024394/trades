// src/lib/nex/live/upload-validation.test.ts
//
// NEX LIVE · Phase C · Upload validation + publication gate tests (§40)

import { describe, it, expect } from "vitest";
import {
  validateUpload,
  isFilenameUnsafe,
  kindFromMime,
  verifyMediaOwnership,
  passesPublicationGate,
  ALLOWED_LIVE_UPLOAD_MIME,
  ALLOWED_VIDEO_MIME,
  ALLOWED_AUDIO_MIME,
  MAX_UPLOAD_BYTES,
  MAX_FILENAME_LEN,
  type MediaOwnershipResult,
} from "./upload-validation";
import type { Queryable } from "@/lib/nex-media/media-object";

// ── validateUpload ────────────────────────────────────────────────

describe("validateUpload · MIME allowlist (§2)", () => {
  it("accepts video/mp4", () => {
    expect(validateUpload({ mime_type: "video/mp4", byte_size: 1024, filename: "clip.mp4" }).ok).toBe(true);
  });
  it("accepts video/webm", () => {
    expect(validateUpload({ mime_type: "video/webm", byte_size: 1024, filename: null }).ok).toBe(true);
  });
  it("accepts audio/mpeg", () => {
    expect(validateUpload({ mime_type: "audio/mpeg", byte_size: 1024, filename: "song.mp3" }).ok).toBe(true);
  });
  it("accepts audio/wav", () => {
    expect(validateUpload({ mime_type: "audio/wav", byte_size: 1024, filename: null }).ok).toBe(true);
  });
  it("REJECTS application/pdf (not in Live allowlist)", () => {
    const r = validateUpload({ mime_type: "application/pdf", byte_size: 1024, filename: "doc.pdf" });
    expect(r.ok).toBe(false);
    if (!r.ok) expect(r.error_code).toBe("UNSUPPORTED_MEDIA");
  });
  it("REJECTS text/html (executable-shaped content)", () => {
    const r = validateUpload({ mime_type: "text/html", byte_size: 1024, filename: "x.html" });
    expect(r.ok).toBe(false);
    if (!r.ok) expect(r.error_code).toBe("UNSUPPORTED_MEDIA");
  });
  it("REJECTS application/octet-stream (unknown MIME · §10 fail closed)", () => {
    const r = validateUpload({ mime_type: "application/octet-stream", byte_size: 1024, filename: null });
    expect(r.ok).toBe(false);
    if (!r.ok) expect(r.error_code).toBe("UNSUPPORTED_MEDIA");
  });
  it("case-insensitive on MIME", () => {
    expect(validateUpload({ mime_type: "VIDEO/MP4", byte_size: 1024, filename: null }).ok).toBe(true);
  });
});

describe("validateUpload · size limits", () => {
  it("REJECTS oversized files (§10)", () => {
    const r = validateUpload({ mime_type: "video/mp4", byte_size: MAX_UPLOAD_BYTES + 1, filename: null });
    expect(r.ok).toBe(false);
    if (!r.ok) expect(r.error_code).toBe("FILE_TOO_LARGE");
  });
  it("REJECTS empty file", () => {
    const r = validateUpload({ mime_type: "video/mp4", byte_size: 0, filename: null });
    expect(r.ok).toBe(false);
    if (!r.ok) expect(r.error_code).toBe("FILE_EMPTY");
  });
  it("REJECTS negative size", () => {
    const r = validateUpload({ mime_type: "video/mp4", byte_size: -1, filename: null });
    expect(r.ok).toBe(false);
    if (!r.ok) expect(r.error_code).toBe("INVALID_FILE");
  });
  it("REJECTS NaN size", () => {
    const r = validateUpload({ mime_type: "video/mp4", byte_size: NaN, filename: null });
    expect(r.ok).toBe(false);
    if (!r.ok) expect(r.error_code).toBe("INVALID_FILE");
  });
  it("accepts exactly at limit", () => {
    const r = validateUpload({ mime_type: "video/mp4", byte_size: MAX_UPLOAD_BYTES, filename: null });
    expect(r.ok).toBe(true);
  });
});

describe("validateUpload · missing mime", () => {
  it("REJECTS empty mime_type", () => {
    const r = validateUpload({ mime_type: "", byte_size: 1024, filename: null });
    expect(r.ok).toBe(false);
    if (!r.ok) expect(r.error_code).toBe("INVALID_FILE");
  });
});

// ── isFilenameUnsafe (§29 filename safety) ────────────────────────

describe("isFilenameUnsafe · path traversal + control chars", () => {
  it("safe: normal filename", () => expect(isFilenameUnsafe("song.mp3")).toBe(false));
  it("safe: unicode filename", () => expect(isFilenameUnsafe("音楽.mp3")).toBe(false));
  it("UNSAFE: contains ..", () => expect(isFilenameUnsafe("../etc/passwd")).toBe(true));
  it("UNSAFE: contains forward slash", () => expect(isFilenameUnsafe("dir/song.mp3")).toBe(true));
  it("UNSAFE: contains backslash", () => expect(isFilenameUnsafe("dir\\song.mp3")).toBe(true));
  it("UNSAFE: contains null byte", () => expect(isFilenameUnsafe("song\0.mp3")).toBe(true));
  it("UNSAFE: contains newline", () => expect(isFilenameUnsafe("song\n.mp3")).toBe(true));
  it("UNSAFE: contains DEL char (0x7F)", () => expect(isFilenameUnsafe("song\x7F.mp3")).toBe(true));
});

describe("validateUpload · filename gates", () => {
  it("REJECTS oversized filename", () => {
    const r = validateUpload({ mime_type: "video/mp4", byte_size: 1024, filename: "a".repeat(MAX_FILENAME_LEN + 1) });
    expect(r.ok).toBe(false);
    if (!r.ok) expect(r.error_code).toBe("FILENAME_TOO_LONG");
  });
  it("REJECTS unsafe filename", () => {
    const r = validateUpload({ mime_type: "video/mp4", byte_size: 1024, filename: "../secret" });
    expect(r.ok).toBe(false);
    if (!r.ok) expect(r.error_code).toBe("FILENAME_UNSAFE");
  });
  it("null filename OK", () => {
    expect(validateUpload({ mime_type: "video/mp4", byte_size: 1024, filename: null }).ok).toBe(true);
  });
});

// ── kindFromMime ──────────────────────────────────────────────────

describe("kindFromMime · MIME → kind (never trusts client mode)", () => {
  it("video/mp4 → video", () => expect(kindFromMime("video/mp4")).toBe("video"));
  it("audio/mpeg → audio", () => expect(kindFromMime("audio/mpeg")).toBe("audio"));
  it("audio/wav → audio", () => expect(kindFromMime("audio/wav")).toBe("audio"));
  it("image/jpeg → null (not a Live media kind)", () => expect(kindFromMime("image/jpeg")).toBe(null));
  it("unknown → null", () => expect(kindFromMime("nonsense")).toBe(null));
});

// ── verifyMediaOwnership · §16 §17 immutable ─────────────────────

/** Minimal fake Queryable for isolated testing · matches the same shape
 *  that /lib/nex-media/media-object.ts::Queryable expects. */
function fakeDb(rows: unknown[]): Queryable {
  return {
    query: async () => ({ rows: rows as never[], rowCount: rows.length }),
  } as unknown as Queryable;
}
function throwingDb(err: string): Queryable {
  return {
    query: async () => { throw new Error(err); },
  } as unknown as Queryable;
}

describe("verifyMediaOwnership · §16 immutable server-side ownership", () => {
  it("returns ok:true when owner matches authenticated user", async () => {
    const db = fakeDb([{ owner_id: "user-1", state: "ready", visibility: "public", mime_type: "video/mp4" }]);
    const r = await verifyMediaOwnership(db, { media_id: "m1", authenticated_supabase_user_id: "user-1" });
    expect(r.ok).toBe(true);
    if (r.ok) {
      expect(r.owner_id).toBe("user-1");
      expect(r.state).toBe("ready");
    }
  });
  it("returns MEDIA_NOT_FOUND when no row exists", async () => {
    const db = fakeDb([]);
    const r = await verifyMediaOwnership(db, { media_id: "m-missing", authenticated_supabase_user_id: "user-1" });
    expect(r.ok).toBe(false);
    if (!r.ok) expect(r.error_code).toBe("MEDIA_NOT_FOUND");
  });
  it("returns MEDIA_NOT_OWNED when owner mismatches", async () => {
    const db = fakeDb([{ owner_id: "victim-user", state: "ready", visibility: "public", mime_type: "video/mp4" }]);
    const r = await verifyMediaOwnership(db, { media_id: "m1", authenticated_supabase_user_id: "attacker-user" });
    expect(r.ok).toBe(false);
    if (!r.ok) expect(r.error_code).toBe("MEDIA_NOT_OWNED");
  });
  it("returns MEDIA_NOT_OWNED when no authenticated user id", async () => {
    const db = fakeDb([{ owner_id: "victim", state: "ready", visibility: "public", mime_type: "video/mp4" }]);
    const r = await verifyMediaOwnership(db, { media_id: "m1", authenticated_supabase_user_id: "" });
    expect(r.ok).toBe(false);
    if (!r.ok) expect(r.error_code).toBe("MEDIA_NOT_OWNED");
  });
  it("returns MEDIA_NOT_FOUND when no media_id supplied", async () => {
    const db = fakeDb([]);
    const r = await verifyMediaOwnership(db, { media_id: "", authenticated_supabase_user_id: "user-1" });
    expect(r.ok).toBe(false);
    if (!r.ok) expect(r.error_code).toBe("MEDIA_NOT_FOUND");
  });
  it("returns MEDIA_STORAGE_UNAVAILABLE when db throws", async () => {
    const db = throwingDb("connection refused");
    const r = await verifyMediaOwnership(db, { media_id: "m1", authenticated_supabase_user_id: "user-1" });
    expect(r.ok).toBe(false);
    if (!r.ok) expect(r.error_code).toBe("MEDIA_STORAGE_UNAVAILABLE");
  });
});

// ── passesPublicationGate · §17 composite ────────────────────────

describe("passesPublicationGate · §17 immutable composite check", () => {
  const OK_OWNERSHIP: MediaOwnershipResult = {
    ok: true, owner_id: "user-1", state: "ready", visibility: "public", mime_type: "video/mp4",
  };

  it("permits when all conditions met", () => {
    const r = passesPublicationGate({
      authenticated_supabase_user_id: "user-1",
      media_ownership: OK_OWNERSHIP,
      has_active_rights_declaration: true,
    });
    expect(r.ok).toBe(true);
  });
  it("REJECTS AUTHENTICATION_REQUIRED when no session", () => {
    const r = passesPublicationGate({
      authenticated_supabase_user_id: "",
      media_ownership: OK_OWNERSHIP,
      has_active_rights_declaration: true,
    });
    expect(r.ok).toBe(false);
    if (!r.ok) expect(r.error_code).toBe("AUTHENTICATION_REQUIRED");
  });
  it("REJECTS MEDIA_NOT_FOUND when ownership check said so", () => {
    const r = passesPublicationGate({
      authenticated_supabase_user_id: "user-1",
      media_ownership: { ok: false, error_code: "MEDIA_NOT_FOUND", reason: "x" },
      has_active_rights_declaration: true,
    });
    expect(r.ok).toBe(false);
    if (!r.ok) expect(r.error_code).toBe("MEDIA_NOT_FOUND");
  });
  it("REJECTS MEDIA_NOT_OWNED when ownership rejected", () => {
    const r = passesPublicationGate({
      authenticated_supabase_user_id: "attacker-user",
      media_ownership: { ok: false, error_code: "MEDIA_NOT_OWNED", reason: "x" },
      has_active_rights_declaration: true,
    });
    expect(r.ok).toBe(false);
    if (!r.ok) expect(r.error_code).toBe("MEDIA_NOT_OWNED");
  });
  it("REJECTS MEDIA_NOT_READY when state ≠ ready", () => {
    const r = passesPublicationGate({
      authenticated_supabase_user_id: "user-1",
      media_ownership: { ok: true, owner_id: "user-1", state: "uploading", visibility: "public", mime_type: "video/mp4" },
      has_active_rights_declaration: true,
    });
    expect(r.ok).toBe(false);
    if (!r.ok) expect(r.error_code).toBe("MEDIA_NOT_READY");
  });
  it("REJECTS RIGHTS_DECLARATION_REQUIRED when no declaration", () => {
    const r = passesPublicationGate({
      authenticated_supabase_user_id: "user-1",
      media_ownership: OK_OWNERSHIP,
      has_active_rights_declaration: false,
    });
    expect(r.ok).toBe(false);
    if (!r.ok) expect(r.error_code).toBe("RIGHTS_DECLARATION_REQUIRED");
  });
  it("REJECTS MEDIA_STORAGE_UNAVAILABLE when ownership check failed on infra", () => {
    const r = passesPublicationGate({
      authenticated_supabase_user_id: "user-1",
      media_ownership: { ok: false, error_code: "MEDIA_STORAGE_UNAVAILABLE", reason: "db down" },
      has_active_rights_declaration: true,
    });
    expect(r.ok).toBe(false);
    if (!r.ok) expect(r.error_code).toBe("MEDIA_STORAGE_UNAVAILABLE");
  });
});

// ── Allowlist integrity ────────────────────────────────────────────

describe("allowlists · integrity + sanity", () => {
  it("Live allowlist = video ∪ audio · no images", () => {
    for (const m of ALLOWED_VIDEO_MIME) expect(ALLOWED_LIVE_UPLOAD_MIME.has(m)).toBe(true);
    for (const m of ALLOWED_AUDIO_MIME) expect(ALLOWED_LIVE_UPLOAD_MIME.has(m)).toBe(true);
    expect(ALLOWED_LIVE_UPLOAD_MIME.has("image/jpeg")).toBe(false);
  });
  it("no executable MIME present", () => {
    for (const m of ALLOWED_LIVE_UPLOAD_MIME) {
      expect(m).not.toMatch(/javascript|html|executable/);
    }
  });
  it("size limit is a sane number", () => {
    expect(MAX_UPLOAD_BYTES).toBeGreaterThan(1024 * 1024);   // ≥ 1 MB
    expect(MAX_UPLOAD_BYTES).toBeLessThanOrEqual(1024 * 1024 * 1024);   // ≤ 1 GB
  });
});
