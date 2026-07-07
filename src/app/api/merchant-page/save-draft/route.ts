// POST /api/merchant-page/save-draft
//
// Auto-save endpoint called by LiveEditShell on every debounced state
// change. Body: { pageSlug, sections, placements }. Merchant identity
// from x-merchant-id header (production would use Supabase auth
// session).

import { NextResponse } from "next/server";
import { saveDraftSections } from "@/lib/live-edit/merchantPageLoader";
import type { PlacementsMap } from "@/lib/live-edit/merchantPageLoader";

export const runtime = "nodejs";

export async function POST(request: Request) {
  const merchantId = request.headers.get("x-merchant-id") ?? "";
  if (!merchantId) {
    return NextResponse.json(
      { ok: true, demo: true, message: "No merchant session — nothing persisted." },
      { status: 200 }
    );
  }
  let body: {
    pageSlug?: string;
    sections?: Record<string, unknown>;
    placements?: PlacementsMap;
  };
  try {
    body = await request.json();
  } catch {
    return NextResponse.json({ error: "Invalid JSON" }, { status: 400 });
  }
  if (!body.pageSlug || !body.sections) {
    return NextResponse.json(
      { error: "pageSlug + sections required" },
      { status: 400 }
    );
  }
  const ok = await saveDraftSections(
    merchantId,
    body.pageSlug,
    body.sections,
    body.placements ?? {}
  );
  return NextResponse.json({ ok });
}
