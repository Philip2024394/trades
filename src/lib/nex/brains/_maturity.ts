// src/lib/nex/brains/_maturity.ts
//
// The Maturity Ladder · Phase 2 observability (ADR-0038 + Philip 2026-07-28)
//
// HARD LAW · levels 0-4 are the ONLY levels defined at platform level.
// Levels 5-7 are placeholders that MUST be discovered from real-world
// evidence gathered by the Staircase Brain, never invented in advance.
// "The platform should discover what makes a Reference Brain, not
// invent it."
//
// The evaluator returns:
//   - current_level (0-7)
//   - current_level_name
//   - requirements_for_next (concrete, met/unmet)
//   - reason_for_current_level
//   - deferred_levels (5-7 marked TBD until earned)
//
// Consumers: Control Centre Maturity section · Trust Dashboard ·
// Improvement Queue.

import { brainSupabase, brainSupabaseAvailable, getBrainBySlug } from "./_supabase";

export type MaturityLevel = 0 | 1 | 2 | 3 | 4 | 5 | 6 | 7;

export type MaturityRequirement = {
  key: string;
  description: string;
  met: boolean;
  detail: string; // human-readable current state ("2 drafts exist", "no certification on file", …)
};

export type MaturityLevelDefinition = {
  level: MaturityLevel;
  name: string;
  status: "locked" | "tbd";     // TBD levels have no defined requirements yet
  requirements: MaturityRequirement[] | null;
};

export type MaturityAssessment = {
  brain_slug: string;
  current_level: MaturityLevel;
  current_level_name: string;
  next_level: MaturityLevel | null;
  next_level_name: string | null;
  requirements_for_next: MaturityRequirement[] | null;
  reason_for_current_level: string;
  deferred_levels: Array<{ level: MaturityLevel; name: string; note: string }>;
  computed_at: string;
};

const LEVEL_NAMES: Record<MaturityLevel, string> = {
  0: "Prototype",
  1: "Authoring",
  2: "Reviewed",
  3: "Certified",
  4: "Production",
  5: "Trusted Reference",
  6: "Industry Standard",
  7: "Reference Authority",
};

const DEFERRED_NOTE =
  "Criteria to be defined based on real-world experience with the Staircase Brain · Philip 2026-07-28.";

// ---------- Public API ----------

export async function computeMaturity(brain_slug: string): Promise<MaturityAssessment> {
  const computed_at = new Date().toISOString();

  if (!brainSupabaseAvailable()) {
    return emptyAssessment(brain_slug, computed_at, "Supabase unavailable");
  }

  const brain = await getBrainBySlug(brain_slug);
  if (!brain) {
    return emptyAssessment(brain_slug, computed_at, `Brain '${brain_slug}' not found`);
  }

  const sb = brainSupabase()!;
  const [{ count: draftsCount }, { count: reviewsCount }, { data: primaryCert }] = await Promise.all([
    sb.from("hammerex_nex_brain_drafts").select("id", { count: "exact", head: true }).eq("brain_slug", brain_slug),
    sb.from("hammerex_nex_brain_review_actions").select("id", { count: "exact", head: true }).eq("brain_slug", brain_slug),
    sb.from("hammerex_nex_brain_certifications").select("id, author_name, expires_at").eq("brain_slug", brain_slug).eq("is_primary", true).eq("status", "active").maybeSingle(),
  ]);

  // Requirements for each locked level (0-4) evaluated against current state.
  const level0Reqs: MaturityRequirement[] = [
    { key: "brain_exists", description: "Brain row exists in registry", met: true, detail: `slug=${brain.slug}` },
  ];

  const level1Reqs: MaturityRequirement[] = [
    { key: "has_drafts", description: "At least one draft has been created", met: (draftsCount ?? 0) >= 1, detail: `${draftsCount ?? 0} draft(s)` },
  ];

  const level2Reqs: MaturityRequirement[] = [
    { key: "review_completed", description: "At least one review action has been recorded", met: (reviewsCount ?? 0) >= 1, detail: `${reviewsCount ?? 0} review action(s)` },
  ];

  const level3Reqs: MaturityRequirement[] = [
    { key: "active_primary_cert", description: "Active primary certification on file", met: !!primaryCert, detail: primaryCert ? `by ${(primaryCert as { author_name: string }).author_name}` : "no active primary certification" },
  ];

  const level4Reqs: MaturityRequirement[] = [
    { key: "lifecycle_production", description: "lifecycle_stage = production", met: brain.lifecycle_stage === "production", detail: `lifecycle_stage=${brain.lifecycle_stage}` },
    { key: "mission_set", description: "Mission statement present", met: !!(brain.mission && brain.mission.trim().length > 0), detail: brain.mission ? "set" : "not set" },
    { key: "principles_set", description: "At least one principle declared", met: (brain.principles ?? []).length > 0, detail: `${(brain.principles ?? []).length} principle(s)` },
    { key: "promise_set", description: "At least one will_do promise declared", met: (brain.promise?.will_do ?? []).length > 0, detail: `${(brain.promise?.will_do ?? []).length} will_do commitment(s)` },
  ];

  const allReqs: Array<{ level: MaturityLevel; reqs: MaturityRequirement[] }> = [
    { level: 0, reqs: level0Reqs },
    { level: 1, reqs: level1Reqs },
    { level: 2, reqs: level2Reqs },
    { level: 3, reqs: level3Reqs },
    { level: 4, reqs: level4Reqs },
  ];

  // Advance through locked levels while every requirement is met.
  let current_level: MaturityLevel = 0;
  let firstUnmetLevel: MaturityLevel | null = null;
  for (const { level, reqs } of allReqs) {
    const allMet = reqs.every((r) => r.met);
    if (allMet) {
      current_level = level;
    } else {
      firstUnmetLevel = level;
      break;
    }
  }

  const next_level: MaturityLevel | null = firstUnmetLevel !== null
    ? firstUnmetLevel
    : (current_level < 4 ? ((current_level + 1) as MaturityLevel) : null);

  const requirements_for_next = next_level !== null
    ? allReqs.find((x) => x.level === next_level)?.reqs ?? null
    : null;

  const reason_for_current_level = buildReasonForCurrentLevel(current_level, allReqs);

  const deferred_levels: MaturityAssessment["deferred_levels"] = [
    { level: 5, name: LEVEL_NAMES[5], note: DEFERRED_NOTE },
    { level: 6, name: LEVEL_NAMES[6], note: DEFERRED_NOTE },
    { level: 7, name: LEVEL_NAMES[7], note: DEFERRED_NOTE },
  ];

  return {
    brain_slug,
    current_level,
    current_level_name: LEVEL_NAMES[current_level],
    next_level,
    next_level_name: next_level !== null ? LEVEL_NAMES[next_level] : null,
    requirements_for_next,
    reason_for_current_level,
    deferred_levels,
    computed_at,
  };
}

// ---------- Level catalogue for UI (all 8 levels, 5-7 marked TBD) ----------

export function getMaturityLadderCatalogue(): MaturityLevelDefinition[] {
  return ([0, 1, 2, 3, 4, 5, 6, 7] as MaturityLevel[]).map((level) => ({
    level,
    name: LEVEL_NAMES[level],
    status: level <= 4 ? "locked" : "tbd",
    requirements: level <= 4 ? placeholderReqsForLevel(level) : null,
  }));
}

function placeholderReqsForLevel(level: MaturityLevel): MaturityRequirement[] {
  // Description-only versions of the requirements, no live state.
  // Used by the catalogue view; the assessment fills in live state.
  switch (level) {
    case 0: return [{ key: "brain_exists", description: "Brain row exists in registry", met: false, detail: "" }];
    case 1: return [{ key: "has_drafts", description: "At least one draft created", met: false, detail: "" }];
    case 2: return [{ key: "review_completed", description: "At least one review action recorded", met: false, detail: "" }];
    case 3: return [{ key: "active_primary_cert", description: "Active primary certification on file", met: false, detail: "" }];
    case 4: return [
      { key: "lifecycle_production", description: "lifecycle_stage = production", met: false, detail: "" },
      { key: "mission_set",          description: "Mission statement present",  met: false, detail: "" },
      { key: "principles_set",       description: "At least one principle declared", met: false, detail: "" },
      { key: "promise_set",          description: "At least one will_do promise declared", met: false, detail: "" },
    ];
    default: return [];
  }
}

// ---------- Helpers ----------

function emptyAssessment(brain_slug: string, computed_at: string, reason: string): MaturityAssessment {
  return {
    brain_slug,
    current_level: 0,
    current_level_name: LEVEL_NAMES[0],
    next_level: 1,
    next_level_name: LEVEL_NAMES[1],
    requirements_for_next: placeholderReqsForLevel(1),
    reason_for_current_level: reason,
    deferred_levels: [
      { level: 5, name: LEVEL_NAMES[5], note: DEFERRED_NOTE },
      { level: 6, name: LEVEL_NAMES[6], note: DEFERRED_NOTE },
      { level: 7, name: LEVEL_NAMES[7], note: DEFERRED_NOTE },
    ],
    computed_at,
  };
}

function buildReasonForCurrentLevel(current: MaturityLevel, allReqs: Array<{ level: MaturityLevel; reqs: MaturityRequirement[] }>): string {
  if (current === 0) return "New brain · no drafts, reviews, or certifications yet.";
  const summary = allReqs
    .filter((x) => x.level <= current)
    .flatMap((x) => x.reqs)
    .filter((r) => r.met)
    .map((r) => r.description)
    .join(" · ");
  return `Advanced to ${LEVEL_NAMES[current]} because: ${summary}.`;
}
