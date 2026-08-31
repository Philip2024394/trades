// src/lib/nex/brain/presentation.ts
//
// Stage 3.34 · Phase 27 · Presentation capability (Philip 2026-08-31).
//
// CONSTITUTIONAL. Vertical-agnostic 3-landscape-card contract.
//
// Same behaviour whether the source is accommodation, food, marketplace,
// service, or transport:
//
//   3 real matches → 3 cards
//   2 real matches → 2 cards
//   1 real match   → 1 card
//   0 real matches → 0 cards (never invent fillers)
//
// Actions are evidence-driven: WhatsApp action exists ONLY when the
// record has a whatsapp number. Booking action exists ONLY when the
// vertical has a real booking integration (none today · Stage 6). No
// "Book now" button on cards that can't actually book anything.
//
// The Brain calls `presentRecords()` with the raw WorldRecords and
// gets back a PresentedCardSet the UI renders directly.

import type { WorldRecord, WorldVertical } from "./world-adapters/types";

/** Action a card exposes · UI decides how to render each. */
export type CardActionKind =
  | "view"        // open the record's detail page
  | "call"        // tel:
  | "whatsapp"    // wa.me link
  | "website"     // external website
  | "directions"  // maps deep-link with lat/lng
  | "message"     // in-app messenger to the seller (Stage 3.32+)
  | "book"        // real booking integration (Stage 6 · not wired yet)
  | "buy"         // real commerce checkout (Stage 6 · not wired yet)
  | "add_to_cart";// marketplace cart add (Stage 6 · not wired yet)

export type CardAction = {
  kind: CardActionKind;
  label: string;   // human-readable · UI may localize
  href?: string;   // resolved deep-link if applicable
  disabled?: boolean;
  reason?: string; // when disabled · e.g. "no live booking connection"
};

/** Card contract · single record's presentation payload. */
export type PresentedCard = {
  id: string;
  vertical: WorldVertical;
  name: string;
  subline?: string;         // "Hotel · Yogyakarta" · "Product · IDR 250,000"
  location?: string;        // "Yogyakarta" or "Near Malioboro"
  heroImage?: string;
  rating?: number;
  reviewCount?: number;
  starRating?: number;
  price?: string;           // pre-formatted display string (e.g. "Rp 250,000") · null when unknown
  amenities?: readonly string[];
  verified?: boolean;
  provenanceLabel: string;  // e.g. "NEX directory · listed"
  /**
   * Stage 3.34 · Phase 27f · Visibility ≠ Ownership doctrine
   * (Philip 2026-08-31). Explicit claim-relationship signal so the UI
   * never implies partnership/endorsement for merely-listed businesses.
   *   "unclaimed" · listed on NEX but the business hasn't claimed its
   *                 NEX presence yet · UI should say "Listed on NEX"
   *                 rather than "NEX partner"
   *   "invited"   · NEX has invited the owner to claim · same as
   *                 unclaimed for UI honesty; a small "invited" hint
   *                 may render if the surface wants to show it
   *   "claimed"   · owner has claimed the listing · UI may say
   *                 "Claimed by owner" · genuine relationship
   *   "member"    · paying subscriber · UI may say "NEX member" ·
   *                 highest ownership tier
   */
  ownershipState?: "unclaimed" | "invited" | "claimed" | "member";
  actions: readonly CardAction[];
};

/** Full presented set · what the composer attaches to its reply. */
export type PresentedCardSet = {
  vertical: WorldVertical;
  cards: readonly PresentedCard[];
  /** Total available before the top-3 slice · lets the composer say
   *  "3 of 42 matches" when it's honest to. */
  totalAvailable: number;
  /** Present-tense summary the composer can use verbatim in its reply. */
  headline: string;
  /** Non-null when Presentation had to omit something honest (e.g.
   *  fewer than 3 real matches). Composer surfaces this in its reply. */
  caveat?: string;
};

/**
 * Stage 3.34 · Phase 27c · Expanded results page (Philip 2026-08-31).
 *
 * When a user asks "show me more" / "show the list" / "next" / "give
 * me all", the app opens an expanded results surface: 10 landscape
 * cards per page with pagination. Vertical-agnostic — same shape
 * whether the source is accommodation, food, commerce, service,
 * transport, or places.
 *
 * The SAME live World records that populate the 3 conversational
 * cards populate this expanded page · no separate retrieval, no
 * duplicated data layer, no divergence.
 */
export type ExpandedResultsPage = {
  vertical: WorldVertical;
  /** Cards on this page · at most `pageSize` (default 10) · fewer
   *  when it's the last page. Never fabricates fillers. */
  cards: readonly PresentedCard[];
  /** 1-based page index. */
  currentPage: number;
  /** Total pages available · derived from totalAvailable/pageSize. */
  totalPages: number;
  /** Total records available across all pages (same as PresentedCardSet.totalAvailable). */
  totalAvailable: number;
  /** Records-per-page cap · doctrine default 10. */
  pageSize: number;
  /** Convenience for UI pagination controls. */
  hasNext: boolean;
  hasPrev: boolean;
  /** Present-tense summary the composer can use verbatim. */
  headline: string;
  /** Honest caveat when the page is empty or short. */
  caveat?: string;
};

/**
 * Build the presented card set from raw WorldRecords.
 *
 * @param records   The retrieval result · adapter-ordered (highest-ranked first).
 * @param totalAvailable Total before pagination (from WorldSearchResult).
 * @param opts.max  Cap on cards to present (default 3 per Philip's doctrine).
 */
export function presentRecords(input: {
  records: readonly WorldRecord[];
  totalAvailable: number;
  vertical: WorldVertical;
  max?: number;
}): PresentedCardSet {
  const max = input.max ?? 3;
  const take = input.records.slice(0, max);
  const cards = take.map((r) => buildCard(r));

  const headline = buildHeadline({
    vertical: input.vertical,
    presented: cards.length,
    total: input.totalAvailable,
  });

  const caveat =
    cards.length === 0
      ? "no_real_matches"
      : cards.length < max && input.totalAvailable === cards.length
        ? `only_${cards.length}_available`
        : undefined;

  return {
    vertical: input.vertical,
    cards,
    totalAvailable: input.totalAvailable,
    headline,
    caveat,
  };
}

/**
 * Stage 3.34 · Phase 27c · Build an expanded 10-card page from a raw
 * World retrieval result.
 *
 * Vertical-agnostic · same behaviour whether accommodation, food,
 * commerce, service, transport, places.
 *
 * @param records    Full retrieval slice for this page · caller decides
 *                   the offset/limit at the adapter layer OR passes the
 *                   full available set and lets this function slice.
 * @param totalAvailable Total across ALL pages (from the adapter).
 * @param vertical   Vertical for headline noun + card action shape.
 * @param page       1-based page index · default 1.
 * @param pageSize   Records per page · doctrine default 10.
 * @param preSliced  When true, `records` is ALREADY sliced for the page.
 *                   When false (default), this function slices from
 *                   records using page/pageSize.
 */
export function presentRecordsExpanded(input: {
  records: readonly WorldRecord[];
  totalAvailable: number;
  vertical: WorldVertical;
  page?: number;
  pageSize?: number;
  preSliced?: boolean;
}): ExpandedResultsPage {
  const pageSize = input.pageSize ?? 10;
  const currentPage = Math.max(1, input.page ?? 1);
  const totalPages = Math.max(1, Math.ceil(input.totalAvailable / pageSize));

  const sliced = input.preSliced
    ? input.records
    : input.records.slice((currentPage - 1) * pageSize, currentPage * pageSize);

  const cards = sliced.map((r) => buildCard(r));

  const headline = buildExpandedHeadline({
    vertical: input.vertical,
    page: currentPage,
    totalPages,
    total: input.totalAvailable,
  });

  const caveat =
    input.totalAvailable === 0 ? "no_real_matches"
    : cards.length === 0        ? "page_out_of_range"
    : undefined;

  return {
    vertical: input.vertical,
    cards,
    currentPage,
    totalPages,
    totalAvailable: input.totalAvailable,
    pageSize,
    hasNext: currentPage < totalPages,
    hasPrev: currentPage > 1,
    headline,
    caveat,
  };
}

function buildExpandedHeadline(input: {
  vertical: WorldVertical;
  page: number;
  totalPages: number;
  total: number;
}): string {
  const noun = HEADLINE_NOUN[input.vertical];
  if (input.total === 0) return `No real ${noun.plural} matched.`;
  if (input.totalPages === 1) {
    return input.total === 1
      ? `Full list · 1 real ${noun.singular}.`
      : `Full list · ${input.total} real ${noun.plural}.`;
  }
  return `Page ${input.page} of ${input.totalPages} · ${input.total} real ${noun.plural} total.`;
}

// ─── Card construction ───────────────────────────────────────────────

function buildCard(r: WorldRecord): PresentedCard {
  return {
    id:       r.id,
    vertical: r.vertical,
    name:     r.name,
    subline:  buildSubline(r),
    location: buildLocation(r),
    heroImage: r.heroImage,
    rating: r.rating,
    reviewCount: r.reviewCount,
    starRating: r.starRating,
    price: formatPrice(r),
    amenities: r.amenities,
    verified: r.verified,
    provenanceLabel: buildProvenanceLabel(r),
    ownershipState: buildOwnershipState(r),
    actions: buildActions(r),
  };
}

/**
 * Visibility ≠ Ownership · Philip 2026-08-31 doctrine.
 *
 * A row with claim_status="listed" is legitimately visible in the
 * directory even though the business hasn't claimed its NEX presence.
 * The UI must NOT imply partnership. This function collapses the
 * DB-native claim_status into a UI-facing ownership tier so the copy
 * layer can render "Listed on NEX" vs "Claimed by owner" vs "NEX
 * member" without pretending relationships that don't exist.
 */
function buildOwnershipState(r: WorldRecord): PresentedCard["ownershipState"] {
  switch (r.claimStatus) {
    case "listed":  return "unclaimed";
    case "invited": return "invited";
    case "claimed": return "claimed";
    case "paying":  return "member";
    default:        return undefined;
  }
}

function buildSubline(r: WorldRecord): string | undefined {
  const parts: string[] = [];
  if (r.category) parts.push(capitalize(r.category));
  if (r.city) parts.push(r.city);
  return parts.length > 0 ? parts.join(" · ") : undefined;
}

function buildLocation(r: WorldRecord): string | undefined {
  if (r.area && r.city) return `${capitalize(r.area)} · ${r.city}`;
  return r.area ? capitalize(r.area) : r.city;
}

function formatPrice(r: WorldRecord): string | undefined {
  if (r.price != null) {
    return `Rp ${r.price.toLocaleString("id-ID")}`;
  }
  if (r.priceRange) {
    const { min, max, currency } = r.priceRange;
    return `${currency} ${min.toLocaleString("id-ID")}–${max.toLocaleString("id-ID")}`;
  }
  return undefined; // Absent price stays absent. Never manufacture "From Rp 350,000".
}

function buildProvenanceLabel(r: WorldRecord): string {
  const tierLabel =
    r.provenance.sourceTier === "directory_live" ? "NEX directory"
    : r.provenance.sourceTier === "live_api"     ? "Live source"
    : r.provenance.sourceTier === "editorial"    ? "Editorial"
    : /* curated */                                "Curated";
  const claimLabel =
    r.claimStatus === "claimed" || r.claimStatus === "paying" ? "claimed"
    : r.claimStatus === "invited" ? "invited"
    : r.claimStatus === "listed"  ? "listed"
    : undefined;
  return claimLabel ? `${tierLabel} · ${claimLabel}` : tierLabel;
}

// ─── Action derivation · evidence-driven ─────────────────────────────

function buildActions(r: WorldRecord): readonly CardAction[] {
  const actions: CardAction[] = [];

  // View · always available for records with an id.
  actions.push({
    kind: "view",
    label: "View",
    href: `/nex-app/centre?ref=${encodeURIComponent(r.id)}`,
  });

  // WhatsApp · only when the record actually has a whatsapp number.
  if (r.whatsapp) {
    actions.push({
      kind: "whatsapp",
      label: "WhatsApp",
      href: `https://wa.me/${sanitizePhone(r.whatsapp)}`,
    });
  }

  // Call · only when phone exists.
  if (r.phone) {
    actions.push({
      kind: "call",
      label: "Call",
      href: `tel:${sanitizePhone(r.phone)}`,
    });
  }

  // Website · only when website exists.
  if (r.website) {
    actions.push({
      kind: "website",
      label: "Website",
      href: r.website,
    });
  }

  // Directions · only when we have coords.
  if (r.latitude != null && r.longitude != null) {
    actions.push({
      kind: "directions",
      label: "Directions",
      href: `https://maps.google.com/?q=${r.latitude},${r.longitude}`,
    });
  }

  // Book · vertical-specific · currently no live booking integration.
  // Surface as disabled with the reason so the UI can render "coming
  // soon" rather than a fake enabled button.
  if (r.vertical === "accommodation") {
    actions.push({
      kind: "book",
      label: "Book",
      disabled: true,
      reason: "no_live_booking_integration",
    });
  }

  // Buy / add_to_cart · commerce vertical only · same disabled honesty.
  if (r.vertical === "commerce") {
    actions.push(
      { kind: "add_to_cart", label: "Add to cart", disabled: true, reason: "no_commerce_checkout_yet" },
      { kind: "buy",         label: "Buy now",     disabled: true, reason: "no_commerce_checkout_yet" },
    );
  }

  return actions;
}

// ─── Copy helpers ────────────────────────────────────────────────────

function buildHeadline(input: { vertical: WorldVertical; presented: number; total: number }): string {
  const noun = HEADLINE_NOUN[input.vertical];
  if (input.presented === 0) {
    return `No real ${noun.plural} matched.`;
  }
  if (input.total === input.presented) {
    // We're showing everything we found.
    return input.presented === 1
      ? `Found 1 real ${noun.singular}.`
      : `Found ${input.presented} real ${noun.plural}.`;
  }
  // We're showing top N of a larger set.
  return `Showing ${input.presented} of ${input.total} real ${noun.plural}.`;
}

const HEADLINE_NOUN: Record<WorldVertical, { singular: string; plural: string }> = {
  accommodation: { singular: "stay",     plural: "stays"      },
  food:          { singular: "place",    plural: "places"     },
  service:       { singular: "provider", plural: "providers"  },
  commerce:      { singular: "product",  plural: "products"   },
  transport:     { singular: "option",   plural: "options"    },
  places:        { singular: "place",    plural: "places"     },
};

function capitalize(s: string): string {
  return s.length > 0 ? s[0].toUpperCase() + s.slice(1) : s;
}

function sanitizePhone(s: string): string {
  // wa.me + tel: both want digits only, no leading +.
  return s.replace(/[^\d]/g, "");
}
