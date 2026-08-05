// GET /api/nex/brain/records — list knowledge records
//
// Query params:
//   status = DRAFT | UNDER_REVIEW | AUTHORITATIVE | DEPRECATED | SUPERSEDED
//   limit  = default 50, max 200
//
// Returns records sorted newest first.

import type { NextRequest } from "next/server";
import { NextResponse } from "next/server";
import { brainStore } from "@/lib/nex/brain/storage";
import type { KnowledgeRecord } from "@/lib/nex/brain/types";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

const VALID_STATUSES: KnowledgeRecord["status"][] = [
  "DRAFT",
  "UNDER_REVIEW",
  "AUTHORITATIVE",
  "DEPRECATED",
  "SUPERSEDED",
];

export async function GET(req: NextRequest) {
  const { searchParams } = new URL(req.url);
  const statusParam = searchParams.get("status");
  const limitParam = Number(searchParams.get("limit") ?? "50");
  const limit = Math.min(Math.max(1, limitParam || 50), 200);
  const status =
    statusParam && (VALID_STATUSES as string[]).includes(statusParam)
      ? (statusParam as KnowledgeRecord["status"])
      : undefined;

  try {
    const records = await brainStore().listRecords({ status, limit });
    return NextResponse.json({ ok: true, records, count: records.length });
  } catch (err) {
    console.error("[api.brain.records] failed:", err);
    return NextResponse.json({ ok: false, error: "list_failed" }, { status: 500 });
  }
}
