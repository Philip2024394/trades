// Timeline adapter — reads hammerex_sitebook_events + supplements
// with the project itself (created/started/completed) so the very
// first event is always in the timeline even on brand-new projects.

import { supabaseAdmin } from "@/lib/supabaseAdmin";
import type { PIAdapter, AspectMetrics, TimelineEvent } from "../types";
import { evidenceFor } from "../types";

const HEADLINES: Record<string, string> = {
  project_created:    "Project created",
  project_published:  "Project published",
  trade_invited:      "Trade invited",
  trade_accepted:     "Trade accepted invitation",
  trade_declined:     "Trade declined",
  trade_quoted:       "Trade sent a quote",
  trade_hired:        "Trade hired",
  project_started:    "Project started",
  project_completed:  "Project completed",
  photo_added:        "Photo uploaded",
  message_posted:     "Message posted",
  warranty_added:     "Warranty logged",
  invoice_added:      "Invoice added"
};

export const timelineAdapter: PIAdapter = {
  aspect: "timeline",
  label:  "Timeline",
  weight: 1.5,

  async run(ctx) {
    const evidence = evidenceFor("hammerex_sitebook_events", ["hammerex_sitebook_events"]);
    const rows = await supabaseAdmin
      .from("hammerex_sitebook_events")
      .select("event_type, actor_type, actor_name, created_at, metadata")
      .eq("project_id", ctx.projectId)
      .order("created_at", { ascending: false })
      .limit(200);

    const events: TimelineEvent[] = (rows.data ?? []).map((r) => ({
      at:         r.created_at as string,
      event_type: String(r.event_type),
      actor_type: (r.actor_type ?? null) as TimelineEvent["actor_type"],
      actor_name: (r.actor_name ?? null) as string | null,
      headline:   HEADLINES[String(r.event_type)] ?? String(r.event_type).replace(/_/g, " "),
      evidence
    }));

    const count = events.length;
    // A project with any timeline movement gets a floor of 60. Very
    // active timelines saturate at 100.
    const sub_score = count === 0 ? 40 : Math.min(100, 60 + count);

    return {
      aspect: "timeline",
      label:  "Timeline",
      sub_score,
      weight: 1.5,
      metrics: [
        { key: "events_total", label: "Timeline events", value: count, unit: "count", direction: "higher_is_better", evidence }
      ],
      observations: [],
      timeline: events
    };
  }
};
