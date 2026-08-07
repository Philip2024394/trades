// POST /api/nex/attribution/conversions · record a conversion (webhook target)
// GET  /api/nex/attribution/conversions · list recent
import { NextResponse } from "next/server";
import { listConversions, recordConversion } from "@/lib/nex/attribution/engine";
import type { ConversionInput } from "@/lib/nex/attribution/types";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

export async function GET() {
  return NextResponse.json({ ok: true, conversions: await listConversions(200) });
}

export async function POST(request: Request) {
  let body: ConversionInput;
  try { body = await request.json() as ConversionInput; }
  catch { return NextResponse.json({ ok: false, error: "invalid_json" }, { status: 400 }); }
  if (!body.contact_id || !body.event_type) {
    return NextResponse.json({ ok: false, error: "contact_id + event_type required" }, { status: 400 });
  }
  const r = await recordConversion(body);
  if (!r) return NextResponse.json({ ok: false, error: "record_failed" }, { status: 500 });
  return NextResponse.json({ ok: true, conversion: r });
}
