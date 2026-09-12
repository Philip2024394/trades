// src/lib/nex/brain/universal-discovery/entity-detail-contract.ts
//
// NEX Universal Discovery Slice · Entity Detail Contract
// Philip 2026-09-06 · CEREMONIAL AUTHORIZE
//
// PURPOSE (§8 · §11)
//   Universal shell for the full entity detail page. The SECTIONS
//   adapt per vertical (accommodation shows rooms + facilities · food
//   shows cuisine + hours · commerce shows specifications + condition
//   etc.), but the CONTRACT is one.
//
// TRUTH RULE (§4 · §6 · §10 · §14)
//   Every field carries its AttributeState (KNOWN_YES / KNOWN_NO /
//   UNKNOWN / UNVERIFIED / CONFLICTING / STALE). The detail page
//   NEVER converts absence into presence. Empty sections are hidden
//   entirely rather than showing "unknown" boilerplate.
//
// PRESERVES
//   Universal Entity Intelligence Delta v2. This module composes ON
//   TOP OF projectAttributes() + computeCoverage() from
//   entity-attribute-contract.ts · zero duplication.

import type { PresentedCard } from "../presentation";
import type { WorldRecord, WorldVertical } from "../world-adapters/types";
import type { AttributeMap, AttributeMapEntry, AttributeState, InformationCoverage } from "../entity-attribute-contract";
import { projectAttributes, computeCoverage } from "../entity-attribute-contract";

// ─── Types ──────────────────────────────────────────────────────

/** A single verified image on the entity. Multiple = gallery. */
export type EntityImage = {
  url: string;
  alt: string;
  is_primary: boolean;
  source: string;                       // provenance label · e.g. "openstreetmap" / "owner"
};

/** One row of the details section · label + value + evidence state.
 *  Rendered with a hedge affordance when state ≠ KNOWN_YES · never
 *  rendered when state === UNKNOWN or KNOWN_NO (empty · caller filters). */
export type DetailRow = {
  key: string;                          // stable id · matches AttributeMap key when applicable
  label: string;                        // human-readable label ("Bedrooms", "Wi-Fi")
  value: string;                        // formatted display value
  state: AttributeState;
  source_hint?: string;                 // "verified by owner" / "from OpenStreetMap" / etc.
};

/** A section of the detail page. `rows` may be empty · caller omits
 *  the whole section in that case (§8 "Do not show empty sections"). */
export type DetailSection = {
  id: string;                           // stable id · "facilities" / "rooms" / "cuisine" / "specs"
  title: string;                        // human-readable section title
  rows: DetailRow[];
};

/** Universal contact-capability snapshot. Presence of a channel here
 *  DOES NOT imply commercial capability (§24 capability separation).
 *  "phone: present" means "user can call this number", not "you can
 *  book by phone". */
export type ContactCapability = {
  phone?: { value: string; state: AttributeState };
  whatsapp?: { value: string; state: AttributeState };
  website?: { value: string; state: AttributeState };
  address?: { value: string; state: AttributeState };
};

/** Trust / freshness footer. §18 · "make trust understandable without
 *  overwhelming". Owner-verified = strongest · directory-evidence
 *  weaker · stale flagged. */
export type TrustSummary = {
  owner_verified: boolean;
  primary_source: string;               // "OpenStreetMap community" / "Owner" / etc.
  last_verified?: string;               // ISO timestamp · may be missing
  is_stale: boolean;                    // true when past freshness window per Delta v2
};

/** Universal full-detail payload · agnostic to vertical at the shell
 *  level, adaptive at the section level. */
export type EntityDetail = {
  ref_id: string;
  vertical: WorldVertical;
  card: PresentedCard;                  // reuses the same PresentedCard shape as the result card
  name: string;
  category?: string;
  location?: string;
  images: EntityImage[];                // may be empty · caller renders placeholder
  summary: string | null;               // 1-2 sentence honest overview or null when no evidence
  sections: DetailSection[];            // adaptive · empty ones filtered out
  contact: ContactCapability;
  trust: TrustSummary;
  coverage: InformationCoverage;
  /** Owner-conversation eligibility. True ONLY when we have a resolvable
   *  contact channel AND ownership evidence is at least UNVERIFIED
   *  (existence-in-directory is enough for "Interested" · full owner
   *  verification is a stronger state exposed via trust.owner_verified). */
  interested_enabled: boolean;
};

// ─── Vertical-specific section builders ─────────────────────────

/** Ordered lists of attribute ids per vertical for each section.
 *  Ordering = display priority. Attributes not present in an entity
 *  are simply skipped. NEW verticals get added here · zero new modules. */
const SECTION_MAP: Record<WorldVertical, Array<{ id: string; title: string; keys: string[] }>> = {
  accommodation: [
    { id: "rooms",       title: "Rooms",      keys: ["bedrooms", "bathrooms", "capacity", "room_count", "star_rating"] },
    { id: "facilities",  title: "Facilities", keys: ["pool", "private_pool", "full_kitchen", "wifi", "ac", "parking", "breakfast", "restaurant", "laundry", "airport_transfer", "gym", "spa", "room_service", "housekeeping"] },
  ],
  food: [
    { id: "food_info",   title: "Food",       keys: ["cuisine", "signature_dish", "vegetarian", "vegan", "halal"] },
    { id: "service",     title: "Service",    keys: ["delivery", "takeaway", "reservations", "outdoor_seating", "wifi", "parking"] },
  ],
  service: [
    { id: "capability",  title: "Capabilities", keys: ["emergency", "free_quote", "personal_trainer", "group_classes", "showers"] },
  ],
  commerce: [
    { id: "product",     title: "Details",    keys: ["price", "condition", "brand", "model", "warranty"] },
  ],
  transport: [
    { id: "transport",   title: "Vehicle",    keys: ["vehicle_type", "seats", "features"] },
  ],
  places: [
    { id: "place",       title: "About",      keys: ["opening_hours", "entry_fee"] },
  ],
};

// ─── Detail projection ─────────────────────────────────────────

/** Build a universal EntityDetail from a WorldRecord + the same
 *  PresentedCard the result card used. Pure · no I/O. */
export function projectEntityDetail(input: {
  record: WorldRecord;
  card: PresentedCard;
}): EntityDetail {
  const { record, card } = input;
  const attributes = projectAttributes(record);
  const coverage = computeCoverage(attributes);
  const images = extractImages(record);
  const location = extractLocation(record);
  const sections = buildSections(record.vertical, attributes, record);
  const contact = buildContact(attributes, record);
  const trust = buildTrust(record, attributes);
  const summary = buildSummary(record, attributes);
  const interested_enabled = hasResolvableOwnerContact(contact) || record.claimStatus === "claimed";
  return {
    ref_id: `place:${record.vertical}:${record.id}`,
    vertical: record.vertical,
    card,
    name: record.name,
    category: record.category ?? undefined,
    location: location ?? undefined,
    images,
    summary,
    sections,
    contact,
    trust,
    coverage,
    interested_enabled,
  };
}

// ─── Helpers ──────────────────────────────────────────────────

function extractImages(record: WorldRecord): EntityImage[] {
  const out: EntityImage[] = [];
  const heroImage = (record as unknown as { heroImage?: string }).heroImage;
  if (typeof heroImage === "string" && heroImage.length > 0) {
    out.push({
      url: heroImage,
      alt: record.name,
      is_primary: true,
      source: providerLabel(record),
    });
  }
  // Multi-image gallery support · when adapters populate `images[]` on
  // the WorldRecord (currently accommodation adapters don't · food
  // adapter may · commerce yes). Fail-safe: skip when the field is
  // absent. Never fabricate an image (§9).
  const gallery = (record as unknown as { images?: Array<{ url?: string; alt?: string; source?: string }> }).images;
  if (Array.isArray(gallery)) {
    for (const img of gallery) {
      if (typeof img?.url !== "string" || img.url.length === 0) continue;
      if (out.some((e) => e.url === img.url)) continue;
      out.push({
        url: img.url,
        alt: typeof img.alt === "string" && img.alt.length > 0 ? img.alt : record.name,
        is_primary: false,
        source: typeof img.source === "string" && img.source.length > 0 ? img.source : providerLabel(record),
      });
    }
  }
  return out;
}

function extractLocation(record: WorldRecord): string | null {
  const city = (record as unknown as { city?: string }).city;
  const area = (record as unknown as { area?: string }).area;
  const parts = [area, city].filter((s): s is string => typeof s === "string" && s.length > 0);
  return parts.length > 0 ? parts.join(", ") : null;
}

function buildSections(vertical: WorldVertical, attributes: AttributeMap, record: WorldRecord): DetailSection[] {
  const specs = SECTION_MAP[vertical] ?? [];
  // AttributeMap is a ReadonlyArray of AttributeMapEntry · index by id.
  const byId = new Map<string, AttributeMapEntry>();
  for (const entry of attributes) byId.set(entry.attribute.id, entry);
  const out: DetailSection[] = [];
  for (const spec of specs) {
    const rows: DetailRow[] = [];
    for (const key of spec.keys) {
      const entry = byId.get(key);
      if (!entry) continue;
      // Only render KNOWN_YES / UNVERIFIED / CONFLICTING / STALE. KNOWN_NO
      // and UNKNOWN are silence per §4 (never show negative or missing
      // facts as "unknown" boilerplate).
      if (entry.state === "KNOWN_NO" || entry.state === "UNKNOWN") continue;
      rows.push({
        key,
        label: entry.attribute.displayEn ?? labelOf(key),
        value: formatValueFromRecord(key, record),
        state: entry.state,
        source_hint: sourceHintFor(entry),
      });
    }
    if (rows.length > 0) out.push({ id: spec.id, title: spec.title, rows });
  }
  return out;
}

function buildContact(attributes: AttributeMap, record: WorldRecord): ContactCapability {
  const byId = new Map<string, AttributeMapEntry>();
  for (const entry of attributes) byId.set(entry.attribute.id, entry);
  const contact: ContactCapability = {};
  const phone = byId.get("phone");
  const wa    = byId.get("whatsapp");
  const site  = byId.get("website");
  const addr  = byId.get("address");
  // Read the actual value directly from the record (AttributeMapEntry
  // tracks state and evidence, not the raw value).
  const rawPhone   = (record as unknown as { phone?: unknown }).phone;
  const rawWa      = (record as unknown as { whatsapp?: unknown }).whatsapp;
  const rawSite    = (record as unknown as { website?: unknown }).website;
  const rawAddress = (record as unknown as { address?: unknown }).address;
  if (phone && phone.state !== "UNKNOWN" && phone.state !== "KNOWN_NO" && typeof rawPhone === "string" && rawPhone.length > 0) {
    contact.phone = { value: rawPhone, state: phone.state };
  }
  if (wa && wa.state !== "UNKNOWN" && wa.state !== "KNOWN_NO" && typeof rawWa === "string" && rawWa.length > 0) {
    contact.whatsapp = { value: rawWa, state: wa.state };
  }
  if (site && site.state !== "UNKNOWN" && site.state !== "KNOWN_NO" && typeof rawSite === "string" && rawSite.length > 0) {
    contact.website = { value: rawSite, state: site.state };
  }
  if (addr && addr.state !== "UNKNOWN" && addr.state !== "KNOWN_NO" && typeof rawAddress === "string" && rawAddress.length > 0) {
    contact.address = { value: rawAddress, state: addr.state };
  }
  return contact;
}

function sourceHintFor(entry: AttributeMapEntry): string | undefined {
  if (entry.state === "KNOWN_YES") return "verified";
  if (entry.state === "UNVERIFIED") return "from directory";
  if (entry.state === "STALE") return "may be out of date";
  if (entry.state === "CONFLICTING") return "sources disagree";
  return undefined;
}

function formatValueFromRecord(key: string, record: WorldRecord): string {
  // Prefer a directly-typed field on the record when it exists (rating,
  // bedrooms, price, etc.); otherwise show "Yes" — a KNOWN_YES amenity
  // token has no numeric value.
  const anyRec = record as unknown as Record<string, unknown>;
  const v = anyRec[key];
  if (v === undefined || v === null) return "Yes";
  if (typeof v === "boolean") return v ? "Yes" : "No";
  if (typeof v === "number") {
    if (key === "price") return `Rp ${v.toLocaleString("id-ID")}`;
    return String(v);
  }
  if (typeof v === "string") return v;
  return String(v);
}

function buildTrust(record: WorldRecord, attributes: AttributeMap): TrustSummary {
  const ownerVerified = record.claimStatus === "claimed" && record.verified === true;
  const provider = providerLabel(record);
  const lastVerified = (record as unknown as { provenance?: { readAt?: string } }).provenance?.readAt;
  const isStale = attributes.some((a) => a.state === "STALE");
  return {
    owner_verified: ownerVerified,
    primary_source: provider,
    last_verified: typeof lastVerified === "string" ? lastVerified : undefined,
    is_stale: isStale,
  };
}

function buildSummary(record: WorldRecord, attributes: AttributeMap): string | null {
  const parts: string[] = [];
  const cat = record.category?.replace(/[_-]/g, " ").trim();
  const city = (record as unknown as { city?: string }).city;
  const area = (record as unknown as { area?: string }).area;
  if (cat && city) {
    parts.push(`${record.name} is a ${cat} in ${city}${area ? ` (${area})` : ""}.`);
  } else if (cat) {
    parts.push(`${record.name} is a ${cat}.`);
  } else if (city) {
    parts.push(`${record.name} · ${city}.`);
  }
  const ownerLine = record.claimStatus === "claimed" && record.verified === true
    ? "Owner-verified on NEX."
    : `Listed on NEX (${providerLabel(record)}).`;
  parts.push(ownerLine);
  const knownCount = attributes.filter((a) => a.state === "KNOWN_YES").length;
  if (knownCount === 0 && parts.length === 1) return null;
  return parts.join(" ");
}

function hasResolvableOwnerContact(contact: ContactCapability): boolean {
  return !!(contact.phone || contact.whatsapp || contact.website);
}

function providerLabel(record: WorldRecord): string {
  const sk = (record as unknown as { provenance?: { sourceKey?: string } }).provenance?.sourceKey;
  if (typeof sk === "string") {
    if (sk.includes("openstreetmap")) return "OpenStreetMap community";
    if (sk.includes("nex.")) return "NEX directory";
    return sk;
  }
  return "NEX directory";
}

function labelOf(key: string): string {
  // Human-readable label per attribute id. Falls back to Title Case of
  // the key when unmapped · keeps this module small.
  const LABELS: Record<string, string> = {
    bedrooms: "Bedrooms", bathrooms: "Bathrooms", capacity: "Capacity",
    room_count: "Rooms", star_rating: "Star rating",
    pool: "Pool", private_pool: "Private pool", full_kitchen: "Full kitchen",
    wifi: "Wi-Fi", ac: "Air conditioning", parking: "Parking",
    breakfast: "Breakfast", restaurant: "On-site restaurant",
    laundry: "Laundry", airport_transfer: "Airport transfer",
    gym: "Gym", spa: "Spa", room_service: "Room service", housekeeping: "Housekeeping",
    cuisine: "Cuisine", signature_dish: "Signature dish",
    vegetarian: "Vegetarian options", vegan: "Vegan options", halal: "Halal",
    delivery: "Delivery", takeaway: "Takeaway", reservations: "Reservations",
    outdoor_seating: "Outdoor seating",
    emergency: "Emergency service", free_quote: "Free quote",
    personal_trainer: "Personal trainer", group_classes: "Group classes", showers: "Showers",
    price: "Price", condition: "Condition", brand: "Brand", model: "Model", warranty: "Warranty",
    vehicle_type: "Vehicle type", seats: "Seats", features: "Features",
    opening_hours: "Opening hours", entry_fee: "Entry fee",
  };
  return LABELS[key] ?? key.replace(/_/g, " ").replace(/\b\w/g, (c) => c.toUpperCase());
}

function formatValue(key: string, value: unknown): string {
  if (value === true) return "Yes";
  if (value === false) return "No";
  if (typeof value === "number") {
    if (key === "price") return `Rp ${value.toLocaleString("id-ID")}`;
    return String(value);
  }
  if (typeof value === "string") return value;
  if (value === null || value === undefined) return "—";
  return String(value);
}
