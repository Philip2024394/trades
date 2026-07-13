// GET /api/studio/templates?trade=<slug>&tone=<tone>&length=<length>
//
// Returns the template gallery, filtered by trade + tone + length.
// Powers the Step 2 picker in the App Builder.

import { NextResponse } from "next/server";
import { listTemplates, templatesForTrade } from "@/lib/studio/templates";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

export async function GET(req: Request): Promise<Response> {
  const url = new URL(req.url);
  const trade = (url.searchParams.get("trade") ?? "").trim();
  const tone = (url.searchParams.get("tone") ?? "").trim();
  const length = (url.searchParams.get("length") ?? "").trim();

  let templates = trade ? templatesForTrade(trade) : listTemplates();
  if (tone) templates = templates.filter((t) => t.tone === tone);
  if (length) templates = templates.filter((t) => t.length === length);

  return NextResponse.json({
    ok: true,
    count: templates.length,
    templates
  });
}
