// verticals/services.ts · Philip 2026-08-30 · B-wide
//
// Services · Yogyakarta vertical descriptor. Miscellaneous local
// professional services (photography, tutoring, beauty, cleaning). Trades
// and Mobility have their own top-level verticals; Services is the
// catch-all for the long tail.
//
// Descriptor-only. Uses trades-flavored statusLabels ("Available now" /
// "Booked today" / "Fully booked") since the entity type is a service
// provider not a venue.

import {
  Briefcase, Camera, GraduationCap, Sparkles, Phone, MessageCircle, FileText,
  Stethoscope, WashingMachine, Scissors, Heart, Flame, Key, Printer,
} from "lucide-react";
import type {
  DirectoryVertical,
  DirectoryEntity,
} from "@/components/nexapp/NexDirectorySurface";

const PROVIDERS: DirectoryEntity[] = [
  {
    id: "studio-lensa-jogja",
    name: "Studio Lensa Jogja",
    subtitle: "Photography · weddings · portraits",
    rating: 4.9,
    distanceKm: 2.2,
    priceIndication: "Rp 3.5M/half-day",
    openStatus: "open",
    cardGradient: "linear-gradient(135deg, #292524 0%, #57534e 50%, #a8a29e 100%)",
  },
  {
    id: "bu-siti-tutor",
    name: "Bu Siti · Bahasa Tutor",
    subtitle: "Language tutor · 15 yrs",
    rating: 4.9,
    distanceKm: 1.4,
    priceIndication: "Rp 150k/hr",
    openStatus: "open",
    cardGradient: "linear-gradient(135deg, #14532d 0%, #166534 50%, #15803d 100%)",
  },
  {
    id: "salon-cantik-jogja",
    name: "Salon Cantik Jogja",
    subtitle: "Beauty · hair · skincare",
    rating: 4.6,
    distanceKm: 0.8,
    priceIndication: "Rp 120k+",
    openStatus: "closing-soon",
    cardGradient: "linear-gradient(135deg, #831843 0%, #9d174d 50%, #be185d 100%)",
  },
  {
    id: "bersih-cepat-cleaning",
    name: "Bersih Cepat",
    subtitle: "Home cleaning · 2 hrs min",
    rating: 4.7,
    distanceKm: 1.9,
    priceIndication: "Rp 90k/hr",
    openStatus: "open",
    cardGradient: "linear-gradient(135deg, #0c4a6e 0%, #075985 50%, #0369a1 100%)",
  },
  {
    id: "pak-hendra-notaris",
    name: "Pak Hendra · Notaris",
    subtitle: "Notary · documents · certs",
    rating: 4.8,
    distanceKm: 2.5,
    priceIndication: "Quote-based",
    openStatus: "closed",
    cardGradient: "linear-gradient(135deg, #422006 0%, #713f12 50%, #a16207 100%)",
  },
];

export const servicesVertical: DirectoryVertical = {
  verticalId: "services",
  city: "Yogyakarta",
  headerLabel: "SERVICES · YOGYAKARTA",
  headerPrompt: "What service do you need?",
  searchPlaceholder: "Find a service…",
  backNoun: "Services",
  photoIcon: Briefcase,
  // Philip 2026-08-30 · chip taxonomy expanded to cover the health / lifestyle
  // service categories added to the walker registry (doctors · clinics · vet ·
  // laundry · tailor · wedding · funeral · locksmith · copyshop · shoe-repair).
  // Chip is visual navigation today · filter wiring is a follow-up slice.
  categoryChips: [
    { id: "all",         label: "All",         icon: Briefcase },
    { id: "health",      label: "Health",      icon: Stethoscope },
    { id: "beauty",      label: "Beauty",      icon: Sparkles },
    { id: "photography", label: "Photography", icon: Camera },
    { id: "tutoring",    label: "Tutoring",    icon: GraduationCap },
    { id: "laundry",     label: "Laundry",     icon: WashingMachine },
    { id: "tailor",      label: "Tailor",      icon: Scissors },
    { id: "wedding",     label: "Wedding",     icon: Heart },
    { id: "funeral",     label: "Funeral",     icon: Flame },
    { id: "locksmith",   label: "Locksmith",   icon: Key },
    { id: "copy-shop",   label: "Copy shop",   icon: Printer },
  ],
  listings: PROVIDERS,
  detailActions: [
    { id: "call",     label: "Call",          icon: Phone,         disabled: true },
    { id: "message",  label: "Message",       icon: MessageCircle, disabled: true },
    { id: "quote",    label: "Request quote", icon: FileText,      disabled: true },
  ],
  // Provider availability wording (matches Trades convention).
  statusLabels: {
    open: "Available now",
    "closing-soon": "Booked today",
    closed: "Fully booked",
  },
  entityToContext: (e) => ({
    id: e.id,
    name: e.name,
    cuisine: e.subtitle,
    distanceKm: e.distanceKm,
    rating: e.rating,
    openStatus: e.openStatus,
  }),
};
