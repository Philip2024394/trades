// src/app/api/nex/keys/[id]/route.ts
//
// Founder Phase 14 · P14-4 · Per-key ops: DELETE (revoke) · POST (rotate).

import { NextResponse } from "next/server";
import { cookies } from "next/headers";
import { resolveSession } from "@/lib/nex/identity-auth";
import { revokeApiKey, rotateApiKey } from "@/lib/nex/api-platform/keys";

export const runtime = "nodejs";

export async function DELETE(_req: Request, ctx: { params: Promise<{ id: string }> }) {
  const { id } = await ctx.params;
  const cookieStore = await cookies();
  const token = cookieStore.get("nex_session")?.value ?? null;
  const session = await resolveSession(token);
  if (!session?.user_id) return NextResponse.json({ error: "unauthenticated" }, { status: 401 });
  const ok = await revokeApiKey(session.user_id, id);
  return NextResponse.json({ ok, api_key_id: id });
}

export async function POST(_req: Request, ctx: { params: Promise<{ id: string }> }) {
  const { id } = await ctx.params;
  const cookieStore = await cookies();
  const token = cookieStore.get("nex_session")?.value ?? null;
  const session = await resolveSession(token);
  if (!session?.user_id) return NextResponse.json({ error: "unauthenticated" }, { status: 401 });
  const out = await rotateApiKey(session.user_id, id);
  if (!out) return NextResponse.json({ error: "not_found_or_revoked" }, { status: 404 });
  return NextResponse.json({
    raw_token: out.raw_token,
    token_prefix: out.token_prefix,
    warning: "Store this raw_token now — the previous token is revoked and cannot be recovered.",
  });
}
