// GET /api/cron/nex-social-publish
// Auth: header 'x-cron-secret' must match CRON_SECRET.
//
// Runs every ~5 minutes. Publishes any post in 'scheduled' state
// whose scheduled_for <= now. Publisher enforces all the rules
// (auto-publish permission, connection, first-post-manual, etc).

import { NextResponse, type NextRequest } from "next/server";
import { supabaseAdmin } from "@/lib/supabaseAdmin";
import { publishPost } from "@/lib/nex/social";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

const MAX_PER_TICK = 25;

export async function GET(req: NextRequest): Promise<NextResponse> {
  const secret = req.headers.get("x-cron-secret");
  if (secret !== process.env.CRON_SECRET) return NextResponse.json({ ok: false, error: "unauthorised" }, { status: 401 });

  const now = new Date().toISOString();
  const { data: due } = await supabaseAdmin
    .from("hammerex_nex_social_posts")
    .select("id, merchant_slug, platform")
    .eq("status", "scheduled")
    .lte("scheduled_for", now)
    .order("scheduled_for", { ascending: true })
    .limit(MAX_PER_TICK);

  const results: Array<{ id: string; ok: boolean; reason?: string }> = [];
  for (const row of due ?? []) {
    const r = await publishPost({ postId: row.id, actor: "cron" });
    results.push({ id: row.id, ok: r.ok, reason: r.ok ? undefined : r.reason });
  }
  return NextResponse.json({ ok: true, considered: due?.length ?? 0, results });
}
