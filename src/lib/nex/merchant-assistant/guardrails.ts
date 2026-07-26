// NEX Merchant Assistant — content guardrails.
//
// Code-level validation applied to every AI-generated field BEFORE it
// reaches any product / offer / banner storage. Prompt-only defence is
// insufficient — this file is where the trust promises from the
// Business Listing Trust Architecture become enforceable rules.
//
// Reference: docs/brains/nex-business-listing-and-trust-architecture.md
// Reference: docs/brains/PHASE_7_IMPLEMENTATION_PLAN.md · Section 9.2
//
// Every guardrail rejection is surfaced to the merchant with a plain-
// language reason so they can rephrase the claim rather than being
// silently blocked.

export type GuardrailResult =
  | { ok: true }
  | { ok: false; reason: string; matched: string };

/** Certification / accreditation phrases that require evidence on the
 *  merchant record. If the merchant has not registered the credential
 *  in their listing, the AI cannot invent it. */
const CERTIFICATION_PHRASES = [
  "BSI-approved",
  "BSI approved",
  "ISO-certified",
  "ISO certified",
  "ISO 9001",
  "TrustMark verified",
  "TrustMark approved",
  "TrustMark member",
  "FMB approved",
  "FMB verified",
  "FMB member",
  "NICEIC certified",
  "NICEIC approved",
  "Gas Safe registered",
  "Gas Safe approved",
  "CIS registered",
  "CSCS certified",
  "BS 6180",
  "BS EN 14351",
  "Approved Doc K compliant",
  "Building Regulations approved",
  "Which? Trusted Trader",
  "Checkatrade approved",
];

/** Comparative claims require evidence and are usually legally risky.
 *  Blocked outright — merchant must rephrase. */
const COMPARATIVE_CLAIMS = [
  "cheaper than",
  "better than",
  "faster than",
  "stronger than",
  "safer than",
  "outperforms",
  "beats every",
  "unbeatable price",
  "lowest price in",
  "cheapest in",
  "number one",
  "no.1 in",
  "#1 in",
  "voted best",
  "award-winning",           // requires actual award record
  "industry leading",
  "market leading",
];

/** Absolute health / safety claims are never OK on a product listing. */
const ABSOLUTE_SAFETY_CLAIMS = [
  "100% safe",
  "completely safe",
  "child-proof",
  "childproof",
  "fireproof",
  "waterproof",              // very rarely accurate; usually water-resistant
  "unbreakable",
  "indestructible",
  "lifetime guarantee",      // requires an actual lifetime warranty on file
  "guaranteed for life",
  "never fails",
  "zero risk",
];

/** Health-outcome claims — reserved for regulated goods only, not
 *  timber / joinery / stair products. Blocked outright. */
const HEALTH_OUTCOME_CLAIMS = [
  "cures",
  "prevents disease",
  "medically proven",
  "clinically proven",
  "healing",
  "therapeutic",
];

/** Time-since-founded phrasing — requires the founded-year on the
 *  merchant record. Extracted here so the executor can spot invented
 *  history. */
const TRADING_HISTORY_REGEXES = [
  /\bestablished\s+(\d{4})\b/i,
  /\bfounded\s+in\s+(\d{4})\b/i,
  /\bsince\s+(\d{4})\b/i,
  /\btrading\s+for\s+(\d{1,3})\s+years?\b/i,
  /\b(\d{1,3})\s+years?\s+of\s+experience\b/i,
];

/** Case-insensitive substring match against a phrase list. */
function findFirstBlockedPhrase(
  text: string,
  list: readonly string[]
): string | null {
  const lower = text.toLowerCase();
  for (const phrase of list) {
    if (lower.includes(phrase.toLowerCase())) return phrase;
  }
  return null;
}

/** Public: check a piece of AI-generated text against every guardrail
 *  rule and return the first violation (or ok). */
export function checkText(
  text: string,
  context: {
    /** Certifications the merchant has actually registered. Empty array
     *  means the AI must not claim any. */
    merchantCredentials?: string[];
    /** Year the merchant registered as trading (from Companies House
     *  or self-declared during signup). If set, invented earlier dates
     *  in trading-history claims are blocked. */
    merchantTradingSince?: number;
  } = {}
): GuardrailResult {
  const merchantCredentialsLower = (context.merchantCredentials ?? []).map(
    (c) => c.toLowerCase()
  );

  // 1. Certification claims — allowed only if the merchant holds the credential
  const certHit = findFirstBlockedPhrase(text, CERTIFICATION_PHRASES);
  if (certHit && !merchantCredentialsLower.includes(certHit.toLowerCase())) {
    return {
      ok: false,
      matched: certHit,
      reason: `The phrase "${certHit}" implies a certification your NEX profile does not currently hold. If you are certified, add it to your profile credentials first; otherwise please rephrase without this claim.`,
    };
  }

  // 2. Comparative claims — blocked outright
  const compareHit = findFirstBlockedPhrase(text, COMPARATIVE_CLAIMS);
  if (compareHit) {
    return {
      ok: false,
      matched: compareHit,
      reason: `The phrase "${compareHit}" is a comparative claim that needs evidence NEX cannot verify. Please rephrase to describe your product on its own merits.`,
    };
  }

  // 3. Absolute safety claims — blocked outright
  const safetyHit = findFirstBlockedPhrase(text, ABSOLUTE_SAFETY_CLAIMS);
  if (safetyHit) {
    return {
      ok: false,
      matched: safetyHit,
      reason: `The phrase "${safetyHit}" is an absolute safety claim that is almost never accurate. Please use a more measured phrase (e.g. "water-resistant" instead of "waterproof").`,
    };
  }

  // 4. Health-outcome claims — blocked outright
  const healthHit = findFirstBlockedPhrase(text, HEALTH_OUTCOME_CLAIMS);
  if (healthHit) {
    return {
      ok: false,
      matched: healthHit,
      reason: `The phrase "${healthHit}" is a health-outcome claim that applies only to regulated medical products. This is not permitted on trade product listings.`,
    };
  }

  // 5. Trading history — invented years blocked
  if (context.merchantTradingSince != null) {
    for (const rx of TRADING_HISTORY_REGEXES) {
      const match = text.match(rx);
      if (!match) continue;
      const claimed = Number(match[1]);
      // The regex captures either a year (>1900) or a duration (years).
      if (claimed > 1900) {
        // It is a year — must be >= registered year
        if (claimed < context.merchantTradingSince) {
          return {
            ok: false,
            matched: match[0],
            reason: `You cannot claim to be trading since ${claimed} — your NEX profile shows you registered as trading in ${context.merchantTradingSince}. Please use an accurate date.`,
          };
        }
      } else {
        // It is a duration — must be consistent with registered year
        const claimedStart = new Date().getFullYear() - claimed;
        if (claimedStart < context.merchantTradingSince) {
          return {
            ok: false,
            matched: match[0],
            reason: `You cannot claim ${claimed} years of experience — your NEX profile shows you registered as trading in ${context.merchantTradingSince}. Please use an accurate figure.`,
          };
        }
      }
    }
  }

  return { ok: true };
}

/** Convenience for validating a whole object of AI-generated fields
 *  (e.g. { name, description, tags }) — returns the first violation
 *  across any field or ok. */
export function checkFields<T extends Record<string, string | null | undefined>>(
  fields: T,
  context: Parameters<typeof checkText>[1] = {}
): GuardrailResult & { field?: keyof T } {
  for (const key of Object.keys(fields) as Array<keyof T>) {
    const value = fields[key];
    if (typeof value !== "string" || value.length === 0) continue;
    const result = checkText(value, context);
    if (!result.ok) return { ...result, field: key };
  }
  return { ok: true };
}
