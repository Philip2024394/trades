// XP answer router — SEPARATES regulation vs experience vs preference
// on every reply. Never merges.

import { buildBenchmark } from "./aggregate";
import { classifyProjectType, extractRegion } from "./anonymise";
import { loadFingerprints } from "./loader";
import { findSimilarProjects } from "./similar";
import { DISCLAIMERS, evidenceFor, K_MIN, type BenchmarkStat, type ExperienceRecommendation, type ProjectFingerprint, type SourcedClaim } from "./types";
import { resolveResultLimit } from "../util/limit";

export type XPQuestion =
  | { kind: "how_long";       project_hint: string; region_hint?: string }
  | { kind: "labour_hours";   project_hint: string; region_hint?: string }
  | { kind: "similar";        project_hint: string; region_hint?: string }
  | { kind: "benchmark_reveal" }
  | { kind: "none" };

export function classifyXPQuestion(text: string): XPQuestion {
  const t = text.toLowerCase().trim();
  if (!t) return { kind: "none" };

  if (/\bhow\s+long\s+(does|do)\b|\btypical\s+duration\b/.test(t)) {
    return { kind: "how_long", project_hint: text };
  }
  if (/\baverage\s+labour\s+hours\b|\btypical\s+labour\b|\bwhat'?s\s+the\s+labour\b/.test(t)) {
    return { kind: "labour_hours", project_hint: text };
  }
  if (/\bsimilar\s+(projects?|jobs?)\b|\bshow\s+projects\s+similar\b/.test(t)) {
    return { kind: "similar", project_hint: text };
  }
  if (/\bhow\s+many\s+contributing\s+projects\b|\bxp\s+sample\s+size\b/.test(t)) {
    return { kind: "benchmark_reveal" };
  }
  return { kind: "none" };
}

export type AnswerXPInput = {
  question:         XPQuestion;
  /** Optional per-request opt-in list — projects the caller has just
   *  received explicit consent for (persistence not wired yet). */
  optInProjectIds?: string[];
  now?:             Date;
};

export async function answerXP(input: AnswerXPInput): Promise<{ speak: string; data?: ExperienceRecommendation }> {
  const q = input.question;
  if (q.kind === "none") return { speak: "" };

  const fingerprints = await loadFingerprints({ optInProjectIds: input.optInProjectIds, now: input.now });

  if (q.kind === "benchmark_reveal") {
    return {
      speak: [
        `Contributing projects on file: ${fingerprints.length}.`,
        "",
        `Benchmarks only appear when at least ${K_MIN} anonymous projects match a query (k-anonymity). Below that Nex stays silent to protect contributors.`
      ].join("\n")
    };
  }

  // Derive filter set from the hint (project_type + region).
  const projectType = classifyProjectType(q.project_hint);
  const region = q.region_hint ? extractRegion(q.region_hint) : undefined;

  if (q.kind === "similar") {
    const limit = resolveResultLimit(q.project_hint, 3);
    const similar = findSimilarProjects({
      fingerprints,
      // No trade filter — the merchant's ask doesn't include a trade,
      // match on project_type + region only.
      project_type: projectType,
      region,
      limit
    });
    const claims: SourcedClaim[] = [];
    claims.push({
      source_kind: "regulation",
      headline:    "Refer to the trade's building-regulation guidance for the technical requirements.",
      evidence:    evidenceFor("Regulations layer — advisory", [])
    });
    if (similar.length >= K_MIN) {
      claims.push({
        source_kind: "experience",
        headline:    `${similar.length} similar contributing project${similar.length === 1 ? "" : "s"} on the platform.`,
        detail:      similar.slice(0, limit).map((s) => `- ${s.similarity_note}; duration ${s.duration_days ?? "?"} days, labour ${s.labour_hours ?? "?"} hours`).join("\n"),
        sample_size: similar.length,
        confidence:  similar.length >= 25 ? "high" : similar.length >= 10 ? "medium" : "low",
        evidence:    evidenceFor("XP similar-project match", [])
      });
    } else {
      claims.push({
        source_kind: "experience",
        headline:    `Below the k=${K_MIN} threshold — ${similar.length} contributing project${similar.length === 1 ? "" : "s"} matched, kept silent to protect anonymity.`,
        sample_size: similar.length,
        confidence:  "low",
        evidence:    evidenceFor("XP similar-project match", [])
      });
    }
    return finish(q, claims);
  }

  // how_long / labour_hours — build the benchmark.
  const benchmark = buildBenchmark({
    fingerprints,
    filters: { project_type: projectType, region }
  });

  const metric: BenchmarkStat["metric"] = q.kind === "how_long" ? "duration_days" : "labour_hours";
  const stat = benchmark.stats.find((s) => s.metric === metric);
  const claims: SourcedClaim[] = [];

  claims.push({
    source_kind: "regulation",
    headline:    "Regulations don't set duration — the timeline depends on scope + weather. Refer to your trade's method statement.",
    evidence:    evidenceFor("Regulations layer — advisory", [])
  });

  if (stat && stat.median !== null) {
    claims.push({
      source_kind: "experience",
      headline:    `Real-world median ${stat.label.toLowerCase()}: ${stat.median} (p25=${stat.p25}, p75=${stat.p75}, min=${stat.min}, max=${stat.max}).`,
      detail:      stat.reason,
      sample_size: stat.count,
      confidence:  stat.confidence === "insufficient" ? "low" : stat.confidence,
      evidence:    stat.evidence
    });
  } else {
    claims.push({
      source_kind: "experience",
      headline:    `Insufficient contributing projects for ${projectType}${region ? ` in region ${region}` : ""} — nothing surfaced (k=${K_MIN} threshold).`,
      sample_size: benchmark.sample_size,
      confidence:  "low",
      evidence:    benchmark.evidence
    });
  }

  return finish(q, claims);
}

function finish(question: XPQuestion, claims: SourcedClaim[]): { speak: string; data: ExperienceRecommendation } {
  const rec: ExperienceRecommendation = {
    query:      "project_hint" in question ? question.project_hint : "",
    claims,
    disclaimer: `${DISCLAIMERS.regulation_vs_experience}\n${DISCLAIMERS.k_anonymity}\n${DISCLAIMERS.privacy}`,
    evidence:   evidenceFor("XP composite reply", [])
  };
  return { speak: formatReply(rec), data: rec };
}

// ─── Formatter — sources always shown separately ────────────

function formatReply(rec: ExperienceRecommendation): string {
  const bySource: Record<SourcedClaim["source_kind"], SourcedClaim[]> = {
    regulation:      [],
    experience:      [],
    preference:      [],
    engine_default:  []
  };
  for (const c of rec.claims) bySource[c.source_kind].push(c);

  const lines: string[] = [];
  if (bySource.regulation.length > 0) {
    lines.push("OFFICIAL:");
    for (const c of bySource.regulation) lines.push(`- ${c.headline}${c.detail ? `\n  ${c.detail}` : ""}`);
  }
  if (bySource.experience.length > 0) {
    if (lines.length > 0) lines.push("");
    lines.push("REAL-WORLD EXPERIENCE:");
    for (const c of bySource.experience) {
      const meta = c.sample_size !== undefined ? ` (n=${c.sample_size}, confidence: ${c.confidence ?? "low"})` : "";
      lines.push(`- ${c.headline}${meta}${c.detail ? `\n  ${c.detail}` : ""}`);
    }
  }
  if (bySource.preference.length > 0) {
    if (lines.length > 0) lines.push("");
    lines.push("MERCHANT PREFERENCE:");
    for (const c of bySource.preference) lines.push(`- ${c.headline}${c.detail ? `\n  ${c.detail}` : ""}`);
  }
  lines.push("");
  lines.push(rec.disclaimer);
  return lines.join("\n");
}

export { formatReply as _formatReply };
