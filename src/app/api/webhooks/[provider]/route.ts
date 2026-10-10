// POST /api/webhooks/{provider}
//
// Single dynamic-route webhook endpoint for all 5 supported providers.
// Founder-authorised programme · Session-19 · World-proof gate #4 · 2026-09-22.
//
// GATED:
//   1. NEX_WEBHOOK_ENDPOINTS_ACTIVATION === "on"       → else 503 endpoint_dormant
//   2. Per-provider secret env var configured          → else 503 endpoint_dormant
//   3. Signature verification succeeds                 → else 401 signature_failed
//
// When all three gates pass: verify → classify → record → 202.
// Response body never contains raw email addresses.

import { NextResponse } from "next/server";
import { getPool } from "@/lib/nex/db";
import { handleAuthenticatedWebhook } from "@/lib/nex/marketing/deliverability";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

export async function POST(req: Request, ctx: { params: Promise<{ provider: string }> }) {
  const { provider } = await ctx.params;
  const raw_body = await req.text();
  const headers: Record<string, string> = {};
  req.headers.forEach((v, k) => { headers[k.toLowerCase()] = v; });

  const pool = await getPool();
  if (!pool) {
    return NextResponse.json({ ok: false, error: "database_unavailable" }, { status: 503 });
  }
  const client = await pool.connect();
  try {
    const result = await handleAuthenticatedWebhook(client, {
      provider, raw_body, headers, env: process.env,
    });
    switch (result.kind) {
      case "recorded":
      case "already_recorded":
      case "insufficient_evidence":
        return NextResponse.json({ ok: true, result }, { status: 202 });
      case "signature_failed":
        return NextResponse.json({ ok: false, result }, { status: 401 });
      case "endpoint_dormant":
        return NextResponse.json({ ok: false, result }, { status: 503 });
      case "provider_unknown":
        return NextResponse.json({ ok: false, result }, { status: 404 });
    }
  } catch (e) {
    const msg = e instanceof Error ? e.message : String(e);
    return NextResponse.json({ ok: false, error: "internal_error", detail: msg }, { status: 500 });
  } finally { client.release(); }
}

// GET · surface dormancy status without processing any body
export async function GET(req: Request, ctx: { params: Promise<{ provider: string }> }) {
  const { provider } = await ctx.params;
  const env_gate_on = process.env.NEX_WEBHOOK_ENDPOINTS_ACTIVATION === "on";
  return NextResponse.json({
    ok: true,
    provider,
    endpoint_state: env_gate_on ? "active" : "dormant",
    note: "POST signed provider webhooks here · GET returns dormancy status only",
  });
}
