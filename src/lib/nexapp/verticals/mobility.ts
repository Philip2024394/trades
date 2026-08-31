// verticals/mobility.ts · Philip 2026-08-30 · B-wide
//
// Mobility · Yogyakarta vertical descriptor. Local providers offering
// bike/parcel/food-run services. Respects the NEX Mobility Doctrine
// (project_nex_mobility_doctrine_2026_08_29): PROVIDER not driver ·
// REQUEST not book · CHECKING NEX NETWORK not searching for driver ·
// never simulate live location · bike colour treated as core real-world
// identification cue in the subtitle.
//
// Mobility uses provider-shaped status labels ("Online" / "Busy" /
// "Offline") — descriptor-only.

import { Bike, Package, Utensils, MessageCircle, Route } from "lucide-react";
import type {
  DirectoryVertical,
  DirectoryEntity,
} from "@/components/nexapp/NexDirectorySurface";

const PROVIDERS: DirectoryEntity[] = [
  {
    id: "pak-agus-vario",
    name: "Pak Agus",
    subtitle: "Bike · Black Honda Vario",
    rating: 4.9,
    distanceKm: 0.7,
    priceIndication: "Rp 8k/km",
    openStatus: "open",
    cardGradient: "linear-gradient(135deg, #0f172a 0%, #1e293b 50%, #334155 100%)",
  },
  {
    id: "bu-yani-nmax",
    name: "Bu Yani",
    subtitle: "Bike · Blue Yamaha NMAX",
    rating: 4.8,
    distanceKm: 1.1,
    priceIndication: "Rp 9k/km",
    openStatus: "open",
    cardGradient: "linear-gradient(135deg, #0c4a6e 0%, #075985 50%, #0369a1 100%)",
  },
  {
    id: "mas-rian-parcel",
    name: "Mas Rian",
    subtitle: "Parcel · Red Honda Beat",
    rating: 4.7,
    distanceKm: 1.6,
    priceIndication: "Rp 7k/km",
    openStatus: "closing-soon",
    cardGradient: "linear-gradient(135deg, #7f1d1d 0%, #991b1b 50%, #b91c1c 100%)",
  },
  {
    id: "pak-bambang-food-run",
    name: "Pak Bambang",
    subtitle: "Food run · Green Suzuki Address",
    rating: 4.6,
    distanceKm: 2.0,
    priceIndication: "Rp 6k/km + item cost",
    openStatus: "open",
    cardGradient: "linear-gradient(135deg, #14532d 0%, #166534 50%, #15803d 100%)",
  },
  {
    id: "bu-eka-nmax-2023",
    name: "Bu Eka",
    subtitle: "Bike · White Yamaha NMAX",
    rating: 4.5,
    distanceKm: 3.4,
    priceIndication: "Rp 8k/km",
    openStatus: "closed",
    cardGradient: "linear-gradient(135deg, #292524 0%, #57534e 50%, #a8a29e 100%)",
  },
];

export const mobilityVertical: DirectoryVertical = {
  verticalId: "mobility",
  city: "Yogyakarta",
  headerLabel: "MOBILITY · YOGYAKARTA",
  headerPrompt: "Where do you need to go?",
  searchPlaceholder: "Find a provider…",
  backNoun: "Mobility",
  photoIcon: Bike,
  categoryChips: [
    { id: "all",     label: "All",     icon: Bike },
    { id: "bike",    label: "Bike",    icon: Bike },
    { id: "parcel",  label: "Parcel",  icon: Package },
    { id: "foodrun", label: "Food run", icon: Utensils },
  ],
  listings: PROVIDERS,
  detailActions: [
    // Doctrine wording: REQUEST not book. TRACK is intentionally left
    // disabled because live-location simulation is banned per doctrine.
    { id: "request", label: "Request",  icon: Route,         disabled: true },
    { id: "message", label: "Message",  icon: MessageCircle, disabled: true },
    { id: "track",   label: "Track",    icon: Route,         disabled: true },
  ],
  // Mobility-appropriate availability wording.
  statusLabels: {
    open: "Online",
    "closing-soon": "Busy",
    closed: "Offline",
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
