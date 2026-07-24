// GET /api/cron/nex-weekly-report
// Auth: header 'x-cron-secret' must match CRON_SECRET env.
//
// Writes one row per week to hammerex_nex_weekly_reports summarising:
// pending reviews, approvals + rejections this week, new entries per
// trade, weakest trade. Admins read at /admin/nex/weekly.
//
// Email delivery is deferred to pass 2 (needs an email transport
// decision). The row lands in the DB — that's the source of truth.

import { NextResponse, type NextRequest } from "next/server";
import { supabaseAdmin } from "@/lib/supabaseAdmin";
import { readHealth } from "@/lib/nex/intelligence";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

export async function GET(req: NextRequest): Promise<NextResponse> {
  const secret = req.headers.get("x-cron-secret");
  if (secret !== process.env.CRON_SECRET) {
    return NextResponse.json({ ok: false, error: "unauthorised" }, { status: 401 });
  }

  const now         = new Date();
  const weekStart   = mondayOf(now);
  const weekStartIso = weekStart.toISOString();

  // Pending count (all-time pending).
  const { count: pendingCount = 0 } = await supabaseAdmin
    .from("hammerex_nex_review_queue")
    .select("*", { count: "exact", head: true })
    .eq("status", "pending");

  // This week's approvals + rejections.
  const { count: approvedCount = 0 } = await supabaseAdmin
    .from("hammerex_nex_review_queue")
    .select("*", { count: "exact", head: true })
    .eq("status", "approved")
    .gte("reviewed_at", weekStartIso);

  const { count: rejectedCount = 0 } = await supabaseAdmin
    .from("hammerex_nex_review_queue")
    .select("*", { count: "exact", head: true })
    .eq("status", "rejected")
    .gte("reviewed_at", weekStartIso);

  // New entries this week + per-trade breakdown.
  const { data: newVersions } = await supabaseAdmin
    .from("hammerex_nex_knowledge_versions")
    .select("trade, change_kind")
    .gte("approved_at", weekStartIso);
  const newEntriesThisWeek = (newVersions ?? []).filter((v) => v.change_kind === "initial").length;
  const updatesByTrade: Record<string, number> = {};
  for (const v of newVersions ?? []) {
    updatesByTrade[v.trade] = (updatesByTrade[v.trade] ?? 0) + 1;
  }

  // Weakest trade from the health view.
  const health = await readHealth();
  const weakest = health[0];   // health rows are sorted asc by health_pct

  const greetingMd = buildGreeting({
    pendingCount:       pendingCount ?? 0,
    newEntriesThisWeek,
    approvedCount:      approvedCount ?? 0,
    updatesByTrade,
    weakestTrade:       weakest?.trade,
    weakestPct:         weakest?.health_pct
  });

  const { error } = await supabaseAdmin
    .from("hammerex_nex_weekly_reports")
    .upsert({
      week_starting:         weekStart.toISOString().slice(0, 10),
      pending_reviews:       pendingCount ?? 0,
      approved_this_week:    approvedCount ?? 0,
      rejected_this_week:    rejectedCount ?? 0,
      new_entries_this_week: newEntriesThisWeek,
      updates_by_trade:      updatesByTrade,
      weakest_trade:         weakest?.trade ?? null,
      weakest_trade_pct:     weakest?.health_pct ?? null,
      estimated_review_minutes: Math.max(2, Math.ceil((pendingCount ?? 0) * 0.5)),
      greeting_md:           greetingMd
    }, { onConflict: "week_starting" });
  if (error) return NextResponse.json({ ok: false, error: error.message }, { status: 500 });

  return NextResponse.json({
    ok:                    true,
    week_starting:         weekStart.toISOString().slice(0, 10),
    pending_reviews:       pendingCount,
    new_entries_this_week: newEntriesThisWeek,
    weakest_trade:         weakest?.trade,
    weakest_pct:           weakest?.health_pct
  });
}

function mondayOf(d: Date): Date {
  const copy = new Date(d);
  const day = copy.getUTCDay();
  const diff = day === 0 ? -6 : 1 - day;   // shift Sunday back 6, others forward to Monday
  copy.setUTCDate(copy.getUTCDate() + diff);
  copy.setUTCHours(0, 0, 0, 0);
  return copy;
}

function buildGreeting(input: {
  pendingCount:       number;
  newEntriesThisWeek: number;
  approvedCount:      number;
  updatesByTrade:     Record<string, number>;
  weakestTrade?:      string;
  weakestPct?:        number;
}): string {
  const lines: string[] = [];
  lines.push("Good morning.");
  lines.push("");
  lines.push("This week I reviewed:");
  const entries = Object.entries(input.updatesByTrade).sort(([, a], [, b]) => b - a);
  if (entries.length === 0) lines.push("- (nothing published this week)");
  else for (const [trade, n] of entries) lines.push(`- ${trade}: ${n} updates`);
  lines.push("");
  lines.push(`${input.pendingCount} knowledge item${input.pendingCount === 1 ? "" : "s"} await your approval.`);
  if (input.weakestTrade && (input.weakestPct ?? 100) < 80) {
    lines.push(`${input.weakestTrade} is our weakest trade at ${input.weakestPct}% — worth teaching Nex more.`);
  }
  return lines.join("\n");
}
