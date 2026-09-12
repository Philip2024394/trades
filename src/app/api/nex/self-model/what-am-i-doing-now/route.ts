// GET /api/nex/self-model/what-am-i-doing-now · read-only · founder-authored open items.
import { NextResponse } from "next/server";
import { whatAmIDoingNow } from "@/lib/nex-self-model/introspective-reporter";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

export async function GET(): Promise<NextResponse> {
  return NextResponse.json(whatAmIDoingNow(), { headers: { "Cache-Control": "no-store" } });
}
