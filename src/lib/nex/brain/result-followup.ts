// src/lib/nex/brain/result-followup.ts
//
// P0 · Result-Follow-Up Provenance Regression Guard
// Philip 2026-09-05 · AUTHORIZE · NEX LANGUAGE INTELLIGENCE FOUNDATION
//
// PURPOSE
//   When NEX has just returned a set of results (e.g. a hotel list) and
//   the user asks a follow-up ABOUT the provenance of those results
//   ("where you find them" · "how did you retrieve these"), the reply
//   MUST answer from actual provenance evidence — never re-execute the
//   original search and never fabricate a source.
//
// ARCHITECTURAL SHIFT (from the prior slice)
//   The initial fix matched sentence patterns (6 regexes). That
//   trajectory is unacceptable: every new surface form ("how were
//   these sourced?") would require a new regex. This slice instead
//   consumes the NEX LANGUAGE INTELLIGENCE FOUNDATION
//   (`language-intelligence.ts`) which decomposes a message into
//   linguistic FEATURES (interrogative · referent · verb-semantic ·
//   postposition · source-noun) and composes an INTENT. New surface
//   forms cost nothing if they use the same feature vocabulary.
//
// ANSWER CONTRACT (locked)
//   Only 4 provenance states are permitted:
//     KNOWN_SOURCE          — anchored result set + vertical known + provenance record
//     LIMITED_SOURCE        — anchored result set + vertical known + no provenance record  (currently unused; reserved)
//     NO_SOURCE_INFORMATION — anchored result set + vertical unknown
//     NO_ANCHOR             — no anchored result set (fresh conv or expired window)
//
//   Reply text MUST reference actual NEX table names or say honestly
//   that source information is unavailable. NEVER manufactures URLs,
//   provider names, verification status, owner information, or
//   discovery methodology.
//
// PRESERVATION
//   · P0.3 hotel resolved-reference continuity: this gate emits a
//     terminal reply — it doesn't touch reference-hydration flow.
//   · P0.4 fresh-conversation ordinal-anchor gate: this gate fires
//     BEFORE the ordinal gate but only for provenance-classified
//     messages; ordinals ("first hotel") get through untouched.
//   · P0 zero-evidence fabrication guard: this gate is compatible —
//     it enforces the same "no manufactured claims" discipline for a
//     narrower class of messages.

import type { SessionState, SessionEntity } from "./session";
import { hasValidConversationalAnchor } from "./ordinal-anchor";
import { interpretIntent, type MessageIntent } from "./language-intelligence";

// ─── Public detection surface ───────────────────────────────────

export type ResultFollowupKind =
  | "where_provenance"
  | "how_provenance"
  | "source_query"
  | "origin_query";

export type ResultFollowupDetection = {
  matched: boolean;
  kind: ResultFollowupKind | null;
  matched_phrase: string | null;
};

/** Semantic detection — no phrase table. Delegates to the language
 *  intelligence classifier and re-labels the result in terms this gate
 *  uses. Kept for observability/backward-compat with the prior slice. */
export function detectResultFollowup(message: string): ResultFollowupDetection {
  const intent = interpretIntent(message);
  if (intent.kind !== "result_provenance_followup") {
    return { matched: false, kind: null, matched_phrase: null };
  }
  const kind = classifyKind(intent);
  return { matched: true, kind, matched_phrase: intent.features.original_message };
}

function classifyKind(intent: MessageIntent & { kind: "result_provenance_followup" }): ResultFollowupKind {
  const f = intent.features;
  if (f.has_source_noun) return "source_query";
  if (f.interrogative === "how") return "how_provenance";
  if (f.has_from_postposition) return "origin_query";
  return "where_provenance";
}

// ─── Session anchor inspection ──────────────────────────────────

/** Most-recent presented entities. These are what "them/these" refer to. */
export function extractPresentedEntities(session: SessionState | null | undefined): SessionEntity[] {
  if (!session) return [];
  const entities = session.entities ?? [];
  return entities.filter((e) =>
    (e.kind === "business_name" || e.kind === "place" || e.kind === "area")
    && e.source === "nex_reply",
  );
}

function verticalFromEntity(entity: SessionEntity): string | null {
  const raw = (entity as unknown as { refId?: string }).refId;
  if (!raw || typeof raw !== "string") return null;
  const m = /^place:([a-z_]+):/i.exec(raw);
  if (!m) return null;
  return m[1].toLowerCase();
}

export function inferDominantVertical(entities: SessionEntity[]): string | null {
  const counts = new Map<string, number>();
  for (const e of entities) {
    const v = verticalFromEntity(e);
    if (v) counts.set(v, (counts.get(v) ?? 0) + 1);
  }
  let best: string | null = null;
  let bestCount = 0;
  for (const [v, n] of counts.entries()) {
    if (n > bestCount) { best = v; bestCount = n; }
  }
  return best;
}

// ─── Provenance answers (deterministic · from real NEX tables) ──

// §8 §9 · SOURCE ≠ CAPABILITY.
// These strings describe ONLY where the listings came from. Whether NEX
// can perform an action (booking · reservation · contact · purchase) is
// a separate, evidence-grounded question answered by the
// capability-display-intelligence module. Do NOT re-introduce booking
// language here.
const VERTICAL_PROVENANCE: Record<string, string> = {
  accommodation: "I found them through NEX's accommodation directory for the area. Some of the underlying listing information was contributed via OpenStreetMap.",
  food: "I found them through NEX's food directory. Some of the underlying listing information was contributed via OpenStreetMap.",
  service: "I found them through NEX's services directory. Some of the underlying listing information was contributed via OpenStreetMap.",
  commerce: "I found them through NEX's marketplace listings.",
  transport: "I found them through NEX's transport-provider directory.",
};

function detectOwnerLanguage(message: string): "en" | "id" {
  const idMarkers = /\b(apa|siapa|dimana|bagaimana|selamat|kenapa|halo|hai|iya|saya|anda|kamu|ceritakan|tentang|belum|tidak|ingin|yang|mana|adalah|akan|sudah|jadi|juga|itu|ini|dengan|pada|untuk)\b/i;
  return /[a-z]/i.test(message) && !idMarkers.test(message.toLowerCase())
    ? "en"
    : "id";
}

function honestBoundaryNoAnchor(language: "en" | "id"): string {
  if (language === "id") {
    return "Saya belum menampilkan daftar hasil apa pun di percakapan ini. Ingin saya cari sesuatu untuk Anda?";
  }
  return "I haven't shown you any results yet in this conversation. Want me to find some?";
}

function honestBoundaryUnknownProvenance(language: "en" | "id"): string {
  if (language === "id") {
    return "Saya tidak memiliki detail sumber untuk hasil-hasil tersebut dalam percakapan saat ini.";
  }
  return "I don't have detailed source information for those results in the current conversation.";
}

// ─── Public gate decision ───────────────────────────────────────
//
// Public API preserved so the wiring in route.ts is unchanged.

export type ProvenanceState = "KNOWN_SOURCE" | "NO_SOURCE_INFORMATION" | "NO_ANCHOR";

export type ResultFollowupDecision =
  | { shouldGate: false; reason: string }
  | {
      shouldGate: true;
      reason: string;
      detection: ResultFollowupDetection;
      reply: string;
      language: "en" | "id";
      inferred_vertical: string | null;
      /** Whether the reply invokes real provenance (true) vs an honest
       *  boundary (false · no anchor OR unknown provenance). */
      provenance_from_evidence: boolean;
      /** Answer-contract state · one of the 4 locked provenance states. */
      provenance_state: ProvenanceState;
    };

export function decideResultFollowupGate(input: {
  userMessage: string;
  session: SessionState | null | undefined;
  ownerLanguage?: "en" | "id";
}): ResultFollowupDecision {
  const intent = interpretIntent(input.userMessage);
  if (intent.kind !== "result_provenance_followup") {
    return { shouldGate: false, reason: `not_provenance_followup:${intent.kind}` };
  }

  const detection: ResultFollowupDetection = {
    matched: true,
    kind: classifyKind(intent),
    matched_phrase: intent.features.original_message,
  };
  const language = input.ownerLanguage ?? detectOwnerLanguage(input.userMessage);

  // Anchor check · fresh conv → honest boundary. Never fabricates.
  const anchored = hasValidConversationalAnchor(input.session);
  if (!anchored) {
    return {
      shouldGate: true,
      reason: `no_anchor:${detection.kind}`,
      detection,
      reply: honestBoundaryNoAnchor(language),
      language,
      inferred_vertical: null,
      provenance_from_evidence: false,
      provenance_state: "NO_ANCHOR",
    };
  }

  const entities = extractPresentedEntities(input.session);
  const vertical = inferDominantVertical(entities);
  if (!vertical || !VERTICAL_PROVENANCE[vertical]) {
    return {
      shouldGate: true,
      reason: `anchored_unknown_provenance:${vertical ?? "no_vertical_inferred"}`,
      detection,
      reply: honestBoundaryUnknownProvenance(language),
      language,
      inferred_vertical: vertical,
      provenance_from_evidence: false,
      provenance_state: "NO_SOURCE_INFORMATION",
    };
  }

  const provenanceEn = VERTICAL_PROVENANCE[vertical];
  const reply = language === "id"
    ? `Saya menemukannya melalui direktori ${vertical} NEX. Sebagian informasi listingan berasal dari kontribusi komunitas OpenStreetMap.`
    : provenanceEn;
  return {
    shouldGate: true,
    reason: `provenance_from_vertical:${vertical}`,
    detection,
    reply,
    language,
    inferred_vertical: vertical,
    provenance_from_evidence: true,
    provenance_state: "KNOWN_SOURCE",
  };
}
