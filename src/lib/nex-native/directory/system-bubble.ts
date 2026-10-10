// src/lib/nex-native/directory/system-bubble.ts
//
// NEX Directory · Phase C (Agent C) · the "first-contact" system bubble.
//
// What this module is
//   · A pure function that composes the single system message that is
//     written into a listing-chat thread the first time a visitor opens
//     a conversation against an unclaimed canonical business.
//   · A sealed meta.kind marker so later readers (owner inbox, UI
//     grouping, retention policy) can identify this bubble without
//     string-matching the body.
//
// What this module is NOT
//   · Not a writer · the composer that calls this function is in
//     `./listing-chat-actions.ts` and reuses the sealed listing-chat
//     service for persistence.
//   · Not an owner-invite composer · owner invite email copy lives in
//     the sealed `src/lib/nex/listing-chat/owner-invite.ts`. This file
//     is strictly the in-thread bubble shown to the visitor + owner.
//   · Not a template engine · the function has one shape and returns
//     one string per call.
//
// Doctrine references
//   · Doctrine #7 · the message IS a two-party envelope · the sealed
//     meta.kind marker never leaks beyond the two parties.
//   · No fabrication · the location phrase is only included when the
//     visitorLocation.city is a non-empty string.
//   · Length bound · migration 165's `listing_message.body` CHECK
//     restricts bodies to 1–4000 chars. This composer additionally
//     caps at 240 chars so the bubble renders as a single visual beat
//     inside the chat UI (the UI layer is Agent B's).
//
// Pure · deterministic · zero side effects.

/**
 * Sealed meta.kind marker.
 *
 * The actions layer writes this value into `nex.listing_message.meta`
 * for the system bubble so later readers can identify the first-contact
 * bubble without string-matching the body (which is translated and
 * subject to copy iteration). The value is a sealed string literal · it
 * is NOT a version namespace that walks forward on cosmetic copy
 * changes · bump the suffix ("_v2") only when the SEMANTICS of the
 * bubble change (e.g. the ownership-claim invitation is removed).
 */
export const SYSTEM_BUBBLE_META_KIND = "nex_directory_first_contact_v1" as const;

/**
 * Maximum length of the composed body in characters.
 *
 * Chosen so the bubble occupies a single visual beat inside the chat
 * stream. Well below the sealed migration-165 ceiling of 4000.
 */
export const SYSTEM_BUBBLE_MAX_CHARS = 240 as const;

/**
 * Honest-location shape · the composer accepts an optional
 * `visitorLocation` and only includes a city phrase when
 * `visitorLocation.city` is a non-empty string. The `country` field is
 * accepted for forward-compatibility (a future copy variant might
 * include "a customer in the UK") but is NOT read today · adding it to
 * the body silently would be fabrication the moment a caller passed a
 * country without a city.
 */
export interface VisitorLocationHint {
  readonly city?: string | null;
  readonly country?: string | null;
}

export interface BuildSystemBubbleArgs {
  readonly businessName: string;
  readonly visitorLocation?: VisitorLocationHint | null;
}

/**
 * Compose the first-contact system bubble.
 *
 * Shape (with city):
 *   "Hi — a customer in <city> would like to connect with you. Reply
 *    here to say hello. If you own this business, you can claim your
 *    free NEX listing while you're here."
 *
 * Shape (without city):
 *   "Hi — a customer would like to connect with you. Reply here to say
 *    hello. If you own this business, you can claim your free NEX
 *    listing while you're here."
 *
 * The business name is NOT woven into the body today · the owner reads
 * the thread already scoped to their listing · repeating the business
 * name inside the bubble is noise. The argument is still accepted so
 * the signature can carry it when copy evolves.
 *
 * Length guard: the function enforces `≤ 240 chars` by truncating
 * conservatively at the last word boundary before 240 chars and
 * appending `"…"`. This path only triggers if the copy is deliberately
 * extended in a future revision · the current baseline bodies are well
 * under the cap.
 */
export function buildSystemBubble(args: BuildSystemBubbleArgs): string {
  // Honest city: only treat `city` as present when it's a non-empty
  // string after trim. undefined / null / empty / whitespace → no city.
  const rawCity = args.visitorLocation?.city;
  const city =
    typeof rawCity === "string" && rawCity.trim().length > 0
      ? rawCity.trim()
      : null;

  const customerPhrase = city !== null
    ? `a customer in ${city} would like to connect with you`
    : `a customer would like to connect with you`;

  const body =
    `Hi — ${customerPhrase}. ` +
    `Reply here to say hello. ` +
    `If you own this business, you can claim your free NEX listing while you're here.`;

  // Reference `businessName` so future copy variants that weave it in
  // need not change the signature. Explicitly noop-reads it today.
  void args.businessName;

  if (body.length <= SYSTEM_BUBBLE_MAX_CHARS) return body;

  // Truncation path · defensive against future copy edits that push past
  // the 240 ceiling. Cuts at the last word boundary that fits once an
  // ellipsis is appended; falls back to a hard slice if there is no
  // whitespace at all (impossible for the current body, kept for
  // completeness). The ellipsis character ("…") counts as one char.
  const roomForText = SYSTEM_BUBBLE_MAX_CHARS - 1;
  const sliced = body.slice(0, roomForText);
  const lastSpace = sliced.lastIndexOf(" ");
  const base = lastSpace > 0 ? sliced.slice(0, lastSpace) : sliced;
  return `${base}…`;
}
