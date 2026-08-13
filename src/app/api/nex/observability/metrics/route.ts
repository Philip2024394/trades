// src/app/api/nex/observability/metrics/route.ts
//
// F2 · Prometheus-format metrics endpoint.
//
// Reads from the in-process counter store and emits the standard
// Prometheus text-format (# HELP / # TYPE / counter). Suitable for
// scraping by Prometheus, Datadog Agent, Grafana Alloy, or any other
// tool that speaks Prometheus.
//
// Auth: shared cron-secret boundary (same as every other brain route),
// so this endpoint cannot be scraped without the token.
//
// Notes on process scope: counters live in a per-process Map. In a
// multi-instance deploy (Vercel functions scale horizontally), each
// scrape hits ONE instance's view. Prometheus deduplicates by label —
// so downstream aggregation is the operator's concern.

import { NextResponse } from "next/server";
import { checkCronAuth } from "@/lib/nex/brain/auth/require-cron-token";
import { snapshot } from "@/lib/nex/observability/counters";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";
export const maxDuration = 10;

const HELP: Record<string, string> = {
  "shadow.mirror_failed":            "Reverse-shadow mirror writes that failed (pg→supa)",
  "shadow.mirror_success":           "Reverse-shadow mirror writes that succeeded (pg→supa)",
  "manager.inbox_writeback_failed":  "Manager inbox writeback failures",
  "manager.inbox_read_degraded":     "Manager inbox reads that fell back to degraded response",
  "router.route_failed":             "Router dispatch failures",
  "inbox.enqueue_failed":            "Knowledge-inbox enqueue failures",
  "jobs.create_failed":              "Worker-job creation failures",
  "audit.emit_failed":               "Audit-log emit failures (immediate)",
  "audit.emit_retried":              "Audit-log emit retries",
  "audit.emit_dropped":              "Audit-log emit rows dropped after retries",
  "inbox.pg_read_fallback":          "Inbox reads that fell back from Postgres to filesystem",
  "jobs.pg_read_fallback":           "Jobs reads that fell back from Postgres to filesystem",
  "validate.row_dropped":            "Rows dropped at a validation boundary",
  "validate.line_dropped":           "Lines dropped at a validation boundary",
  "cron_tick.fired":                 "F12 · cron-tick invocations. Watch _last_at_seconds for staleness.",
  "cron_tick.failed":                "F12 · cron-tick invocations that threw",
  "analytics.rollup_failed":         "D6 · analytics rollup worker · rows that failed to apply",
  "analytics.rollup_batch_drained":  "D6 · analytics rollup worker · batches drained",
};

// Convert a counter name like `shadow.mirror_failed` to a
// Prometheus-legal metric name: only [a-zA-Z0-9_].
function toPromName(name: string): string {
  return `nex_${name.replace(/[^a-zA-Z0-9_]/g, "_")}`;
}

function toPromFormat(snap: Record<string, { count: number; last_at: string | null }>): string {
  const lines: string[] = [];
  for (const [name, s] of Object.entries(snap)) {
    const metric = toPromName(name);
    const help = HELP[name] ?? "NEX counter";
    lines.push(`# HELP ${metric} ${help}`);
    lines.push(`# TYPE ${metric} counter`);
    lines.push(`${metric} ${s.count}`);
    if (s.last_at) {
      const lastMetric = `${metric}_last_at_seconds`;
      const ts = Math.floor(new Date(s.last_at).getTime() / 1000);
      lines.push(`# HELP ${lastMetric} Unix seconds of last increment for ${metric}`);
      lines.push(`# TYPE ${lastMetric} gauge`);
      lines.push(`${lastMetric} ${ts}`);
    }
  }
  return lines.join("\n") + "\n";
}

export async function GET(req: Request): Promise<NextResponse> {
  const auth = checkCronAuth({ headers: { get: (n) => req.headers.get(n) } });
  if (!auth.ok) {
    return NextResponse.json({ ok: false, code: auth.code, message: auth.message }, { status: auth.status });
  }
  const snap = snapshot();
  const body = toPromFormat(snap as Record<string, { count: number; last_at: string | null }>);
  return new NextResponse(body, {
    status: 200,
    headers: { "content-type": "text/plain; version=0.0.4; charset=utf-8" },
  });
}
