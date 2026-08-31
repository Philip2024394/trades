// verticals/rentals.ts · Philip 2026-08-30 · B-wide
//
// Rentals · Yogyakarta vertical descriptor. Rentable items and gear.
// Descriptor-only registration. statusLabels reworded into availability
// semantics ("Available" / "Few left" / "All booked").

import { KeyRound, Bike, Camera, Waves, CalendarCheck2, MessageCircle, Route, Ship, Zap } from "lucide-react";
import type {
  DirectoryVertical,
  DirectoryEntity,
} from "@/components/nexapp/NexDirectorySurface";

const RENTABLES: DirectoryEntity[] = [
  {
    id: "scooter-vario-daily",
    name: "Scooter · Honda Vario",
    subtitle: "Jl. Prawirotaman · Jogja Rent",
    rating: 4.8,
    distanceKm: 0.8,
    priceIndication: "Rp 80k/day",
    openStatus: "open",
    cardGradient: "linear-gradient(135deg, #0c4a6e 0%, #075985 50%, #0369a1 100%)",
  },
  {
    id: "mtb-hardtail",
    name: "MTB Hardtail · 27.5”",
    subtitle: "Kotabaru · Jogja Cycle",
    rating: 4.7,
    distanceKm: 1.9,
    priceIndication: "Rp 120k/day",
    openStatus: "open",
    cardGradient: "linear-gradient(135deg, #14532d 0%, #166534 50%, #15803d 100%)",
  },
  {
    id: "canon-eos-r6",
    name: "Canon EOS R6 kit",
    subtitle: "Malioboro · Studio Rental",
    rating: 4.9,
    distanceKm: 1.2,
    priceIndication: "Rp 380k/day",
    openStatus: "closing-soon",
    cardGradient: "linear-gradient(135deg, #292524 0%, #57534e 50%, #a8a29e 100%)",
  },
  {
    id: "surf-longboard",
    name: "Surf longboard · 9'",
    subtitle: "Parangtritis · Beach Surf",
    rating: 4.6,
    distanceKm: 27.0,
    priceIndication: "Rp 150k/day",
    openStatus: "open",
    cardGradient: "linear-gradient(135deg, #164e63 0%, #155e75 50%, #0891b2 100%)",
  },
  {
    id: "vespa-primavera",
    name: "Vespa Primavera 150",
    subtitle: "Jl. Kaliurang · Retro Rent",
    rating: 4.5,
    distanceKm: 2.7,
    priceIndication: "Rp 180k/day",
    openStatus: "closed",
    cardGradient: "linear-gradient(135deg, #7f1d1d 0%, #991b1b 50%, #dc2626 100%)",
  },
];

export const rentalsVertical: DirectoryVertical = {
  verticalId: "rentals",
  city: "Yogyakarta",
  headerLabel: "RENTALS · YOGYAKARTA",
  headerPrompt: "What would you like to rent?",
  searchPlaceholder: "Find something to rent…",
  backNoun: "Rentals",
  photoIcon: KeyRound,
  // Philip 2026-08-30 · added Scooters + Boat to mirror the walker registry
  // (transport-boat-rental + transport-bicycle-rental categories).
  categoryChips: [
    { id: "all",       label: "All",       icon: KeyRound },
    { id: "scooters",  label: "Scooters",  icon: Zap },
    { id: "bikes",     label: "Bikes",     icon: Bike },
    { id: "camera",    label: "Camera",    icon: Camera },
    { id: "surf",      label: "Surf",      icon: Waves },
    { id: "boat",      label: "Boat",      icon: Ship },
  ],
  listings: RENTABLES,
  detailActions: [
    { id: "reserve",     label: "Reserve",       icon: CalendarCheck2, disabled: true },
    { id: "message",     label: "Message owner", icon: MessageCircle,  disabled: true },
    { id: "availability", label: "Availability", icon: Route,          disabled: true },
  ],
  // Rental availability wording.
  statusLabels: {
    open: "Available",
    "closing-soon": "Few left",
    closed: "All booked",
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
