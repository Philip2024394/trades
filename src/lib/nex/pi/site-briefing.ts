// Daily Site Briefing — the "walk on site" summary.
//
// Uses the PI snapshot for one specific project. Sections:
//   1. Health headline
//   2. Today's activity (timeline filtered to today)
//   3. Payments due (overdue-cost observations)
//   4. Outstanding tasks (open snags + open questions)
//   5. Active risks (from the risks adapter)
// Empty sections are OMITTED — nothing padded.

import { buildProjectSnapshot } from "./engine";
import type { ProjectSnapshot, ViewerType } from "./types";

export type SiteBriefing = {
  project_id:  string;
  title:       string;
  health:      ProjectSnapshot["health"];
  sections:    Array<{ heading: string; bullets: string[] }>;
  computed_at: string;
};

export type SiteBriefingOptions = {
  projectId: string;
  viewer:    ViewerType;
  viewerId:  string;
  now?:      Date;
};

export async function buildSiteBriefing(opts: SiteBriefingOptions): Promise<
  | { ok: true; briefing: SiteBriefing }
  | { ok: false; reason: string }
> {
  const res = await buildProjectSnapshot({
    projectId: opts.projectId,
    viewer:    opts.viewer,
    viewerId:  opts.viewerId,
    now:       opts.now
  });
  if (!res.ok) return { ok: false, reason: res.reason };

  const s = res.snapshot;
  const now = opts.now ?? new Date();
  const dayStart = new Date(now.getFullYear(), now.getMonth(), now.getDate()).toISOString();

  const sections: SiteBriefing["sections"] = [];

  const today = s.timeline.filter((ev) => ev.at >= dayStart).slice(0, 6);
  if (today.length > 0) {
    sections.push({
      heading: "Today so far",
      bullets: today.map((ev) => `${ev.headline}${ev.actor_name ? ` — ${ev.actor_name}` : ""}`)
    });
  }

  const paymentAlerts = s.observations.filter((o) => o.aspect === "costs" && (o.severity === "warning" || o.severity === "alert"));
  if (paymentAlerts.length > 0) {
    sections.push({
      heading: "Payments needing attention",
      bullets: paymentAlerts.map((o) => o.headline)
    });
  }

  const tasks = s.observations.filter((o) => o.aspect === "things_to_fix" || (o.aspect === "posts" && o.key === "open_questions"));
  if (tasks.length > 0) {
    sections.push({
      heading: "Outstanding tasks",
      bullets: tasks.map((o) => o.headline)
    });
  }

  const risks = s.observations.filter((o) => o.aspect === "risks");
  if (risks.length > 0) {
    sections.push({
      heading: "Active risks",
      bullets: risks.slice(0, 5).map((o) => o.headline)
    });
  }

  const briefing: SiteBriefing = {
    project_id:  s.project.id,
    title:       s.project.title,
    health:      s.health,
    sections,
    computed_at: s.computed_at
  };
  return { ok: true, briefing };
}

/** Turn a briefing into a plain-text block Nex can speak. */
export function siteBriefingToText(b: SiteBriefing): string {
  const lines: string[] = [`Site briefing — ${b.title}`, b.health.headline];
  for (const sec of b.sections) {
    lines.push("");
    lines.push(sec.heading + ":");
    for (const bl of sec.bullets) lines.push(`- ${bl}`);
  }
  if (b.sections.length === 0) {
    lines.push("");
    lines.push("Nothing needs your attention on this project right now.");
  }
  return lines.join("\n");
}
