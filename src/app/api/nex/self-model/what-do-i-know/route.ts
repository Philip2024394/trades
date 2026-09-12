// GET /api/nex/self-model/what-do-i-know · read-only · substrate pointers only.
import { NextResponse } from "next/server";
import { whatDoIKnow } from "@/lib/nex-self-model/introspective-reporter";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

export async function GET(): Promise<NextResponse> {
  return NextResponse.json(whatDoIKnow(), { headers: { "Cache-Control": "no-store" } });
}
