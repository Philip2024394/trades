// NEX Comms Centre · Social · claim taxonomy classifier.
//
// Charter §S-III enforces a claim taxonomy with six classes. The
// classifier is rule-based in Phase 2 (deterministic · auditable). An
// LLM-based classifier is a Phase 3 add-on and MUST be validator-side,
// never generator-side (per S-III "Fact-checker distinct from Generator").
//
// Rules load from the versioned data files:
//   data/nex-comms-social/forbidden-claims-v1.json
//   data/nex-comms-social/subjective-descriptors-whitelist-v1.json
//
// The lists are the operational implementation of the two PROPOSAL docs.
// Additions require Philip approval + a corresponding doc update; the
// safety-ratchet allows removals without approval.

import { readFileSync } from "node:fs";
import { join } from "node:path";
import type { ClaimClass, ExtractedClaim } from "./types";

// ── Load rule sets at module init ─────────────────────────────

interface ForbiddenPattern { match: string; reason: string }
interface ForbiddenCategory {
  category: string;
  enforcement: "hard_block" | "review_required";
  patterns: ForbiddenPattern[];
}
interface ForbiddenClaimsData {
  version: string;
  categories: ForbiddenCategory[];
}
interface WhitelistData {
  version: string;
  green_visual_character: string[];
  green_style_family: string[];
  green_room_feel: string[];
  green_neutral_positive: string[];
  green_colour_family: string[];
  amber_context_gated: Array<{
    term: string;
    unlock_source_kind: string;
    unlock_field: string;
    unlock_value: unknown;
  }>;
  explicit_reject: string[];
}

const DATA_DIR = join(process.cwd(), "data", "nex-comms-social");

let forbiddenData: ForbiddenClaimsData | null = null;
let whitelistData: WhitelistData | null = null;

function loadForbidden(): ForbiddenClaimsData {
  if (forbiddenData) return forbiddenData;
  const raw = readFileSync(join(DATA_DIR, "forbidden-claims-v1.json"), "utf8");
  forbiddenData = JSON.parse(raw) as ForbiddenClaimsData;
  return forbiddenData;
}
function loadWhitelist(): WhitelistData {
  if (whitelistData) return whitelistData;
  const raw = readFileSync(join(DATA_DIR, "subjective-descriptors-whitelist-v1.json"), "utf8");
  whitelistData = JSON.parse(raw) as WhitelistData;
  return whitelistData;
}

// Category → claim class mapping.
const CATEGORY_TO_CLASS: Record<string, ClaimClass> = {
  guarantees_warranties:              "factual",              // treated as factual + hard-block if unbacked
  qualifications_credentials:         "implicit_qualification",
  comparative_superlative:            "comparative",
  pricing_offers:                     "urgency_scarcity",
  safety_regulatory:                  "factual",
  environmental_green:                "factual",
  review_required_needs_evidence:     "social_proof",
  hashtags_implicit_credential:       "implicit_qualification",
};

export interface ClassifyInput {
  caption:      string;
  hashtags:     string[];
  cta:          string | null;
}

export interface ClassifyResult {
  claims:       ExtractedClaim[];
  hard_blocks:  number;
  review_flags: number;
  ok:           boolean;
}

// Scan a caption + hashtags + CTA for pattern matches. Returns a set
// of extracted claims, each with class + enforcement level. Grounding
// (whether the claim resolves to a source) is done separately by the
// grounding validator — this classifier only assigns class.
export function classifyClaims(input: ClassifyInput): ClassifyResult {
  const forbidden = loadForbidden();
  const whitelist = loadWhitelist();
  const claims: ExtractedClaim[] = [];
  const fullText = [input.caption, input.hashtags.join(" "), input.cta ?? ""].join(" \n ");

  // Pass 1 · forbidden claims (all classes end up here first).
  for (const cat of forbidden.categories) {
    for (const pat of cat.patterns) {
      const re = new RegExp(pat.match, "gi");
      let m: RegExpExecArray | null;
      while ((m = re.exec(fullText)) !== null) {
        claims.push({
          text:         m[0],
          class:        CATEGORY_TO_CLASS[cat.category] ?? "factual",
          grounded:     false,
          source_ref:   null,
          reason:       `${cat.category}: ${pat.reason}`,
          enforcement:  cat.enforcement,
        });
      }
    }
  }

  // Pass 2 · explicit-reject descriptors (subjective words NOT on whitelist).
  const rejectWords = new Set(whitelist.explicit_reject.map((s) => s.toLowerCase()));
  const wordRegex = /\b[a-z][a-z\-']{2,}\b/gi;
  const seen = new Set<string>();
  let w: RegExpExecArray | null;
  while ((w = wordRegex.exec(fullText)) !== null) {
    const raw = w[0];
    const norm = raw.toLowerCase();
    if (seen.has(norm)) continue;
    seen.add(norm);
    if (rejectWords.has(norm)) {
      claims.push({
        text:        raw,
        class:       "subjective_descriptor",
        grounded:    false,
        source_ref:  null,
        reason:      "descriptor is on explicit_reject list · would autopublish an unauthorised quality/credential/absolute/comparative claim",
        enforcement: "hard_block",
      });
    }
  }

  const hard_blocks  = claims.filter((c) => c.enforcement === "hard_block").length;
  const review_flags = claims.filter((c) => c.enforcement === "review_required").length;
  return { claims, hard_blocks, review_flags, ok: hard_blocks === 0 && review_flags === 0 };
}

// Exposed for the generator so it can pre-check descriptor whitelist
// membership before emitting a word.
export function isGreenDescriptor(word: string): boolean {
  const w = loadWhitelist();
  const norm = word.toLowerCase();
  return (
    w.green_visual_character.includes(norm) ||
    w.green_style_family.includes(norm) ||
    w.green_room_feel.includes(norm) ||
    w.green_neutral_positive.includes(norm) ||
    w.green_colour_family.includes(norm)
  );
}

// Test-only: reset the module-scoped caches so a test can swap data files.
export const __resetClaimCachesForTests = () => {
  forbiddenData = null;
  whitelistData = null;
};
