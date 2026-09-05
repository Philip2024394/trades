// src/lib/nex/brain/entity-attribute-query.ts
//
// Universal Entity Attribute Question Gate
// Philip 2026-09-06 · AUTHORIZE · UNIVERSAL ENTITY INTELLIGENCE
//
// PURPOSE (§9 §10)
//   Answer questions like:
//     "does the first one have a pool?"
//     "which one has laundry?"
//     "what rooms does the second have?"
//     "do any have breakfast?"
//   from the STRUCTURED entity data (attribute contract) instead of
//   letting the composer inline-fabricate.
//
// CONTRACT (§10)
//   Known-yes    → confident affirmative
//   Known-no     → explicit no (reserved · not derived from silence)
//   Unknown      → "I don't have verified information on that yet"
//   Compare      → answer only from KNOWN_YES entries; explicit
//                  "I only know about X so far" caveat if fewer than
//                  the requested set have data
//
// PRESERVATION
//   Preserves G03 (language), G04 (reference resolution against
//   session.entities), G12 (negated queries), result-followup,
//   capability-display. Runs AFTER those gates.

import type { SessionState, SessionEntity } from "./session";
import type { Lang } from "./language-state";
import type { WorldVertical } from "./world-adapters/types";
import type { EntityCardMemo } from "./entity-result-cards";
import { findAttributeByKeyword, type AttributeState } from "./entity-attribute-contract";

// ─── Types ──────────────────────────────────────────────────────

export type AttributeQueryKind =
  | "HAS_ATTRIBUTE_SINGLE"    // "does the first one have a pool?"
  | "WHICH_HAS_ATTRIBUTE"     // "which one has a pool?"
  | "DO_ANY_HAVE_ATTRIBUTE"   // "do any have breakfast?"
  | "LIST_ATTRIBUTES_OF"      // "what does the first one have?" · "tell me more about the second"
  | "NONE";

export type ReferenceKind =
  | "ORDINAL_FIRST" | "ORDINAL_SECOND" | "ORDINAL_THIRD" | "ORDINAL_LAST"
  | "PRONOUN_IT" | "PRONOUN_THAT" | "PRONOUN_THIS"
  | "ANAPHORIC_THE_ONE"
  | "NONE";

export type AttributeQueryDetection = {
  kind: AttributeQueryKind;
  reference: ReferenceKind;
  keyword: string | null;                 // detected attribute keyword ("pool", "laundry")
  matched_attribute_id: string | null;    // canonicalised via contract lookup
  markers: string[];
  reason: string;
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

// ─── Question-shape detectors ───────────────────────────────────

const HAS_ATTR_STARTS: ReadonlyArray<ReadonlyArray<string>> = [
  ["does"], ["do"], ["is"], ["are"], ["has"], ["have"],
  ["apakah"], ["ada"],
];
const WHICH_STARTS: ReadonlyArray<ReadonlyArray<string>> = [
  ["which"], ["what"],
  ["yang", "mana"],
];
const DO_ANY_STARTS: ReadonlyArray<ReadonlyArray<string>> = [
  ["do", "any"], ["are", "there", "any"], ["is", "there", "any"],
  ["ada", "yang"],
];
const LIST_ATTR_STARTS: ReadonlyArray<ReadonlyArray<string>> = [
  ["what", "does"], ["tell", "me", "more"], ["tell", "me", "about"],
  ["what", "are"], ["what", "features"],
  ["ceritakan"], ["apa", "saja"],
];

// ─── Reference detectors ────────────────────────────────────────

const ORDINAL_MAP: Record<string, ReferenceKind> = {
  "first": "ORDINAL_FIRST", "1st": "ORDINAL_FIRST",
  "second": "ORDINAL_SECOND", "2nd": "ORDINAL_SECOND",
  "third": "ORDINAL_THIRD", "3rd": "ORDINAL_THIRD",
  "last": "ORDINAL_LAST",
  "pertama": "ORDINAL_FIRST", "kedua": "ORDINAL_SECOND",
  "ketiga": "ORDINAL_THIRD", "terakhir": "ORDINAL_LAST",
};
const PRONOUN_MAP: Record<string, ReferenceKind> = {
  "it": "PRONOUN_IT",
  "that": "PRONOUN_THAT",
  "this": "PRONOUN_THIS",
  "itu": "PRONOUN_THAT", "ini": "PRONOUN_THIS",
};

function detectReference(t: string[]): ReferenceKind {
  for (const tok of t) {
    if (ORDINAL_MAP[tok]) return ORDINAL_MAP[tok];
    if (PRONOUN_MAP[tok]) return PRONOUN_MAP[tok];
  }
  // "the one" pattern
  for (let i = 0; i < t.length - 1; i++) {
    if (t[i] === "the" && t[i + 1] === "one") return "ANAPHORIC_THE_ONE";
  }
  return "NONE";
}

// ─── Keyword extraction · via contract (vertical needed) ────────

/** Scan tokens for a match in ANY vertical's contract · used before we
 *  know which vertical the session's cards belong to. */
function findFirstKeywordInMessage(t: string[], vertical: WorldVertical | null): { keyword: string; id: string } | null {
  if (!vertical) return null;
  for (const tok of t) {
    const attr = findAttributeByKeyword(vertical, tok);
    if (attr) return { keyword: tok, id: attr.id };
  }
  // Handle two-word attribute names in the message (e.g. "air conditioning")
  for (let i = 0; i < t.length - 1; i++) {
    const bigram = `${t[i]} ${t[i + 1]}`;
    const attr = findAttributeByKeyword(vertical, bigram);
    if (attr) return { keyword: bigram, id: attr.id };
  }
  return null;
}

// ─── Helpers ────────────────────────────────────────────────────

function startsWithSequence(t: string[], seq: ReadonlyArray<string>): boolean {
  if (seq.length > t.length) return false;
  for (let i = 0; i < seq.length; i++) if (t[i] !== seq[i]) return false;
  return true;
}
function matchAny(t: string[], starts: ReadonlyArray<ReadonlyArray<string>>): boolean {
  return starts.some((seq) => startsWithSequence(t, seq));
}

// ─── Classifier ─────────────────────────────────────────────────

export function classifyAttributeQuery(
  message: string,
  vertical: WorldVertical | null,
): AttributeQueryDetection {
  const t = tokens(message);
  const markers: string[] = [];
  const none = (reason: string): AttributeQueryDetection => ({
    kind: "NONE", reference: "NONE",
    keyword: null, matched_attribute_id: null,
    markers, reason,
  });
  if (t.length === 0 || !vertical) return none("empty_or_no_vertical");

  const reference = detectReference(t);
  const kw = findFirstKeywordInMessage(t, vertical);

  // 4 · LIST_ATTRIBUTES_OF · "tell me more about the second" · "what does the first have?"
  //     Requires a reference; keyword-less.
  if (matchAny(t, LIST_ATTR_STARTS) && reference !== "NONE") {
    markers.push("list_start", `ref:${reference}`);
    return {
      kind: "LIST_ATTRIBUTES_OF",
      reference,
      keyword: null,
      matched_attribute_id: null,
      markers,
      reason: `list_attributes:${reference}`,
    };
  }

  // 3 · DO_ANY_HAVE_ATTRIBUTE · "do any have breakfast?"
  if (matchAny(t, DO_ANY_STARTS) && kw) {
    markers.push("do_any_start", `kw:${kw.keyword}`);
    return {
      kind: "DO_ANY_HAVE_ATTRIBUTE",
      reference: "NONE",
      keyword: kw.keyword,
      matched_attribute_id: kw.id,
      markers,
      reason: `do_any:${kw.id}`,
    };
  }

  // 2 · WHICH_HAS_ATTRIBUTE · "which one has laundry?" · "which one has a pool?"
  if (matchAny(t, WHICH_STARTS) && kw) {
    markers.push("which_start", `kw:${kw.keyword}`);
    return {
      kind: "WHICH_HAS_ATTRIBUTE",
      reference: "NONE",
      keyword: kw.keyword,
      matched_attribute_id: kw.id,
      markers,
      reason: `which_has:${kw.id}`,
    };
  }

  // 1 · HAS_ATTRIBUTE_SINGLE · "does the first one have a pool?"
  //     · in-contract keyword → normal HAS_ATTRIBUTE_SINGLE
  //     · out-of-contract keyword still fires as HAS_ATTRIBUTE_SINGLE with
  //       matched_attribute_id=null so the gate can emit the honest
  //       UNKNOWN reply and prevent the LLM composer from silently
  //       converting UNKNOWN → FALSE ("does not have a helicopter pad").
  if (matchAny(t, HAS_ATTR_STARTS) && reference !== "NONE") {
    if (kw) {
      markers.push("has_start", `ref:${reference}`, `kw:${kw.keyword}`);
      return {
        kind: "HAS_ATTRIBUTE_SINGLE",
        reference,
        keyword: kw.keyword,
        matched_attribute_id: kw.id,
        markers,
        reason: `has_single:${reference}:${kw.id}`,
      };
    }
    // Out-of-contract attribute · try to extract the tail phrase after
    // the possession-verb ("have" / "has" / "punya" / "memiliki") as
    // the query keyword for the reply. Handles EN + ID.
    const possessionVerbs = ["have", "has", "punya", "memiliki", "ada"];
    let verbIdx = -1;
    for (const v of possessionVerbs) {
      const i = t.indexOf(v);
      if (i >= 0) { verbIdx = i; break; }
    }
    const tail = verbIdx >= 0 && verbIdx < t.length - 1
      ? t.slice(verbIdx + 1).filter((x) => x !== "a" && x !== "an" && x !== "the").join(" ")
      : null;
    if (tail) {
      markers.push("has_start_out_of_contract", `ref:${reference}`, `tail:${tail}`);
      return {
        kind: "HAS_ATTRIBUTE_SINGLE",
        reference,
        keyword: tail,
        matched_attribute_id: null,
        markers,
        reason: `has_single_out_of_contract:${reference}:${tail}`,
      };
    }
  }

  return none("no_pattern_matched");
}

// ─── Session helpers ────────────────────────────────────────────

/** Read the entity card memo from the session · written by route.ts
 *  after every result-emitting turn. */
function getEntityCardMemo(session: SessionState | null | undefined): EntityCardMemo[] {
  if (!session) return [];
  const memo = (session as unknown as { entityCardMemo?: EntityCardMemo[] }).entityCardMemo;
  return Array.isArray(memo) ? memo : [];
}

function resolvePositionFromReference(ref: ReferenceKind, memo: EntityCardMemo[]): EntityCardMemo | null {
  if (memo.length === 0) return null;
  switch (ref) {
    case "ORDINAL_FIRST": return memo[0];
    case "ORDINAL_SECOND": return memo[1] ?? null;
    case "ORDINAL_THIRD": return memo[2] ?? null;
    case "ORDINAL_LAST": return memo[memo.length - 1];
    case "PRONOUN_IT":
    case "PRONOUN_THAT":
    case "PRONOUN_THIS":
    case "ANAPHORIC_THE_ONE":
      return memo[0];
    default: return null;
  }
}

function verticalFromMemo(memo: EntityCardMemo[]): WorldVertical | null {
  if (memo.length === 0) return null;
  return memo[0].vertical;
}

// ─── Deterministic reply builders ───────────────────────────────

function displayNameForKeyword(keyword: string, attributeId: string, lang: Lang, vertical: WorldVertical): string {
  const attr = findAttributeByKeyword(vertical, keyword)
    ?? findAttributeByKeyword(vertical, attributeId);
  if (!attr) return keyword;
  return lang === "ID" ? attr.displayId : attr.displayEn;
}

function replyHasSingle(input: {
  entity: EntityCardMemo;
  attrId: string | null;
  keyword: string;
  lang: Lang;
}): string {
  const { entity, attrId, keyword, lang } = input;
  // Out-of-contract keyword · attrId is null → force UNKNOWN so we
  // emit an honest boundary rather than letting the LLM composer
  // convert UNKNOWN into FALSE.
  const state: AttributeState = attrId
    ? (entity.attribute_states[attrId] ?? "UNKNOWN")
    : "UNKNOWN";
  const attrName = attrId
    ? displayNameForKeyword(keyword, attrId, lang, entity.vertical)
    : keyword;
  // 6-state reply routing per §7. UNVERIFIED / STALE / CONFLICTING each
  // get their own honest surface — never conflated with KNOWN_YES.
  if (state === "KNOWN_YES") {
    if (lang === "ID") return `Ya — ${entity.name} punya ${attrName}.`;
    return `Yes — ${entity.name} has ${attrName}.`;
  }
  if (state === "KNOWN_NO") {
    if (lang === "ID") return `Tidak — menurut informasi NEX, ${entity.name} tidak memiliki ${attrName}.`;
    return `No — according to NEX data, ${entity.name} doesn't have ${attrName}.`;
  }
  if (state === "UNVERIFIED") {
    if (lang === "ID") return `${entity.name} tercatat memiliki ${attrName} di direktori, tetapi belum dikonfirmasi langsung oleh pemilik. Mau saya bantu memverifikasinya?`;
    return `${entity.name} is listed as having ${attrName} in the directory, but that hasn't been confirmed by the owner. Want me to help verify?`;
  }
  if (state === "STALE") {
    if (lang === "ID") return `Data ${attrName} untuk ${entity.name} sudah lama tidak diperbarui, jadi saya belum bisa memastikan status terkininya.`;
    return `The ${attrName} information for ${entity.name} hasn't been refreshed in a while, so I can't confirm its current status.`;
  }
  if (state === "CONFLICTING") {
    if (lang === "ID") return `Ada informasi yang saling bertentangan soal ${attrName} untuk ${entity.name}. Sebaiknya konfirmasi langsung dengan mereka.`;
    return `There's conflicting information about ${attrName} for ${entity.name}. Best to check directly with them.`;
  }
  // UNKNOWN · honest boundary · §10 UNKNOWN ≠ NO
  if (lang === "ID") return `Saya belum memiliki informasi terverifikasi soal ${attrName} untuk ${entity.name}. Mau saya bantu cari cara mengonfirmasi?`;
  return `I don't have verified information about ${attrName} for ${entity.name} yet. Want me to help you confirm?`;
}

function replyWhichHas(input: {
  memo: EntityCardMemo[];
  attrId: string;
  keyword: string;
  lang: Lang;
  vertical: WorldVertical;
}): string {
  const { memo, attrId, keyword, lang, vertical } = input;
  const attrName = displayNameForKeyword(keyword, attrId, lang, vertical);
  const verified = memo.filter((m) => m.attribute_states[attrId] === "KNOWN_YES");
  const unverified = memo.filter((m) => m.attribute_states[attrId] === "UNVERIFIED");
  const unknownCount = memo.filter((m) => m.attribute_states[attrId] === "UNKNOWN").length;

  if (verified.length === 0 && unverified.length === 0) {
    if (lang === "ID") return `Saya belum punya info ${attrName} terverifikasi untuk daftar ini. Mau saya bantu cari yang secara khusus punya ${attrName}?`;
    return `I don't have verified ${attrName} information for the current list. Want me to search for ones that specifically offer ${attrName}?`;
  }

  const parts: string[] = [];
  if (verified.length > 0) {
    const names = verified.map((m) => m.name).join(", ");
    parts.push(lang === "ID"
      ? `${names} tercatat punya ${attrName} (terverifikasi).`
      : `${names} — ${attrName} (verified).`);
  }
  if (unverified.length > 0) {
    const names = unverified.map((m) => m.name).join(", ");
    parts.push(lang === "ID"
      ? `${names} tercantum memiliki ${attrName} tapi belum dikonfirmasi pemilik.`
      : `${names} list ${attrName} in the directory but the owner hasn't confirmed it.`);
  }
  if (unknownCount > 0) {
    parts.push(lang === "ID"
      ? `Untuk ${unknownCount} lainnya saya belum punya informasi.`
      : `For the other ${unknownCount}, I don't have information yet.`);
  }
  return parts.join(" ");
}

function replyDoAny(input: {
  memo: EntityCardMemo[];
  attrId: string;
  keyword: string;
  lang: Lang;
  vertical: WorldVertical;
}): string {
  const { memo, attrId, keyword, lang, vertical } = input;
  const attrName = displayNameForKeyword(keyword, attrId, lang, vertical);
  const verified = memo.filter((m) => m.attribute_states[attrId] === "KNOWN_YES");
  const unverified = memo.filter((m) => m.attribute_states[attrId] === "UNVERIFIED");
  const unknownCount = memo.filter((m) => m.attribute_states[attrId] === "UNKNOWN").length;

  if (verified.length === 0 && unverified.length === 0) {
    if (unknownCount > 0) {
      if (lang === "ID") return `Belum ada yang saya konfirmasi memiliki ${attrName}. Untuk ${unknownCount} listing lainnya belum saya tahu.`;
      return `None of them are confirmed to have ${attrName}. I don't have verified info for the other ${unknownCount}.`;
    }
    if (lang === "ID") return `Belum ada yang saya konfirmasi memiliki ${attrName}.`;
    return `I can't confirm any of them offer ${attrName}.`;
  }
  const parts: string[] = [];
  if (verified.length > 0) {
    const names = verified.map((m) => m.name).join(", ");
    parts.push(lang === "ID" ? `Ya — ${names} punya ${attrName} (terverifikasi).` : `Yes — ${names} has ${attrName} (verified).`);
  }
  if (unverified.length > 0) {
    const names = unverified.map((m) => m.name).join(", ");
    parts.push(lang === "ID"
      ? `${names} tercantum memiliki ${attrName} tapi belum dikonfirmasi.`
      : `${names} list ${attrName} in the directory but it hasn't been owner-confirmed.`);
  }
  return parts.join(" ");
}

function replyListAttributes(input: {
  entity: EntityCardMemo;
  lang: Lang;
}): string {
  const { entity, lang } = input;
  if (entity.highlights.length === 0) {
    if (lang === "ID") return `Saya belum punya banyak informasi terverifikasi tentang ${entity.name}. Mau saya bantu cari info kontaknya?`;
    return `I don't have many verified details about ${entity.name} yet. Want me to help find their contact info?`;
  }
  const vertical = entity.vertical;
  const readable = entity.highlights.map((id) => {
    const attr = findAttributeByKeyword(vertical, id);
    if (!attr) return id;
    return lang === "ID" ? attr.displayId : attr.displayEn;
  });
  const list = readable.join(", ");
  if (lang === "ID") return `${entity.name} punya: ${list}.`;
  return `${entity.name} has: ${list}.`;
}

// ─── Public gate decision ──────────────────────────────────────

export type AttributeQueryGateDecision =
  | { shouldGate: false; reason: string; detection: AttributeQueryDetection }
  | {
      shouldGate: true;
      reason: string;
      detection: AttributeQueryDetection;
      reply: string;
      language: Lang;
      resolved_position: number | null;
      resolved_entity_name: string | null;
      /** Full 6-state alphabet plus MIXED (for multi-entity queries) plus
       *  null (no memo). New callers should pattern-match all 8 values. */
      matched_state:
        | "KNOWN_YES" | "KNOWN_NO" | "UNKNOWN"
        | "UNVERIFIED" | "CONFLICTING" | "STALE"
        | "MIXED" | null;
    };

export function decideAttributeQueryGate(input: {
  userMessage: string;
  session: SessionState | null | undefined;
  activeLanguage: Lang;
}): AttributeQueryGateDecision {
  const memo = getEntityCardMemo(input.session);
  const vertical = verticalFromMemo(memo);
  const detection = classifyAttributeQuery(input.userMessage, vertical);
  if (detection.kind === "NONE") {
    return { shouldGate: false, reason: `no_attribute_query:${detection.reason}`, detection };
  }
  // Every attribute-query pathway needs an active card memo.
  if (memo.length === 0 || !vertical) {
    // Fresh conversation · no memoized cards to answer from · honest boundary.
    const reply = input.activeLanguage === "ID"
      ? "Saya belum menampilkan hasil apa pun untuk saya jawab. Mau saya cari sesuatu dulu?"
      : "I haven't shown you any results to answer from yet. Want me to search for something first?";
    return {
      shouldGate: true,
      reason: "no_card_memo",
      detection,
      reply,
      language: input.activeLanguage,
      resolved_position: null,
      resolved_entity_name: null,
      matched_state: null,
    };
  }

  const lang = input.activeLanguage;

  if (detection.kind === "HAS_ATTRIBUTE_SINGLE") {
    const entity = resolvePositionFromReference(detection.reference, memo);
    // detection.keyword is always non-null when this branch fires (the
    // classifier fills either the contract-resolved keyword OR the
    // out-of-contract tail). matched_attribute_id may be null for
    // out-of-contract queries — that still gates as UNKNOWN so the LLM
    // composer cannot convert UNKNOWN → FALSE.
    if (!entity || !detection.keyword) {
      return { shouldGate: false, reason: "reference_or_keyword_unresolved", detection };
    }
    const reply = replyHasSingle({
      entity, attrId: detection.matched_attribute_id, keyword: detection.keyword, lang,
    });
    const matched_state: AttributeState = detection.matched_attribute_id
      ? (entity.attribute_states[detection.matched_attribute_id] ?? "UNKNOWN")
      : "UNKNOWN";
    return {
      shouldGate: true,
      reason: `has_single:${detection.matched_attribute_id ?? "out_of_contract"}:${matched_state}`,
      detection,
      reply,
      language: lang,
      resolved_position: entity.position,
      resolved_entity_name: entity.name,
      matched_state,
    };
  }

  if (detection.kind === "WHICH_HAS_ATTRIBUTE") {
    if (!detection.matched_attribute_id || !detection.keyword) {
      return { shouldGate: false, reason: "attribute_unresolved", detection };
    }
    const reply = replyWhichHas({
      memo, attrId: detection.matched_attribute_id, keyword: detection.keyword, lang, vertical,
    });
    const withKnown = memo.filter((m) => m.attribute_states[detection.matched_attribute_id!] === "KNOWN_YES");
    const matched_state = withKnown.length === 0 ? "UNKNOWN" : "MIXED";
    return {
      shouldGate: true,
      reason: `which_has:${detection.matched_attribute_id}:count=${withKnown.length}`,
      detection,
      reply,
      language: lang,
      resolved_position: null,
      resolved_entity_name: null,
      matched_state,
    };
  }

  if (detection.kind === "DO_ANY_HAVE_ATTRIBUTE") {
    if (!detection.matched_attribute_id || !detection.keyword) {
      return { shouldGate: false, reason: "attribute_unresolved", detection };
    }
    const reply = replyDoAny({
      memo, attrId: detection.matched_attribute_id, keyword: detection.keyword, lang, vertical,
    });
    const withKnown = memo.filter((m) => m.attribute_states[detection.matched_attribute_id!] === "KNOWN_YES");
    const matched_state = withKnown.length === 0 ? "UNKNOWN" : "MIXED";
    return {
      shouldGate: true,
      reason: `do_any:${detection.matched_attribute_id}:count=${withKnown.length}`,
      detection,
      reply,
      language: lang,
      resolved_position: null,
      resolved_entity_name: null,
      matched_state,
    };
  }

  if (detection.kind === "LIST_ATTRIBUTES_OF") {
    const entity = resolvePositionFromReference(detection.reference, memo);
    if (!entity) {
      return { shouldGate: false, reason: "reference_unresolved", detection };
    }
    const reply = replyListAttributes({ entity, lang });
    return {
      shouldGate: true,
      reason: `list:${entity.position}:${entity.highlights.length}`,
      detection,
      reply,
      language: lang,
      resolved_position: entity.position,
      resolved_entity_name: entity.name,
      matched_state: null,
    };
  }

  return { shouldGate: false, reason: "unhandled_kind", detection };
}
