// Staircase Advisor · flow · field extraction + next-question generation
//
// Field vocabularies constrained to Philip-authored options (Section 4.1
// canonical decisions). Educating-while-asking format (Section 4.2)
// wraps every question. All education snippets trace to Section 8
// evidence sources.

import type { AdvisorState, ProjectType } from "./state";
import {
  INSTALL_LOCATION_BARE_WORD,
  INSTALL_LOCATION_PHRASES,
  INSTALL_LOCATION_VOCAB,
} from "./design-enquiry";

// ─── Field extraction ────────────────────────────────────────────

type FieldUpdates = Partial<Pick<AdvisorState,
  "project_type" | "style" | "timber" | "balustrade" |
  "drawings_available" | "layout" | "available_space" |
  "install_location">>;

export type ExtractionResult = {
  updates:     FieldUpdates;
  corrections: string[];  // G05 · fields the customer explicitly changed (e.g. "actually make it walnut")
};

// G05 · Correction / revision markers (Philip 2026-08-01 · "actually make it
// walnut should feel natural"). When customer signals a change, extraction
// is allowed to overwrite existing state values.
const CORRECTION_PATTERNS: RegExp[] = [
  /\bactually\b/i,
  /\bi\s+meant\b/i,
  /\bchange\s+(that|it)\s+to\b/i,
  /\bmake\s+it\s+[a-z]+\s+instead\b/i,
  /\binstead\s+of\b/i,
  /\brather\s+than\b/i,
  /\bon\s+second\s+thought\b/i,
  /\blet['s]{0,2}\s+(change|switch|make)\s+(that|it)\b/i,
];

function isCorrection(msg: string): boolean {
  return CORRECTION_PATTERNS.some((p) => p.test(msg));
}

// Physical-location values that structurally imply a project_type.
// hallway and landing do NOT imply project_type · they're just install context.
function canProjectTypeFromLocation(loc: string): ProjectType | null {
  switch (loc) {
    case "loft":       return "loft-conversion";
    case "extension":  return "extension";
    case "new-build":  return "new-build";
    case "renovation": return "renovation";
    default:           return null;
  }
}

export function extractFields(message: string, state: AdvisorState): ExtractionResult {
  const msg = message.toLowerCase().trim();
  const correction = isCorrection(msg);
  const updates: FieldUpdates = {};
  const corrections: string[] = [];

  // G05 helper · returns whether to accept an extracted value for this field.
  // Existing (unset) fields always accept · already-set fields only overwrite
  // when the customer signalled a correction ("actually", "instead", etc.).
  const canSet = <K extends keyof FieldUpdates>(key: K): boolean => {
    const existing = (state as AdvisorState)[key as keyof AdvisorState] as FieldUpdates[K] | undefined;
    return existing === undefined || correction;
  };
  // G05 helper · records that a field was corrected (existing → different value)
  const recordCorrection = <K extends keyof FieldUpdates>(key: K, newValue: FieldUpdates[K]): void => {
    const existing = (state as AdvisorState)[key as keyof AdvisorState] as FieldUpdates[K] | undefined;
    if (existing !== undefined && existing !== newValue) {
      corrections.push(String(key));
    }
  };

  // G20/G21 fix 2026-08-01 · context-aware bare-word extraction.
  // When Advisor just asked about balustrade (next_decision_required set)
  // and customer replies with a short bare option word ("glass", "timber",
  // "steel"), extract in the context of the asked question. Same for
  // style and timber. Prevents customer answers from being dropped when
  // they don't use the full "glass balustrade" phrasing.
  if (state.next_decision_required === "balustrade" && !state.balustrade) {
    if (/^(glass)\b/.test(msg))                                    updates.balustrade = "glass";
    else if (/^(timber|wood|wooden|oak\s+spindles?|spindles?)\b/.test(msg)) updates.balustrade = "timber";
    else if (/^(metal|steel|stainless)\b/.test(msg))               updates.balustrade = "metal";
    else if (/^mixed\b/.test(msg))                                 updates.balustrade = "mixed";
  }
  if (state.next_decision_required === "style" && !state.style) {
    if (/^(modern)\b/.test(msg))                                   updates.style = "modern";
    else if (/^(traditional)\b/.test(msg))                         updates.style = "traditional";
    else if (/^(contemporary)\b/.test(msg))                        updates.style = "contemporary";
    else if (/^(minimal|minimalist)\b/.test(msg))                  updates.style = "minimal";
  }
  if (state.next_decision_required === "timber" && !state.timber) {
    if (/^(oak)\b/.test(msg))                                      updates.timber = "oak";
    else if (/^(pine)\b/.test(msg))                                updates.timber = "pine";
    else if (/^(walnut)\b/.test(msg))                              updates.timber = "walnut";
    else if (/^(painted|paint)\b/.test(msg))                       updates.timber = "painted";
    else if (/^(ash)\b/.test(msg))                                 updates.timber = "ash";
  }

  // Philip 2026-08-01 · install_location bare-word extraction · fires when
  // Advisor asked "where will the staircase be installed?" and customer replies
  // "hallway" · "loft" · "extension" · etc. Fixes the "hallway restarts the
  // conversation" bug.
  if (state.next_decision_required === "install_location" && !state.install_location) {
    const bareMatch = msg.match(INSTALL_LOCATION_BARE_WORD);
    if (bareMatch) {
      const key = bareMatch[1].toLowerCase().replace(/\s+/g, " ").trim();
      const canonical = INSTALL_LOCATION_VOCAB[key] ?? "other";
      updates.install_location = canonical;
      // Also fill project_type where it's structurally implied (loft/extension/renovation/new-build)
      // so downstream branch handlers work as before. "hallway" and "landing" do NOT imply a
      // project_type · they're install-location context for an already-planned project.
      if (canProjectTypeFromLocation(canonical) && !state.project_type) {
        updates.project_type = canProjectTypeFromLocation(canonical) as ProjectType;
      }
    }
  }

  // Project type (Pass 3 MANDATORY · Stage 1 threshold)
  // T09 fix 2026-08-01 · broadened new-build vocabulary.
  if (canSet("project_type")) {
    let v: FieldUpdates["project_type"] | undefined;
    if (/\bnew\s+build\b/.test(msg))                                                          v = "new-build";
    else if (/\b(building|constructing|build)\s+(a\s+|my\s+|our\s+)?(new\s+|own\s+)?(house|home)\b/.test(msg))
                                                                                              v = "new-build";
    else if (/\bnew\s+(house|home)\b/.test(msg))                                              v = "new-build";
    else if (/\bself[\s-]?build\b/.test(msg))                                                 v = "new-build";
    else if (/\brenovation|renovate|renovating/.test(msg))                                    v = "renovation";
    else if (/\breplace|replacement/.test(msg))                                               v = "replacement";
    else if (/\bloft\s+conversion|\bin\s+the\s+loft\b/.test(msg))                             v = "loft-conversion";
    else if (/\bextension\b/.test(msg))                                                       v = "extension";
    if (v) { recordCorrection("project_type", v); updates.project_type = v; }
  }

  // Style (Pass 3 MANDATORY · Stage 1 threshold)
  if (canSet("style")) {
    let v: FieldUpdates["style"] | undefined;
    if (/\btraditional|victorian|georgian|4-panel|four-panel/.test(msg)) v = "traditional";
    else if (/\bmodern\b/.test(msg))                       v = "modern";
    else if (/\bcontemporary\b/.test(msg))                 v = "contemporary";
    else if (/\bminimal(ist)?\b/.test(msg))                v = "minimal";
    if (v) { recordCorrection("style", v); updates.style = v; }
  }

  // Timber (OPTIONAL · scoped to Philip-authored species)
  if (canSet("timber")) {
    let v: FieldUpdates["timber"] | undefined;
    if (/\boak\b/.test(msg))              v = "oak";
    else if (/\bpine\b/.test(msg))        v = "pine";
    else if (/\bwalnut\b/.test(msg))      v = "walnut";
    else if (/\bpainted\b/.test(msg))     v = "painted";
    else if (/\bash\b/.test(msg))         v = "ash";
    if (v) { recordCorrection("timber", v); updates.timber = v; }
  }

  // Balustrade (OPTIONAL)
  if (canSet("balustrade")) {
    let v: FieldUpdates["balustrade"] | undefined;
    if (/\bglass\s+balustrade|glass\s+balusters?|glass\s+panels?\b/.test(msg)) v = "glass";
    else if (/\btimber\s+balust(rade|ers?)/.test(msg))     v = "timber";
    else if (/\bmetal\s+balust(rade|ers?)|steel\s+balust/.test(msg)) v = "metal";
    else if (/\bwith\s+glass\b/.test(msg) && /balustr|balust/.test(msg)) v = "glass";
    if (v) { recordCorrection("balustrade", v); updates.balustrade = v; }
  }

  // Philip 2026-08-01 · install_location multi-word phrases (fires regardless
  // of next_decision_required · catches "for a hallway" · "in the entrance" ·
  // "for a loft conversion" · etc.).
  if (canSet("install_location")) {
    for (const [rx, canonical] of INSTALL_LOCATION_PHRASES) {
      if (rx.test(msg)) {
        recordCorrection("install_location", canonical);
        updates.install_location = canonical;
        if (canProjectTypeFromLocation(canonical) && !state.project_type) {
          updates.project_type = canProjectTypeFromLocation(canonical) as ProjectType;
        }
        break;
      }
    }
  }

  // Drawings (OPTIONAL)
  if (state.drawings_available === undefined || correction) {
    let v: boolean | undefined;
    if (/\bi\s+have\s+drawings|got\s+drawings|have\s+architectural\s+drawings\b/.test(msg)) v = true;
    else if (/\bno\s+drawings|don'?t\s+have\s+drawings\b/.test(msg))                        v = false;
    if (v !== undefined) {
      if (state.drawings_available !== undefined && state.drawings_available !== v) {
        corrections.push("drawings_available");
      }
      updates.drawings_available = v;
    }
  }

  return { updates, corrections };
}

// ─── Next-question generation ─────────────────────────────────────

export type NextQuestion = {
  key:           string;
  question_text: string;
  sources:       string[];
};

/** Returns the next question Nex should ask, or null when Stage 1 threshold is met. */
export function nextQuestion(state: AdvisorState): NextQuestion | null {
  // Philip 2026-08-01 · Design-enquiry continuation path.
  // When a design-enquiry set install_location as the next expected answer
  // (e.g. "have you got straight stairs?" → tag next_decision_required =
  // "install_location"), ask about physical location rather than restarting
  // with the mandatory project_type gate. install_location satisfies the same
  // structural purpose (knowing WHERE the staircase goes) as project_type.
  if (state.next_decision_required === "install_location" && !state.install_location) {
    const typeHint = state.design_enquiry_context?.staircase_type;
    const typePhrase = typeHint === "straight"    ? "straight-flight"
                     : typeHint === "quarter-turn" ? "quarter-turn"
                     : typeHint === "half-turn"    ? "half-turn"
                     : typeHint === "spiral"       ? "spiral"
                     : typeHint === "curved"       ? "curved"
                     : typeHint === "floating"     ? "floating"
                     : "";
    const leadIn = typePhrase
      ? `Yes — I have a range of ${typePhrase} staircase designs. `
      : "Yes — I have a range of confirmed staircase designs. ";
    return {
      key: "install_location",
      question_text:
        `${leadIn}Where will the staircase be installed — for example a hallway, loft conversion, extension, renovation or another location?`,
      sources: ["staircase-design-principles.md · Principle A (design must start with the building)"],
    };
  }

  // Anchor entry (Section 4.1) · project_type MANDATORY when no install_location
  // context was captured from a prior design-enquiry.
  if (!state.project_type && !state.install_location) {
    return {
      key: "project_type",
      question_text:
        "Happy to help — a good place to start is what the staircase is for, because different projects need different decisions. Is this for a new build, a renovation, a replacement in your current home, a loft conversion, or an extension?",
      sources: ["staircase-design-principles.md · Principle A (design must start with the building)"],
    };
  }

  // Adaptive ordering (Section 4.1 · "Order may adapt") · if customer
  // volunteered timber but hasn't answered balustrade, ask balustrade next
  // instead of re-asking style. Matches Philip's ideal T09.b flow · G20 aligned.
  // Style still required for Stage 1 threshold · will be asked after balustrade.
  if (state.project_type && state.timber && !state.balustrade && !state.style) {
    const timberNote =
      state.timber === "oak"    ? "Oak treads pair well with either warm timber balusters or clean glass — the choice shapes the whole feel of the staircase."
    : state.timber === "pine"   ? "Pine treads (often painted) usually pair with timber balusters for a classic look, or glass for a lighter modern feel."
    : state.timber === "walnut" ? "Walnut treads pair richly with either dark timber balusters or contrasting glass — both work with the luxury tone."
    :                              `${state.timber.charAt(0).toUpperCase() + state.timber.slice(1)} treads pair with either timber balusters or glass — the choice shapes the whole feel.`;

    return {
      key: "balustrade",
      question_text:
        `${timberNote} Would you prefer timber balusters, glass, stainless steel, or mixed materials?`,
      sources: [
        "nex-knowledge-base-staircase-materials-overview.md · Timber or glass balustrade section",
        "nex-knowledge-base-staircase-design-ideas-and-inspiration.md · Balustrade choices",
      ],
    };
  }

  // Style MANDATORY (Stage 1 threshold)
  // T09 fix 2026-08-01 · personalise based on known project_type + timber so
  // the question doesn't feel like a repeat when the customer volunteered
  // context out-of-turn.
  if (!state.style) {
    let intro = "Most customers know roughly the direction they want the house to feel.";
    // Philip 2026-08-01 · install_location-first intro (design-enquiry continuation)
    if (state.install_location === "hallway") {
      const typeHint = state.design_enquiry_context?.staircase_type;
      const typePhrase = typeHint === "straight" ? "Straight-flight staircases"
                       : typeHint === "quarter-turn" ? "Quarter-turn staircases"
                       : typeHint === "spiral" ? "Spiral staircases"
                       : typeHint === "curved" ? "Curved staircases"
                       : typeHint === "floating" ? "Floating staircases"
                       : "Staircases";
      intro = `Great. For a hallway, ${typePhrase.toLowerCase()} are one of the most popular choices.`;
    } else if (state.install_location === "landing") {
      intro = "Landings often set the tone for the whole upper floor — the staircase style leads into it.";
    } else if (state.project_type === "new-build") {
      intro = "For a new build you usually have more flexibility because the staircase can be designed around the space from the start.";
    } else if (state.project_type === "renovation") {
      intro = "For a renovation the staircase often needs to work with the existing interior style.";
    } else if (state.project_type === "loft-conversion") {
      intro = "For a loft conversion the design usually favours space-efficient styles.";
    }

    let timberNote = "";
    if (state.timber === "oak") {
      timberNote = " Oak is a popular premium choice — it gives warmth and long-term durability.";
    } else if (state.timber === "pine") {
      timberNote = " Pine is a versatile choice — economical and takes paint well.";
    } else if (state.timber === "walnut") {
      timberNote = " Walnut is a darker luxury choice — striking on visible components.";
    } else if (state.timber) {
      timberNote = ` ${state.timber.charAt(0).toUpperCase() + state.timber.slice(1)} is a considered choice — the style still shapes how the staircase feels.`;
    }

    return {
      key: "style",
      question_text:
        `${intro}${timberNote} Traditional homes often pair 4-panel doors with turned newels and a closed-string staircase. Modern homes often pair Shaker or flush doors with square newels and glass balustrades. Which feels closer to what you're building?`,
      sources: [
        "nex-knowledge-base-staircase-design-ideas-and-inspiration.md · Style directions table",
        "staircase-design-principles.md · Principle A",
      ],
    };
  }

  // Stage 1 threshold met · caller composes recommendation
  return null;
}

/** Human-friendly label for a project_type value. */
export function projectPhrase(pt: ProjectType | undefined): string {
  switch (pt) {
    case "new-build":       return "for a new build";
    case "renovation":      return "for a renovation";
    case "replacement":     return "for a replacement staircase";
    case "loft-conversion": return "for a loft conversion";
    case "extension":       return "for an extension";
    default:                return "for your project";
  }
}
