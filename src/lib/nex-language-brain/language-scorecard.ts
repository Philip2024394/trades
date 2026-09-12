// src/lib/nex-language-brain/language-scorecard.ts
//
// NEX1 · LANGUAGE BRAIN · LANGUAGE SCORECARD v1.
//
// taught_by = master_ai_engineer · 2026-09-12
//
// Founder doctrine (locked): "Every supported human/programming language
// has a measurable 0–100 capability scale. NEX1 does not claim fluency
// until it reaches the defined 100% benchmark."
//
// A single percentage across a whole language is not useful. This module
// scores per-language, per-capability-dimension. Dimensions are the
// vocabulary NEX1's language brain uses to describe *what it can and
// cannot do*. Each dimension is measurable from tagged test cases.

/** The four language tracks NEX1 measures. */
export type Nex1LanguageId = "english" | "bahasa_indonesia" | "code_switch" | "programming";

/** 18 capability dimensions the founder specified. */
export type Nex1CapabilityDimension =
  | "vocabulary"
  | "grammar"
  | "syntax"
  | "semantics"
  | "intent"
  | "context"
  | "ambiguity"
  | "idioms"
  | "slang"
  | "spelling_tolerance"
  | "tone"
  | "technical"
  | "programming"
  | "multi_turn"
  | "long_context"
  | "reasoning"
  | "truth_evidence"
  | "safety_refusal";

/** Discrete level bands the founder defined. */
export type Nex1LevelBand =
  | "basic_recognition"       // 0–20%
  | "sentence_understanding"  // 20–40%
  | "context"                 // 40–60%
  | "technical_conversation"  // 60–75%
  | "natural_conversation"    // 75–90%
  | "advanced_fluency"        // 90–99%
  | "fluent";                 // 100% only (must include unseen + regression + adversarial)

export interface Nex1LevelBandInfo {
  readonly band: Nex1LevelBand;
  readonly label: string;
  readonly description: string;
  readonly percent_min: number;
  readonly percent_max: number;
}

export const NEX1_LEVEL_BANDS: readonly Nex1LevelBandInfo[] = [
  { band: "basic_recognition",      label: "Basic recognition",      description: "Understands simple words and commands.",              percent_min: 0,   percent_max: 20 },
  { band: "sentence_understanding", label: "Sentence understanding", description: "Understands normal sentences and extracts basic intent.", percent_min: 20,  percent_max: 40 },
  { band: "context",                label: "Context",                description: "Understands references, follow-ups and conversational context.", percent_min: 40,  percent_max: 60 },
  { band: "technical_conversation", label: "Technical conversation", description: "Understands coding terminology and engineering requests.", percent_min: 60,  percent_max: 75 },
  { band: "natural_conversation",   label: "Natural conversation",   description: "Handles informal language, spelling mistakes, slang, incomplete sentences and corrections.", percent_min: 75,  percent_max: 90 },
  { band: "advanced_fluency",       label: "Advanced fluency",       description: "Handles difficult ambiguity, code-switching, complex instructions and long conversations.", percent_min: 90,  percent_max: 99 },
  { band: "fluent",                 label: "Fluent / proven",        description: "Passes the complete defined benchmark, including unseen and regression tests.", percent_min: 100, percent_max: 100 },
];

/**
 * @summary Map a raw percent to a level band. 100% requires an EXACT 100
 * on the FULL benchmark including hidden + adversarial + regression cases,
 * AND the benchmark itself must be at "proven" maturity (>= 10,000 cases
 * with hidden + adversarial + regression all present). This prevents a
 * small pilot benchmark from being sold as "fluent". Founder doctrine
 * (2026-09-12): "Benchmark size is NEVER the definition of intelligence.
 * A 100% on a pilot floor is a floor, not fluency."
 */
export function classifyLevel(
  percent: number,
  benchmarkComplete: boolean,
  maturity: Nex1BenchmarkMaturity = "pilot",
): Nex1LevelBand {
  if (percent >= 100 && benchmarkComplete && maturity === "proven") return "fluent";
  if (percent >= 90) return "advanced_fluency";
  if (percent >= 75) return "natural_conversation";
  if (percent >= 60) return "technical_conversation";
  if (percent >= 40) return "context";
  if (percent >= 20) return "sentence_understanding";
  return "basic_recognition";
}

/** Per-dimension score for one language. */
export interface Nex1DimensionScoreEntry {
  readonly dimension: Nex1CapabilityDimension;
  readonly points: number;
  readonly max_points: number;
  readonly percent: number;
  readonly case_count: number;
}

/** Coverage indicator per language · founder correction 2026-09-12. */
export interface Nex1LanguageCoverage {
  readonly public: number;
  readonly hidden: number;
  readonly adversarial: number;
  readonly regression: number;
  readonly total: number;
}

/** Explicit maturity label · prevents "small benchmark ≡ mastery" confusion. */
export type Nex1BenchmarkMaturity = "pilot" | "expanding" | "mature" | "proven";

/**
 * @summary Classify benchmark maturity by coverage size + composition.
 * Doctrine (founder-locked 2026-09-12): benchmark size is NEVER the
 * definition of intelligence. Maturity is a floor, not a ceiling.
 *
 *   pilot      · total < 100
 *   expanding  · total < 1,000
 *   mature     · total < 10,000 · hidden > 0 · adversarial > 0
 *   proven     · total >= 10,000 · hidden > 0 · adversarial > 0 · regression > 0
 */
export function classifyMaturity(cov: Nex1LanguageCoverage): Nex1BenchmarkMaturity {
  if (cov.total < 100) return "pilot";
  if (cov.total < 1000) return "expanding";
  if (cov.total < 10000 || cov.hidden === 0 || cov.adversarial === 0) return "mature";
  if (cov.regression === 0) return "mature";
  return "proven";
}

/** Per-language section of the scorecard. */
export interface Nex1LanguageSection {
  readonly language: Nex1LanguageId;
  readonly overall_points: number;
  readonly overall_max: number;
  readonly overall_percent: number;
  readonly level: Nex1LevelBand;
  readonly benchmark_complete: boolean;
  readonly benchmark_maturity: Nex1BenchmarkMaturity;
  readonly coverage: Nex1LanguageCoverage;
  readonly dimensions: readonly Nex1DimensionScoreEntry[];
  readonly case_count: number;
  readonly weak_dimensions: readonly Nex1CapabilityDimension[]; // <=60%
}

/** Full scorecard across all four language tracks. */
export interface Nex1LanguageScorecard {
  readonly at: string;
  readonly sections: readonly Nex1LanguageSection[];
  readonly benchmark_version: string;
  readonly hidden_cases_included: boolean;
  readonly regression_cases_included: boolean;
  readonly adversarial_cases_included: boolean;
  readonly taught_by: "master_ai_engineer";
  readonly independent_authorship_percent: 0; // by construction
}

/**
 * @summary Map a case's tags to which dimensions it exercises. Tags come
 * from the challenge case metadata. A single case can exercise multiple
 * dimensions (e.g. an Indonesian slang case exercises slang + vocabulary
 * + intent + language_detection).
 *
 * This is a deterministic mapping. Growth: adding new tags requires
 * updating this table (auditable).
 */
export function tagsToDimensions(tags: readonly string[]): readonly Nex1CapabilityDimension[] {
  const set = new Set<Nex1CapabilityDimension>();
  for (const t of tags) {
    // Language-track tags (not dimensions themselves · used elsewhere)
    if (t === "english" || t === "indonesian" || t === "code_switch" || t === "programming_lang") continue;
    switch (t) {
      case "add_field":
      case "fix_test":
      case "modify_ui":
      case "refactor":
      case "clarify":
      case "cancel":
      case "acknowledge":
        set.add("intent"); break;
      case "slang":
        set.add("slang"); set.add("vocabulary"); break;
      case "spelling":
      case "typo":
        set.add("spelling_tolerance"); break;
      case "safety":
      case "adversarial":
        set.add("safety_refusal"); break;
      case "underspec":
      case "ambiguous":
        set.add("ambiguity"); break;
      case "reference":
        set.add("context"); set.add("ambiguity"); break;
      case "multi_turn":
        set.add("multi_turn"); set.add("context"); break;
      case "long_context":
        set.add("long_context"); break;
      case "technical":
      case "engineering":
        set.add("technical"); break;
      case "programming_lang_ts":
      case "programming_lang_python":
      case "programming_lang_sql":
      case "programming_lang":
        set.add("programming"); set.add("technical"); break;
      case "idiom":
        set.add("idioms"); set.add("vocabulary"); break;
      case "tone":
      case "polite":
      case "informal":
      case "formal":
        set.add("tone"); break;
      case "grammar":
        set.add("grammar"); break;
      case "syntax":
        set.add("syntax"); break;
      case "semantics":
        set.add("semantics"); break;
      case "vocabulary":
        set.add("vocabulary"); break;
      case "regression":
        // Regression membership · doesn't itself add a dimension
        break;
      case "hidden":
        // Hidden-set membership · not a dimension
        break;
      default:
        // Unknown tags contribute to "intent" as a default (still measured)
        set.add("intent"); break;
    }
  }
  return Array.from(set);
}

/**
 * @summary Given a case's tags, decide which language track it belongs to.
 * A case can only belong to ONE language track (its primary track).
 */
export function tagsToLanguage(tags: readonly string[]): Nex1LanguageId | null {
  if (tags.includes("programming_lang_ts") || tags.includes("programming_lang_python") || tags.includes("programming_lang_sql") || tags.includes("programming_lang")) return "programming";
  if (tags.includes("code_switch")) return "code_switch";
  if (tags.includes("indonesian")) return "bahasa_indonesia";
  if (tags.includes("english")) return "english";
  return null;
}

/**
 * @summary Detect whether a benchmark is "complete" for 100% classification.
 * Requires: hidden cases were included, adversarial cases were included,
 * regression cases were included, and every dimension has at least one
 * measured case.
 */
export function benchmarkComplete(
  hiddenIncluded: boolean,
  adversarialIncluded: boolean,
  regressionIncluded: boolean,
  dims: readonly Nex1DimensionScoreEntry[],
): boolean {
  if (!hiddenIncluded) return false;
  if (!adversarialIncluded) return false;
  if (!regressionIncluded) return false;
  for (const d of dims) {
    if (d.case_count === 0) return false;
  }
  return true;
}
