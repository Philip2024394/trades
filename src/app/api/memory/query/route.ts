// POST /api/memory/query
//
// Structured Archive query. Used by:
//   - Growth Engine composer ("give me 6 best resin driveway photos")
//   - Merchant search UI ("all sandstone patios in LS6")
//   - Gold Path context ("what's the customer for the Smith job")
//
// Body:
//   {
//     merchantId, recordType?, facetMatch?, postcodeStartsWith?,
//     updatedSince?, limit?
//   }
//
// Body is POST to keep facetMatch JSON out of URL length limits.

import { NextResponse } from "next/server";
import { queryMemory } from "@/lib/memory/loader";
import { MEMORY_RECORD_TYPES } from "@/lib/memory/types";
import type { MemoryRecordType } from "@/lib/memory/types";

export const runtime = "nodejs";

type Body = {
  merchantId?: string;
  recordType?: string;
  facetMatch?: Record<string, unknown>;
  postcodeStartsWith?: string;
  updatedSince?: string;
  limit?: number;
};

export async function POST(request: Request) {
  const body = (await request.json().catch(() => null)) as Body | null;
  if (!body?.merchantId) {
    return NextResponse.json(
      { error: "merchantId required" },
      { status: 400 }
    );
  }
  if (
    body.recordType &&
    !(MEMORY_RECORD_TYPES as readonly string[]).includes(body.recordType)
  ) {
    return NextResponse.json(
      { error: `unknown record_type: ${body.recordType}` },
      { status: 400 }
    );
  }
  const results = await queryMemory({
    merchantId: body.merchantId,
    recordType: body.recordType as MemoryRecordType | undefined,
    facetMatch: body.facetMatch,
    postcodeStartsWith: body.postcodeStartsWith,
    updatedSince: body.updatedSince,
    limit: body.limit
  });
  return NextResponse.json({ results });
}
