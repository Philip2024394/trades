// src/app/api/nex/public/v1/chat/route.ts
//
// Founder Phase 14 · P14-4 · Public API chat endpoint (non-streaming).
//
// Auth: Bearer nex_live_... (Authorization header)
// Body: { message: string, conversation_id?: string, market?: string }
// Response: { reply: string, evidence_refs: string[], trust_score?: number }
//
// This is a thin adapter over the internal chat pipeline. Response envelope
// deliberately narrow so we can evolve internals without breaking the API.

import { NextResponse } from "next/server";
import { requireApiKey } from "@/lib/nex/api-platform/bearer-auth";
import { checkRateLimit, rateLimitHeaders } from "@/lib/nex/api-platform/rate-limit";

export const runtime = "nodejs";

export async function POST(req: Request) {
  const auth = await requireApiKey(req, "chat:write");
  if (!auth.ok) return NextResponse.json({ error: auth.error }, { status: auth.status });

  const rl = checkRateLimit(auth.key.api_key_id, auth.key.tier);
  const rlHeaders = rateLimitHeaders(rl);
  if (!rl.allowed) {
    return NextResponse.json(
      { error: "rate_limited", retry_after_s: rl.retry_after_s },
      { status: 429, headers: rlHeaders },
    );
  }

  let body: Record<string, unknown> = {};
  try { body = (await req.json()) as Record<string, unknown>; } catch { /* empty body */ }
  const message = typeof body.message === "string" ? body.message : "";
  if (message.length === 0 || message.length > 10_000) {
    return NextResponse.json({ error: "invalid_message" }, { status: 400, headers: rlHeaders });
  }

  // Delegate to internal chat pipeline. Kept simple + non-streaming for API stability.
  try {
    const host = req.headers.get("host") ?? "localhost:3008";
    const proto = req.headers.get("x-forwarded-proto") ?? "http";
    const internalRes = await fetch(`${proto}://${host}/api/nex-conv/chat`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        message,
        conversation_id: typeof body.conversation_id === "string" ? body.conversation_id : undefined,
        market: typeof body.market === "string" ? body.market : "ID",
        user_id: auth.key.user_id,
        useLiveWorld: true,
      }),
    });
    const j = await internalRes.json().catch(() => ({}));
    const reply = String(j?.reply ?? j?.reply_text ?? "");
    const evidence_refs = Array.isArray(j?.evidence_refs) ? j.evidence_refs : [];
    const trust_score = typeof j?.trust_score === "number" ? j.trust_score : null;
    return NextResponse.json(
      {
        reply,
        evidence_refs,
        trust_score,
        conversation_id: j?.conversation_id ?? null,
        model: j?.model ?? null,
        doctrine_note: "Every fact traces to evidence_refs. If a claim isn't in an evidence_ref it isn't verified by NEX.",
      },
      { headers: rlHeaders },
    );
  } catch (e) {
    return NextResponse.json(
      { error: "upstream_error", detail: e instanceof Error ? e.message.slice(0, 200) : "unknown" },
      { status: 502, headers: rlHeaders },
    );
  }
}
