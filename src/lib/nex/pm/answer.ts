// PM answer router — multi-project + command centre questions.
//
// "how are my projects?"         → overview
// "which project worries you?"   → worst project
// "which project needs me today?" → highest urgency
// "what's falling behind?"       → delayed projects
// "run today's business"         → command centre briefing
// "when will X finish?"          → forecast (needs a project id)

import { commandCentreToText, type BuildCommandCentreResult } from "./command_centre";
import type { CompletionForecast, DelayedProject, ProjectsOverview } from "./types";

export type PMQuestion =
  | { kind: "portfolio_overview" }
  | { kind: "worst_project" }
  | { kind: "delayed" }
  | { kind: "command_centre" }
  | { kind: "forecast";       hint: string }
  | { kind: "none" };

export function classifyPMQuestion(text: string): PMQuestion {
  const t = text.toLowerCase().trim();
  if (!t) return { kind: "none" };

  if (/\brun\s+today'?s\s+business\b|\btoday'?s\s+command\s+centre\b/.test(t)) return { kind: "command_centre" };
  if (/\bhow\s+are\s+my\s+projects\b|\bshow\s+(all\s+)?my\s+projects\b|\bportfolio\b/.test(t)) return { kind: "portfolio_overview" };
  if (/\bwhich\s+project\s+worries\s+you\b|\bwhich\s+project\s+needs\s+me\b|\bwhich\s+project\s+is\s+worst\b/.test(t)) return { kind: "worst_project" };
  if (/\bwhat'?s\s+falling\s+behind\b|\bdelayed\s+projects\b|\bwhich\s+projects\s+are\s+late\b/.test(t)) return { kind: "delayed" };
  const forecastMatch = t.match(/\bwhen\s+will\s+(.+?)\s+(finish|complete|be\s+done)\b/);
  if (forecastMatch) return { kind: "forecast", hint: forecastMatch[1].trim() };
  return { kind: "none" };
}

// ─── Reply builders ───────────────────────────────────────────

export function formatPortfolioOverview(o: ProjectsOverview): string {
  if (o.projects.length === 0) {
    const w = o.warnings[0] ?? "No active projects on file.";
    return w;
  }
  const lines: string[] = [`Portfolio — ${o.projects.length} project${o.projects.length === 1 ? "" : "s"}, worst-health first:`];
  for (const p of o.projects) {
    lines.push(`- ${p.project.title} — ${p.health_score}% (${p.band}). ${p.observation_summary}`);
  }
  return lines.join("\n");
}

export function formatWorstProject(o: ProjectsOverview): string {
  if (o.projects.length === 0) return o.warnings[0] ?? "No projects to rank.";
  const worst = o.projects[0];
  const lines = [
    `Worst-health project: ${worst.project.title} at ${worst.health_score}% (${worst.band}).`,
    ""
  ];
  if (worst.top_observations.length > 0) {
    for (const t of worst.top_observations) lines.push(`- ${t.headline}`);
  } else {
    lines.push(worst.observation_summary);
  }
  return lines.join("\n");
}

export function formatDelayed(list: DelayedProject[]): string {
  if (list.length === 0) return "No projects forecast to run past their scheduled end date.";
  const lines = [`${list.length} project${list.length === 1 ? "" : "s"} forecast to slip:`];
  for (const d of list.slice(0, 10)) lines.push(`- ${d.title} — forecast ${d.forecast_end} vs scheduled ${d.scheduled_end} (${d.days_behind} day${d.days_behind === 1 ? "" : "s"} behind).`);
  return lines.join("\n");
}

export function formatCommandCentre(res: BuildCommandCentreResult): string {
  if (!res.ok) return "Your listing isn't set up yet — I can't run the command centre.";
  return commandCentreToText(res.briefing);
}

export function formatForecast(f: CompletionForecast): string {
  const lines: string[] = [];
  lines.push(`${f.title}: ${f.forecast_end ? `forecast to finish ${f.forecast_end}` : "cannot forecast yet"} (confidence: ${f.confidence}).`);
  lines.push("");
  lines.push(f.reason);
  return lines.join("\n");
}
