// GET /api/nex/founder/marketing/acceptance-matrix
//
// Founder-only view of the NEX World Email Intelligence programme's
// progressive A-Z acceptance matrix. Pure aggregation · zero mutation ·
// zero DB access · zero network. Reports the 26 canonical categories with
// each's state and the pointer to its receipt.

import { NextResponse } from "next/server";
import { resolveFounderAuth } from "@/lib/nex/marketing/founder";
import { buildAcceptanceMatrix } from "@/lib/nex/marketing/deliverability";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

export async function GET(req: Request) {
  const auth = resolveFounderAuth(req);
  if (!auth.authenticated) return NextResponse.json({ ok: false, error: "not_founder" }, { status: 401 });
  const matrix = buildAcceptanceMatrix();
  return NextResponse.json({ ok: true, matrix });
}
