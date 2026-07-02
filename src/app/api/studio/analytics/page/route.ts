// GET /api/studio/analytics/page?pageId=...&window=7d|30d|90d
//
// Returns per-section rollups for the merchant's current page over the
// given time window. Auth-gated by the studio session cookie.
//
// Shape:
//   {
//     ok: true,
//     pageId: "home",
//     window: "30d",
//     since: "2026-06-02T…Z",
//     totals: { views, clicks, converts },
//     sections: [
//       {
//         section_key,
//         instance_id,
//         views, clicks, converts,
//         ctr, conversion_rate,
//         daily: [{ day, views, clicks }]
//       }
//     ]
//   }

import { NextResponse } from "next/server";
import { loadStudioSession } from "@/lib/studio/session";
import { supabaseAdmin } from "@/lib/supabaseAdmin";

export const runtime = "nodejs";

const WINDOWS: Record<string, number> = {
  "7d": 7,
  "30d": 30,
  "90d": 90
};

type EventRow = {
  event: string;
  section_key: string | null;
  instance_id: string | null;
  created_at: string;
};

export async function GET(req: Request) {
  const session = await loadStudioSession();
  if (!session) {
    return NextResponse.json(
      { ok: false, error: "unauthenticated" },
      { status: 401 }
    );
  }

  const url = new URL(req.url);
  const pageId = url.searchParams.get("pageId") ?? "home";
  const windowKey = url.searchParams.get("window") ?? "30d";
  const days = WINDOWS[windowKey] ?? 30;
  const since = new Date(Date.now() - days * 86_400_000).toISOString();

  const res = await supabaseAdmin
    .from("studio_layout_events")
    .select("event, section_key, instance_id, created_at")
    .eq("brand_id", session.brand.id)
    .eq("page_id", pageId)
    .gte("created_at", since)
    .in("event", ["view", "click", "convert"])
    .order("created_at", { ascending: true })
    .limit(50_000);

  if (res.error) {
    return NextResponse.json(
      { ok: false, error: res.error.message },
      { status: 500 }
    );
  }

  const rollups = new Map<
    string,
    {
      section_key: string | null;
      instance_id: string | null;
      views: number;
      clicks: number;
      converts: number;
      daily: Map<string, { views: number; clicks: number }>;
    }
  >();

  let totalViews = 0;
  let totalClicks = 0;
  let totalConverts = 0;

  for (const row of (res.data ?? []) as EventRow[]) {
    if (row.instance_id === "page") continue; // page-level scroll depth
    const key = `${row.section_key ?? "-"}::${row.instance_id ?? "-"}`;
    let bucket = rollups.get(key);
    if (!bucket) {
      bucket = {
        section_key: row.section_key,
        instance_id: row.instance_id,
        views: 0,
        clicks: 0,
        converts: 0,
        daily: new Map()
      };
      rollups.set(key, bucket);
    }
    const day = row.created_at.slice(0, 10);
    let dayBucket = bucket.daily.get(day);
    if (!dayBucket) {
      dayBucket = { views: 0, clicks: 0 };
      bucket.daily.set(day, dayBucket);
    }
    if (row.event === "view") {
      bucket.views++;
      dayBucket.views++;
      totalViews++;
    } else if (row.event === "click") {
      bucket.clicks++;
      dayBucket.clicks++;
      totalClicks++;
    } else if (row.event === "convert") {
      bucket.converts++;
      totalConverts++;
    }
  }

  const sections = Array.from(rollups.values())
    .map((s) => ({
      section_key: s.section_key,
      instance_id: s.instance_id,
      views: s.views,
      clicks: s.clicks,
      converts: s.converts,
      ctr: s.views ? Math.round((s.clicks / s.views) * 1000) / 10 : 0,
      conversion_rate:
        s.views ? Math.round((s.converts / s.views) * 1000) / 10 : 0,
      daily: Array.from(s.daily.entries())
        .sort((a, b) => (a[0] < b[0] ? -1 : 1))
        .map(([day, v]) => ({ day, ...v }))
    }))
    .sort((a, b) => b.views - a.views);

  return NextResponse.json({
    ok: true,
    pageId,
    window: windowKey,
    since,
    totals: { views: totalViews, clicks: totalClicks, converts: totalConverts },
    sections
  });
}
