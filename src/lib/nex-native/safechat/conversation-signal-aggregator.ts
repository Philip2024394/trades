// src/lib/nex-native/safechat/conversation-signal-aggregator.ts
//
// NEX SafeChat · conversation-level signal aggregator.
// -----------------------------------------------------
// Reads the recent classification history for a conversation and
// derives higher-order signals that depend on context, not just the
// current message.
//
// Signals derived (v1.0.0 baseline · retained in v1.1.0):
//   · repeated_pressure_after_refusal · when historic rule_matches
//     include a 'coercion_indicator' AND there's a later 'image_request'
//     within the same window.
//   · escalation_pattern · when the trailing N classifications show a
//     strictly non-decreasing level trend ending at >= 2.
//   · time_pressure · when >= 10 messages were classified for the
//     conversation in the window.
//   · platform_switch_invitation · when any historic classification
//     recorded a 'platform_switch_invitation' signal.
//
// NEW signals (v1.1.0 · Ruleset Tuning Wave 1 · R3 fix):
//   · repeated_request_after_refusal · true if a request-shaped
//     message (image_request or meeting_arrangement) appears AFTER a
//     refusal-shaped message in the window. "Refusal-shaped" is
//     detected via a historic 'refusal_language' pattern signal.
//   · escalating_severity_pattern · same as escalation_pattern,
//     exposed under a new field name to match the v1.1.0 contract.
//   · pressure_density · request-shaped messages per minute in the
//     window (based on classifiedAt timestamps).
//   · platform_switch_already_proposed · same as the existing
//     platform_switch_invitation boolean · provided for naming
//     symmetry with the rules modules.
//   · secrecy_already_requested · true if any prior classification
//     recorded a secrecy_request signal.
//   · age_gap_already_disclosed · true if any prior classification
//     recorded an age_gap_disclosure signal.
//
// Doctrine:
//   · Reads are strictly scoped to the given conversation_id.
//   · Returns a neutral-false ConversationSignals when the DB is
//     unavailable or the conversation_id is null · never throws.
//   · aggregateSignals accepts an optional injectedHistory parameter.
//     When provided, the DB read is skipped and derivation runs on the
//     injected rows. This is the hermetic entry point for the eval
//     runner (R-CORPUS) and for multi-message unit tests.

import "server-only";
import { withClient } from "@/lib/nex/db";
import type {
  ConversationSignals,
  PriorClassification,
  RuleMatchEntry,
  SignalType,
} from "./types";

export const DEFAULT_WINDOW_MINUTES = 60;
export const TIME_PRESSURE_THRESHOLD = 10;

export interface HistoryEntry {
  readonly level: number;
  readonly ruleMatches: readonly RuleMatchEntry[];
  readonly signals: ConversationSignals | Record<string, unknown>;
  readonly classifiedAt: string;
}

/** Neutral-false signals · returned when there's no history. */
export function emptySignals(): ConversationSignals {
  return {
    repeated_pressure_after_refusal: false,
    escalation_pattern: false,
    time_pressure: false,
    platform_switch_invitation: false,
    historyWindowCount: 0,
    repeated_request_after_refusal: false,
    escalating_severity_pattern: false,
    pressure_density: 0,
    platform_switch_already_proposed: false,
    secrecy_already_requested: false,
    age_gap_already_disclosed: false,
  };
}

/** Core derivation · exposed for tests + reused by the DB path. */
export function deriveSignals(
  entries: readonly HistoryEntry[],
): ConversationSignals {
  if (entries.length === 0) return emptySignals();

  // Oldest-first for sequence-based checks.
  const chronological = [...entries].sort(
    (a, b) => Date.parse(a.classifiedAt) - Date.parse(b.classifiedAt),
  );

  let platformSwitch = false;
  let sawCoercion = false;
  let repeatedPressure = false;

  // v1.1.0 trackers.
  let sawRefusal = false;
  let requestAfterRefusal = false;
  let secrecyRequested = false;
  let ageGapDisclosed = false;
  let requestShapedCount = 0;
  let firstTs: number | null = null;
  let lastTs: number | null = null;

  for (const e of chronological) {
    const ts = Date.parse(e.classifiedAt);
    if (!Number.isNaN(ts)) {
      if (firstTs === null) firstTs = ts;
      lastTs = ts;
    }

    const hasImageRequest = ruleMatchesHaveSignal(e.ruleMatches, "image_request");
    const hasMeeting = ruleMatchesHaveSignal(
      e.ruleMatches,
      "meeting_arrangement",
    );
    const hasCoercion = ruleMatchesHaveCategory(
      e.ruleMatches,
      "coercion_indicator",
    );
    const hasPlatformSwitch = ruleMatchesHaveSignal(
      e.ruleMatches,
      "platform_switch_invitation",
    );
    const hasRefusal = ruleMatchesHaveSignal(e.ruleMatches, "refusal_language");
    const hasSecrecy =
      ruleMatchesHaveSignal(e.ruleMatches, "secrecy_request") ||
      ruleMatchesHaveCategory(e.ruleMatches, "secrecy_request");
    const hasAgeGap = ruleMatchesHaveSignal(
      e.ruleMatches,
      "age_gap_disclosure",
    );

    if (hasPlatformSwitch) platformSwitch = true;
    if (hasCoercion) sawCoercion = true;
    if (sawCoercion && hasImageRequest) repeatedPressure = true;

    // Request-shaped messages (image_request OR meeting_arrangement).
    if (hasImageRequest || hasMeeting) requestShapedCount += 1;

    // Refusal tracking: if we previously saw a refusal and this entry
    // is request-shaped, that's a repeated request after refusal.
    if (sawRefusal && (hasImageRequest || hasMeeting)) {
      requestAfterRefusal = true;
    }
    if (hasRefusal) sawRefusal = true;

    if (hasSecrecy) secrecyRequested = true;
    if (hasAgeGap) ageGapDisclosed = true;
  }

  const escalation = detectEscalation(chronological.map((e) => e.level));
  const timePressure = chronological.length >= TIME_PRESSURE_THRESHOLD;

  // pressure_density = request-shaped messages per minute. If window
  // span < 1 minute, treat denominator as 1 minute (avoid dividing by
  // zero and avoid artificially high density on bursts under a second).
  let pressureDensity = 0;
  if (requestShapedCount > 0 && firstTs !== null && lastTs !== null) {
    const spanMs = Math.max(60_000, lastTs - firstTs);
    const minutes = spanMs / 60_000;
    pressureDensity = Math.round((requestShapedCount / minutes) * 1000) / 1000;
  }

  return {
    repeated_pressure_after_refusal: repeatedPressure,
    escalation_pattern: escalation,
    time_pressure: timePressure,
    platform_switch_invitation: platformSwitch,
    historyWindowCount: chronological.length,
    // v1.1.0 additions:
    repeated_request_after_refusal: requestAfterRefusal,
    escalating_severity_pattern: escalation,
    pressure_density: pressureDensity,
    platform_switch_already_proposed: platformSwitch,
    secrecy_already_requested: secrecyRequested,
    age_gap_already_disclosed: ageGapDisclosed,
  };
}

/** Non-decreasing trailing trend ending at >= 2. Requires at least 3
 *  consecutive entries to avoid firing on a single spike. */
export function detectEscalation(levels: readonly number[]): boolean {
  if (levels.length < 3) return false;
  const tail = levels.slice(-3);
  const nonDecreasing = tail[0]! <= tail[1]! && tail[1]! <= tail[2]!;
  return nonDecreasing && tail[2]! >= 2;
}

function ruleMatchesHaveSignal(
  matches: readonly RuleMatchEntry[],
  signalType: SignalType | string,
): boolean {
  for (const m of matches) {
    if (m.kind === "pattern" && m.signalType === signalType) return true;
  }
  return false;
}

function ruleMatchesHaveCategory(
  matches: readonly RuleMatchEntry[],
  category: string,
): boolean {
  for (const m of matches) {
    if (m.kind === "vocabulary" && m.category === category) return true;
  }
  return false;
}

/** Convert an injected PriorClassification into the internal
 *  HistoryEntry shape used by the derivation function. */
function priorToHistory(prior: PriorClassification): HistoryEntry {
  return {
    level: prior.level,
    ruleMatches: prior.ruleMatches,
    signals: {},
    classifiedAt: prior.classifiedAt,
  };
}

/** DB (or hermetic) entry point.
 *
 *  When `injectedHistory` is provided, the DB read is skipped and the
 *  derivation runs on the injected rows. This is the hermetic path for
 *  the evaluation runner (R-CORPUS) and multi-message unit tests.
 *
 *  When `injectedHistory` is NOT provided and `conversationId` is set,
 *  the aggregator pulls the last `windowMinutes` worth of
 *  classifications from the DB. */
export async function aggregateSignals(args: {
  conversationId: string | null;
  windowMinutes?: number;
  injectedHistory?: readonly PriorClassification[];
}): Promise<ConversationSignals> {
  // Hermetic path · take precedence over the DB read.
  if (args.injectedHistory !== undefined) {
    const entries = args.injectedHistory.map(priorToHistory);
    return deriveSignals(entries);
  }

  const conversationId = args.conversationId;
  if (!conversationId) return emptySignals();
  const windowMinutes = args.windowMinutes ?? DEFAULT_WINDOW_MINUTES;

  const result = await withClient(async (client) => {
    const r = await client.query(
      `SELECT level, rule_matches, signals, classified_at
         FROM nex.safechat_classification
        WHERE conversation_id = $1
          AND classified_at >= now() - ($2::text || ' minutes')::interval
        ORDER BY classified_at DESC
        LIMIT 50`,
      [conversationId, String(Math.max(1, Math.min(1440, windowMinutes)))],
    );
    return r.rows.map((row) => {
      const rec = row as Record<string, unknown>;
      const classifiedAtRaw = rec.classified_at;
      const classifiedAt =
        classifiedAtRaw instanceof Date
          ? (classifiedAtRaw as Date).toISOString()
          : new Date(String(classifiedAtRaw ?? 0)).toISOString();
      const h: HistoryEntry = {
        level: Number(rec.level),
        ruleMatches: Array.isArray(rec.rule_matches)
          ? (rec.rule_matches as RuleMatchEntry[])
          : [],
        signals:
          rec.signals && typeof rec.signals === "object"
            ? (rec.signals as Record<string, unknown>)
            : {},
        classifiedAt,
      };
      return h;
    });
  });

  const entries = result ?? [];
  return deriveSignals(entries);
}
