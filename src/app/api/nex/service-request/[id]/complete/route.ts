// POST /api/nex/service-request/[id]/complete · Philip 2026-08-29
//
// Thin HTTP adapter around the extracted completeRequest() function
// (src/lib/nex-mobility/complete-request.ts). All transactional logic +
// fee/allowance/wallet semantics live there so integration tests can
// exercise it directly.

import { NextRequest, NextResponse } from "next/server";
import { completeRequest } from "@/lib/nex-mobility/complete-request";
import { getMobilityPool } from "@/lib/nex-mobility/pool";

export async function POST(
  _req: NextRequest,
  { params }: { params: Promise<{ id: string }> },
) {
  const { id: request_id } = await params;
  const result = await completeRequest({
    pool: getMobilityPool(),
    requestId: request_id,
  });
  if (result.ok) return NextResponse.json(result);
  const { status, ...body } = result;
  return NextResponse.json(body, { status });
}
