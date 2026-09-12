// src/lib/nex/brain/universal-discovery/interested-message.ts
//
// NEX Universal Discovery Slice · Contextual "I'm interested" prefill
// Philip 2026-09-06 · CEREMONIAL AUTHORIZE
//
// PURPOSE (§14 · §16 · §25)
//   When a user presses "I'm interested" on an entity detail page, NEX
//   drafts a natural conversational opener to the owner that INHERITS
//   the entity context. The user reviews and can edit before sending
//   (§15 user control · §12 not an auto-commitment).
//
// TRUTH RULE (§4 · §14)
//   The prefill uses ONLY known-verified attributes. It NEVER invents
//   a specific fact (a price, a room type, an availability window).
//   When an attribute is not verified, the prefill uses honest phrasing
//   ("could you tell me what rooms are available?" rather than "the
//   deluxe suite for tonight").
//
// PRIVACY (§23)
//   The prefill does NOT include any user phone/email/address/name.
//   The owner receives ONLY the entity context + the user's typed
//   message. The user's NEX ID is the identity primitive.

import type { EntityDetail } from "./entity-detail-contract";
import type { WorldVertical } from "../world-adapters/types";

// ─── Types ──────────────────────────────────────────────────────

export type InterestedPrefill = {
  entity_ref_id: string;
  entity_name: string;
  vertical: WorldVertical;
  message: string;                      // the prefilled opener · editable
  language: "EN" | "ID";
  attributes_referenced: string[];      // audit trail · which entity attrs the message names
};

// ─── Vertical-specific opener templates ────────────────────────
//
// Every template is a PURE FUNCTION of (entity name + a small set of
// KNOWN_YES attributes). Never composes with unverified data. When a
// language flag is ID, the ID variant is used · fallback to EN.

type Composer = (input: {
  name: string;
  location?: string;
  known: Set<string>;                   // attribute keys that are KNOWN_YES on this entity
  lang: "EN" | "ID";
}) => { message: string; attributes_referenced: string[] };

const ACCOMMODATION_COMPOSER: Composer = ({ name, location, known, lang }) => {
  const attrs: string[] = [];
  const roomAsk = known.has("bedrooms") || known.has("room_count")
    ? (lang === "ID" ? " Kamar apa yang tersedia?" : " What rooms are currently available?")
    : (lang === "ID" ? " Bisa beri tahu kamar apa saja yang tersedia saat ini?" : " Could you tell me what rooms are currently available?");
  if (known.has("bedrooms") || known.has("room_count")) attrs.push("bedrooms");
  const locBit = location ? (lang === "ID" ? ` di ${location}` : ` in ${location}`) : "";
  const message = lang === "ID"
    ? `Hi, saya tertarik dengan ${name}${locBit}.${roomAsk}`
    : `Hi, I'm interested in staying at ${name}${locBit}.${roomAsk}`;
  return { message, attributes_referenced: attrs };
};

const FOOD_COMPOSER: Composer = ({ name, location, known, lang }) => {
  const attrs: string[] = [];
  const askBit = known.has("reservations")
    ? (lang === "ID" ? " Apakah bisa reservasi malam ini?" : " Do you take reservations tonight?")
    : (lang === "ID" ? " Bisakah saya tahu jam bukanya?" : " Could you let me know your opening hours?");
  if (known.has("reservations")) attrs.push("reservations");
  const locBit = location ? (lang === "ID" ? ` di ${location}` : ` in ${location}`) : "";
  const message = lang === "ID"
    ? `Hi, saya tertarik dengan ${name}${locBit}.${askBit}`
    : `Hi, I'm interested in eating at ${name}${locBit}.${askBit}`;
  return { message, attributes_referenced: attrs };
};

const COMMERCE_COMPOSER: Composer = ({ name, known, lang }) => {
  const attrs: string[] = [];
  const askBit = known.has("condition")
    ? (lang === "ID" ? " Apakah masih tersedia?" : " Is it still available?")
    : (lang === "ID" ? " Apakah masih tersedia?" : " Is it still available?");
  const message = lang === "ID"
    ? `Hi, saya tertarik dengan ${name}.${askBit}`
    : `Hi, I'm interested in ${name}.${askBit}`;
  return { message, attributes_referenced: attrs };
};

const SERVICE_COMPOSER: Composer = ({ name, location, lang }) => {
  const locBit = location ? (lang === "ID" ? ` di ${location}` : ` in ${location}`) : "";
  const message = lang === "ID"
    ? `Hi, saya tertarik dengan layanan Anda${locBit}. Bisa cerita tentang apa yang bisa Anda bantu?`
    : `Hi, I'm interested in your service${locBit}. Could you tell me a bit about what you can help with?`;
  return { message, attributes_referenced: [] };
};

const TRANSPORT_COMPOSER: Composer = ({ name, lang }) => {
  const message = lang === "ID"
    ? `Hi, saya tertarik dengan ${name}. Apakah masih tersedia?`
    : `Hi, I'm interested in ${name}. Is it still available?`;
  return { message, attributes_referenced: [] };
};

const PLACES_COMPOSER: Composer = ({ name, lang }) => {
  const message = lang === "ID"
    ? `Hi, saya ingin tahu lebih tentang ${name}.`
    : `Hi, I'd like to know more about ${name}.`;
  return { message, attributes_referenced: [] };
};

const COMPOSERS: Record<WorldVertical, Composer> = {
  accommodation: ACCOMMODATION_COMPOSER,
  food:          FOOD_COMPOSER,
  commerce:      COMMERCE_COMPOSER,
  service:       SERVICE_COMPOSER,
  transport:     TRANSPORT_COMPOSER,
  places:        PLACES_COMPOSER,
};

// ─── Public API ─────────────────────────────────────────────────

/** Build a contextual prefilled "I'm interested" opener for the given
 *  entity. The message is a DRAFT · the caller renders it in an
 *  editable field. Sending happens only after explicit user action. */
export function buildInterestedPrefill(input: {
  detail: EntityDetail;
  lang?: "EN" | "ID";
}): InterestedPrefill {
  const { detail } = input;
  const lang = input.lang ?? "EN";
  const composer = COMPOSERS[detail.vertical] ?? PLACES_COMPOSER;
  // Derive known-verified attributes from the detail's rendered
  // sections. A row present in the detail sections with state
  // KNOWN_YES is a verified attribute the composer can safely name.
  const known = new Set<string>();
  for (const section of detail.sections) {
    for (const row of section.rows) {
      if (row.state === "KNOWN_YES") known.add(row.key);
    }
  }
  const { message, attributes_referenced } = composer({
    name: detail.name,
    location: detail.location,
    known,
    lang,
  });
  return {
    entity_ref_id: detail.ref_id,
    entity_name: detail.name,
    vertical: detail.vertical,
    message,
    language: lang,
    attributes_referenced,
  };
}

