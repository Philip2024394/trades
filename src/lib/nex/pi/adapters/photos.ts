// Photos adapter — reads hammerex_sitebook_photos for the project.
//
// KPIs:
//   • photos_total     — every photo on the project
//   • photos_recent    — photos in the lookback window
//   • days_since_photo — freshness (null when no photos exist)
// Observations:
//   • notice when four+ days have passed without a photo (SiteBook
//     Blueprint rule 2: "replaces the paper snagging list" —
//     silence-for-days is a real signal).
//
// AI enrichment stub: photo tagging (room / trade / defect / stage)
// is future work. When tags land on the rows we surface counts here;
// today the adapter is null-safe on tags.

import { supabaseAdmin } from "@/lib/supabaseAdmin";
import type { PIAdapter, TimelineEvent } from "../types";
import { evidenceFor } from "../types";
import { scoreMetric } from "../health";

const DAY_MS = 86_400_000;

export const photosAdapter: PIAdapter = {
  aspect: "photos",
  label:  "Photos",
  weight: 1.2,

  async run(ctx) {
    const now       = ctx.now ?? new Date();
    const lookback  = ctx.lookbackDays ?? 30;
    const fromIso   = new Date(now.getTime() - lookback * DAY_MS).toISOString();
    const evidence  = evidenceFor("hammerex_sitebook_photos", ["hammerex_sitebook_photos"], `/sitebook/${ctx.projectId}/photos`);

    const total = await supabaseAdmin
      .from("hammerex_sitebook_photos")
      .select("id", { count: "exact", head: true })
      .eq("project_id", ctx.projectId);

    const recent = await supabaseAdmin
      .from("hammerex_sitebook_photos")
      .select("id, created_at, storage_url, caption, stage, uploaded_by_type, uploaded_by_name", { count: "exact" })
      .eq("project_id", ctx.projectId)
      .gte("created_at", fromIso)
      .order("created_at", { ascending: false });

    const latest = await supabaseAdmin
      .from("hammerex_sitebook_photos")
      .select("created_at")
      .eq("project_id", ctx.projectId)
      .order("created_at", { ascending: false })
      .limit(1)
      .maybeSingle();

    const totalCount  = total.count ?? 0;
    const recentCount = recent.count ?? 0;
    const daysSince   = latest.data?.created_at
      ? Math.floor((now.getTime() - new Date(latest.data.created_at as string).getTime()) / DAY_MS)
      : null;

    // Stage breakdown for a quick "how far along" sense.
    const stageCounts = { before: 0, "in-progress": 0, after: 0, untagged: 0 };
    for (const r of recent.data ?? []) {
      const s = r.stage as keyof typeof stageCounts | null;
      if (s === "before" || s === "in-progress" || s === "after") stageCounts[s]++;
      else stageCounts.untagged++;
    }

    // Timeline contribution — one event per recent photo (max 20).
    const timeline: TimelineEvent[] = (recent.data ?? []).slice(0, 20).map((r) => ({
      at:         r.created_at as string,
      event_type: "photo_added",
      actor_type: r.uploaded_by_type as TimelineEvent["actor_type"],
      actor_name: (r.uploaded_by_name ?? null) as string | null,
      headline:   r.caption ? `Photo: ${String(r.caption).slice(0, 80)}` : "Photo uploaded",
      evidence
    }));

    const activityScore = scoreMetric(recentCount, { floor: 0, ceiling: 20, direction: "higher_is_better" });
    const freshnessScore = daysSince === null ? 30 : scoreMetric(daysSince, { floor: 21, ceiling: 1, direction: "lower_is_better" });
    const sub_score = Math.round((activityScore + freshnessScore) / 2);

    const observations = [];
    if (daysSince !== null && daysSince >= 4) {
      observations.push({
        key:      "photos_stale",
        aspect:   "photos" as const,
        severity: daysSince >= 10 ? "warning" as const : "notice" as const,
        headline: `No photos uploaded for ${daysSince} days.`,
        detail:   "A quick site snap keeps everyone on the same page — homeowner, trades and me.",
        action:   { label: "Add a photo", href: `/sitebook/${ctx.projectId}/photos` },
        evidence
      });
    }

    return {
      aspect: "photos",
      label:  "Photos",
      sub_score,
      weight: 1.2,
      metrics: [
        { key: "photos_total",     label: "Photos on record",   value: totalCount,  unit: "count", direction: "higher_is_better", evidence },
        { key: "photos_recent",    label: `Photos last ${lookback} days`, value: recentCount, unit: "count", direction: "higher_is_better", evidence },
        { key: "days_since_photo", label: "Days since last photo", value: daysSince, unit: "days", direction: "lower_is_better", evidence },
        { key: "photos_before",    label: "Before photos",      value: stageCounts.before,        unit: "count", direction: "higher_is_better", evidence },
        { key: "photos_progress",  label: "In-progress photos", value: stageCounts["in-progress"], unit: "count", direction: "higher_is_better", evidence },
        { key: "photos_after",     label: "After photos",       value: stageCounts.after,         unit: "count", direction: "higher_is_better", evidence }
      ],
      observations,
      timeline
    };
  }
};
