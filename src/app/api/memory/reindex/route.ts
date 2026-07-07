// POST /api/memory/reindex
//
// Batched embedding backfill. Runs once after enabling embeddings on
// an existing merchant's data.

import { NextResponse } from "next/server";
import { reindexMerchant } from "@/lib/memory/reindex";

export const runtime = "nodejs";

type Body = { merchantId?: string; limit?: number };

export async function POST(request: Request) {
  const body = (await request.json().catch(() => null)) as Body | null;
  const result = await reindexMerchant(body?.merchantId, body?.limit ?? 200);
  return NextResponse.json(result);
}
