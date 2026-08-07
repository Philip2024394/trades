// GET /api/nex/journeys/inbound-events?limit=&trigger_key=&verified= · debug feed
import { NextResponse } from "next/server";
import { withClient } from "@/lib/nex/delivery/db";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

export async function GET(request: Request) {
  const url = new URL(request.url);
  const limit = Math.max(1, Math.min(500, Number(url.searchParams.get("limit") ?? 100)));
  const trigger_key = url.searchParams.get("trigger_key");
  const verifiedParam = url.searchParams.get("verified");

  const rows = await withClient(async (c) => {
    const wheres: string[] = [];
    const params: unknown[] = [];
    if (trigger_key) { params.push(trigger_key); wheres.push(`trigger_key = $${params.length}`); }
    if (verifiedParam === "true")  wheres.push(`verified_signature = TRUE`);
    if (verifiedParam === "false") wheres.push(`verified_signature = FALSE`);
    const where = wheres.length > 0 ? `WHERE ${wheres.join(" AND ")}` : "";
    const res = await c.query(`SELECT * FROM nex.journey_inbound_events ${where} ORDER BY received_at DESC LIMIT ${limit}`, params);
    return res.rows;
  });
  return NextResponse.json({ ok: true, events: rows ?? [] });
}
