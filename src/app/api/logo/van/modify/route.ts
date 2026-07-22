// POST /api/logo/van/modify
//
// Apply a user text prompt to an existing van layout. Body:
//   { layout: VanLayout, prompt: string }
// → { ok:true, layout: VanLayout }
//
// Rate-limited by IP hash. Public.

import { NextResponse, type NextRequest } from "next/server";
import { createHash } from "node:crypto";
import { modifyVanLayout } from "@/lib/logo/vanLayoutAI";
import type { VanLayout } from "@/lib/logo/vanLayout";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

const RATE_LIMIT_PER_MINUTE = 8;
const bucket: Map<string, { count: number; resetAt: number }> = new Map();

function checkRate(req: NextRequest): boolean {
  const ip = req.headers.get("x-forwarded-for")?.split(",")[0].trim()
    ?? req.headers.get("x-real-ip") ?? "0.0.0.0";
  const key = createHash("sha256").update(ip).digest("hex").slice(0, 24);
  const now = Date.now();
  const entry = bucket.get(key);
  if (!entry || entry.resetAt < now) {
    bucket.set(key, { count: 1, resetAt: now + 60_000 });
    return true;
  }
  if (entry.count >= RATE_LIMIT_PER_MINUTE) return false;
  entry.count++;
  return true;
}

export async function POST(req: NextRequest): Promise<NextResponse> {
  if (!checkRate(req)) {
    return NextResponse.json({ ok: false, error: "rate_limited" }, { status: 429 });
  }
  const body = await req.json().catch(() => null) as {
    layout?: VanLayout;
    prompt?: string;
  } | null;

  const layout = body?.layout;
  const prompt = String(body?.prompt ?? "").trim().slice(0, 400);

  if (!layout || !Array.isArray(layout.elements)) {
    return NextResponse.json({ ok: false, error: "layout_required" }, { status: 400 });
  }
  if (!prompt) {
    return NextResponse.json({ ok: false, error: "prompt_required" }, { status: 400 });
  }
  if (!process.env.ANTHROPIC_API_KEY) {
    return NextResponse.json({ ok: false, error: "ai_unavailable" }, { status: 503 });
  }

  const modified = await modifyVanLayout({ layout, prompt });
  return NextResponse.json({ ok: true, layout: modified });
}
