// User Identity API endpoint · POST { input: string } → IdentityClassification
//
// Doctrine: docs/brains/nex-user-identity-brain-philip-2026-08-03.md

import { NextResponse } from "next/server";
import { classifyIdentity } from "@/lib/nex/identity";

export async function POST(req: Request): Promise<Response> {
  let body: { input?: unknown } = {};
  try { body = (await req.json()) as { input?: unknown }; }
  catch { return NextResponse.json({ error: "invalid JSON body" }, { status: 400 }); }

  const input = typeof body.input === "string" ? body.input : "";
  if (!input.trim()) {
    return NextResponse.json({ error: "input required" }, { status: 400 });
  }

  const c = classifyIdentity(input);
  return NextResponse.json({
    register: c.register,
    confidence: Math.round(c.confidence * 100) / 100,
    matched_signals: c.matched_signals,
    reason: c.reason,
    needs_clarification: c.needs_clarification,
  });
}
