// NEX Centre mock — deliberately fabricated placeholder businesses
// (NOT scraped from any directory). Names are illustrative so the
// discovery surface has content to render before real onboarding.
// Photos are stock Unsplash. When real merchants onboard, mock data
// is replaced by the live `suppliers` table.

import type { Supplier, CentreCategory } from "./_types";

export const CATEGORIES: CentreCategory[] = [
  { id: "all",       label: "All"        },
  { id: "materials", label: "Materials"  , emoji: "🧱" },
  { id: "tools",     label: "Tools"      , emoji: "🛠" },
  { id: "trades",    label: "Trades"     , emoji: "👷" },
  { id: "services",  label: "Services"   , emoji: "🚚" },
  { id: "rentals",   label: "Rentals"    , emoji: "🪜" },
  { id: "deals",     label: "Deals"      , emoji: "🔥" }
];

export const FEATURED_SUPPLIER: Supplier = {
  id:             "salford-timber-co",
  state:          "claimed",
  name:           "Salford Timber Co.",
  category:       "Timber Merchant",
  tags:           ["Oak", "Trade prices", "Same-day delivery"],
  location:       "Salford · 3 mi",
  distance_km:    4.8,
  photo_url:      "https://images.unsplash.com/photo-1611288891681-51ff45311bd7?w=900&q=80",
  logo_url:       "https://images.unsplash.com/photo-1615529162924-f8605388461d?w=200&q=80",
  verified:       true,
  featured:       true,
  whatsapp_e164:  "+447700900001",
  response_text:  "Usually replies in 12 min",
  rating:         4.8,
  reviews_count:  186,
  headline:       "45 years supplying joiners across the North West. Bring the drawing, we cut to size.",
  hours_today:    "Open · closes 6 PM"
};

export const NEARBY_SUPPLIERS: Supplier[] = [
  {
    id:            "manchester-tool-depot",
    state:         "claimed",
    name:          "Manchester Tool Depot",
    category:      "Trade Tools",
    tags:          ["Milwaukee", "DeWalt", "Ex-demo deals"],
    location:      "Manchester · 2 mi",
    distance_km:   2.1,
    photo_url:     "https://images.unsplash.com/photo-1581092160607-ee22621dd758?w=800&q=80",
    logo_url:      "https://images.unsplash.com/photo-1581092160607-ee22621dd758?w=200&q=80",
    verified:      true,
    whatsapp_e164: "+447700900002",
    response_text: "Usually replies in 20 min",
    rating:        4.7,
    reviews_count: 92,
    hours_today:   "Open · closes 5:30 PM"
  },
  {
    id:            "north-concrete",
    state:         "claimed",
    name:          "North Concrete Supplies",
    category:      "Aggregates",
    tags:          ["Cement", "Ballast", "Bulk bags"],
    location:      "Bolton · 6 mi",
    distance_km:   9.3,
    photo_url:     "https://images.unsplash.com/photo-1590069261209-f8e9b8642343?w=800&q=80",
    verified:      true,
    whatsapp_e164: "+447700900003",
    response_text: "Usually replies in 35 min",
    rating:        4.6,
    reviews_count: 41
  },
  {
    id:            "j-p-electrical",
    state:         "claimed",
    name:          "J.P. Electrical Wholesale",
    category:      "Electrical",
    tags:          ["MK", "Hager", "Trade counter"],
    location:      "Stockport · 8 mi",
    distance_km:   12.4,
    photo_url:     "https://images.unsplash.com/photo-1621905251189-08b45d6a269e?w=800&q=80",
    verified:      true,
    whatsapp_e164: "+447700900004",
    response_text: "Usually replies same day",
    rating:        4.5,
    reviews_count: 63
  }
];

// Unclaimed placeholders — Companies-House-only data. Sit alongside
// claimed listings so a search still returns something for every
// category; each shows a "Claim this business" CTA.
export const UNCLAIMED_SUPPLIERS: Supplier[] = [
  {
    id:                 "north-plumbing-01234567",
    state:              "unclaimed",
    name:               "North Plumbing & Heating Ltd",
    category:           "Plumbing",
    location:           "Salford",
    photo_url:          "https://images.unsplash.com/photo-1607472586893-edb57bdc0e39?w=800&q=80",
    companies_house_no: "01234567"
  },
  {
    id:                 "manchester-roofing-02345678",
    state:              "unclaimed",
    name:               "Manchester Roofing Ltd",
    category:           "Roofing",
    location:           "Manchester",
    photo_url:          "https://images.unsplash.com/photo-1632759145355-8b8f0d5f4c8b?w=800&q=80",
    companies_house_no: "02345678"
  }
];

// Simple content-search across name/category/tags. Placeholder for
// the real NL retrieval that ships when NEX Centre wires to
// production data.
export function searchSuppliers(all: Supplier[], q: string): Supplier[] {
  const s = q.trim().toLowerCase();
  if (!s) return all;
  return all.filter((sup) => {
    const hay = [sup.name, sup.category, sup.location, ...(sup.tags ?? [])]
      .join(" ")
      .toLowerCase();
    return hay.includes(s);
  });
}
