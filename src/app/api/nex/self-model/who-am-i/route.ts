// GET /api/nex/self-model/who-am-i · read-only · identity + constitutional pins.
import { NextResponse } from "next/server";
import { whoAmI } from "@/lib/nex-self-model/introspective-reporter";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

export async function GET(): Promise<NextResponse> {
  return NextResponse.json(whoAmI(), { headers: { "Cache-Control": "no-store" } });
}
