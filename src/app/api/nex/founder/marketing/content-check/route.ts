// POST /api/nex/founder/marketing/content-check
//
// Founder-only DRY-RUN content quality analysis. Pure structural checks ·
// never modifies content · never blocks a send · advisory only.

import { NextResponse } from "next/server";
import { resolveFounderAuth } from "@/lib/nex/marketing/founder";
import { analyzeEmailContent } from "@/lib/nex/marketing/deliverability";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

export async function POST(req: Request) {
  const auth = resolveFounderAuth(req);
  if (!auth.authenticated) return NextResponse.json({ ok: false, error: "not_founder" }, { status: 401 });
  let body: any;
  try { body = await req.json(); } catch { return NextResponse.json({ ok: false, error: "invalid_json" }, { status: 400 }); }
  const subject = String(body?.subject ?? "");
  const html_body = String(body?.html_body ?? "");
  const plain_body = typeof body?.plain_body === "string" ? body.plain_body : undefined;
  const sender_domain = typeof body?.sender_domain === "string" ? body.sender_domain : undefined;

  const analysis = analyzeEmailContent({ subject, html_body, plain_body, sender_domain });
  return NextResponse.json({
    ok: true,
    note: "DRY-RUN content analysis · advisory only · never blocks · never modifies",
    analysis,
  });
}
