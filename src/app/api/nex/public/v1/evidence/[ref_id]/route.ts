// src/app/api/nex/public/v1/evidence/[ref_id]/route.ts
//
// Founder Phase 14 · P14-4 · Public API evidence lookup.
//
// Auth: Bearer nex_live_... (chat:read scope)
// Response: forwards internal evidence endpoint + rate-limit headers.

import { NextResponse } from "next/server";
import { requireApiKey } from "@/lib/nex/api-platform/bearer-auth";
import { checkRateLimit, rateLimitHeaders } from "@/lib/nex/api-platform/rate-limit";

export const runtime = "nodejs";

export async function GET(req: Request, ctx: { params: Promise<{ ref_id: string }> }) {
  const auth = await requireApiKey(req, "chat:read");
  if (!auth.ok) return NextResponse.json({ error: auth.error }, { status: auth.status });

  const rl = checkRateLimit(auth.key.api_key_id, auth.key.tier);
  const rlHeaders = rateLimitHeaders(rl);
  if (!rl.allowed) {
    return NextResponse.json({ error: "rate_limited", retry_after_s: rl.retry_after_s }, { status: 429, headers: rlHeaders });
  }

  const { ref_id } = await ctx.params;

  try {
    const host = req.headers.get("host") ?? "localhost:3008";
    const proto = req.headers.get("x-forwarded-proto") ?? "http";
    const inner = await fetch(`${proto}://${host}/api/nex/evidence/${encodeURIComponent(ref_id)}`);
    const j = await inner.json().catch(() => ({}));
    return NextResponse.json(j, { status: inner.status, headers: rlHeaders });
  } catch (e) {
    return NextResponse.json(
      { error: "upstream_error", detail: e instanceof Error ? e.message.slice(0, 200) : "unknown" },
      { status: 502, headers: rlHeaders },
    );
  }
}
