// src/app/nex-native/_cover/mock-data.ts
//
// Mock content used by every layout preview so the 10 covers can be
// judged on their COMPOSITION under one theme rather than on content
// variation. Same peer, same products, same social — different layout.

import type { CoverProduct, CoverSection, CoverSocialLinks } from "./primitives";

export interface MockCoverContent {
  businessName: string;
  tagline: string;
  handle: string;
  location: string;
  portraitUrl: string;
  ownerAccountId: string;
  presenceOnline: boolean;
  social: CoverSocialLinks;
  sections: CoverSection[];
  /** Founder direction 2026-09-30 · ISO 3166-1 alpha-2 · renders a
   *  small round flag badge on the portrait circle instead of the
   *  theme charm. Optional · omit for no flag. */
  countryCode?: string | null;
  /** Founder direction 2026-09-30 · seller-configurable eyebrow +
   *  title for the primary catalog section. Both optional · fall back
   *  to sensible defaults ("Services" / "Ships locally · exports too")
   *  when omitted. A future settings surface will persist these
   *  per-business on nex_business. */
  sectionEyebrow?: string | null;
  sectionTitle?: string | null;
  products: CoverProduct[];
  services: {
    id: string;
    name: string;
    fromPrice: string;
    description: string;
  }[];
  reviews: { author: string; body: string; stars: number }[];
  hours: string;
  address: string;
  atmosphereLine: string;
}

export const MARIA_MOCK: MockCoverContent = {
  businessName: "Maria's Café",
  tagline: "Slow coffee · sourdough · Ubud",
  handle: "@mariascafe",
  location: "Ubud, Bali",
  portraitUrl:
    "https://ijvqdvsvwtwxzcqmoqit.supabase.co/storage/v1/object/public/nex-chat-theme-hero/maria-santos-hero-1790481483761.png",
  ownerAccountId: "preview-maria",
  presenceOnline: true,
  social: {
    instagram: "mariascafe",
    tiktok: "@mariascafe.bali",
    facebook: "mariascafeubud",
    whatsapp: "+6281234567890",
    website: "https://mariascafe.com",
  },
  atmosphereLine: "Slow coffee · sourdough · warm mornings",
  hours: "07:00 · 22:00 · every day",
  address: "Jl. Raya Sanggingan, Ubud, Bali",
  countryCode: "ID",
  sections: [
    { id: "sec-meal", name: "Meal", sort_order: 0 },
    { id: "sec-snack", name: "Snack", sort_order: 1 },
    { id: "sec-drinks", name: "Drinks", sort_order: 2 },
  ],
  products: [
    {
      id: "prod-oat-latte",
      slug: "oat-latte",
      name: "Oat Latte",
      price_pence: 3500000,
      currency: "IDR",
      image_url: null,
      stock_status: "in_stock",
      section_id: "sec-drinks",
    },
    {
      id: "prod-nasi-goreng",
      slug: "nasi-goreng",
      name: "Nasi Goreng Spesial",
      price_pence: 4500000,
      currency: "IDR",
      image_url: null,
      stock_status: "in_stock",
      section_id: "sec-meal",
    },
    {
      id: "prod-sourdough",
      slug: "sourdough",
      name: "Country Sourdough",
      price_pence: 5500000,
      currency: "IDR",
      image_url: null,
      stock_status: "low_stock",
      section_id: "sec-snack",
    },
    {
      id: "prod-cinnamon-bun",
      slug: "cinnamon-bun",
      name: "Cinnamon Bun",
      price_pence: 3000000,
      currency: "IDR",
      image_url: null,
      stock_status: "in_stock",
      section_id: "sec-snack",
    },
    {
      id: "prod-cold-brew",
      slug: "cold-brew",
      name: "Cold Brew · 300ml",
      price_pence: 3800000,
      currency: "IDR",
      image_url: null,
      stock_status: "in_stock",
      section_id: "sec-drinks",
    },
    {
      id: "prod-tart",
      slug: "lemon-tart",
      name: "Lemon Tart",
      price_pence: 4200000,
      currency: "IDR",
      image_url: null,
      stock_status: "sold_out",
      section_id: "sec-snack",
    },
  ],
  services: [
    {
      id: "svc-catering",
      name: "Private catering",
      fromPrice: "from Rp 1.2jt",
      description: "Full menu for events of 8-40 · we bring the kitchen.",
    },
    {
      id: "svc-workshop",
      name: "Sourdough workshop",
      fromPrice: "Rp 450k · pp",
      description: "Half-day hands-on class · take-home starter included.",
    },
    {
      id: "svc-supper-club",
      name: "Monthly supper club",
      fromPrice: "Rp 250k · pp",
      description: "Chef's tasting menu · one seating per month.",
    },
  ],
  reviews: [
    {
      author: "Ayu · Denpasar",
      body: "Best oat latte in Ubud. The barista actually cares.",
      stars: 5,
    },
    {
      author: "Kelly · London",
      body: "Everything from the sourdough to the tart. Felt like Maria's home.",
      stars: 5,
    },
    {
      author: "Rico · Jakarta",
      body: "Catering for our wedding · flawless. Worth every rupiah.",
      stars: 5,
    },
  ],
};
