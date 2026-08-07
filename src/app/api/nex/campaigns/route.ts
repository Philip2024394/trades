// GET/POST /api/nex/campaigns — list + create
import { NextResponse } from "next/server";
import { createCampaign, listCampaigns } from "@/lib/nex/campaigns/registry";
import type { CampaignInput } from "@/lib/nex/campaigns/types";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

export async function GET(request: Request) {
  const url = new URL(request.url);
  const includeArchived = url.searchParams.get("include_archived") === "true";
  const campaigns = await listCampaigns({ includeArchived });
  return NextResponse.json({ ok: true, campaigns });
}

export async function POST(request: Request) {
  let body: Partial<CampaignInput>;
  try { body = await request.json() as Partial<CampaignInput>; }
  catch { return NextResponse.json({ ok: false, error: "invalid_json" }, { status: 400 }); }
  if (!body.name) return NextResponse.json({ ok: false, error: "name required" }, { status: 400 });
  const campaign = await createCampaign(body as CampaignInput);
  if (!campaign) return NextResponse.json({ ok: false, error: "create_failed" }, { status: 500 });
  return NextResponse.json({ ok: true, campaign });
}
