// verticals/trades.ts · Philip 2026-08-30 · B-wide · Trades stress test
//
// Trades · Yogyakarta vertical descriptor. Third vertical registered
// against NexDirectorySurface. Deliberate architecture stress test per
// Philip's B-wide gate: entities here are PEOPLE / COMPANIES that provide
// a service, not venues. If NexDirectorySurface represents them beautifully
// via descriptor only, the abstraction is genuinely strong and no
// per-vertical UI component is needed for B-wide.
//
// Descriptor evolution introduced with this vertical:
//   · `statusLabels` — Trades opts into "Available now" / "Booked today" /
//     "Fully booked" wording (food/hotels keep defaults). Descriptor-level
//     opt-in · not a per-vertical UI component.

import { Wrench, Zap, Hammer, Paintbrush, Phone, MessageCircle, FileText } from "lucide-react";
import type {
  DirectoryVertical,
  DirectoryEntity,
} from "@/components/nexapp/NexDirectorySurface";

const TRADES: DirectoryEntity[] = [
  {
    id: "budi-santoso",
    name: "Budi Santoso",
    subtitle: "Plumber · 8 yrs",
    rating: 4.8,
    distanceKm: 0.9,
    priceIndication: "Rp 150k/hr",
    openStatus: "open",
    cardGradient: "linear-gradient(135deg, #0c4a6e 0%, #075985 50%, #0369a1 100%)",
  },
  {
    id: "rina-sari",
    name: "Rina Sari",
    subtitle: "Electrician · 12 yrs",
    rating: 4.9,
    distanceKm: 1.5,
    priceIndication: "Rp 200k/hr",
    openStatus: "open",
    cardGradient: "linear-gradient(135deg, #713f12 0%, #a16207 50%, #ca8a04 100%)",
  },
  {
    id: "cv-karya-utama",
    name: "CV Karya Utama",
    subtitle: "Carpentry workshop",
    rating: 4.7,
    distanceKm: 2.1,
    priceIndication: "Quote-based",
    openStatus: "closing-soon",
    cardGradient: "linear-gradient(135deg, #78350f 0%, #92400e 50%, #b45309 100%)",
  },
  {
    id: "andi-wirawan",
    name: "Andi Wirawan",
    subtitle: "House painter",
    rating: 4.5,
    distanceKm: 1.2,
    priceIndication: "Rp 120k/hr",
    openStatus: "open",
    cardGradient: "linear-gradient(135deg, #3b0764 0%, #581c87 50%, #7e22ce 100%)",
  },
  {
    id: "setiawan-kaca",
    name: "Setiawan Kaca",
    subtitle: "Glazier · window & glass",
    rating: 4.6,
    distanceKm: 3.0,
    priceIndication: "Rp 180k/hr",
    openStatus: "closed",
    cardGradient: "linear-gradient(135deg, #164e63 0%, #155e75 50%, #0e7490 100%)",
  },
];

export const tradesVertical: DirectoryVertical = {
  verticalId: "trades",
  city: "Yogyakarta",
  headerLabel: "TRADES · YOGYAKARTA",
  headerPrompt: "What needs fixing today?",
  searchPlaceholder: "Find a trade…",
  backNoun: "Trades",
  photoIcon: Wrench,
  categoryChips: [
    { id: "all",         label: "All",         icon: Wrench },
    { id: "plumbing",    label: "Plumbing",    icon: Wrench },
    { id: "electrical",  label: "Electrical",  icon: Zap },
    { id: "carpentry",   label: "Carpentry",   icon: Hammer },
    { id: "painting",    label: "Painting",    icon: Paintbrush },
  ],
  listings: TRADES,
  detailActions: [
    { id: "call",     label: "Call",          icon: Phone,         disabled: true },
    { id: "whatsapp", label: "WhatsApp",      icon: MessageCircle, disabled: true },
    { id: "quote",    label: "Request quote", icon: FileText,      disabled: true },
  ],
  // Descriptor-level opt-in · replaces food-shaped "Open now" / "Closing
  // soon" / "Closed" wording with trades-appropriate labels. Enforces the
  // no-per-vertical-UI rule via the descriptor contract.
  statusLabels: {
    open: "Available now",
    "closing-soon": "Booked today",
    closed: "Fully booked",
  },
  entityToContext: (e) => ({
    id: e.id,
    name: e.name,
    // Trades map their subtitle ("Plumber · 8 yrs" / "Electrician · 12 yrs")
    // into the BusinessContext.cuisine slot until a generic EntityContext
    // shape is introduced.
    cuisine: e.subtitle,
    distanceKm: e.distanceKm,
    rating: e.rating,
    openStatus: e.openStatus,
  }),
};
