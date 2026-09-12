// src/app/api/nex-private/route.ts
//
// NEX Y-P3 · Private ciphertext API (POST / GET / DELETE)
// Philip 2026-09-07
//
// The endpoint NEVER accepts or returns plaintext. Payloads are opaque
// ciphertext bytes + a 12-byte IV, both base64-encoded for JSON
// transport. Clients encrypt/decrypt in the browser with a DEK the
// server never holds.

import { NextResponse } from "next/server";
import { getAuthenticatedUser } from "@/lib/nex/brains/_auth";
import { putPrivate, listPrivate, deletePrivate, getPrivate } from "@/lib/nex/private/private-store";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

// ---------------------------------------------------------------------------
// POST · put ciphertext
// ---------------------------------------------------------------------------
export async function POST(req: Request) {
  const auth = await getAuthenticatedUser();
  if (!auth.ok) return NextResponse.json({ ok: false, error: auth.error }, { status: auth.status });

  let body: {
    object_type?: unknown;
    ciphertext_b64?: unknown;
    iv_b64?: unknown;
    key_version?: unknown;
    metadata?: unknown;
    // Guard against a misused client that accidentally sends plaintext.
    plaintext?: unknown;
    content?: unknown;
  } | null = null;
  try { body = await req.json(); } catch { return NextResponse.json({ ok: false, error: "invalid_json" }, { status: 400 }); }

  // TRUTH GUARD · this endpoint never accepts plaintext. If a caller
  // sends `plaintext` or `content`, reject with a helpful error so a
  // mistaken client can be spotted immediately during development.
  if ("plaintext" in (body ?? {}) || "content" in (body ?? {})) {
    return NextResponse.json({ ok: false, error: "plaintext_forbidden · encrypt client-side then send ciphertext_b64 + iv_b64" }, { status: 400 });
  }

  const result = await putPrivate({
    actor_user_id: auth.user.supabase_user_id,
    object_type: String(body?.object_type ?? ""),
    ciphertext_b64: String(body?.ciphertext_b64 ?? ""),
    iv_b64: String(body?.iv_b64 ?? ""),
    key_version: typeof body?.key_version === "number" ? body!.key_version as number : 1,
    metadata: (body?.metadata as Record<string, unknown>) ?? {},
  });
  if (!result.ok) return NextResponse.json({ ok: false, error: result.error }, { status: result.status });
  return NextResponse.json({ ok: true, object: result.value }, { status: 201 });
}

// ---------------------------------------------------------------------------
// GET · list ciphertext blobs · optional ?type=X or ?id=X (single)
// ---------------------------------------------------------------------------
export async function GET(req: Request) {
  const auth = await getAuthenticatedUser();
  if (!auth.ok) return NextResponse.json({ ok: false, error: auth.error }, { status: auth.status });

  const url = new URL(req.url);
  const id = url.searchParams.get("id");
  const type = url.searchParams.get("type") ?? undefined;

  if (id) {
    const single = await getPrivate({ actor_user_id: auth.user.supabase_user_id, id });
    if (!single.ok) return NextResponse.json({ ok: false, error: single.error }, { status: single.status });
    if (!single.value) return NextResponse.json({ ok: true, object: null }, { status: 200 });
    return NextResponse.json({ ok: true, object: single.value }, { status: 200 });
  }

  const list = await listPrivate({ actor_user_id: auth.user.supabase_user_id, object_type: type });
  if (!list.ok) return NextResponse.json({ ok: false, error: list.error }, { status: list.status });
  return NextResponse.json({ ok: true, objects: list.value }, { status: 200 });
}

// ---------------------------------------------------------------------------
// DELETE · own ciphertext blob only
// ---------------------------------------------------------------------------
export async function DELETE(req: Request) {
  const auth = await getAuthenticatedUser();
  if (!auth.ok) return NextResponse.json({ ok: false, error: auth.error }, { status: auth.status });

  const url = new URL(req.url);
  const id = url.searchParams.get("id");
  if (!id) return NextResponse.json({ ok: false, error: "id_required" }, { status: 400 });

  const result = await deletePrivate({ actor_user_id: auth.user.supabase_user_id, id });
  if (!result.ok) return NextResponse.json({ ok: false, error: result.error }, { status: result.status });
  return NextResponse.json({ ok: true, deleted: result.value.deleted }, { status: 200 });
}
