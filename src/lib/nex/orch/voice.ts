// Nex voice — merge N specialist replies into ONE Nex-voiced reply.
//
// Every specialist speaks as itself internally ("Estimating agent:",
// "Structural agent:", etc.). The merchant should never see those
// labels — Nex takes credit for everything.
//
// Voice rules (from feedback_nex_voice_in_thenetworkers.md +
// feedback_no_em_dash_in_hero.md):
//   - Northern UK, direct, brief.
//   - No em dashes.
//   - Nex speaks as "I" or plural "we" — never third-person.

import type { AgentResult } from "./types";
import type { Conflict } from "./confidence";

/** Strip agent-name prefixes like "Estimating agent:" or "Regulations
 *  Agent found:" from a line so it reads as Nex's own voice. */
export function stripAgentLabel(line: string): string {
  return line
    .replace(/^\s*[A-Z][A-Za-z ]+? agent(?: found)?:\s*/i, "")
    .replace(/^\s*[A-Z][A-Za-z ]+? Agent(?: found)?:\s*/i, "")
    .trim();
}

/** Kill em dashes — replace with a period or a semicolon depending on
 *  context. Per site-wide brand rule (no em dashes in hero copy — but
 *  Nex holds the same bar for consistency). */
export function stripEmDash(text: string): string {
  return text
    .replace(/\s+—\s+/g, ". ")
    .replace(/—/g, ".");
}

/** Normalise a single agent's speak into a Nex bullet. */
export function normaliseContribution(r: AgentResult): string[] {
  const lines = r.speak.split("\n").map((l) => stripEmDash(stripAgentLabel(l))).filter(Boolean);
  return lines;
}

/** Compose N contributions into a single Nex-voiced reply. Errors
 *  drop silently unless every agent failed. Conflicts surface as a
 *  "sources disagree" note. */
export function composeNexReply(input: {
  contributions: AgentResult[];
  conflicts?:    Conflict[];
  overall_confidence: "low" | "medium" | "high";
  official_cited: boolean;
}): string {
  const good = input.contributions.filter((c) => !c.error && (c.headline || c.speak));
  if (good.length === 0) return "I couldn't get a clear answer from my specialists this time. Try rephrasing or narrowing the ask.";

  const bullets: string[] = [];
  for (const c of good) {
    const lines = normaliseContribution(c);
    if (lines.length === 0) continue;
    // First line becomes the bullet, remaining lines nest.
    const first = lines[0]!;
    bullets.push(`- ${first}`);
    for (const l of lines.slice(1)) bullets.push(`  ${l}`);
  }

  const parts: string[] = [];
  parts.push("Here's what I found:");
  parts.push("");
  parts.push(bullets.join("\n"));
  if (input.conflicts && input.conflicts.length > 0) {
    parts.push("");
    parts.push("Heads-up. My sources disagree on some of this. I've surfaced both above so you can decide.");
  }
  const conf = input.overall_confidence;
  const footer = input.official_cited
    ? `Confidence: ${conf}. Cited against official guidance where available.`
    : `Confidence: ${conf}. Non-official sources only.`;
  parts.push("");
  parts.push(footer);
  return parts.join("\n");
}
