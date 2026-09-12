// src/app/api/nex/isp-status/route.ts
//
// Founder ISP-1 · ISP outage awareness endpoint.
// GET /api/nex/isp-status?country=ID returns cached per-provider status.
// Read-only. Cached per 5 minutes. Never crashes on upstream failure.

import { NextResponse } from "next/server";
import { getIspStatus } from "@/lib/nex/live-chat-completion/isp-status/provider";

export const runtime = "nodejs";

export async function GET(req: Request) {
  const url = new URL(req.url);
  const country = (url.searchParams.get("country") ?? "ID").toUpperCase();
  try {
    const entries = await getIspStatus(country);
    return NextResponse.json({
      country,
      generated_at: new Date().toISOString(),
      entries,
      note: "Data-only source (Downdetector RSS · CC BY where applicable). "
        + "NEX does not proxy any ISP service · this endpoint is purely informational so users can be told 'your provider is degraded'.",
    });
  } catch (e) {
    return NextResponse.json({
      error: "isp_status_error",
      detail: e instanceof Error ? e.message.slice(0, 200) : "unknown",
    }, { status: 500 });
  }
}
