// GET /api/nex/brain/audit-events — query the Worker Audit Log.
//
// Query params:
//   limit          = 1..500 (default 50)
//   since_hours    = 1..168 (default 24) — trailing window
//   worker_type    = filter to one worker
//   event_type     = filter to one event kind
//   job_id         = trace one job end-to-end
//   provider       = filter to one provider
//
// Returns events sorted newest-first with normalised shape.
// Doctrine: feedback_nex_must_know_its_own_state_infrastructure_doctrine_2026_08_07.md

import type { NextRequest } from "next/server";
import { NextResponse } from "next/server";
import { z } from "zod";
import { createClient } from "@supabase/supabase-js";
// V-1b · D9 route-boundary validation adopted 2026-08-10.
import { validateSearchParams } from "@/lib/nex/brain/http/validate-input";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

const QuerySchema = z.object({
  limit: z.coerce.number().int().min(1).max(500).default(50),
  since_hours: z.coerce.number().int().min(1).max(168).default(24),
  worker_type: z.string().min(1).optional(),
  event_type: z.string().min(1).optional(),
  job_id: z.string().min(1).optional(),
  provider: z.string().min(1).optional(),
});

export async function GET(req: NextRequest) {
  const parsed = validateSearchParams(req, QuerySchema);
  if (!parsed.ok) return parsed.response;
  const { limit, since_hours: hours, worker_type: workerType, event_type: eventType, job_id: jobId, provider } = parsed.data;

  const url = process.env.NEX_SUPABASE_URL || process.env.NEXT_PUBLIC_NEX_SUPABASE_URL || process.env.SUPABASE_URL;
  const key = process.env.NEX_SUPABASE_SERVICE_ROLE_KEY || process.env.SUPABASE_SERVICE_ROLE_KEY;
  if (!url || !key) {
    return NextResponse.json({ ok: false, error: "audit-events: NEX_SUPABASE_URL / NEX_SUPABASE_SERVICE_ROLE_KEY not configured" }, { status: 500 });
  }
  const sb = createClient(url, key, { auth: { persistSession: false } });

  try {
    const since = new Date(Date.now() - hours * 60 * 60 * 1000).toISOString();
    let q = sb
      .from("worker_audit_events")
      .select("id,worker_type,worker_host_id,job_id,input_ref,event_type,actor,at,latency_ms,provider,model,confidence,outcome,error_snippet,details")
      .gte("at", since)
      .order("at", { ascending: false })
      .limit(limit);
    if (workerType) q = q.eq("worker_type", workerType);
    if (eventType)  q = q.eq("event_type", eventType);
    if (jobId)      q = q.eq("job_id", jobId);
    if (provider)   q = q.eq("provider", provider);

    const { data, error } = await q;
    if (error) {
      // Table may not exist yet if migration not applied — return honest empty
      const msg = error.message || "";
      const tableMissing =
        msg.includes("does not exist") ||
        msg.includes("relation") ||
        msg.includes("Could not find the table") ||
        msg.includes("schema cache");
      return NextResponse.json({
        ok: true,
        events: [],
        count: 0,
        table_ready: !tableMissing,
        note: tableMissing
          ? "worker_audit_events table not yet created. Apply db/migrations/004_worker_audit_events.sql to enable."
          : `Query error: ${msg}`,
      });
    }
    return NextResponse.json({
      ok: true,
      events: data ?? [],
      count: data?.length ?? 0,
      table_ready: true,
    });
  } catch (e) {
    return NextResponse.json({ ok: false, error: e instanceof Error ? e.message : "audit_events_failed" }, { status: 500 });
  }
}
