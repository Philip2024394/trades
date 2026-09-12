// GET /api/nex/self-model/what-can-i-do · read-only · cannot-yet FIRST · then can.
import { NextResponse } from "next/server";
import { whatCanIDo } from "@/lib/nex-self-model/introspective-reporter";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

export async function GET(): Promise<NextResponse> {
  return NextResponse.json(whatCanIDo(), { headers: { "Cache-Control": "no-store" } });
}
