// GET /api/nex/attribution — Marketing Attribution service
//
// Query params:
//   mode=campaigns (default) — per-campaign roll-up (sessions, conversions, contacts acquired)
//   mode=contact&contact_id=X — full attribution chain for one contact
//   mode=funnel — overall visitor→session→conversion funnel counts
//   since_hours — window (default per-mode)
//
// Turns Marketing Attribution from 🔴 Not Installed → 🟢 Running.
//
// This service is READ-ONLY. Every response is computed on demand from
// the tracking + contact stores.

import type { NextRequest } from "next/server";
import { NextResponse } from "next/server";
import { campaignReport, contactAttribution, funnelReport } from "@/lib/nex/attribution/analyzer";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

export async function GET(req: NextRequest) {
  const { searchParams } = new URL(req.url);
  const mode = (searchParams.get("mode") ?? "campaigns") as "campaigns" | "contact" | "funnel";
  const hoursRaw = Number(searchParams.get("since_hours"));

  try {
    if (mode === "contact") {
      const contact_id = searchParams.get("contact_id");
      if (!contact_id) {
        return NextResponse.json({ ok: false, error: "contact_id_required" }, { status: 400 });
      }
      const sinceMs = Number.isFinite(hoursRaw) && hoursRaw > 0
        ? hoursRaw * 60 * 60 * 1000
        : 90 * 24 * 60 * 60 * 1000;   // 90d default
      const attribution = await contactAttribution(contact_id, sinceMs);
      return NextResponse.json({ ok: true, mode, backend: "computed", attribution });
    }

    if (mode === "funnel") {
      const sinceMs = Number.isFinite(hoursRaw) && hoursRaw > 0
        ? hoursRaw * 60 * 60 * 1000
        : 24 * 60 * 60 * 1000;        // 24h default
      const funnel = await funnelReport(sinceMs);
      return NextResponse.json({ ok: true, mode, backend: "computed", funnel });
    }

    // campaigns (default)
    const sinceMs = Number.isFinite(hoursRaw) && hoursRaw > 0
      ? hoursRaw * 60 * 60 * 1000
      : 30 * 24 * 60 * 60 * 1000;    // 30d default
    const campaigns = await campaignReport(sinceMs);
    const totals = campaigns.reduce(
      (acc, c) => ({
        campaigns: acc.campaigns + 1,
        sessions: acc.sessions + c.sessions,
        conversions: acc.conversions + c.conversions,
        contacts_acquired: acc.contacts_acquired + c.contacts_acquired,
      }),
      { campaigns: 0, sessions: 0, conversions: 0, contacts_acquired: 0 },
    );
    return NextResponse.json({ ok: true, mode, backend: "computed", campaigns, totals });
  } catch (err) {
    console.error("[attribution.GET] failed:", err);
    return NextResponse.json(
      { ok: false, error: "compute_failed", detail: err instanceof Error ? err.message : "unknown" },
      { status: 500 },
    );
  }
}
