// GET /api/nex/self-model/what-did-i-decide · read-only · evidence pointers only.
import { NextResponse } from "next/server";
import { whatDidIDecide } from "@/lib/nex-self-model/introspective-reporter";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

export async function GET(req: Request): Promise<NextResponse> {
  const url = new URL(req.url);
  const limitParam = url.searchParams.get("limit");
  const limit = Math.max(1, Math.min(50, Number(limitParam) || 12));
  return NextResponse.json(whatDidIDecide(limit), { headers: { "Cache-Control": "no-store" } });
}
