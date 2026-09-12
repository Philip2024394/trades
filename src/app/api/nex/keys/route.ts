// src/app/api/nex/keys/route.ts
//
// Founder Phase 14 · P14-4 · Cookie-authed API key management.
// GET  → list current user's keys
// POST { name, tier?, scopes? } → issue new key, returns raw_token ONCE

import { NextResponse } from "next/server";
import { cookies } from "next/headers";
import { resolveSession } from "@/lib/nex/identity-auth";
import { issueApiKey, listApiKeys } from "@/lib/nex/api-platform/keys";

export const runtime = "nodejs";

export async function GET() {
  const cookieStore = await cookies();
  const token = cookieStore.get("nex_session")?.value ?? null;
  const session = await resolveSession(token);
  if (!session?.user_id) return NextResponse.json({ error: "unauthenticated" }, { status: 401 });
  const keys = await listApiKeys(session.user_id);
  return NextResponse.json({
    keys: keys.map((k) => ({
      api_key_id: k.api_key_id,
      name: k.name,
      token_prefix: k.token_prefix,
      tier: k.tier,
      scopes: k.scopes,
      created_at: k.created_at,
      last_used_at: k.last_used_at,
      revoked_at: k.revoked_at,
      request_count: k.request_count,
    })),
  });
}

export async function POST(req: Request) {
  const cookieStore = await cookies();
  const token = cookieStore.get("nex_session")?.value ?? null;
  const session = await resolveSession(token);
  if (!session?.user_id) return NextResponse.json({ error: "unauthenticated" }, { status: 401 });
  let body: Record<string, unknown> = {};
  try { body = (await req.json()) as Record<string, unknown>; } catch { /* empty body */ }
  const name = typeof body.name === "string" && body.name.trim() ? body.name : "unnamed";
  const tier = ["free", "pro", "enterprise"].includes(body.tier as string) ? (body.tier as "free" | "pro" | "enterprise") : "free";
  const scopes = Array.isArray(body.scopes) && body.scopes.every((s) => typeof s === "string") ? (body.scopes as string[]) : undefined;
  const out = await issueApiKey({ user_id: session.user_id, name, tier, scopes });
  return NextResponse.json({
    api_key_id: out.api_key_id,
    raw_token: out.raw_token,
    token_prefix: out.token_prefix,
    tier: out.tier,
    scopes: out.scopes,
    warning: "Store this raw_token now — NEX cannot recover it later.",
  });
}
