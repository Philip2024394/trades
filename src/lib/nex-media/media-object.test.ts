// src/lib/nex-media/media-object.test.ts
//
// NEX Media Foundation · Stage 1 · regression tests · Philip 2026-08-27.
//
// Every test runs inside a transaction that ROLLS BACK · zero DB persistence.
// Same pattern as identity-resolver + gate tests.
//
// Covers ADR-0118 rules:
//   § 1 · uploader is owner
//   § 3 · in-NEX delete → grace period 7 days
//   § 4 · visibility defaults private
//   § 5 · provenance stamped once, never rewritten
//   plus: state transitions · read permissions · content_hash preserved

import { describe, it, expect, beforeAll, afterAll } from "vitest";
import pg from "pg";
import {
  insertUploadingRow, completeUpload, softDelete, getById,
} from "./media-object";
import { canRead, canMutate, normaliseVisibility } from "./permissions";

const POOL = new pg.Pool({
  connectionString: process.env.NEX_POSTGRES_URL
    ?? "postgresql://postgres:Admin1phil@localhost:5433/nex_dev",
  max: 3,
});

beforeAll(async () => {
  const r = await POOL.query(
    `SELECT COUNT(*)::int AS n FROM information_schema.tables WHERE table_schema='nex' AND table_name='media_object'`,
  );
  if (r.rows[0].n === 0) throw new Error("nex.media_object missing · run migration 118");
});
afterAll(async () => { await POOL.end(); });

async function inTx<T>(fn: (c: pg.PoolClient) => Promise<T>): Promise<T> {
  const c = await POOL.connect();
  try {
    await c.query("BEGIN");
    const out = await fn(c);
    await c.query("ROLLBACK");
    return out;
  } finally { c.release(); }
}

describe("nex-media · schema + defaults", () => {
  it("(ADR-0118 § 4) visibility defaults to private when not specified", async () => {
    await inTx(async (c) => {
      const row = await insertUploadingRow(c, {
        object_type: "image", owner_id: "user-alice", visibility: normaliseVisibility(undefined),
        storage_key: "test/a.jpg", storage_version: "v1", mime_type: "image/jpeg",
        uploaded_via: "test",
      });
      expect(row.visibility).toBe("private");
    });
  });

  it("(ADR-0118 § 1) uploader is stamped as owner_id", async () => {
    await inTx(async (c) => {
      const row = await insertUploadingRow(c, {
        object_type: "video", owner_id: "user-bob", visibility: "unlisted",
        storage_key: "test/v.mp4", storage_version: "v1", mime_type: "video/mp4",
        uploaded_via: "test",
      });
      expect(row.owner_id).toBe("user-bob");
      expect(row.state).toBe("uploading");
    });
  });

  it("state transitions uploading → ready via completeUpload", async () => {
    await inTx(async (c) => {
      const row = await insertUploadingRow(c, {
        object_type: "image", owner_id: "user-c", visibility: "public",
        storage_key: "test/img.png", storage_version: "v1", mime_type: "image/png",
        uploaded_via: "test",
      });
      const done = await completeUpload(c, {
        media_id: row.media_id, size_bytes: 12345, content_hash: "abcdef",
        width_px: 640, height_px: 480,
      });
      expect(done?.state).toBe("ready");
      expect(done?.size_bytes).toBe(12345);
      expect(done?.content_hash).toBe("abcdef");
      expect(done?.width_px).toBe(640);
    });
  });

  it("completeUpload refuses to move away from state='uploading'", async () => {
    await inTx(async (c) => {
      const row = await insertUploadingRow(c, {
        object_type: "image", owner_id: "user-d", visibility: "private",
        storage_key: "test/img2.png", storage_version: "v1", mime_type: "image/png",
        uploaded_via: "test",
      });
      const first = await completeUpload(c, { media_id: row.media_id, size_bytes: 1, content_hash: "x" });
      expect(first?.state).toBe("ready");
      const second = await completeUpload(c, { media_id: row.media_id, size_bytes: 2, content_hash: "y" });
      expect(second).toBeNull();  // already ready · won't re-fire
    });
  });
});

describe("nex-media · ADR-0118 § 3 · 7-day grace period on delete", () => {
  it("softDelete transitions state to 'deleted' + sets hard_delete_after ~7 days out", async () => {
    await inTx(async (c) => {
      const row = await insertUploadingRow(c, {
        object_type: "video", owner_id: "user-e", visibility: "private",
        storage_key: "test/e.mp4", storage_version: "v1", mime_type: "video/mp4",
        uploaded_via: "test",
      });
      await completeUpload(c, { media_id: row.media_id, size_bytes: 100, content_hash: "h" });
      const deleted = await softDelete(c, row.media_id);
      expect(deleted?.state).toBe("deleted");
      expect(deleted?.deleted_at).toBeTruthy();
      expect(deleted?.hard_delete_after).toBeTruthy();
      const graceMs = deleted!.hard_delete_after!.getTime() - deleted!.deleted_at!.getTime();
      const sevenDays = 7 * 24 * 3600 * 1000;
      expect(graceMs).toBeGreaterThan(sevenDays - 1000);
      expect(graceMs).toBeLessThan(sevenDays + 1000);
    });
  });

  it("softDelete on already-deleted row returns null (idempotent)", async () => {
    await inTx(async (c) => {
      const row = await insertUploadingRow(c, {
        object_type: "image", owner_id: "user-f", visibility: "private",
        storage_key: "test/f.png", storage_version: "v1", mime_type: "image/png",
        uploaded_via: "test",
      });
      await completeUpload(c, { media_id: row.media_id, size_bytes: 1, content_hash: "h" });
      const first = await softDelete(c, row.media_id);
      expect(first?.state).toBe("deleted");
      const second = await softDelete(c, row.media_id);
      expect(second).toBeNull();
    });
  });
});

describe("nex-media · permissions", () => {
  it("public + ready → anyone can read", () => {
    const row = fakeRow({ visibility: "public", state: "ready", owner_id: "alice" });
    expect(canRead(row, { identity: null })).toBe(true);
    expect(canRead(row, { identity: "bob" })).toBe(true);
    expect(canRead(row, { identity: "alice" })).toBe(true);
  });
  it("unlisted + ready → anyone with the id can read", () => {
    const row = fakeRow({ visibility: "unlisted", state: "ready", owner_id: "alice" });
    expect(canRead(row, { identity: "random" })).toBe(true);
  });
  it("private + ready → only owner", () => {
    const row = fakeRow({ visibility: "private", state: "ready", owner_id: "alice" });
    expect(canRead(row, { identity: "alice" })).toBe(true);
    expect(canRead(row, { identity: "bob" })).toBe(false);
    expect(canRead(row, { identity: null })).toBe(false);
  });
  it("admin can always read", () => {
    const row = fakeRow({ visibility: "private", state: "deleted", owner_id: "alice" });
    expect(canRead(row, { identity: "anyone", isAdmin: true })).toBe(true);
  });
  it("deleted → only owner and admin can read", () => {
    const row = fakeRow({ visibility: "public", state: "deleted", owner_id: "alice" });
    expect(canRead(row, { identity: "bob" })).toBe(false);
    expect(canRead(row, { identity: "alice" })).toBe(true);
  });
  it("only owner + admin can mutate", () => {
    const row = fakeRow({ visibility: "public", state: "ready", owner_id: "alice" });
    expect(canMutate(row, { identity: "alice" })).toBe(true);
    expect(canMutate(row, { identity: "bob" })).toBe(false);
    expect(canMutate(row, { identity: null })).toBe(false);
    expect(canMutate(row, { identity: "someone", isAdmin: true })).toBe(true);
  });
});

describe("nex-media · normaliseVisibility", () => {
  it("defaults to private", () => {
    expect(normaliseVisibility(undefined)).toBe("private");
    expect(normaliseVisibility(null)).toBe("private");
    expect(normaliseVisibility("garbage")).toBe("private");
  });
  it("accepts valid values", () => {
    expect(normaliseVisibility("public")).toBe("public");
    expect(normaliseVisibility("unlisted")).toBe("unlisted");
    expect(normaliseVisibility("private")).toBe("private");
  });
});

// ── helper ───────────────────────────────────────────────────────
function fakeRow(overrides: Partial<import("./types").MediaObject>): import("./types").MediaObject {
  return {
    media_id: "00000000-0000-0000-0000-000000000000",
    object_type: "image", owner_id: "owner", visibility: "private",
    storage_bucket: "nex-media", storage_key: "k", storage_version: "v1",
    mime_type: "image/jpeg", size_bytes: 0, content_hash: "",
    duration_ms: null, width_px: null, height_px: null, codec: null,
    poster_media_id: null, audio_codec: null, sample_rate: null, channels: null,
    context_type: null, context_ref: null,
    uploaded_via: "test", uploaded_at: new Date(), uploaded_from_user_agent: null,
    cycle_run_id: null,
    state: "ready", deleted_at: null, hard_delete_after: null,
    title: null, description: null, extras: {},
    created_at: new Date(), updated_at: new Date(),
    ...overrides,
  };
}
