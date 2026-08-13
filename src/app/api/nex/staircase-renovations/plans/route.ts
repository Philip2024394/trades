// GET /api/nex/staircase-renovations/plans
//
// Serves the customer-facing staircase-PLAN catalogue used by the
// Quote flow's "Choose a staircase plan" path. Read-only · one JSON
// file · Philip edits data/staircase-renovations/plans-manifest.json
// to add / update / reorder plans without a code change.
//
// Separate from the renovation gallery categories manifest ·
// renovations = finishes / styles · plans = geometry / layout.

import { NextResponse } from "next/server";
import { readFile } from "node:fs/promises";
import { join } from "node:path";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

type PlanRow = { slug: string; label: string; description?: string; src?: string; sort?: number };
type Manifest = { version?: number; updated_at?: string; plans?: PlanRow[]; notes?: string[] };

const MANIFEST_PATH = join(process.cwd(), "data", "staircase-renovations", "plans-manifest.json");

export async function GET() {
  try {
    const raw = await readFile(MANIFEST_PATH, "utf8");
    const parsed = JSON.parse(raw) as Manifest;
    const plans = Array.isArray(parsed.plans)
      ? [...parsed.plans].sort((a, b) => (a.sort ?? 0) - (b.sort ?? 0)).map((p) => ({
          slug:        String(p.slug),
          label:       String(p.label),
          description: p.description ?? null,
          src:         p.src ?? null,
        }))
      : [];
    return NextResponse.json({
      ok: true,
      version: parsed.version ?? 1,
      updated_at: parsed.updated_at ?? null,
      plans,
      total_plans: plans.length,
    });
  } catch (err) {
    return NextResponse.json({
      ok: false,
      error: err instanceof Error ? err.message : String(err),
      plans: [],
      total_plans: 0,
    }, { status: 500 });
  }
}
