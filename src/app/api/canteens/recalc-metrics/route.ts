// POST /api/canteens/recalc-metrics
//
// Cron-guarded periodic recompute of denormalized canteen metrics:
//   - member_count      = COUNT(hammerex_canteen_members WHERE canteen_id=canteen.id)
//   - posts_last_30d    = COUNT(hammerex_canteen_posts WHERE canteen_id=canteen.id AND created_at > now() - '30 days')
//
// Denormalized so the canteen list + detail pages don't run an
// aggregate on every render. A periodic recalc keeps drift bounded —
// join/leave/post endpoints do best-effort bumps at write time, this
// endpoint reconciles the truth.
//
// Guarded by CRON_SECRET header. Idempotent. Safe to call every hour.

import { NextResponse } from "next/server";
import { supabaseAdmin } from "@/lib/supabaseAdmin";

export async function POST(req: Request) {
  const cronSecret = process.env.CRON_SECRET;
  const authHeader = req.headers.get("x-cron-secret") ?? req.headers.get("authorization");
  const providedSecret = authHeader?.startsWith("Bearer ")
    ? authHeader.slice(7)
    : authHeader;

  if (!cronSecret) {
    return NextResponse.json({ ok: false, error: "cron-secret-not-configured" }, { status: 500 });
  }
  if (providedSecret !== cronSecret) {
    return NextResponse.json({ ok: false, error: "unauthorized" }, { status: 401 });
  }

  // Pull every canteen. This scales to ~10K canteens per invocation
  // without pagination — beyond that, chunk by id ranges.
  const canteens = await supabaseAdmin
    .from("hammerex_canteens")
    .select("id");
  if (canteens.error) {
    return NextResponse.json(
      { ok: false, error: "db-read-failed", detail: canteens.error.message },
      { status: 500 }
    );
  }

  const rows = canteens.data ?? [];
  const cutoffIso = new Date(Date.now() - 30 * 24 * 60 * 60 * 1000).toISOString();
  let updated = 0;

  for (const c of rows) {
    const [memberRes, postRes] = await Promise.all([
      supabaseAdmin
        .from("hammerex_canteen_members")
        .select("id", { count: "exact", head: true })
        .eq("canteen_id", c.id),
      supabaseAdmin
        .from("hammerex_canteen_posts")
        .select("id", { count: "exact", head: true })
        .eq("canteen_id", c.id)
        .gte("created_at", cutoffIso)
    ]);
    const memberCount = memberRes.count ?? 0;
    const postsLast30d = postRes.count ?? 0;

    const upd = await supabaseAdmin
      .from("hammerex_canteens")
      .update({ member_count: memberCount, posts_last_30d: postsLast30d })
      .eq("id", c.id);
    if (!upd.error) updated += 1;
  }

  return NextResponse.json({ ok: true, canteens: rows.length, updated });
}
