// POST /api/merchant-page/publish
//
// Copies draft_sections → published_sections + sets published_at.
// Called by the sticky footer's Publish button.

import { NextResponse } from "next/server";
import { publishPage } from "@/lib/live-edit/merchantPageLoader";

export const runtime = "nodejs";

export async function POST(request: Request) {
  const merchantId = request.headers.get("x-merchant-id") ?? "";
  if (!merchantId) {
    return NextResponse.json(
      { ok: true, demo: true, message: "No merchant session — nothing published." },
      { status: 200 }
    );
  }
  let body: { pageSlug?: string };
  try {
    body = await request.json();
  } catch {
    return NextResponse.json({ error: "Invalid JSON" }, { status: 400 });
  }
  if (!body.pageSlug) {
    return NextResponse.json({ error: "pageSlug required" }, { status: 400 });
  }
  const ok = await publishPage(merchantId, body.pageSlug);
  return NextResponse.json({ ok });
}
