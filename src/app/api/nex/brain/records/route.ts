// GET /api/nex/brain/records — list knowledge records
//
// Query params:
//   status         = DRAFT | UNDER_REVIEW | AUTHORITATIVE | DEPRECATED | SUPERSEDED
//   limit          = default 50, max 200 (fetched from DB before mock filter)
//   include_mock   = "true" to include mock-adapter records (default false)
//
// Returns records sorted newest first.
//
// Mock filter (per feedback_nex_never_pretends_work_done_2026_08_07.md):
// Records produced by the mock adapter are identified by id prefix
// `mock_`. They are HIDDEN by default so they never poison the dashboard
// review queue or Recent Records panel. Set `include_mock=true` to see
// them (useful for cleanup / bulk-reject workflows). This is a display
// filter; the records remain in the DB and are auditable.

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

function isMockRecord(r: KnowledgeRecord): boolean {
  // Mock-adapter records identify themselves via the `record_id` field
  // (e.g. "mock_door_oak_msh9mlug") — the primary key `id` is a UUID
  // and not diagnostic. The summary also contains "Mock adapter extracted"
  // — checked as a secondary signal.
  if (typeof r.record_id === "string" && r.record_id.startsWith("mock_")) return true;
  if (typeof r.summary === "string" && r.summary.includes("Mock adapter extracted")) return true;
  return false;
}

export async function GET(req: NextRequest) {
  const { searchParams } = new URL(req.url);
  const statusParam = searchParams.get("status");
  const limitParam = Number(searchParams.get("limit") ?? "50");
  const includeMock = searchParams.get("include_mock") === "true";
  const requestedLimit = Math.min(Math.max(1, limitParam || 50), 200);
  const status =
    statusParam && (VALID_STATUSES as string[]).includes(statusParam)
      ? (statusParam as KnowledgeRecord["status"])
      : undefined;

  try {
    // Fetch extra when the mock filter is active so post-filter we still
    // return roughly the requested count. Capped at 500 to avoid pulling
    // the whole table if the DB is dominated by mock records.
    const fetchLimit = includeMock ? requestedLimit : Math.min(500, requestedLimit * 5);
    const all = await brainStore().listRecords({ status, limit: fetchLimit });
    const filtered = includeMock ? all : all.filter((r) => !isMockRecord(r));
    const records = filtered.slice(0, requestedLimit);
    const mockCount = all.length - filtered.length;
    return NextResponse.json({
      ok: true,
      records,
      count: records.length,
      // Transparency: tell the UI how many mock records were hidden so
      // Philip can spot when the pipeline is still poisoned. The number
      // being non-zero means the Fly worker still needs
      //   fly secrets set LLM_ALLOW_MOCK_FALLBACK=false --app nex-brain-worker
      mock_hidden_in_this_page: includeMock ? 0 : mockCount,
    });
  } catch (err) {
    console.error("[api.brain.records] failed:", err);
    return NextResponse.json({ ok: false, error: "list_failed" }, { status: 500 });
  }
}
