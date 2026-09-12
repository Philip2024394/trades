// GET /api/nex/self-model/how-sure-am-i · composite uncertainty · reads live language scorecard.
import { NextResponse } from "next/server";
import { howSureAmI } from "@/lib/nex-self-model/introspective-reporter";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

export async function GET(req: Request): Promise<NextResponse> {
  const url = new URL(req.url);
  const baseUrl = `${url.protocol}//${url.host}`;
  let langStatus: any = null;
  try {
    const r = await fetch(`${baseUrl}/api/nex/lab/language-room/status`, { cache: "no-store" });
    if (r.ok) langStatus = await r.json();
  } catch { langStatus = null; }
  return NextResponse.json(howSureAmI(langStatus), { headers: { "Cache-Control": "no-store" } });
}
