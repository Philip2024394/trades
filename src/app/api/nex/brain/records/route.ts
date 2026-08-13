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
import { z } from "zod";
import { brainStore } from "@/lib/nex/brain/storage";
import type { KnowledgeRecord } from "@/lib/nex/brain/types";
import { validateSearchParams } from "@/lib/nex/brain/http/validate-input";
import { logger } from "@/lib/nex/observability/logger";
// W-OBS-1 Path A Layer 1 · Wave 3 H2.a · adopted 2026-08-10.
import { runFromRequest } from "@/lib/nex/observability/correlation";

const log = logger("api.brain.records");

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

// D9 · route-boundary schema. Zod owns coercion/enum-check/limits;
// prior code did the same by hand plus an untyped fall-through for
// unrecognised statuses.
const QuerySchema = z.object({
  status: z.enum(["DRAFT", "UNDER_REVIEW", "AUTHORITATIVE", "DEPRECATED", "SUPERSEDED"]).optional(),
  limit: z.coerce.number().int().min(1).max(200).default(50),
  include_mock: z.coerce.boolean().default(false),
});

function isMockRecord(r: KnowledgeRecord): boolean {
  if (typeof r.record_id === "string" && r.record_id.startsWith("mock_")) return true;
  if (typeof r.summary === "string" && r.summary.includes("Mock adapter extracted")) return true;
  return false;
}

export async function GET(req: NextRequest) {
  return runFromRequest(req, () => recordsHandler(req));
}

async function recordsHandler(req: NextRequest) {
  const parsed = validateSearchParams(req, QuerySchema);
  if (!parsed.ok) return parsed.response;
  const { status, limit: requestedLimit, include_mock: includeMock } = parsed.data;

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
    log.error("list_failed", { error: err instanceof Error ? err.message : String(err) });
    return NextResponse.json({ ok: false, error: "list_failed" }, { status: 500 });
  }
}
