// POST /api/reply/[token] — public endpoint used by the trade's reply
// page at /r/[token]. NO AUTH — the token is the credential. The
// waMessages lib handles rate-limiting + revoked-thread checks.
//
// Body: { body: string }
// Response: { ok: true } or { ok: false, error: string }

import { NextResponse } from "next/server";
import { addInboundReply } from "@/lib/homeowners/waMessages";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

export async function POST(
  req: Request,
  { params }: { params: Promise<{ token: string }> }
) {
  const { token } = await params;
  if (!token || token.length < 8) {
    return NextResponse.json({ ok: false, error: "not-found" }, { status: 404 });
  }

  const payload = await req.json().catch(() => null) as { body?: string } | null;
  if (!payload?.body?.trim()) {
    return NextResponse.json({ ok: false, error: "empty-body" }, { status: 400 });
  }

  const res = await addInboundReply({ token, body: payload.body });
  if (!res.ok) {
    const status =
      res.error === "not-found"    ? 404 :
      res.error === "revoked"      ? 410 :
      res.error === "rate-limited" ? 429 :
      400;
    return NextResponse.json({ ok: false, error: res.error }, { status });
  }
  return NextResponse.json({ ok: true, messageId: res.message.id });
}
