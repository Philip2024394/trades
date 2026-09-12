// src/app/api/nex/agent/code-engine/status/route.ts
//
// Read-only status endpoint for NEX1's Code Authoring Engine.

import { NextResponse } from "next/server";
import { Nex1ReasoningRegistry } from "@/lib/nex-agent/code-engine";
import { TEMPLATE_ONLY_ID } from "@/lib/nex-agent/code-engine";
import { existsSync, readFileSync } from "node:fs";
import { auditPath } from "@/lib/nex-agent/code-engine";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

/**
 * @summary Report NEX1 Code Engine status · adapters registered · audit ledger stats · identity-floor availability.
 */
export async function GET() {
  const registry = new Nex1ReasoningRegistry();
  const registered = registry.listRegistered();
  const available = await registry.available();

  let auditLines = 0;
  const p = auditPath();
  if (existsSync(p)) {
    try {
      auditLines = readFileSync(p, "utf8").split("\n").filter(Boolean).length;
    } catch { /* ignore */ }
  }

  return NextResponse.json({
    ok: true,
    engine: {
      sprint: 1,
      identity_floor: TEMPLATE_ONLY_ID,
      identity_floor_available: available.includes(TEMPLATE_ONLY_ID),
      adapters_registered: registered,
      adapters_available: available,
      non_template_adapters_bound: registered.filter((id) => id !== TEMPLATE_ONLY_ID).length,
      audit_entries: auditLines,
      audit_path_relative: "data/nex1-code-engine/audit.jsonl",
      constitutional_status: "NEX1 owns the programming loop · adapter scope limited to code_proposal_only",
    },
  }, { headers: { "cache-control": "no-store" } });
}
