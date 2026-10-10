// src/lib/nex-native/business/terminology.ts
//
// NEX Business Experience · terminology resolution.
// Rev 6 FROZEN · 2026-10-02.
//
// Resolution hierarchy (never keyed on subtype alone):
//   1. Owner's explicit override for this context + concept
//   2. Business/context-specific terminology (per-content-row override)
//   3. Profile/subtype recommendation for this context + concept
//   4. Universal generic term for this concept
//
// Subtype is a RECOMMENDATION source, not the resolver's identity.

import type {
  BusinessOwnerState,
  BusinessSubtype,
  LocalizedTerm,
  TerminologyConcept,
  TerminologyContext,
  TerminologyKey,
} from "./types";

// -----------------------------------------------------------------------------
// Layer 4 · Universal generic terms per concept.
// -----------------------------------------------------------------------------
const GENERIC: Record<TerminologyConcept, LocalizedTerm> = {
  catalog:     { en: "Catalogue",   id: "Katalog"     },
  item:        { en: "Item",        id: "Item"        },
  order:       { en: "Order",       id: "Pesanan"     },
  cart:        { en: "Cart",        id: "Keranjang"   },
  shop:        { en: "Shop",        id: "Toko"        },
  action:      { en: "Action",      id: "Tindakan"    },
  session:     { en: "Session",     id: "Sesi"        },
  booking:     { en: "Booking",     id: "Reservasi"   },
  reservation: { en: "Reservation", id: "Reservasi"   },
  appointment: { en: "Appointment", id: "Janji"       },
  deal:        { en: "Deal",        id: "Penawaran"   },
};

// -----------------------------------------------------------------------------
// Layer 3 · Per-subtype recommendations · the "profile overlay" layer.
// Not every subtype needs every concept override; empty slots fall through
// to GENERIC. Resolution never consults subtype alone — it consults
// (context + concept) and the subtype is one source of the default.
// -----------------------------------------------------------------------------
type SubtypeTermMap = Partial<Record<TerminologyKey, LocalizedTerm>>;

const BY_SUBTYPE: Partial<Record<BusinessSubtype, SubtypeTermMap>> = {
  restaurant: {
    "menu.catalog":  { en: "Menu",        id: "Menu"       },
    "menu.item":     { en: "Dish",        id: "Hidangan"   },
    "restaurant.order": { en: "Order",    id: "Pesanan"    },
    "offer.item":    { en: "Set",         id: "Paket"      },
  },
  cafe: {
    "menu.catalog":  { en: "Menu",        id: "Menu"       },
    "menu.item":     { en: "Item",        id: "Item"       },
    "restaurant.order": { en: "Order",    id: "Pesanan"    },
    "offer.item":    { en: "Set",         id: "Paket"      },
  },
  bakery: {
    "menu.catalog":  { en: "Catalogue",   id: "Katalog"    },
    "menu.item":     { en: "Item",        id: "Item"       },
    "restaurant.order": { en: "Pre-order",id: "Pre-order"  },
    "offer.item":    { en: "Set",         id: "Paket"      },
  },
  food_maker: {
    "menu.catalog":  { en: "Catalogue",   id: "Katalog"    },
    "menu.item":     { en: "Item",        id: "Item"       },
    "restaurant.order": { en: "Pre-order",id: "Pre-order"  },
    "offer.item":    { en: "Set",         id: "Paket"      },
  },
  catering: {
    "offer.catalog": { en: "Packages",    id: "Paket"      },
    "offer.item":    { en: "Package",     id: "Paket"      },
    "enquiry.action":{ en: "Enquiry",     id: "Permintaan" },
  },
  drinks: {
    "menu.catalog":  { en: "Menu",        id: "Menu"       },
    "menu.item":     { en: "Drink",       id: "Minuman"    },
    "restaurant.order": { en: "Order",    id: "Pesanan"    },
    "offer.item":    { en: "Set",         id: "Paket"      },
  },
  food_delivery: {
    "menu.catalog":  { en: "Menu",        id: "Menu"       },
    "menu.item":     { en: "Dish",        id: "Hidangan"   },
    "restaurant.order": { en: "Order",    id: "Pesanan"    },
    "offer.item":    { en: "Combo",       id: "Paket"      },
  },
  // Accommodation
  hotel: {
    "accommodation.catalog": { en: "Rooms",   id: "Kamar"    },
    "accommodation.item":    { en: "Room",    id: "Kamar"    },
    "accommodation.booking": { en: "Booking", id: "Reservasi"},
    "offer.item":            { en: "Package", id: "Paket Menginap" },
  },
  villa: {
    "accommodation.catalog": { en: "Villa",   id: "Villa"    },
    "accommodation.item":    { en: "Villa",   id: "Villa"    },
    "accommodation.booking": { en: "Booking", id: "Pesan Villa" },
    "offer.item":            { en: "Package", id: "Paket"    },
  },
  guesthouse: {
    "accommodation.catalog": { en: "Rooms",   id: "Kamar"    },
    "accommodation.item":    { en: "Room",    id: "Kamar"    },
    "accommodation.booking": { en: "Booking", id: "Pesan"    },
  },
  homestay: {
    "accommodation.catalog": { en: "Rooms",   id: "Kamar"    },
    "accommodation.item":    { en: "Room",    id: "Kamar"    },
    "accommodation.booking": { en: "Stay",    id: "Menginap" },
  },
  resort: {
    "accommodation.catalog": { en: "Rooms",   id: "Kamar"    },
    "accommodation.booking": { en: "Booking", id: "Pesan"    },
    "offer.item":            { en: "Package", id: "Paket"    },
  },
  short_rental: {
    "accommodation.catalog": { en: "Listings",id: "Daftar"   },
    "accommodation.item":    { en: "Property",id: "Properti" },
    "accommodation.booking": { en: "Booking", id: "Pesan"    },
  },
  // Property
  for_sale: {
    "property.catalog":  { en: "Listings", id: "Daftar"       },
    "property.item":     { en: "Property", id: "Properti"     },
    "enquiry.action":    { en: "Enquiry",  id: "Pengajuan"    },
    "offer.item":        { en: "Deal",     id: "Penawaran"    },
  },
  for_rent: {
    "property.catalog":  { en: "Listings", id: "Daftar Sewa"  },
    "property.item":     { en: "Property", id: "Properti"     },
    "enquiry.action":    { en: "Enquiry",  id: "Pengajuan"    },
    "offer.item":        { en: "Deal",     id: "Penawaran"    },
  },
  developer: {
    "property.catalog":  { en: "Projects", id: "Proyek"       },
    "property.item":     { en: "Project",  id: "Proyek"       },
    "enquiry.action":    { en: "Enquiry",  id: "Pengajuan"    },
  },
  agent: {
    "property.catalog":  { en: "Listings", id: "Daftar"       },
    "property.item":     { en: "Property", id: "Properti"     },
    "enquiry.action":    { en: "Enquiry",  id: "Pengajuan"    },
    "offer.item":        { en: "Deal",     id: "Penawaran"    },
  },
  // Products
  retail: {
    "product.catalog":   { en: "Shop",     id: "Toko"         },
    "product.item":      { en: "Product",  id: "Produk"       },
    "offer.item":        { en: "Bundle",   id: "Paket"        },
  },
  manufacturer: {
    "product.catalog":   { en: "Catalogue",id: "Katalog"      },
    "product.item":      { en: "Product",  id: "Produk"       },
    "enquiry.action":    { en: "Enquiry",  id: "Permintaan"   },
    "offer.item":        { en: "Bulk",     id: "Grosir"       },
  },
  wholesale: {
    "product.catalog":   { en: "Catalogue",id: "Katalog"      },
    "product.item":      { en: "Product",  id: "Produk"       },
    "enquiry.action":    { en: "Enquiry",  id: "Permintaan"   },
    "offer.item":        { en: "Bulk",     id: "Grosir"       },
  },
  local_artisan: {
    "product.catalog":   { en: "Shop",     id: "Toko"         },
    "product.item":      { en: "Piece",    id: "Karya"        },
    "offer.item":        { en: "Set",      id: "Set"          },
  },
  exporter: {
    "product.catalog":   { en: "Catalogue",id: "Katalog"      },
    "product.item":      { en: "Product",  id: "Produk"       },
    "enquiry.action":    { en: "Enquiry",  id: "Pengajuan"    },
    "offer.item":        { en: "Container",id: "Kontainer"    },
  },
  motorbike_shop: {
    "product.catalog":   { en: "Fleet",   id: "Armada"       },
    "product.item":      { en: "Bike",    id: "Motor"        },
    "enquiry.action":    { en: "Message", id: "Chat"         },
  },
  // Services
  beauty: {
    "service.catalog":   { en: "Services", id: "Layanan"      },
    "service.item":      { en: "Treatment",id: "Perawatan"    },
    "appointment.action":{ en: "Appointment", id: "Janji Temu"},
    "offer.item":        { en: "Package",  id: "Paket"        },
  },
  health_wellness: {
    "service.catalog":   { en: "Services", id: "Layanan"      },
    "service.item":      { en: "Service",  id: "Layanan"      },
    "appointment.action":{ en: "Appointment", id: "Janji"     },
    "offer.item":        { en: "Programme",id: "Program"      },
  },
  home_services: {
    "service.catalog":   { en: "Services", id: "Layanan"      },
    "service.item":      { en: "Service",  id: "Layanan"      },
    "offer.item":        { en: "Package",  id: "Paket"        },
  },
  professional: {
    "service.catalog":   { en: "Services", id: "Layanan"      },
    "service.item":      { en: "Service",  id: "Layanan"      },
    "enquiry.action":    { en: "Enquiry",  id: "Konsultasi"   },
    "offer.item":        { en: "Package",  id: "Paket"        },
  },
  trade_construction: {
    "service.catalog":   { en: "Services", id: "Layanan"      },
    "service.item":      { en: "Service",  id: "Jasa"         },
    "quote.action":      { en: "Quote",    id: "Penawaran"    },
    "offer.item":        { en: "Package",  id: "Paket"        },
  },
  automotive: {
    "service.catalog":   { en: "Services", id: "Layanan"      },
    "service.item":      { en: "Service",  id: "Layanan"      },
    "offer.item":        { en: "Package",  id: "Paket"        },
  },
  events: {
    "offer.catalog":     { en: "Packages", id: "Paket"        },
    "offer.item":        { en: "Package",  id: "Paket"        },
    "enquiry.action":    { en: "Enquiry",  id: "Pengajuan"    },
  },
  creative: {
    "portfolio.catalog": { en: "Portfolio",id: "Portofolio"   },
    "portfolio.item":    { en: "Project",  id: "Proyek"       },
    "enquiry.action":    { en: "Enquiry",  id: "Pengajuan"    },
    "offer.item":        { en: "Package",  id: "Paket"        },
  },
};

// -----------------------------------------------------------------------------
// Public resolver · owner → business/context → profile/subtype → generic.
// -----------------------------------------------------------------------------

export interface TerminologyResolution {
  term: LocalizedTerm;
  source: "owner" | "subtype" | "generic";
}

/** Resolve the display term for (context, concept) given the business
 *  owner state + its active subtypes (primary first, then secondary).
 *  Walk the hierarchy; return the first hit and record its source so
 *  callers can expose where the word came from if useful. */
export function resolveTerm(
  context: TerminologyContext,
  concept: TerminologyConcept,
  owner_state: BusinessOwnerState,
  subtypes: readonly BusinessSubtype[],
): TerminologyResolution {
  const key = `${context}.${concept}` as TerminologyKey;

  // Layer 1 · Owner override
  const override = owner_state.terminology_overrides[key];
  if (override) return { term: override, source: "owner" };

  // Layer 2 reserved for per-content-row overrides (resolved by the caller
  // with the specific row's `*_label_override`; not keyed on context).

  // Layer 3 · Per-subtype recommendation · walk primary first, then secondary
  for (const s of subtypes) {
    const m = BY_SUBTYPE[s]?.[key];
    if (m) return { term: m, source: "subtype" };
  }

  // Layer 4 · Universal generic
  return { term: GENERIC[concept], source: "generic" };
}

/** Short-hand that returns just the term string (`en` by default). Useful
 *  for places that don't need to know the source. */
export function resolveTermString(
  context: TerminologyContext,
  concept: TerminologyConcept,
  owner_state: BusinessOwnerState,
  subtypes: readonly BusinessSubtype[],
  locale: "en" | "id" = "en",
): string {
  return resolveTerm(context, concept, owner_state, subtypes).term[locale];
}

export { GENERIC as GENERIC_TERMINOLOGY, BY_SUBTYPE as SUBTYPE_TERMINOLOGY };
