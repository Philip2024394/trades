// GET /api/nex/contacts/duplicates — pending duplicate suggestions
//
// Query params:
//   limit           default 50 · max 500
//   min_confidence  0..100
//   match_kind      "email_exact" | "phone_exact" | "name_company_fuzzy"

import { NextResponse } from "next/server";
import { listPendingDuplicates, getMergeStats } from "@/lib/nex/contacts/merge";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

export async function GET(request: Request) {
  const q = new URL(request.url).searchParams;
  const [entries, stats] = await Promise.all([
    listPendingDuplicates({
      limit: Number(q.get("limit") ?? 50) || 50,
      min_confidence: q.get("min_confidence") != null ? Number(q.get("min_confidence")) : undefined,
      match_kind: q.get("match_kind") ?? undefined,
    }),
    getMergeStats(),
  ]);
  return NextResponse.json({ ok: true, entries, stats });
}
