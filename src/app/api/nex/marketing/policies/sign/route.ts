// POST /api/nex/marketing/policies/sign
//
// Server-side HMAC helper for the founder UI. Signs a policy payload
// with NEX_LAB_PROMOTION_SECRET so the founder doesn't need to run a
// CLI to authorize. Founder-only (localhost / admin cookie / HQ token).
//
// Governance: this endpoint SIGNS. It does not persist. The client then
// POSTs the signed payload to /api/nex/marketing/policies which verifies
// signature + stores. Two-step so the server-side signer never bypasses
// the verifier — same secret both sides.

import { NextResponse } from "next/server";
import { createHmac } from "node:crypto";

export const dynamic = "force-dynamic";
export const runtime = "nodejs";

function isFounderRequest(req: Request): boolean {
  const url = new URL(req.url);
  const host = url.hostname;
  if (host === "localhost" || host === "127.0.0.1" || host === "::1") return true;
  const cookie = req.headers.get("cookie") ?? "";
  if (cookie.includes("admin_authed=1") || /x-admin-sig|nex_session=/.test(cookie)) return true;
  const token = req.headers.get("x-hq-token") ?? url.searchParams.get("hq_token");
  const expected = process.env.NEX_HQ_DASHBOARD_TOKEN;
  if (expected && expected.length >= 16 && token && token === expected) return true;
  return false;
}

function sortKeys<T>(v: T): T {
  if (v === null || typeof v !== "object") return v;
  if (Array.isArray(v)) return v.map(sortKeys) as unknown as T;
  const out: Record<string, unknown> = {};
  for (const k of Object.keys(v as Record<string, unknown>).sort()) {
    out[k] = sortKeys((v as Record<string, unknown>)[k]);
  }
  return out as T;
}

export async function POST(req: Request) {
  if (!isFounderRequest(req)) return NextResponse.json({ error: "no_founder_credential" }, { status: 401 });
  const secret = process.env.NEX_LAB_PROMOTION_SECRET ?? "";
  if (secret.length < 32) return NextResponse.json({ error: "server_secret_not_configured" }, { status: 500 });
  const body = await req.json().catch(() => null) as {
    slug?: string; subsystem?: string; agent_class?: string; action_kind?: string;
    action_level?: number; conditions?: Record<string, unknown>;
    authorized_by_user_id?: string;
  } | null;
  if (!body?.slug || !body.subsystem || !body.agent_class || !body.action_kind || !body.action_level || !body.authorized_by_user_id) {
    return NextResponse.json({ error: "missing_fields" }, { status: 400 });
  }
  const authorized_at = new Date().toISOString();
  const payload = JSON.stringify({
    slug: body.slug, subsystem: body.subsystem, agent_class: body.agent_class,
    action_kind: body.action_kind, action_level: body.action_level,
    conditions: sortKeys(body.conditions ?? {}),
    authorized_by_user_id: body.authorized_by_user_id, authorized_at,
  });
  const signature_hmac = createHmac("sha256", secret).update(payload).digest("hex");
  return NextResponse.json({ authorized_at, signature_hmac });
}
