// GET  /api/nex-media/[id]  → metadata + signed playback URL
// DELETE /api/nex-media/[id] → soft delete (7-day grace, ADR-0118 § 3)
//
// Caller identity is taken from the `x-nex-identity` header (dev + prod).
// Real auth wraps this later — for Stage 1 the header is the identity.

import { NextResponse } from "next/server";
import { getObjectStorage } from "@/lib/nex/storage/object-registry";
import { getMediaPool, getById, softDelete } from "@/lib/nex-media/media-object";
import { canRead, canMutate } from "@/lib/nex-media/permissions";

export const dynamic = "force-dynamic";

function callerFromReq(req: Request): { identity: string | null; isAdmin: boolean } {
  const identity = req.headers.get("x-nex-identity");
  const isAdmin = req.headers.get("x-nex-admin") === "1";
  return { identity: identity && identity.length > 0 ? identity : null, isAdmin };
}

export async function GET(req: Request, ctx: { params: Promise<{ id: string }> }) {
  const { id } = await ctx.params;
  const pool = getMediaPool();
  const row = await getById(pool, id);
  if (!row) return NextResponse.json({ ok: false, error: "not found" }, { status: 404 });

  const caller = callerFromReq(req);
  if (!canRead(row, caller)) {
    return NextResponse.json({ ok: false, error: "not found" }, { status: 404 });  // don't leak existence
  }

  // Issue a short-lived playback URL. Backend chooses signed vs public.
  let playback_url: string | null = null;
  try {
    if (row.state === "ready") {
      const store = getObjectStorage();
      playback_url = await store.presign(row.storage_bucket, row.storage_key, {
        operation: "get",
        expires_seconds: 900,
      });
    }
  } catch (e) {
    // Non-fatal · metadata still returned. Playback URL may be null.
    playback_url = null;
  }

  return NextResponse.json({ ok: true, media: row, playback_url });
}

export async function DELETE(req: Request, ctx: { params: Promise<{ id: string }> }) {
  const { id } = await ctx.params;
  const pool = getMediaPool();
  const row = await getById(pool, id);
  if (!row) return NextResponse.json({ ok: false, error: "not found" }, { status: 404 });

  const caller = callerFromReq(req);
  if (!canMutate(row, caller)) {
    return NextResponse.json({ ok: false, error: "forbidden" }, { status: 403 });
  }

  const updated = await softDelete(pool, id);
  if (!updated) return NextResponse.json({ ok: false, error: "already deleted" }, { status: 409 });

  // Note: bytes remain in the storage backend for 7 days (ADR-0118 § 3 grace period).
  // A janitor job (deferred to Stage 2) will hard-delete when now() > hard_delete_after.

  return NextResponse.json({ ok: true, media: updated, note: "soft deleted · grace period 7 days" });
}
