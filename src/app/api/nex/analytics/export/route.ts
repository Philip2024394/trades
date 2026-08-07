// GET /api/nex/analytics/export?scope=<scope>&format=csv|json
// MVP export: CSV or JSON. Excel/PDF (Phase 4e.6) plug in later via
// a downstream conversion step — the raw JSON payload is the source
// of truth for every export format.
import { NextResponse } from "next/server";
import { withClient } from "@/lib/nex/delivery/db";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";
export const maxDuration = 60;

const SCOPES = new Set(["campaigns","daily","monthly","country","provider","segment","events"]);

export async function GET(request: Request) {
  const url = new URL(request.url);
  const scope  = (url.searchParams.get("scope")  ?? "campaigns").toLowerCase();
  const format = (url.searchParams.get("format") ?? "csv").toLowerCase();
  const limit  = Math.max(1, Math.min(10_000, Number(url.searchParams.get("limit") ?? 1000)));
  if (!SCOPES.has(scope)) return NextResponse.json({ ok: false, error: "unknown_scope", allowed: Array.from(SCOPES) }, { status: 400 });
  if (format !== "csv" && format !== "json") return NextResponse.json({ ok: false, error: "unknown_format" }, { status: 400 });

  const table = scope === "events" ? "nex.analytics_events" : `nex.rollup_${scope}`;
  const order = scope === "events" ? "event_timestamp DESC" : scope === "daily" ? "day DESC" : scope === "monthly" ? "month DESC" : "updated_at DESC";

  const rows = await withClient(async (c) => {
    const res = await c.query(`SELECT * FROM ${table} ORDER BY ${order} LIMIT ${limit}`);
    return res.rows;
  }) ?? [];

  if (format === "json") {
    return NextResponse.json({ ok: true, scope, rows });
  }
  // CSV
  const csv = toCsv(rows);
  return new NextResponse(csv, {
    status: 200,
    headers: {
      "content-type": "text/csv; charset=utf-8",
      "content-disposition": `attachment; filename="nex-${scope}-${new Date().toISOString().slice(0, 10)}.csv"`,
    },
  });
}

function toCsv(rows: Record<string, unknown>[]): string {
  if (rows.length === 0) return "";
  const cols = Object.keys(rows[0]);
  const header = cols.join(",");
  const body = rows.map((r) => cols.map((c) => csvEscape(r[c])).join(",")).join("\n");
  return `${header}\n${body}\n`;
}
function csvEscape(v: unknown): string {
  if (v === null || v === undefined) return "";
  const s = typeof v === "object" ? JSON.stringify(v) : String(v);
  if (/[",\n\r]/.test(s)) return `"${s.replace(/"/g, '""')}"`;
  return s;
}
