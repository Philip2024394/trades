// src/lib/nex/brain/reflection.ts
//
// Stage 3.10 · Phase 3 · Reflection (Philip 2026-08-31).
//
// CONSTITUTIONAL. Reflection is one of the five functions Philip named
// as protecting NEX from becoming "super confident nonsense." It runs
// AFTER the composer produces a reply and BEFORE the reply is returned,
// checking:
//
//   1. answersUserMessage  — did we actually address what the user asked?
//   2. internallyConsistent — does the reply contradict prior state?
//   3. hasEvidenceForClaims — are numeric/name claims backed by grounded data?
//   4. respectsHonestBoundary — no invented booking / price / availability
//   5. respectsMarketBoundary — no UK-specialist copy leaking into ID replies
//
// v1 is OBSERVATIONAL. The report is attached to the response for
// audit; the reply is not rewritten. If Reflection fails, we surface
// the failure in the activation trace and the response so tests and
// HQ can catch drift immediately. v2 could re-invoke the composer.

export type ReflectionCheck =
  | "answersUserMessage"
  | "internallyConsistent"
  | "hasEvidenceForClaims"
  | "respectsHonestBoundary"
  | "respectsMarketBoundary";

export type ReflectionFinding = {
  check: ReflectionCheck;
  passed: boolean;
  reason: string;
};

export type ReflectionReport = {
  overallPass: boolean;
  findings: ReflectionFinding[];
  passedCount: number;
  totalChecks: number;
};

export type ReflectionInput = {
  userMessage: string;
  reply: string;
  intent?: string;
  intentReason?: string;
  userMarket?: "ID" | "UK" | "US";
  /** Number of real property results surfaced (from Insight). */
  realPropertiesMentioned?: number;
  /** Names surfaced in the reply that should trace back to real records. */
  namesSurfaced?: string[];
  /** Slot state used to compose the reply. */
  slots?: Record<string, unknown>;
  /**
   * Stage 3.34c · World evidence set (Philip 2026-08-31). When present,
   * Reflection performs an ADDITIONAL check: the numeric count in the
   * reply must equal `worldEvidence.totalAvailable` AND every business
   * name surfaced in the reply must appear in `worldEvidence.recordNames`.
   *
   * This is the "does what I said match what the World actually returned"
   * verification the doctrine calls for · closes the loop between the
   * live retrieval and the composed answer.
   *
   * When absent, Reflection falls back to the existing heuristic checks
   * (backwards-compat for surfaces not on the live-World path yet).
   */
  worldEvidence?: {
    totalAvailable: number;
    recordNames: readonly string[];
  };
};

// ─── Hallmark phrases used to detect honest-boundary violations ───────

const INVENTED_BOOKING_PATTERNS = [
  /\bbooked\s+(for you|it|your)/i,
  /\breservation\s+confirmed\b/i,
  /\bavailable\s+tonight\b/i,
  /\bat\s+idr\s+\d[\d,]*/i,     // fabricated price
  /\bstarting\s+from\s+idr\s+\d/i,
  /\bfive[- ]star\s+rated\b/i,  // rating that OSM doesn't have
];

const UK_STAIRCASE_HALLMARKS = [
  /staircase library/i,
  /staircases are where i know most/i,
  /for plumbing work/i,
  /for electrical work/i,
];

// ─── Individual checks ────────────────────────────────────────────────

function checkAnswersUserMessage(input: ReflectionInput): ReflectionFinding {
  const reply = (input.reply ?? "").trim();
  if (reply.length === 0) {
    return { check: "answersUserMessage", passed: false, reason: "reply is empty" };
  }
  // Very short discovery reply that's ONLY a question is a fail IF the user
  // asked for information (not just chit-chat). We can't distinguish perfectly
  // without an intent classifier · use a heuristic: reply is ≤50 chars AND
  // ends with "?" AND user message contains a discovery verb.
  const userLower = (input.userMessage ?? "").toLowerCase();
  const looksLikeDiscovery = /\b(find|need|want|show|looking|cari|butuh|mau|show me)\b/.test(userLower);
  const replyIsJustAQuestion = reply.length <= 50 && reply.trim().endsWith("?");
  if (looksLikeDiscovery && replyIsJustAQuestion) {
    return { check: "answersUserMessage", passed: false, reason: "reply is only a question · user asked to find/discover something" };
  }
  return { check: "answersUserMessage", passed: true, reason: "reply is non-empty and appropriate to the turn shape" };
}

function checkInternallyConsistent(input: ReflectionInput): ReflectionFinding {
  const slots = (input.slots ?? {}) as { type?: string; location?: string; area?: string; budget?: string };
  const replyLower = (input.reply ?? "").toLowerCase();
  // If the reply mentions a TYPE that doesn't match the accumulated slot type,
  // that's an internal contradiction (composer bug).
  const knownTypes = ["hotel", "guesthouse", "homestay", "hostel", "villa", "resort", "kos", "apartment"];
  if (slots.type) {
    for (const t of knownTypes) {
      if (t !== slots.type && t !== "hotel" && replyLower.match(new RegExp(`\\bfor ${t}s?\\b|\\b${t}s? for\\b`, "i"))) {
        // Note: strict — only counts "for hotels/for guesthouses" phrasing to avoid
        // matching "we have hotels AND guesthouses" (which is honest).
        return { check: "internallyConsistent", passed: false, reason: `reply talks about "${t}" but slot type is "${slots.type}"` };
      }
    }
  }
  return { check: "internallyConsistent", passed: true, reason: "no slot/reply contradictions detected" };
}

function checkHasEvidenceForClaims(input: ReflectionInput): ReflectionFinding {
  const reply = input.reply ?? "";

  // ─── Stage 3.34c · Live World evidence check (Philip 2026-08-31) ────
  // When the caller passed a World evidence set, run the STRICT check
  // against the live retrieval:
  //   · numeric claim must equal worldEvidence.totalAvailable
  //   · every named business in the reply must appear in
  //     worldEvidence.recordNames (case-insensitive)
  //
  // This is the "does what I said match what the World actually
  // returned" verification the Live World doctrine calls for.
  if (input.worldEvidence) {
    // Bilingual numeric-claim regex · matches EN + ID phrasings.
    const worldNumeric = reply.match(/\b(\d+)\s+real listings\b/i)
      || reply.match(/\bhave\s+(\d+)\s+listings\b/i)
      || reply.match(/\b(\d+)\s+listingan asli\b/i)
      || reply.match(/\bpunya\s+(\d+)\s+listingan\b/i);
    if (worldNumeric) {
      const claimed = parseInt(worldNumeric[1], 10);
      if (claimed !== input.worldEvidence.totalAvailable) {
        return {
          check: "hasEvidenceForClaims",
          passed: false,
          reason: `reply claims ${claimed} listings but World returned ${input.worldEvidence.totalAvailable}`,
        };
      }
    }
    // Name check: the composer's named-list opener says "— A, B, C, and
    // more." We look for a comma-separated proper-noun-ish sequence and
    // verify each token appears in the World record set.
    // Heuristic: split on the em/en dash after the opener, take the
    // portion before the boundary sentence ("These are..." / "Ini
    // listingan...").
    const openerSplit = reply.split(/[—-]\s*/);
    if (openerSplit.length >= 2) {
      // Names segment is the second element up to the boundary sentence.
      let namesSegment = openerSplit[1];
      const boundaryStart = namesSegment.search(/These are|Ini listingan/i);
      if (boundaryStart > 0) namesSegment = namesSegment.slice(0, boundaryStart);
      // Strip trailing "and more" / "dan lainnya" · then split on commas.
      namesSegment = namesSegment.replace(/,?\s*(and more|dan lainnya)\.?\s*$/i, "").trim();
      const claimedNames = namesSegment
        .split(",")
        .map((n) => n.trim().replace(/\.$/, ""))
        .filter((n) => n.length > 0);
      const worldNamesLower = new Set(input.worldEvidence.recordNames.map((n) => n.toLowerCase()));
      const missing = claimedNames.filter((n) => !worldNamesLower.has(n.toLowerCase()));
      if (missing.length > 0 && claimedNames.length > 0) {
        return {
          check: "hasEvidenceForClaims",
          passed: false,
          reason: `reply names ${missing.length} business(es) not in the World result set: ${missing.join(", ")}`,
        };
      }
    }
    return {
      check: "hasEvidenceForClaims",
      passed: true,
      reason: "count + names verified against live World evidence set",
    };
  }

  // ─── Fallback · legacy numeric-only check (pre-live-World callers) ──
  // If the reply contains a numeric claim like "I've got 14 real listings",
  // that number must equal realPropertiesMentioned we passed in.
  const numericMatch = reply.match(/\b(\d+)\s+real listings\b/i) || reply.match(/\bhave\s+(\d+)\s+listings\b/i);
  if (numericMatch) {
    const claimed = parseInt(numericMatch[1], 10);
    const actual = input.realPropertiesMentioned ?? -1;
    if (actual >= 0 && claimed !== actual) {
      return { check: "hasEvidenceForClaims", passed: false, reason: `reply claims ${claimed} listings but retrieval had ${actual}` };
    }
  }
  return { check: "hasEvidenceForClaims", passed: true, reason: "numeric claims match evidence · surfaced names are trusted from retrieval" };
}

function checkRespectsHonestBoundary(input: ReflectionInput): ReflectionFinding {
  const reply = input.reply ?? "";
  for (const rx of INVENTED_BOOKING_PATTERNS) {
    if (rx.test(reply)) {
      return { check: "respectsHonestBoundary", passed: false, reason: `reply appears to invent booking/availability/price · pattern: ${rx}` };
    }
  }
  return { check: "respectsHonestBoundary", passed: true, reason: "no invented booking/price/availability detected" };
}

function checkRespectsMarketBoundary(input: ReflectionInput): ReflectionFinding {
  const reply = input.reply ?? "";
  if (input.userMarket === "ID") {
    for (const rx of UK_STAIRCASE_HALLMARKS) {
      if (rx.test(reply)) {
        return { check: "respectsMarketBoundary", passed: false, reason: `ID user received UK-specialist copy · pattern: ${rx}` };
      }
    }
  }
  return { check: "respectsMarketBoundary", passed: true, reason: "no cross-market leakage" };
}

// ─── The Reflect function ─────────────────────────────────────────────

export function reflectOnReply(input: ReflectionInput): ReflectionReport {
  const findings: ReflectionFinding[] = [
    checkAnswersUserMessage(input),
    checkInternallyConsistent(input),
    checkHasEvidenceForClaims(input),
    checkRespectsHonestBoundary(input),
    checkRespectsMarketBoundary(input),
  ];
  const passedCount = findings.filter((f) => f.passed).length;
  return {
    overallPass: passedCount === findings.length,
    findings,
    passedCount,
    totalChecks: findings.length,
  };
}
