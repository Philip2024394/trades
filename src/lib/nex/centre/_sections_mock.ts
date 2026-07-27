// NEX Centre — mock data for the section-heavy shell.
// Deliberately fabricated illustrative content so the surface is
// populated end-to-end. Photos are Unsplash. When the real backend
// wires in, each block below maps to its own table/view.

import type { ReactNode } from "react";

// ── Section 1 · hero activity pips ─────────────────────────────────
export type HeroPip = { id: string; icon: string; text: string };
export const HERO_PIPS: HeroPip[] = [
  { id: "p1", icon: "👀", text: "42 viewing" },
  { id: "p2", icon: "✔",  text: "Verified Supplier" },
  { id: "p3", icon: "🔥", text: "New Offer" },
  { id: "p4", icon: "📦", text: "Ships Today" },
  { id: "p5", icon: "💬", text: "Quote Accepted" }
];

// ── Section 3 · trade worlds ───────────────────────────────────────
export type TradeWorld = {
  id: string; label: string; suppliers: number; image: string;
};
export const TRADE_WORLDS: TradeWorld[] = [
  { id: "construction", label: "Construction", suppliers: 24532, image: "https://images.unsplash.com/photo-1541888946425-d81bb19240f5?w=900&q=80" },
  { id: "electrical",   label: "Electrical",   suppliers:  8214, image: "https://images.unsplash.com/photo-1621905251189-08b45d6a269e?w=900&q=80" },
  { id: "home",         label: "Home",         suppliers: 12980, image: "https://images.unsplash.com/photo-1600585154340-be6161a56a0c?w=900&q=80" },
  { id: "garden",       label: "Garden",       suppliers:  6420, image: "https://images.unsplash.com/photo-1416879595882-3373a0480b5b?w=900&q=80" },
  { id: "industrial",   label: "Industrial",   suppliers:  4187, image: "https://images.unsplash.com/photo-1587293852726-70cdb56c2866?w=900&q=80" },
  { id: "business",     label: "Business",     suppliers: 15690, image: "https://images.unsplash.com/photo-1497366216548-37526070297c?w=900&q=80" },
  { id: "technology",   label: "Technology",   suppliers:  9308, image: "https://images.unsplash.com/photo-1518770660439-4636190af475?w=900&q=80" }
];

// ── Section 4 · live trading feed ──────────────────────────────────
export type LiveTrade = {
  id: string;
  actor: string;
  action: "purchased" | "requested" | "received" | "listed" | "accepted";
  item: string;
  time: string;
  avatar: string;
};
export const LIVE_TRADES: LiveTrade[] = [
  { id: "l1", actor: "John",             action: "purchased", item: "Makita Drill",       time: "2s ago",  avatar: "https://images.unsplash.com/photo-1500648767791-00dcc994a43e?w=200&q=80" },
  { id: "l2", actor: "Builder in Bali",  action: "requested", item: "Concrete Pump",      time: "5s ago",  avatar: "https://images.unsplash.com/photo-1507003211169-0a1dd7228f2d?w=200&q=80" },
  { id: "l3", actor: "Sarah",            action: "received",  item: "5 quotes",           time: "8s ago",  avatar: "https://images.unsplash.com/photo-1494790108377-be9c29b29330?w=200&q=80" },
  { id: "l4", actor: "Ahmad",            action: "listed",    item: "20t Excavator",      time: "12s ago", avatar: "https://images.unsplash.com/photo-1519085360753-af0119f7cbe7?w=200&q=80" },
  { id: "l5", actor: "Sinta",            action: "accepted",  item: "Roofing quote",      time: "18s ago", avatar: "https://images.unsplash.com/photo-1573496359142-b8d87734a5a2?w=200&q=80" }
];

// ── Section 5 · featured opportunities ─────────────────────────────
export type Opportunity = {
  id: string;
  title: string;
  supplier: string;
  supplier_photo: string;
  watchers: number;
  price_from_gbp: number;
  ends_in_hours: number;
  verified: boolean;
  image: string;
};
export const OPPORTUNITIES: Opportunity[] = [
  {
    id: "o1",
    title: "Premium Oak Staircases · 15% off this week",
    supplier: "Salford Timber Co.",
    supplier_photo: "https://images.unsplash.com/photo-1615529162924-f8605388461d?w=200&q=80",
    watchers: 128,
    price_from_gbp: 2200,
    ends_in_hours: 71,
    verified: true,
    image: "https://images.unsplash.com/photo-1600607687920-4e2a09cf159d?w=1200&q=80"
  },
  {
    id: "o2",
    title: "Ex-demo Milwaukee kit · trade-only",
    supplier: "Manchester Tool Depot",
    supplier_photo: "https://images.unsplash.com/photo-1581092160607-ee22621dd758?w=200&q=80",
    watchers: 94,
    price_from_gbp: 320,
    ends_in_hours: 42,
    verified: true,
    image: "https://images.unsplash.com/photo-1572981779307-38b8cabb2407?w=1200&q=80"
  },
  {
    id: "o3",
    title: "Bulk timber · March delivery slot",
    supplier: "North Timber Co.",
    supplier_photo: "https://images.unsplash.com/photo-1615529162924-f8605388461d?w=200&q=80",
    watchers: 61,
    price_from_gbp: 1450,
    ends_in_hours: 118,
    verified: true,
    image: "https://images.unsplash.com/photo-1533107862482-0e6974b06ec4?w=1200&q=80"
  }
];

// ── Section 6 · trending projects ──────────────────────────────────
export type TradeProject = {
  id: string;
  name: string;
  location: string;
  trades: string[];
  budget_label: string;
  image: string;
};
export const PROJECTS: TradeProject[] = [
  {
    id: "pj1",
    name: "Luxury Villa · Ubud",
    location: "Bali",
    trades: ["Electrical", "Roofing", "Concrete", "Windows"],
    budget_label: "Rp 1.4B",
    image: "https://images.unsplash.com/photo-1613977257363-707ba9348227?w=1200&q=80"
  },
  {
    id: "pj2",
    name: "Salford Loft Conversion",
    location: "Manchester",
    trades: ["Joinery", "Plumbing", "Electrical"],
    budget_label: "£58k",
    image: "https://images.unsplash.com/photo-1600585154340-be6161a56a0c?w=1200&q=80"
  },
  {
    id: "pj3",
    name: "Warehouse Retrofit",
    location: "Leeds",
    trades: ["Structural", "Concrete", "HVAC"],
    budget_label: "£420k",
    image: "https://images.unsplash.com/photo-1587293852726-70cdb56c2866?w=1200&q=80"
  }
];

// ── Section 8 · Bloomberg-style insights ───────────────────────────
export const INSIGHTS = {
  todays_trades:      15482,
  products_shipped:    4522,
  quotes_accepted:      812,
  trending: ["Concrete", "Roof Tiles", "Excavator", "Oak", "Insulation"]
};

// ── Section 10 · recommended (alternating layout) ──────────────────
export type Recommendation = {
  id: string;
  title: string;
  supplier: string;
  price_gbp: number;
  image: string;
  size: "large" | "small";
};
export const RECOMMENDED: Recommendation[] = [
  { id: "r1", title: "Milwaukee Fuel Impact Wrench",  supplier: "MTD",                  price_gbp:  420, size: "large",
    image: "https://images.unsplash.com/photo-1504148455328-c376907d081c?w=1200&q=80" },
  { id: "r2", title: "Bespoke Oak Handrails",         supplier: "Salford Timber Co.",   price_gbp:  185, size: "small",
    image: "https://images.unsplash.com/photo-1519996529931-28324d5a630e?w=800&q=80" },
  { id: "r3", title: "Slate Roof Tiles · pallet",     supplier: "Manchester Roofing",   price_gbp:  380, size: "small",
    image: "https://images.unsplash.com/photo-1503387762-592deb58ef4e?w=800&q=80" },
  { id: "r4", title: "Bulk Ready-Mix Concrete",       supplier: "North Concrete",       price_gbp:  620, size: "large",
    image: "https://images.unsplash.com/photo-1590069261209-f8e9b8642343?w=1200&q=80" }
];

// ── Section 11 · community avatars ─────────────────────────────────
export type CommunityMember = {
  id: string; name: string; role: string; photo: string; online: boolean;
};
export const COMMUNITY: CommunityMember[] = [
  { id: "cm1", name: "James",  role: "Builder",       online: true,  photo: "https://images.unsplash.com/photo-1500648767791-00dcc994a43e?w=300&q=80" },
  { id: "cm2", name: "Sarah",  role: "Electrician",   online: true,  photo: "https://images.unsplash.com/photo-1494790108377-be9c29b29330?w=300&q=80" },
  { id: "cm3", name: "Ahmad",  role: "Roofer",        online: false, photo: "https://images.unsplash.com/photo-1519085360753-af0119f7cbe7?w=300&q=80" },
  { id: "cm4", name: "Sinta",  role: "Timber Supp.",  online: true,  photo: "https://images.unsplash.com/photo-1573496359142-b8d87734a5a2?w=300&q=80" },
  { id: "cm5", name: "Marco",  role: "Concrete",      online: true,  photo: "https://images.unsplash.com/photo-1507003211169-0a1dd7228f2d?w=300&q=80" },
  { id: "cm6", name: "Priya",  role: "Architect",     online: false, photo: "https://images.unsplash.com/photo-1487412720507-e7ab37603c6f?w=300&q=80" }
];

// Utility — format the countdown label for opportunities.
export function fmtHours(h: number): string {
  if (h >= 48) return `${Math.floor(h / 24)}d left`;
  if (h >= 1)  return `${h}h left`;
  return "Ending soon";
}

// Unused import guard so eslint doesn't complain — ReactNode is
// re-exported for section files that reference the pips inline.
export type _ReactNodeShim = ReactNode;
