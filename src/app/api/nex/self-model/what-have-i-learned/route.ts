// GET /api/nex/self-model/what-have-i-learned · honest "diff not built yet" · SM-6 refuse-over-guess.
import { NextResponse } from "next/server";
import { whatHaveILearned } from "@/lib/nex-self-model/introspective-reporter";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

export async function GET(): Promise<NextResponse> {
  return NextResponse.json(whatHaveILearned(), { headers: { "Cache-Control": "no-store" } });
}
