// GET /api/cron/nex-continuous-discovery
//
// UWI · Wave 8.F · Thin cron wrapper for continuous ecosystem discovery
// Founder-authorised programme.
//
// CRON_SECRET-gated (matches existing NEX cron pattern e.g. nex-proactive).
// Ships with **zero adapters registered by default** via
// `buildProductionAdapterSpecs()` · production adapter wiring requires
// Wave 6 M26 HMAC-signed human-authority allowlist signature to add
// api.huggingface.co / api.github.com to the constitutional internet gate.
//
// The route is safe to schedule in vercel.json today · when the founder
// authorises live discovery, `discovery-factory.ts` is updated to return
// the authorised adapters and the loop begins to run.

import { NextResponse } from "next/server";
import { DiscoveryScheduler } from "@/lib/nex/continuous-loop/discovery-scheduler";
import { TriggerRouter } from "@/lib/nex/continuous-loop/trigger-router";
import { buildProductionAdapterSpecs } from "@/lib/nex/continuous-loop/discovery-factory";
import { OpportunityStore } from "@/lib/nex/research-memory/opportunity-store";
import { LifecycleHistoryLog } from "@/lib/nex/research-memory/lifecycle-history";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

const DEFAULT_MAX_RESOURCES_PER_ADAPTER = 10;
const DEFAULT_PER_ADAPTER_DEADLINE_MS = 60_000;

export async function GET(req: Request) {
  const secret = process.env.CRON_SECRET;
  const bearer = req.headers.get("authorization")?.replace(/^Bearer\s+/i, "").trim();
  if (secret && bearer !== secret) {
    return NextResponse.json({ ok: false, error: "not-authorised" }, { status: 401 });
  }

  const t0 = Date.now();
  const { specs, meta } = buildProductionAdapterSpecs();

  // Fresh per-invocation memory (production wiring will inject persistent
  // Wave 5 stores backed by Postgres via existing worker_jobs infrastructure).
  const trigger_router = new TriggerRouter();
  const opportunity_store = new OpportunityStore(new LifecycleHistoryLog());
  const scheduler = new DiscoveryScheduler({
    trigger_router,
    adapters: specs,
    workflow_id: "cron:nex-continuous-discovery",
    max_resources_per_adapter_per_cycle: DEFAULT_MAX_RESOURCES_PER_ADAPTER,
    per_adapter_deadline_ms: DEFAULT_PER_ADAPTER_DEADLINE_MS,
    opportunity_store,
  });

  const cycle_id = scheduler.newCycleId();
  const report = await scheduler.runCycle(cycle_id);

  return NextResponse.json({
    ok: true,
    cycle_id,
    duration_ms: Date.now() - t0,
    adapters_wired: specs.length,
    potential_adapters: meta.potential_adapter_count,
    notes: meta.notes,
    report: {
      totals: report.totals,
      adapters: report.adapters.map(a => ({
        ecosystem: a.adapter_ecosystem,
        resources_probed: a.resources_probed,
        findings_created: a.findings_created,
        opportunities_created: a.opportunities_created,
        errors: a.errors,
        deadline_expired: a.deadline_expired,
      })),
    },
  });
}
