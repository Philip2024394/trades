// src/lib/nex/brains/_trust.ts
//
// Trust Dashboard evaluator · Phase 2 observability
// (ADR-0038 · ADR-0040 · Philip 2026-07-28)
//
// HARD LAW · explanation is PRIMARY, number is secondary.
// Do NOT hardcode weighted percentages. Every Trust assessment answers:
//   1. Why is it this score?
//   2. What increased it?
//   3. What reduced it?
//   4. What specific action raises it next?
//
// The UI leads with the explanation. The number is a footnote so
// authors can compare over time — never the primary signal.
//
// "Professionals trust explanations more than numbers." — Philip 2026-07-28

import { brainSupabase, brainSupabaseAvailable, getBrainBySlug } from "./_supabase";

// ---------- Types ----------

export type TrustFactor = {
  key: string;
  label: string;
  direction: "raises" | "reduces" | "neutral";
  contribution: string;      // human sentence: "adds 12 pts", "holds trust at ceiling", "removes 8 pts"
  note: string;              // longer explanation with the underlying evidence
  data_available: boolean;   // false when the factor has no data yet — surfaced honestly
};

export type TrustBand = "excellent" | "good" | "developing" | "insufficient_data";

export type TrustAssessment = {
  brain_slug: string;
  // Explanation first
  headline: string;                 // the one-line story
  raisers: TrustFactor[];
  reducers: TrustFactor[];
  what_raises_it_next: string;      // single most impactful action the author can take
  // Number second
  score: number | null;             // 0-100 or null when insufficient data
  band: TrustBand;
  data_completeness: number;        // 0-1 · fraction of factors with real data
  computed_at: string;
};

// ---------- Factor definitions ----------

const HIGH_CONFIDENCE = 0.85;
const MIN_ANSWERS_FOR_SIGNAL = 20;
const CERT_HORIZON_DAYS = 30;

// ---------- Public API ----------

export async function computeTrust(brain_slug: string): Promise<TrustAssessment> {
  const computed_at = new Date().toISOString();

  if (!brainSupabaseAvailable()) {
    return insufficient(brain_slug, computed_at, "Supabase unavailable — no data to explain trust.");
  }

  const brain = await getBrainBySlug(brain_slug);
  if (!brain) {
    return insufficient(brain_slug, computed_at, `Brain '${brain_slug}' not found.`);
  }

  const sb = brainSupabase()!;

  const since90d = new Date(Date.now() - 90 * 24 * 60 * 60 * 1000).toISOString();

  const [
    { count: answersTotal },
    { count: answersHighConf },
    { count: answersUnknown },
    { count: recentAnswers },
    { data: primaryCert },
    { count: fieldOutcomes },
    { count: correctOutcomes },
    { count: authorActivity },
  ] = await Promise.all([
    sb.from("hammerex_nex_brain_answers").select("id", { count: "exact", head: true }).eq("brain_slug", brain_slug),
    sb.from("hammerex_nex_brain_answers").select("id", { count: "exact", head: true }).eq("brain_slug", brain_slug).gte("confidence", HIGH_CONFIDENCE),
    sb.from("hammerex_nex_brain_answers").select("id", { count: "exact", head: true }).eq("brain_slug", brain_slug).eq("answer_kind", "unknown"),
    sb.from("hammerex_nex_brain_answers").select("id", { count: "exact", head: true }).eq("brain_slug", brain_slug).gte("answered_at", since90d),
    sb.from("hammerex_nex_brain_certifications").select("id, author_name, expires_at").eq("brain_slug", brain_slug).eq("is_primary", true).eq("status", "active").maybeSingle(),
    sb.from("hammerex_nex_brain_field_outcomes").select("id", { count: "exact", head: true }).eq("brain_slug", brain_slug),
    sb.from("hammerex_nex_brain_field_outcomes").select("id", { count: "exact", head: true }).eq("brain_slug", brain_slug).eq("correct", true),
    sb.from("hammerex_nex_events").select("id", { count: "exact", head: true }).eq("entity_type", "brain_draft").gte("occurred_at", since90d).eq("metadata->>brain_slug", brain_slug),
  ]);

  const total = answersTotal ?? 0;
  const highConf = answersHighConf ?? 0;
  const unknown = answersUnknown ?? 0;
  const outcomes = fieldOutcomes ?? 0;
  const correct = correctOutcomes ?? 0;

  const factors: TrustFactor[] = [];

  // ── Factor 1 · Field outcome agreement ────────────────────────────
  if (outcomes >= 10) {
    const agreement = correct / outcomes;
    if (agreement >= 0.90) {
      factors.push({
        key: "field_agreement",
        label: "Field outcome agreement",
        direction: "raises",
        contribution: `Adds significantly · ${Math.round(agreement * 100)}% agreement across ${outcomes} field outcomes`,
        note: "Professionals reporting real-world outcomes agree with this brain's answers.",
        data_available: true,
      });
    } else {
      factors.push({
        key: "field_agreement",
        label: "Field outcome agreement",
        direction: "reduces",
        contribution: `Reduces trust · only ${Math.round(agreement * 100)}% agreement across ${outcomes} outcomes`,
        note: "Field outcomes are disagreeing with the brain's answers. Review the disagreements to find knowledge gaps or errors.",
        data_available: true,
      });
    }
  } else {
    factors.push({
      key: "field_agreement",
      label: "Field outcome agreement",
      direction: "neutral",
      contribution: "Not enough data to measure yet",
      note: `Field outcomes give the strongest signal of real-world trust. Need at least 10; currently have ${outcomes}.`,
      data_available: false,
    });
  }

  // ── Factor 2 · Confidence distribution ─────────────────────────────
  if (total >= MIN_ANSWERS_FOR_SIGNAL) {
    const highConfRate = highConf / total;
    if (highConfRate >= 0.80) {
      factors.push({
        key: "confidence_dist",
        label: "Answer confidence",
        direction: "raises",
        contribution: `Adds · ${Math.round(highConfRate * 100)}% of answers over ${total} served were high-confidence`,
        note: "The brain is confident in most answers it provides — suggests knowledge coverage matches question demand.",
        data_available: true,
      });
    } else if (highConfRate >= 0.60) {
      factors.push({
        key: "confidence_dist",
        label: "Answer confidence",
        direction: "neutral",
        contribution: `Holds · ${Math.round(highConfRate * 100)}% high-confidence over ${total} answers`,
        note: "Confidence is moderate. Not hurting trust but not compounding it either.",
        data_available: true,
      });
    } else {
      factors.push({
        key: "confidence_dist",
        label: "Answer confidence",
        direction: "reduces",
        contribution: `Reduces · only ${Math.round(highConfRate * 100)}% high-confidence over ${total} answers`,
        note: "Most answers are low-confidence. The brain is either under-authored or the question demand is outside its scope.",
        data_available: true,
      });
    }
  } else {
    factors.push({
      key: "confidence_dist",
      label: "Answer confidence",
      direction: "neutral",
      contribution: `Not enough answered questions yet (${total}/${MIN_ANSWERS_FOR_SIGNAL})`,
      note: "Trust cannot be measured through confidence until the brain has served enough real questions.",
      data_available: false,
    });
  }

  // ── Factor 3 · Unknown rate ────────────────────────────────────────
  if (total >= MIN_ANSWERS_FOR_SIGNAL) {
    const unknownRate = unknown / total;
    if (unknownRate < 0.02) {
      factors.push({
        key: "unknown_rate",
        label: "Unknown rate",
        direction: "raises",
        contribution: `Adds · only ${(unknownRate * 100).toFixed(1)}% of ${total} questions unanswered`,
        note: "The brain rarely admits ignorance — coverage matches demand.",
        data_available: true,
      });
    } else if (unknownRate < 0.10) {
      factors.push({
        key: "unknown_rate",
        label: "Unknown rate",
        direction: "neutral",
        contribution: `Holds · ${(unknownRate * 100).toFixed(1)}% unknown across ${total} questions`,
        note: "Some questions go unanswered. Track them via the Improvement Queue to close gaps.",
        data_available: true,
      });
    } else {
      factors.push({
        key: "unknown_rate",
        label: "Unknown rate",
        direction: "reduces",
        contribution: `Reduces · ${(unknownRate * 100).toFixed(1)}% unknown across ${total} questions`,
        note: "Too many questions go unanswered. Prioritise the Improvement Queue.",
        data_available: true,
      });
    }
  } else {
    factors.push({
      key: "unknown_rate",
      label: "Unknown rate",
      direction: "neutral",
      contribution: `Not enough questions answered to measure (${total}/${MIN_ANSWERS_FOR_SIGNAL})`,
      note: "Unknown rate is the sharpest measurement of coverage-vs-demand, but only meaningful with volume.",
      data_available: false,
    });
  }

  // ── Factor 4 · Certification status ────────────────────────────────
  if (primaryCert) {
    const cert = primaryCert as { author_name: string; expires_at: string | null };
    if (cert.expires_at) {
      const daysToExpiry = Math.round((new Date(cert.expires_at).getTime() - Date.now()) / (24 * 60 * 60 * 1000));
      if (daysToExpiry > CERT_HORIZON_DAYS) {
        factors.push({
          key: "cert_status",
          label: "Certification status",
          direction: "raises",
          contribution: `Adds · certified by ${cert.author_name}, valid for ${daysToExpiry} more days`,
          note: "An active primary certification signals human expert accountability.",
          data_available: true,
        });
      } else {
        factors.push({
          key: "cert_status",
          label: "Certification status",
          direction: "reduces",
          contribution: `Reduces · certification expires in ${daysToExpiry} days`,
          note: `Certification renewal is imminent. Contact ${cert.author_name} to renew before expiry.`,
          data_available: true,
        });
      }
    } else {
      factors.push({
        key: "cert_status",
        label: "Certification status",
        direction: "raises",
        contribution: `Adds · certified by ${cert.author_name} · no expiry`,
        note: "Perpetual certification on file.",
        data_available: true,
      });
    }
  } else {
    factors.push({
      key: "cert_status",
      label: "Certification status",
      direction: "reduces",
      contribution: "Reduces · no active primary certification",
      note: "Add a certified expert as primary author. This is the single strongest lever to raise trust.",
      data_available: true,
    });
  }

  // ── Factor 5 · Author activity (recent 90d) ────────────────────────
  const activity = authorActivity ?? 0;
  if (activity >= 5) {
    factors.push({
      key: "author_activity",
      label: "Author activity",
      direction: "raises",
      contribution: `Adds · ${activity} authoring events in the last 90 days`,
      note: "Active authorship signals the brain is being kept current.",
      data_available: true,
    });
  } else if (activity >= 1) {
    factors.push({
      key: "author_activity",
      label: "Author activity",
      direction: "neutral",
      contribution: `Holds · ${activity} authoring event(s) in the last 90 days`,
      note: "Some authoring activity, not yet a strong signal of ongoing maintenance.",
      data_available: true,
    });
  } else {
    factors.push({
      key: "author_activity",
      label: "Author activity",
      direction: "reduces",
      contribution: "Reduces · no authoring activity in the last 90 days",
      note: "The brain has gone quiet. Silent knowledge is stale knowledge.",
      data_available: true,
    });
  }

  // ── Factor 6 · Production status ───────────────────────────────────
  if (brain.lifecycle_stage === "production") {
    factors.push({
      key: "production",
      label: "Production status",
      direction: "raises",
      contribution: "Adds · brain is in production lifecycle",
      note: "Being in production means the brain has cleared Mission + Principles + Promise requirements.",
      data_available: true,
    });
  } else {
    factors.push({
      key: "production",
      label: "Production status",
      direction: "neutral",
      contribution: `Holds · lifecycle is ${brain.lifecycle_stage}`,
      note: "Trust builds fastest under production usage. Consider promoting when ready.",
      data_available: true,
    });
  }

  // ── Compose ────────────────────────────────────────────────────────
  const raisers = factors.filter((f) => f.direction === "raises");
  const reducers = factors.filter((f) => f.direction === "reduces");
  const available = factors.filter((f) => f.data_available);
  const data_completeness = available.length / factors.length;

  const { score, band, headline } = compose(raisers, reducers, factors.length, data_completeness);

  const what_raises_it_next = pickNextAction(reducers, raisers, factors);

  return {
    brain_slug,
    headline,
    raisers,
    reducers,
    what_raises_it_next,
    score,
    band,
    data_completeness,
    computed_at,
  };
}

// ---------- Composition ----------

function compose(
  raisers: TrustFactor[],
  reducers: TrustFactor[],
  totalFactors: number,
  data_completeness: number
): { score: number | null; band: TrustBand; headline: string } {
  if (data_completeness < 0.4) {
    return {
      score: null,
      band: "insufficient_data",
      headline: `Not enough evidence to score trust yet · ${raisers.length} positive signal(s), ${reducers.length} negative signal(s)`,
    };
  }
  // Simple, transparent, non-magical: raisers each contribute 1 unit,
  // reducers each subtract 1 unit, normalised to 0-100. The score is
  // deliberately un-clever — the EXPLANATION is what matters.
  const netUnits = raisers.length - reducers.length;
  const maxUnits = totalFactors;
  const score = Math.max(0, Math.min(100, Math.round(50 + (netUnits / maxUnits) * 50)));

  const band: TrustBand =
    score >= 85 ? "excellent" :
    score >= 65 ? "good" :
                  "developing";

  const headline =
    band === "excellent" ? `Trust is strong · ${raisers.length} raising, ${reducers.length} reducing.` :
    band === "good"      ? `Trust is building · ${raisers.length} raising, ${reducers.length} reducing.` :
                           `Trust is developing · ${reducers.length} reducer(s) need attention.`;

  return { score, band, headline };
}

function pickNextAction(
  reducers: TrustFactor[],
  raisers: TrustFactor[],
  _all: TrustFactor[]
): string {
  // Priority order (author-driven, per Philip 2026-07-28):
  //   1. Add a primary certification if missing (highest single-lever gain)
  //   2. Address any reducer with data
  //   3. Otherwise cite the most valuable data gap
  const noCert = reducers.find((r) => r.key === "cert_status");
  if (noCert) return "Add an active primary certification. Named expertise creates the largest single trust gain available to this brain.";

  const reducerWithData = reducers.find((r) => r.data_available);
  if (reducerWithData) return `Address the '${reducerWithData.label}' reducer: ${reducerWithData.note}`;

  const missingData = raisers.length === 0 ? "any factor" : "field outcome agreement";
  return `Trust is holding but not compounding. Gather more evidence on ${missingData} to raise the score confidently.`;
}

function insufficient(brain_slug: string, computed_at: string, reason: string): TrustAssessment {
  return {
    brain_slug,
    headline: reason,
    raisers: [],
    reducers: [],
    what_raises_it_next: "Ensure the brain is registered and Supabase is available, then check again.",
    score: null,
    band: "insufficient_data",
    data_completeness: 0,
    computed_at,
  };
}
