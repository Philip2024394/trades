// Daily briefing — the walk-into-your-office moment.
//
// Composes:
//   1. Time-of-day greeting + first name + welcome-back line
//   2. "Here's today's briefing." header
//   3. Signal bullets (proactive observations)
//   4. "What would you like to work on first?" close
//
// Uses buildGreeting() for the top line and collectSignals() for the
// middle. Returns both a spoken string and a structured signals array
// so the UI can render clickable action chips.

import { buildGreeting, type GreetingInput } from "./greeting";
import { collectSignals, type Signal } from "./signals";
import { streamObservations } from "./bi";
import type { BusinessHealth, Observation } from "./bi";
import { buildBusinessSnapshot } from "./bi";
import { buildMDBriefing } from "./md";
import type { PriorityItem, Recommendation } from "./md";

export type DailyBriefing = {
  greeting: string;
  bullets:  string[];             // one line per signal + BI observation + MD priority
  signals:  Signal[];             // structured — UI renders clickable chips
  observations: Observation[];    // BI observations (structured, for UI chips)
  /** null when neither engine has enough data yet — briefing stays
   *  silent rather than fabricating a score (evidence-or-silence). */
  health:   { score: number; band: BusinessHealth["band"]; headline: string } | null;
  /** MD-level cross-engine priorities (top 3). Empty when the MD
   *  engine returned nothing. */
  priorities:      PriorityItem[];
  recommendations: Recommendation[];
  closing:  string;
};

export async function buildDailyBriefing(input: {
  firstName:    string;
  lastSeenAt:   string | null;
  merchantSlug: string;
  now?:         Date;
}): Promise<DailyBriefing> {
  // Greeting reuses the existing time-of-day + last-seen logic.
  const { greeting } = buildGreeting({
    firstName:      input.firstName,
    lastSeenAt:     input.lastSeenAt,
    pendingReviews: 0,          // signals now own the "review pending" line
    now:            input.now
  });

  const [signals, snapshot, mdRes] = await Promise.all([
    collectSignals({ merchantSlug: input.merchantSlug, now: input.now }),
    buildBusinessSnapshot({ merchantSlug: input.merchantSlug, now: input.now }).catch(() => null),
    buildMDBriefing({ merchantSlug: input.merchantSlug, now: input.now }).catch(() => null)
  ]);

  const observations = snapshot?.observations.slice(0, 5) ?? [];
  const mdBriefing   = mdRes && mdRes.ok ? mdRes.briefing : null;

  // MD priorities (top 3 by severity) — deduped against BI observations
  // by headline to avoid saying the same thing twice.
  const observationHeadlines = new Set(observations.map((o) => o.headline));
  const priorities = (mdBriefing?.priorities ?? [])
    .filter((p) => !observationHeadlines.has(p.headline))
    .slice(0, 3);

  const bullets = [
    ...signals.map((s) => `- ${s.headline}`),
    ...observations.map((o) => `- ${o.headline}`),
    ...priorities.map((p) => `- ${p.headline}`)
  ];

  // Prefer the MD composite score — it's fuller. Fall back to BI.
  const health = mdBriefing && mdBriefing.health.score > 0
    ? { score: mdBriefing.health.score, band: mdBriefing.health.band, headline: mdBriefing.health.headline }
    : snapshot && snapshot.domains.some((d) => d.sub_score !== null)
      ? { score: snapshot.score, band: snapshot.band, headline: snapshot.headline }
      : null;
  if (health) bullets.push(`- ${health.headline}`);

  const recommendations = mdBriefing?.recommendations.slice(0, 3) ?? [];
  if (recommendations.length > 0) {
    bullets.push("");
    bullets.push("Recommended today:");
    for (const r of recommendations) bullets.push(`- ${r.action} — because: ${r.reason}`);
  }

  const hasContent = bullets.length > 0;
  const closing = hasContent
    ? "What would you like to work on first?"
    : "Nothing needs your attention right now. What would you like to work on first?";

  return { greeting, bullets, signals, observations, health, priorities, recommendations, closing };
}

/** Formats the briefing as one plain-English block Nex can speak.
 *  Never uses AI jargon or fake enthusiasm. */
export function briefingToSpeech(briefing: DailyBriefing): string {
  const lines: string[] = [briefing.greeting];
  if (briefing.bullets.length > 0) {
    lines.push("");
    lines.push("Here's today's briefing.");
    lines.push("");
    lines.push(...briefing.bullets);
    lines.push("");
  } else {
    lines.push("");
  }
  lines.push(briefing.closing);
  return lines.join("\n");
}
