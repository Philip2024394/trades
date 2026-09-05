// src/lib/nex/brain/capability-display-intelligence.ts
//
// Capability & Display Intelligence
// Philip 2026-09-06 · AUTHORIZE · NEX ACCOMMODATION PROVENANCE, BOOKING
// SEMANTICS & FOLLOW-UP CONVERSATION FIX
//
// PROBLEM (Defect B · §3 §4 §10)
//   After a provenance answer, the conversation was stuck:
//     "what you mean i cant book"  → "Yep — found 3."   ⚠ stale re-emit
//     "ok so lets see them"        → "Yep — found 3."   ⚠ stale re-emit
//   These are CURRENT dialogue acts (capability clarification · display
//   request) that must override stale search-result inheritance.
//
// SCOPE
//   Semantic detection of three new dialogue-act classes:
//     · CAPABILITY_QUESTION       "can I book?" · "is it bookable?"
//     · CAPABILITY_CLARIFICATION  "what do you mean I can't book?"
//     · RESULT_DISPLAY_REQUEST    "ok show me them" · "let's see them"
//   Plus a Capability-State Contract (§6): VERIFIED · UNKNOWN · UNAVAILABLE
//   per (vertical, capability_kind).
//
// PRESERVATION
//   L4 · G12 · G15 · G23 · G24 · G04 · G03 · Wave 1 · Wave 2 · P0.3 · P0.4
//   · result-followup (SOURCE_QUESTION handled there · this module handles
//     the CAPABILITY / DISPLAY dimensions).

import type { SessionState, SessionEntity } from "./session";
import type { Lang } from "./language-state";

// ─── Capability-state contract (§6 · locked) ────────────────────

export type CapabilityKind =
  | "BOOKING"     // reserve accommodation / restaurant / activity
  | "CONTACT"     // call · message · WhatsApp
  | "PURCHASE"    // marketplace buy
  | "RESERVATION" // table / seat reservation
  | "GENERIC";    // fallback

export type CapabilityState =
  | "VERIFIED"      // NEX has an integrated capability
  | "UNKNOWN"       // capability not verified either way (default · honest)
  | "UNAVAILABLE";  // NEX has explicitly confirmed no capability

/** Per-vertical, per-capability state registry. Updated ONLY when NEX
 *  actually integrates a capability. Default = UNKNOWN. This contract
 *  is INDEPENDENT of source · OSM-sourced listings can be VERIFIED,
 *  and NEX-authored listings can be UNKNOWN. */
export const CAPABILITY_REGISTRY: Record<string, Partial<Record<CapabilityKind, CapabilityState>>> = {
  accommodation: {
    BOOKING: "UNKNOWN",
    CONTACT: "UNKNOWN",
    RESERVATION: "UNKNOWN",
    PURCHASE: "UNAVAILABLE",
  },
  food: {
    BOOKING: "UNKNOWN",
    RESERVATION: "UNKNOWN",
    CONTACT: "UNKNOWN",
    PURCHASE: "UNAVAILABLE",
  },
  service: {
    CONTACT: "UNKNOWN",
    BOOKING: "UNKNOWN",
    PURCHASE: "UNAVAILABLE",
  },
  commerce: {
    PURCHASE: "UNKNOWN",
    CONTACT: "UNKNOWN",
    BOOKING: "UNAVAILABLE",
    RESERVATION: "UNAVAILABLE",
  },
  transport: {
    BOOKING: "UNKNOWN",
    CONTACT: "UNKNOWN",
    PURCHASE: "UNAVAILABLE",
  },
};

export function lookupCapability(vertical: string, kind: CapabilityKind): CapabilityState {
  const v = CAPABILITY_REGISTRY[vertical.toLowerCase()];
  if (!v) return "UNKNOWN";
  return v[kind] ?? "UNKNOWN";
}

// ─── Types ──────────────────────────────────────────────────────

export type Act =
  | "CAPABILITY_QUESTION"
  | "CAPABILITY_CLARIFICATION"
  | "RESULT_DISPLAY_REQUEST"
  | "NONE";

export type Detection = {
  act: Act;
  capability_kind: CapabilityKind | null;
  reference_present: boolean;   // "the first one", etc.
  markers: string[];
  reason: string;
  confidence: "HIGH" | "MEDIUM" | "LOW";
};

// ─── Tokenizer ──────────────────────────────────────────────────

function tokens(message: string): string[] {
  return (message || "")
    .toLowerCase()
    .replace(/[’']/g, "")
    .replace(/[?.!,;:"“”()]/g, " ")
    .split(/\s+/)
    .filter(Boolean);
}

// ─── Vocabulary (EN + ID) ───────────────────────────────────────

const BOOKING_VERBS = new Set([
  "book", "booking", "booked", "reserve", "reserved", "reservation",
  "pesan", "reservasi", "menginap",
]);
const CONTACT_VERBS = new Set([
  "contact", "call", "message", "whatsapp", "wa",
  "kontak", "hubungi", "menghubungi",
]);
const PURCHASE_VERBS = new Set([
  "buy", "purchase", "order",
  "beli", "membeli",
]);

const CAPABILITY_QUESTION_STARTS: ReadonlyArray<ReadonlyArray<string>> = [
  ["can", "i"],
  ["could", "i"],
  ["is", "it"],
  ["how", "do", "i"],
  ["how", "can", "i"],
  ["bisakah", "saya"],
  ["apakah", "bisa"],
];

const CLARIFICATION_STARTS: ReadonlyArray<ReadonlyArray<string>> = [
  ["what", "do", "you", "mean"],
  ["what", "you", "mean"],
  ["what", "does", "that", "mean"],
  ["why", "cant", "i"],
  ["why", "can", "not", "i"],
  ["apa", "maksud", "kamu"],
  ["apa", "maksudnya"],
  ["kenapa", "tidak", "bisa"],
];

const DISPLAY_VERBS = new Set([
  "show", "see", "list", "display", "give",
  "tunjukkan", "lihat", "berikan",
]);

const DISPLAY_REFERENCE_TARGETS = new Set([
  "them", "these", "those", "it",
  "list", "results",
  "hotels", "restaurants", "places", "options", "flights", "cars",
  "restoran", "penginapan", "tempat", "pilihan",
]);

const DISPLAY_STARTERS = new Set([
  "ok", "okay", "alright", "sure",
  "baik", "oke",
]);

const REF_TOKENS = new Set([
  "them", "these", "those", "it", "that", "this",
  "first", "second", "third", "last",
  "pertama", "kedua", "ketiga", "terakhir",
  "itu", "ini",
]);

// ─── Helpers ────────────────────────────────────────────────────

function startsWithSequence(t: string[], seq: ReadonlyArray<string>): boolean {
  if (seq.length > t.length) return false;
  for (let i = 0; i < seq.length; i++) if (t[i] !== seq[i]) return false;
  return true;
}

function matchSequenceAnywhere(t: string[], seq: ReadonlyArray<string>): boolean {
  outer: for (let i = 0; i <= t.length - seq.length; i++) {
    for (let j = 0; j < seq.length; j++) {
      if (t[i + j] !== seq[j]) continue outer;
    }
    return true;
  }
  return false;
}

function detectCapabilityKind(t: string[]): CapabilityKind | null {
  for (const tok of t) {
    if (BOOKING_VERBS.has(tok)) return "BOOKING";
    if (CONTACT_VERBS.has(tok)) return "CONTACT";
    if (PURCHASE_VERBS.has(tok)) return "PURCHASE";
  }
  return null;
}

function hasReference(t: string[]): boolean {
  return t.some((x) => REF_TOKENS.has(x));
}

// ─── Classifier ────────────────────────────────────────────────

export function classifyCapabilityDisplayAct(message: string): Detection {
  const t = tokens(message);
  const markers: string[] = [];
  const empty = (reason: string): Detection => ({
    act: "NONE", capability_kind: null, reference_present: false,
    markers, reason, confidence: "HIGH",
  });
  if (t.length === 0) return empty("empty");

  const capKind = detectCapabilityKind(t);
  const ref = hasReference(t);

  // 1 · CAPABILITY_CLARIFICATION · runs FIRST · handles
  //     "what do you mean I can't book" (contains "mean" + capability verb).
  for (const seq of CLARIFICATION_STARTS) {
    if (startsWithSequence(t, seq)) {
      markers.push(`clarify_start:${seq.join("_")}`);
      // Prefer classifying as CAPABILITY_CLARIFICATION when a capability
      // verb is present. Otherwise fall through to generic clarification
      // (not gated here · L4/G15 handles).
      if (capKind) {
        markers.push(`cap:${capKind}`);
        return {
          act: "CAPABILITY_CLARIFICATION",
          capability_kind: capKind,
          reference_present: ref,
          markers,
          reason: `clarify_with_${capKind}`,
          confidence: "HIGH",
        };
      }
      // "what do you mean" without a cap-verb: still capability
      // clarification when the message contains any cap-related content
      if (matchSequenceAnywhere(t, ["cant", "book"])
          || matchSequenceAnywhere(t, ["cant", "buy"])
          || matchSequenceAnywhere(t, ["cant", "reserve"])) {
        return {
          act: "CAPABILITY_CLARIFICATION",
          capability_kind: "BOOKING",
          reference_present: ref,
          markers,
          reason: "clarify_cant_book",
          confidence: "HIGH",
        };
      }
      // Bare "what do you mean" without capability content → not our concern
      break;
    }
  }

  // 2 · CAPABILITY_QUESTION · "can I book" · "is it bookable" · etc.
  for (const seq of CAPABILITY_QUESTION_STARTS) {
    if (startsWithSequence(t, seq) && capKind) {
      markers.push(`cap_q_start:${seq.join("_")}`, `cap:${capKind}`);
      return {
        act: "CAPABILITY_QUESTION",
        capability_kind: capKind,
        reference_present: ref,
        markers,
        reason: `cap_q:${capKind}`,
        confidence: "HIGH",
      };
    }
  }
  // Also catch "is it bookable" / "is this reservable" · adjectival form
  if ((t[0] === "is" || t[0] === "are") && t.some((x) => /(bookable|reservable|buyable|purchasable)/.test(x))) {
    markers.push("adjectival_capability");
    return {
      act: "CAPABILITY_QUESTION",
      capability_kind: /(bookable|reservable)/.test(t.find((x) => /(bookable|reservable|buyable|purchasable)/.test(x)) ?? "") ? "BOOKING" : "PURCHASE",
      reference_present: ref,
      markers,
      reason: "adjectival_capability",
      confidence: "HIGH",
    };
  }

  // 3 · RESULT_DISPLAY_REQUEST · "show me them" / "ok let's see them" /
  //     "give me the list" / "show me the hotels"
  //     Requires a display verb + a reference / result-target token.
  const hasDisplayVerb = t.some((x) => DISPLAY_VERBS.has(x));
  const hasDisplayTarget = t.some((x) => DISPLAY_REFERENCE_TARGETS.has(x));
  const starterOnly = t[0] && DISPLAY_STARTERS.has(t[0]);
  if (hasDisplayVerb && hasDisplayTarget) {
    markers.push("display_verb_target");
    return {
      act: "RESULT_DISPLAY_REQUEST",
      capability_kind: null,
      reference_present: ref,
      markers,
      reason: "display_request",
      confidence: "HIGH",
    };
  }
  // "let's see them" pattern · post-apostrophe-strip = "lets see them"
  if (matchSequenceAnywhere(t, ["lets", "see"]) || matchSequenceAnywhere(t, ["let", "us", "see"])) {
    // Must reference something to display
    if (hasDisplayTarget || t.length <= 5) {
      markers.push("lets_see");
      return {
        act: "RESULT_DISPLAY_REQUEST",
        capability_kind: null,
        reference_present: ref,
        markers,
        reason: "lets_see",
        confidence: "HIGH",
      };
    }
  }
  // "ok show me" · "ok display" · minimal shape
  if (starterOnly && hasDisplayVerb) {
    markers.push("starter_plus_display");
    return {
      act: "RESULT_DISPLAY_REQUEST",
      capability_kind: null,
      reference_present: ref,
      markers,
      reason: "starter_display",
      confidence: "MEDIUM",
    };
  }
  // Short imperative in Indonesian · "tunjukkan hotelnya" · "lihat
  // hasilnya". ID display verbs bind to a bare noun without an explicit
  // demonstrative, so accept when the message starts with a display
  // verb and is short (≤ 3 tokens).
  if (t[0] && DISPLAY_VERBS.has(t[0]) && t.length <= 3) {
    markers.push("short_imperative_display");
    return {
      act: "RESULT_DISPLAY_REQUEST",
      capability_kind: null,
      reference_present: ref,
      markers,
      reason: "short_imperative_display",
      confidence: "MEDIUM",
    };
  }

  return empty("no_pattern_matched");
}

// ─── Session utilities · extract recent result-set entities ─────

function extractRecentResults(session: SessionState | null | undefined): {
  entities: SessionEntity[];
  vertical: string | null;
} {
  if (!session) return { entities: [], vertical: null };
  const entities = (session.entities ?? []).filter((e) =>
    (e.kind === "business_name" || e.kind === "place")
    && (e as unknown as { source?: string }).source === "nex_reply",
  );
  if (entities.length === 0) return { entities: [], vertical: null };
  // Infer vertical from most-common refId prefix
  const counts = new Map<string, number>();
  for (const e of entities) {
    const raw = (e as unknown as { refId?: string }).refId ?? "";
    const m = /^place:([a-z_]+):/i.exec(raw);
    if (m) counts.set(m[1].toLowerCase(), (counts.get(m[1].toLowerCase()) ?? 0) + 1);
  }
  let vertical: string | null = null;
  let best = 0;
  for (const [v, n] of counts.entries()) {
    if (n > best) { vertical = v; best = n; }
  }
  return { entities, vertical };
}

// ─── Deterministic reply builders ───────────────────────────────

function displayReply(entities: SessionEntity[], vertical: string | null, lang: Lang): string {
  const names = entities.slice(0, 5).map((e) => (e as unknown as { raw?: string; canonical?: string }).raw ?? e.canonical);
  const list = names.filter(Boolean).join(", ");
  const domain = vertical === "accommodation" ? (lang === "ID" ? "hotel" : "hotels")
              : vertical === "food"            ? (lang === "ID" ? "tempat makan" : "places")
              : vertical === "service"         ? (lang === "ID" ? "layanan" : "options")
              : vertical === "commerce"        ? (lang === "ID" ? "produk" : "listings")
              : vertical === "transport"       ? (lang === "ID" ? "transportasi" : "options")
              : (lang === "ID" ? "hasil" : "results");
  if (lang === "ID") {
    return `Baik — berikut ${entities.length} ${domain} yang saya temukan: ${list}.`;
  }
  return `Sure — here are the ${entities.length} ${domain} I found: ${list}.`;
}

function displayNoResultReply(lang: Lang): string {
  if (lang === "ID") {
    return "Saya belum menampilkan hasil apa pun di percakapan ini. Mau saya cari sesuatu terlebih dahulu?";
  }
  return "I haven't shown you any results yet in this conversation. Want me to search for something first?";
}

function capabilityReply(kind: CapabilityKind, vertical: string | null, lang: Lang): string {
  const state = vertical ? lookupCapability(vertical, kind) : "UNKNOWN";
  const kindWord =
    kind === "BOOKING"     ? (lang === "ID" ? "pemesanan" : "booking")
  : kind === "CONTACT"     ? (lang === "ID" ? "kontak" : "contact")
  : kind === "PURCHASE"    ? (lang === "ID" ? "pembelian" : "purchase")
  : kind === "RESERVATION" ? (lang === "ID" ? "reservasi" : "reservation")
  : (lang === "ID" ? "kemampuan itu" : "that capability");

  if (state === "VERIFIED") {
    if (lang === "ID") return `Ya — saya bisa membantu ${kindWord}. Yang mana yang Anda pilih?`;
    return `Yes — I can help with ${kindWord}. Which one would you like?`;
  }
  if (state === "UNAVAILABLE") {
    if (lang === "ID") return `${kindWord.charAt(0).toUpperCase() + kindWord.slice(1)} belum tersedia melalui NEX untuk listingan ini saat ini.`;
    return `${kindWord.charAt(0).toUpperCase() + kindWord.slice(1)} isn't available through NEX for this listing right now.`;
  }
  // UNKNOWN default · honest boundary
  if (lang === "ID") {
    return `Saya belum memiliki akses ${kindWord} terverifikasi untuk listingan ini melalui NEX, jadi saya tidak mau bilang saya bisa melakukan itu kalau tidak bisa saya konfirmasi. Saya bisa bantu Anda mendapatkan info lebih lanjut.`;
  }
  return `I don't have verified ${kindWord} access for these listings through NEX yet, so I don't want to say I can when I can't confirm it. I can help you get more info instead.`;
}

function capabilityClarificationReply(kind: CapabilityKind, vertical: string | null, lang: Lang): string {
  const state = vertical ? lookupCapability(vertical, kind) : "UNKNOWN";
  const kindWord =
    kind === "BOOKING"     ? (lang === "ID" ? "pemesanan" : "booking")
  : kind === "PURCHASE"    ? (lang === "ID" ? "pembelian" : "purchase")
  : (lang === "ID" ? "itu" : "that");

  if (state === "VERIFIED") {
    if (lang === "ID") return `Saya bisa membantu ${kindWord} — beritahu saya yang mana.`;
    return `I can help with ${kindWord} — let me know which one.`;
  }
  // For the exact "what you mean I can't book" pattern · separate source
  // from capability per §6 §8.
  if (lang === "ID") {
    return `Bukan berarti tempatnya sendiri tidak bisa dipesan. Maksud saya, NEX belum memiliki akses ${kindWord} terverifikasi untuk listingan ini, jadi saya tidak mau bilang saya bisa memesan kalau saya belum bisa memastikannya.`;
  }
  return `I don't mean the listings themselves can't be booked. I mean NEX doesn't have verified ${kindWord} access for these yet, so I don't want to say I can book when I can't confirm it.`;
}

// ─── Public gate decision ──────────────────────────────────────

export type CapabilityDisplayGateDecision =
  | { shouldGate: false; reason: string; detection: Detection }
  | {
      shouldGate: true;
      reason: string;
      detection: Detection;
      reply: string;
      language: Lang;
      /** For observability · the specific vertical inferred from session. */
      inferred_vertical: string | null;
      /** For observability · looked-up capability state (if act was capability-related). */
      capability_state: CapabilityState | null;
      /** For DISPLAY_REQUEST · the number of entities re-emitted. */
      display_entity_count: number | null;
    };

export function decideCapabilityDisplayGate(input: {
  userMessage: string;
  session: SessionState | null | undefined;
  activeLanguage: Lang;
}): CapabilityDisplayGateDecision {
  const detection = classifyCapabilityDisplayAct(input.userMessage);
  if (detection.act === "NONE") {
    return { shouldGate: false, reason: "no_capability_or_display_act", detection };
  }

  const { entities, vertical } = extractRecentResults(input.session);
  const lang = input.activeLanguage;

  if (detection.act === "RESULT_DISPLAY_REQUEST") {
    const reply = entities.length > 0
      ? displayReply(entities, vertical, lang)
      : displayNoResultReply(lang);
    return {
      shouldGate: true,
      reason: entities.length > 0 ? "display_from_result_set" : "display_no_result_set",
      detection,
      reply,
      language: lang,
      inferred_vertical: vertical,
      capability_state: null,
      display_entity_count: entities.length,
    };
  }

  if (detection.act === "CAPABILITY_QUESTION") {
    const kind = detection.capability_kind ?? "GENERIC";
    const state = vertical ? lookupCapability(vertical, kind) : "UNKNOWN";
    return {
      shouldGate: true,
      reason: `capability_question:${kind}:${state}`,
      detection,
      reply: capabilityReply(kind, vertical, lang),
      language: lang,
      inferred_vertical: vertical,
      capability_state: state,
      display_entity_count: null,
    };
  }

  if (detection.act === "CAPABILITY_CLARIFICATION") {
    const kind = detection.capability_kind ?? "BOOKING";
    const state = vertical ? lookupCapability(vertical, kind) : "UNKNOWN";
    return {
      shouldGate: true,
      reason: `capability_clarification:${kind}:${state}`,
      detection,
      reply: capabilityClarificationReply(kind, vertical, lang),
      language: lang,
      inferred_vertical: vertical,
      capability_state: state,
      display_entity_count: null,
    };
  }

  return { shouldGate: false, reason: "unhandled_act", detection };
}
