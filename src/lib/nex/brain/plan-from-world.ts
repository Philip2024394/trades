// src/lib/nex/brain/plan-from-world.ts
//
// Stage 3.35 · Phase D · Sequenced multi-step planning over live
// World data (Philip 2026-08-31).
//
// CONSTITUTIONAL DOCTRINE:
//
//   A downstream step must NEVER consume an unverified assumption
//   from an upstream step.
//
// If Step 1 picks a hotel but the record's coordinates are missing,
// Step 2 (transport-from-that-hotel) is BLOCKED with an honest reason
// — never falls back to guessed coordinates.
//
// Concrete rules:
//   1. Multi-step message → PlanStep[] · sequential execution.
//   2. Each step declares its `requiredInputs` (which upstream fields
//      it depends on).
//   3. Between steps, the planner verifies the upstream step's output
//      actually contains each required input.
//   4. Missing input → status: "blocked" · reason: "required <input>
//      unavailable from step <N>" · downstream steps also skipped.
//   5. Never guesses. Never fabricates coordinates / prices / IDs to
//      unblock a downstream step.
//   6. WorldPlan report enumerates every step with status +
//      dependency chain so Reflection + tests can audit.

import type { WorldRecord, WorldVertical } from "./world-adapters/types";
import type { WorldRecommendation } from "./recommend-from-world";
import type { WorldReasoning } from "./reason-from-world";

// ─── Step + Plan types ──────────────────────────────────────────────

export type PlanStepKind = "accommodation_search" | "food_search" | "commerce_search" | "service_search" | "transport_search";

/**
 * Fields a step needs from an UPSTREAM step's picked entity to
 * proceed. When a required field is missing on the upstream pick, the
 * downstream step is BLOCKED · never guessed.
 */
export type StepInputRequirement =
  | { from: string; field: "coordinates"; usedAs: "origin" | "destination" }
  | { from: string; field: "address"; usedAs: "origin" | "destination" }
  | { from: string; field: "city"; usedAs: "origin" | "destination" }
  | { from: string; field: "id"; usedAs: "reference" };

export type PlanStep = {
  id: string;                       // "step1" · "step2" · human-readable
  kind: PlanStepKind;
  vertical: WorldVertical;
  /** Human-readable description for the plan report. */
  description: string;
  /** Slots extracted for this step from the message ({city, area, budget, etc}). */
  slots: {
    city?: string;
    area?: string;
    category?: string;
    budget?: "budget" | "mid" | "luxury";
    query?: string;
    when?: string;                  // "tonight" · "tomorrow morning" · date phrase
  };
  /** Zero or more requirements this step needs from upstream steps. */
  requiredInputs: readonly StepInputRequirement[];
};

export type StepStatus =
  | { kind: "pending" }
  | { kind: "executing" }
  | { kind: "completed"; pick: WorldRecord; recordsConsidered: number }
  | { kind: "blocked"; reason: string; blockingStep?: string; blockingField?: string }
  | { kind: "skipped"; reason: "upstream_blocked"; blockingStep: string }
  | { kind: "no_matches"; reason: string };

export type PlanStepReport = {
  step: PlanStep;
  status: StepStatus;
};

export type WorldPlan =
  | {
      planned: true;
      steps: readonly PlanStepReport[];
      /** True when EVERY step completed successfully · false when any
       *  step was blocked or had no matches. */
      allCompleted: boolean;
      replyText: { en: string; id: string };
    }
  | {
      planned: false;
      reason: "no_steps_extracted" | "single_step_only";
      message: { en: string; id: string };
    };

// ─── Multi-step message decomposition ───────────────────────────────

// Sequence connectors that indicate the user wants two things done
// in order. Bilingual EN + ID.
const SEQUENCE_MARKERS: RegExp[] = [
  /\bthen\b/i,
  /\band\s+then\b/i,
  /\bafter\s+that\b/i,
  /\bnext\b/i,
  /\bfollowed\s+by\b/i,
  /\blalu\b/i,
  /\bkemudian\b/i,
  /\bsetelah\s+itu\b/i,
  /\bterus\b/i,
];

// Verticals we can plan over today.
//
// ORDERING MATTERS: transport + service + commerce + food are checked
// BEFORE accommodation because a transport substring may reference
// "hotel" as an origin/destination ("transport from the hotel to the
// airport"). Accommodation is checked last so it only wins when the
// substring doesn't already match a more specific vertical.
const VERTICAL_TRIGGERS: Array<{ vertical: WorldVertical; kind: PlanStepKind; markers: RegExp[] }> = [
  { vertical: "transport", kind: "transport_search",
    markers: [/\b(transport|ride|driver|taxi|ojek|car|airport|bandara|antar|jemput)\b/i] },
  { vertical: "service", kind: "service_search",
    markers: [/\b(dentist|doctor|plumber|electrician|clinic|repair|jasa)\b/i] },
  { vertical: "commerce", kind: "commerce_search",
    markers: [/\b(headphones?|phone|laptop|computer|camera|tv|monitor|buy|beli\s+\w+)\b/i] },
  { vertical: "food", kind: "food_search",
    markers: [/\b(restaurant|cafe|coffee|warung|makan|food|gudeg|nasi|sate|dinner|lunch|breakfast)\b/i] },
  { vertical: "accommodation", kind: "accommodation_search",
    markers: [/\b(hotel|guesthouse|guest\s?house|homestay|hostel|villa|resort|kos|lodging|accommodation|penginapan|akomodasi)\b/i,
              /\b(where\s+to\s+stay|place\s+to\s+stay|tempat\s+menginap)\b/i] },
];

/**
 * Detect whether the message describes a multi-step request. When
 * yes, split into per-step substrings on the sequence connector so
 * each substring can be parsed for its own vertical + slots.
 */
export function detectMultiStep(message: string): readonly string[] {
  for (const rx of SEQUENCE_MARKERS) {
    const m = message.match(rx);
    if (m && m.index != null) {
      const left  = message.slice(0, m.index).trim();
      const right = message.slice(m.index + m[0].length).trim();
      if (left.length > 3 && right.length > 3) {
        return [left, right];
      }
    }
  }
  return [];
}

/**
 * Very lightweight per-substring vertical + slots extraction. Reuses
 * the shape the wrapper already builds for single-step queries but
 * doesn't call classifier/slot-extractor (keeps this module
 * side-effect-free · testable in isolation).
 */
export function parsePlanSteps(message: string): readonly PlanStep[] {
  const parts = detectMultiStep(message);
  if (parts.length < 2) return [];

  const steps: PlanStep[] = [];
  for (let i = 0; i < parts.length; i++) {
    const part = parts[i];
    // Find the first vertical whose markers match this part.
    const match = VERTICAL_TRIGGERS.find((v) => v.markers.some((rx) => rx.test(part)));
    if (!match) continue;   // silently skip un-parseable step (planner reports if 0 steps)

    // Slot extraction · minimal: city (Yogyakarta), area, when.
    const city = /\b(jogja|jogjakarta|yogyakarta)\b/i.test(part) ? "Yogyakarta"
               : /\bbali\b/i.test(part) ? "Bali"
               : /\bjakarta\b/i.test(part) ? "Jakarta"
               : undefined;
    const areaMatch = part.match(/\b(malioboro|prawirotaman|kraton|kotagede|tugu|gondomanan)\b/i);
    const area = areaMatch?.[1]?.toLowerCase();
    const whenMatch = part.match(/\b(tonight|tomorrow|besok|malam\s+ini|hari\s+ini|next\s+week)\b/i);
    const when = whenMatch?.[0]?.toLowerCase();

    // Requirements: transport step depends on prior accommodation
    // step for `coordinates` as origin. This is the constitutional
    // constraint · downstream must not fabricate the origin.
    const requiredInputs: StepInputRequirement[] = [];
    if (match.vertical === "transport" && steps.length > 0) {
      const prior = steps[steps.length - 1];
      // Only chain when the prior step is a locatable pick.
      if (["accommodation", "food", "service"].includes(prior.vertical)) {
        requiredInputs.push({ from: prior.id, field: "coordinates", usedAs: "origin" });
      }
    }

    steps.push({
      id: `step${i + 1}`,
      kind: match.kind,
      vertical: match.vertical,
      description: describeStep(match.vertical, city, area, when),
      slots: { city, area, when },
      requiredInputs,
    });
  }
  return steps;
}

function describeStep(v: WorldVertical, city?: string, area?: string, when?: string): string {
  const nouns: Partial<Record<WorldVertical, string>> = {
    accommodation: "place to stay",
    food: "place to eat",
    commerce: "product",
    service: "service provider",
    transport: "transport",
  };
  const bits: string[] = [`Find ${nouns[v] ?? "match"}`];
  if (area) bits.push(`near ${area}`);
  else if (city) bits.push(`in ${city}`);
  if (when) bits.push(`(${when})`);
  return bits.join(" ");
}

// ─── Plan execution ─────────────────────────────────────────────────

/**
 * Execute a plan sequentially. Each step is either:
 *   · completed with a `pick` (verified · downstream can use its fields)
 *   · blocked because a required upstream input is missing (never guess)
 *   · skipped because a prior step blocked (cascade)
 *   · no_matches when the adapter returned zero records
 *
 * The `stepExecutor` callback abstracts "how a step runs" so tests
 * can inject a mock. In production the wrapper passes a real executor
 * that calls searchWorld + reasonFromWorld/recommendFromWorld.
 */
export async function executePlan(input: {
  steps: readonly PlanStep[];
  /** Runs one step against the World · returns records + optional pick. */
  stepExecutor: (step: PlanStep, priorPicks: Readonly<Record<string, WorldRecord>>) => Promise<{
    records: readonly WorldRecord[];
    pick?: WorldRecord;
    reasoning?: WorldReasoning;
    recommendation?: WorldRecommendation;
  }>;
}): Promise<WorldPlan> {
  if (input.steps.length === 0) {
    return {
      planned: false, reason: "no_steps_extracted",
      message: {
        en: "I couldn't parse this into a multi-step plan. Try describing each step, e.g. 'find me a hotel, then transport to the airport'.",
        id: "Saya tidak bisa memecah permintaan ini jadi rencana multi-langkah. Coba deskripsikan tiap langkah, misal 'cari hotel, lalu transport ke bandara'.",
      },
    };
  }
  if (input.steps.length === 1) {
    return {
      planned: false, reason: "single_step_only",
      message: {
        en: "This looks like a single-step request · use the regular search flow.",
        id: "Ini permintaan satu langkah · gunakan alur pencarian biasa.",
      },
    };
  }

  const reports: PlanStepReport[] = [];
  const priorPicks: Record<string, WorldRecord> = {};
  let anyBlocked = false;

  for (const step of input.steps) {
    // Cascade skip: prior step blocked → this one skipped.
    if (anyBlocked) {
      const blockingReport = reports.find((r) => r.status.kind === "blocked");
      reports.push({
        step,
        status: {
          kind: "skipped",
          reason: "upstream_blocked",
          blockingStep: blockingReport?.step.id ?? "unknown",
        },
      });
      continue;
    }

    // Verify required inputs from upstream picks BEFORE executing.
    let blockedReason: string | undefined;
    let blockingStep: string | undefined;
    let blockingField: string | undefined;
    for (const req of step.requiredInputs) {
      const upstream = priorPicks[req.from];
      if (!upstream) {
        blockedReason = `required ${req.field} unavailable · upstream step ${req.from} did not complete with a pick`;
        blockingStep = req.from;
        blockingField = req.field;
        break;
      }
      if (req.field === "coordinates" && (upstream.latitude == null || upstream.longitude == null)) {
        blockedReason = `required coordinates unavailable · upstream step ${req.from} picked "${upstream.name}" but the record has no coordinates published`;
        blockingStep = req.from;
        blockingField = req.field;
        break;
      }
      if (req.field === "address" && !upstream.address) {
        blockedReason = `required address unavailable · upstream step ${req.from} picked "${upstream.name}" but the record has no address published`;
        blockingStep = req.from;
        blockingField = req.field;
        break;
      }
      if (req.field === "city" && !upstream.city) {
        blockedReason = `required city unavailable · upstream step ${req.from} pick has no city`;
        blockingStep = req.from;
        blockingField = req.field;
        break;
      }
    }
    if (blockedReason) {
      reports.push({
        step,
        status: {
          kind: "blocked",
          reason: blockedReason,
          blockingStep,
          blockingField,
        },
      });
      anyBlocked = true;
      continue;
    }

    // All inputs verified · execute the step.
    reports.push({ step, status: { kind: "executing" } });
    try {
      const result = await input.stepExecutor(step, priorPicks);
      if (result.pick) {
        priorPicks[step.id] = result.pick;
        reports[reports.length - 1] = {
          step,
          status: { kind: "completed", pick: result.pick, recordsConsidered: result.records.length },
        };
      } else if (result.records.length === 0) {
        reports[reports.length - 1] = {
          step,
          status: { kind: "no_matches", reason: `adapter returned zero records for ${step.description}` },
        };
        anyBlocked = true;
      } else {
        // Records exist but no explicit pick · treat top record as pick.
        priorPicks[step.id] = result.records[0];
        reports[reports.length - 1] = {
          step,
          status: { kind: "completed", pick: result.records[0], recordsConsidered: result.records.length },
        };
      }
    } catch (err) {
      const detail = err instanceof Error ? err.message : String(err);
      reports[reports.length - 1] = {
        step,
        status: {
          kind: "blocked",
          reason: `step execution failed: ${detail}`,
          blockingStep: step.id,
        },
      };
      anyBlocked = true;
    }
  }

  const allCompleted = reports.every((r) => r.status.kind === "completed");
  const replyText = composePlanReply(reports, allCompleted);

  return {
    planned: true,
    steps: reports,
    allCompleted,
    replyText,
  };
}

// ─── Reply composition ──────────────────────────────────────────────

function composePlanReply(reports: readonly PlanStepReport[], allCompleted: boolean): { en: string; id: string } {
  const en: string[] = [];
  const id: string[] = [];

  if (allCompleted) {
    en.push(`I put together a ${reports.length}-step plan for you:`);
    id.push(`Saya susun rencana ${reports.length} langkah:`);
  } else {
    en.push(`Here's what I could put together · some steps blocked because upstream evidence was missing:`);
    id.push(`Berikut yang bisa saya susun · beberapa langkah diblokir karena bukti langkah sebelumnya kurang:`);
  }

  for (const r of reports) {
    const label = `${r.step.id.replace("step", "Step ")} · ${r.step.description}`;
    const labelId = `${r.step.id.replace("step", "Langkah ")} · ${r.step.description}`;
    if (r.status.kind === "completed") {
      en.push(`${label} → ${r.status.pick.name} (${r.status.recordsConsidered} candidates considered).`);
      id.push(`${labelId} → ${r.status.pick.name} (${r.status.recordsConsidered} kandidat dipertimbangkan).`);
    } else if (r.status.kind === "blocked") {
      en.push(`${label} → BLOCKED · ${r.status.reason}.`);
      id.push(`${labelId} → DIBLOKIR · ${r.status.reason}.`);
    } else if (r.status.kind === "skipped") {
      en.push(`${label} → SKIPPED · ${r.status.blockingStep} did not complete, so this step could not proceed.`);
      id.push(`${labelId} → DILEWATI · ${r.status.blockingStep} tidak selesai, jadi langkah ini tidak bisa berjalan.`);
    } else if (r.status.kind === "no_matches") {
      en.push(`${label} → NO MATCHES · ${r.status.reason}.`);
      id.push(`${labelId} → TIDAK ADA HASIL · ${r.status.reason}.`);
    }
  }

  if (!allCompleted) {
    en.push(`I never guess when required evidence is missing. Tell me more about what to try next or which step to loosen.`);
    id.push(`Saya tidak menebak saat bukti yang dibutuhkan tidak ada. Ceritakan langkah mana yang mau dilonggarkan.`);
  }

  return { en: en.join(" "), id: id.join(" ") };
}
