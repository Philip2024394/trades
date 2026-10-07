// src/app/nex-native/nex-socials/_intent-catalog.ts
//
// NEX Socials · single source of truth for the four sealed intents
// (business · new_friends · dating · nightlife). The signup invite
// card, the landing chooser, the per-intent discover route, the lens
// banner on the discover canvas AND the InviteMeetPanel CTA label
// ALL read from here · the labels, emojis, blurbs and sealed DB
// token names cannot drift between surfaces.
//
// The DB token names (`business`, `new_friends`, `dating`, `nightlife`)
// MUST match the CHECK constraint in migration 145 verbatim. Adding
// a new intent requires both a follow-up migration AND an entry here.
//
// Founder-sealed labels + copy 2026-10-07 · see latest socials brief.

import type { SocialIntent } from "./_actions";

export interface IntentCatalogEntry {
  readonly intent: SocialIntent;
  /** Tile headline · ALLCAPS treatment on the landing. */
  readonly label: string;
  /** Sentence-case display label for chips / banners / breadcrumbs. */
  readonly displayLabel: string;
  /** Short chip label (fits in a top-of-canvas switcher pill). */
  readonly shortLabel: string;
  /** Tile emoji / lens glyph (sealed per founder brief). */
  readonly emoji: string;
  /** Landing tile description · one sentence · inviting. */
  readonly blurb: string;
  /** Tile CTA label · "Explore Business" / "Find Friends" / etc. */
  readonly ctaLabel: string;
  /** Banner subtitle on the per-intent discover canvas. */
  readonly lensSubtitle: string;
  /** InviteMeetPanel primary action label when this is the current lens. */
  readonly inviteCtaLabel: string;
  /** Whether this lens offers the optional NEX Theme gift ice-breaker. */
  readonly supportsThemeGift: boolean;
}

export const INTENT_CATALOG: readonly IntentCatalogEntry[] = [
  {
    intent: "business",
    label: "BUSINESS",
    displayLabel: "Business",
    shortLabel: "Business",
    emoji: "💼",
    blurb:
      "Meet professionals, businesses and people in your industry.",
    ctaLabel: "Explore Business",
    lensSubtitle: "Showing people here for business",
    inviteCtaLabel: "Send Meet Invite",
    supportsThemeGift: false,
  },
  {
    intent: "new_friends",
    label: "NEW FRIENDS",
    displayLabel: "New Friends",
    shortLabel: "Friends",
    emoji: "🤝",
    blurb:
      "Meet people who are looking to make new friends.",
    ctaLabel: "Find Friends",
    lensSubtitle: "Showing people here to make new friends",
    inviteCtaLabel: "Send Friend Invite",
    supportsThemeGift: false,
  },
  {
    intent: "dating",
    label: "DATING",
    displayLabel: "Dating",
    shortLabel: "Dating",
    emoji: "❤️",
    blurb:
      "Meet someone who is looking for the same connection.",
    ctaLabel: "Explore Dating",
    lensSubtitle: "Showing people here for dating",
    inviteCtaLabel: "Send Interest",
    supportsThemeGift: true,
  },
  {
    intent: "nightlife",
    label: "NIGHT LIFE",
    displayLabel: "Night Life",
    shortLabel: "Night Life",
    emoji: "🌙",
    blurb:
      "Meet people looking to go out, have fun and share the night.",
    ctaLabel: "Explore Night Life",
    lensSubtitle: "Showing people out and about tonight",
    inviteCtaLabel: "Send Invite",
    supportsThemeGift: true,
  },
] as const;

export const INTENT_BY_TOKEN: Record<SocialIntent, IntentCatalogEntry> =
  Object.fromEntries(
    INTENT_CATALOG.map((e) => [e.intent, e]),
  ) as Record<SocialIntent, IntentCatalogEntry>;

/** Type-safe parser for URL [intent] segment · returns null if the token
 *  isn't one of the sealed four. Use at route boundaries. */
export function parseIntentToken(raw: string | undefined): SocialIntent | null {
  if (!raw) return null;
  const match = INTENT_CATALOG.find((e) => e.intent === raw);
  return match ? match.intent : null;
}
