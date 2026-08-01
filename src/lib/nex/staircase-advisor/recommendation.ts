// Staircase Advisor · Stage 1 direction-shaped recommendation
//
// Fires when Stage 1 threshold is met (project_type + style known).
// Composes using Philip-authored vocabulary · attaches attribution trail
// per Section 5.5 / 8.6. Never emits Stage 2 without layout + branch-
// specific fields (Section 5.2).

import type { AdvisorState } from "./state";
import { projectPhrase } from "./flow";

export type StageOneRecommendation = {
  text:               string;
  sources:            string[];
  confidence:         "evidence-backed" | "partial-evidence" | "trend-tagged";
  recommendation_id:  string;
};

function makeRecommendationId(): string {
  return `advisor-stage1-${Date.now().toString(36)}-${Math.floor(Math.random() * 10000).toString(36)}`;
}

function capitalise(s: string): string {
  if (!s) return s;
  return s.charAt(0).toUpperCase() + s.slice(1);
}

function projectRationale(pt: AdvisorState["project_type"]): string {
  switch (pt) {
    case "new-build":       return "new-build design freedom";
    case "renovation":      return "renovation design starts from the existing structure";
    case "loft-conversion": return "loft conversion access and headroom constraints";
    default:                return "project fits building context";
  }
}

/** Compose a Stage 1 direction-shaped suggestion. Returns null if threshold unmet.
 *  Philip 2026-08-01 · install_location satisfies the project_type prerequisite for
 *  the design-enquiry continuation path (customer entered via "have you got X stairs?"
 *  and answered a physical-location question, not the mandatory project_type gate). */
export function composeStageOne(state: AdvisorState): StageOneRecommendation | null {
  if ((!state.project_type && !state.install_location) || !state.style) return null;

  const proj = state.project_type
    ? projectPhrase(state.project_type)
    : state.install_location === "hallway"  ? "for a hallway installation"
    : state.install_location === "landing"  ? "for a landing installation"
    : state.install_location === "other"    ? "for your project"
    : "for your project";
  const timber  = state.timber ? `${state.timber} ` : "";
  const style   = state.style;

  // G21 · Confidence-building prefix (Philip 2026-08-01)
  // When the recommendation lands after actual questioning (multi-turn),
  // acknowledge the collaborative journey so the customer feels they
  // reached this direction together with Nex · not that Nex just spat
  // out an answer. Skip on single-message skip-ahead (questions=0).
  const confidencePrefix = state.questions_asked_count > 0
    ? "Good — that gives us enough to point at a clear direction. "
    : "";

  // Direction sentence (matches Philip's verbatim Stage 1 pattern:
  // "Modern oak stairs are a strong direction for a new build.")
  let text = `${confidencePrefix}${capitalise(style)} ${timber}stairs are a strong direction ${proj}.`;

  // Named next-best questions (Section 5.1 mandatory shape)
  const gaps: string[] = [];
  if (!state.available_space && state.drawings_available !== true) {
    gaps.push("the available space or whether you have architectural drawings");
  }
  if (!state.balustrade) {
    gaps.push("whether you prefer a more open glass style or a warmer timber balustrade");
  }
  if (!state.layout && gaps.length < 2) {
    gaps.push("the layout that fits your space (straight flight · quarter-turn · half-turn · winder)");
  }

  if (gaps.length > 0) {
    text += ` To narrow this down, I would next like to understand ${gaps.slice(0, 2).join(" and ")}.`;
  } else {
    text += ` Layout and finish details are the natural next step — happy to explore those or connect you with a designer for measurements.`;
  }

  // Attribution trail (Section 5.5 · 8.6)
  const sources: string[] = [];
  sources.push(`staircase-design-principles.md · Principle A (${projectRationale(state.project_type)})`);
  if (state.timber === "oak")     sources.push("wood-intelligence-principles.md · oak · UK default premium timber");
  else if (state.timber === "pine")   sources.push("wood-intelligence-principles.md · pine · UK default painted-staircase timber");
  else if (state.timber === "walnut") sources.push("wood-intelligence-principles.md · walnut · darker luxury appearance");
  else if (state.timber)              sources.push(`wood-intelligence-principles.md · ${state.timber}`);
  if (state.style === "modern")       sources.push("nex-knowledge-base-staircase-design-ideas-and-inspiration.md · Modern-style row");
  else if (state.style === "traditional") sources.push("nex-knowledge-base-staircase-design-ideas-and-inspiration.md · Traditional row");
  else if (state.style === "contemporary") sources.push("nex-knowledge-base-staircase-design-ideas-and-inspiration.md · Contemporary row");

  return {
    text,
    sources,
    confidence:        "evidence-backed",
    recommendation_id: makeRecommendationId(),
  };
}
