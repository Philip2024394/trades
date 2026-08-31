// POST /api/nex/service-request/[id]/accept · Philip 2026-08-29
//
// Thin HTTP adapter around the extracted acceptOffer() function
// (src/lib/nex-mobility/accept-offer.ts). All transactional logic and race
// resolution live there so integration tests can exercise it directly.

import { NextRequest, NextResponse } from "next/server";
import { acceptOffer } from "@/lib/nex-mobility/accept-offer";
import { getMobilityPool } from "@/lib/nex-mobility/pool";

export async function POST(
  req: NextRequest,
  { params }: { params: Promise<{ id: string }> },
) {
  const { id: request_id } = await params;
  let payload: Record<string, unknown>;
  try { payload = (await req.json()) as Record<string, unknown>; }
  catch { return NextResponse.json({ ok: false, error: "invalid json" }, { status: 400 }); }

  const provider_id = String(payload.provider_id ?? "").trim();
  const action = String(payload.action ?? "accept").trim();
  if (!provider_id) return NextResponse.json({ ok: false, error: "provider_id required" }, { status: 400 });
  if (!["accept", "decline"].includes(action))
    return NextResponse.json({ ok: false, error: "action must be accept or decline" }, { status: 400 });

  const result = await acceptOffer({
    pool: getMobilityPool(),
    requestId: request_id,
    providerId: provider_id,
    action: action as "accept" | "decline",
  });

  if (result.ok) return NextResponse.json(result);
  const { status, ...body } = result;
  return NextResponse.json(body, { status });
}
