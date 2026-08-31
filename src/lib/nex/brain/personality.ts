// src/lib/nex/brain/personality.ts
//
// Stage 3.30 · Phase 23 · Personality (Philip 2026-08-31).
//
// Configurable voice/register. Applies lightweight post-processing
// tweaks to reply text based on a personality profile. Never rewrites
// factual content · never adds claims · never invents preferences.
//
// v1 discipline:
//   · Three profiles: friendly (default) · concise · professional
//   · Post-processes reply text · does NOT re-generate meaning
//   · Only touches connective/opening phrasing · numbers/names/facts
//     are IMMUTABLE (Truth doctrine preserved)
//   · Configurable via OrchestrateOptions.personalityProfile
//   · Attached to response as PersonalityReport for audit
//   · Observational-adjacent v1: text IS transformed but only in
//     safe, bounded ways

export type PersonalityProfile = "friendly" | "concise" | "professional";

export type PersonalityReport = {
  profile: PersonalityProfile;
  transformationsApplied: string[];
  summary: string;
};

export type PersonalityInput = {
  reply: string;
  profile?: PersonalityProfile;
};

export type PersonalityOutput = {
  reply: string;
  report: PersonalityReport;
};

/**
 * Apply personality profile to reply text. Safe transformations only:
 *   friendly (default): passthrough — the composer's baseline is already
 *     friendly. No changes.
 *   concise: strip filler openers, trim honesty-preamble to essentials
 *   professional: replace casual verbs with neutral equivalents; keep
 *     honesty boundaries intact
 *
 * NEVER modifies:
 *   · Numeric claims (14 real listings, 0.88km, etc)
 *   · Named entities (property/seller/product names)
 *   · Honesty boundaries ("I can't book yet", "no price data")
 *   · Provenance citations
 */
export function applyPersonality(input: PersonalityInput): PersonalityOutput {
  const profile: PersonalityProfile = input.profile ?? "friendly";
  const reply = input.reply ?? "";
  const applied: string[] = [];

  let out = reply;

  if (profile === "concise") {
    // Strip common filler openers · keep factual body.
    const beforeLen = out.length;
    out = out
      // "Absolutely — " / "Sure — " / "Got it — " openers
      .replace(/^(Absolutely|Sure|Got it|Of course)[\s—-]+/i, "")
      // "I've got N ..." → "N ..."
      .replace(/^I['']ve got (\d+)/, "$1")
      // Trailing "Want me to ...?" invitation trimmed
      .replace(/\s*(Want me to [^?]+\?)\s*$/i, "");
    if (out.length < beforeLen) applied.push("concise: opener/tail trimmed");
    out = out.trim();
  }

  if (profile === "professional") {
    // Casual verb → neutral. Bounded set.
    const replacements: Array<[RegExp, string]> = [
      [/\bI've got\b/gi, "I have"],
      [/\bI'll\b/gi, "I will"],
      [/\bDo you want\b/gi, "Would you prefer"],
      [/\bWant me to\b/gi, "Would you like me to"],
      [/\bshall I\b/gi, "would you like me to"],
      [/\bcool\b/gi, "acceptable"],
    ];
    let anyChange = false;
    for (const [rx, replacement] of replacements) {
      const before = out;
      out = out.replace(rx, replacement);
      if (out !== before) anyChange = true;
    }
    if (anyChange) applied.push("professional: casual→neutral verbs");
  }

  // Friendly is passthrough · the composer is already friendly.
  if (profile === "friendly" && applied.length === 0) {
    applied.push("friendly: passthrough (composer baseline)");
  }

  return {
    reply: out,
    report: {
      profile,
      transformationsApplied: applied,
      summary: `profile=${profile} · ${applied.length} transformation(s)`,
    },
  };
}
