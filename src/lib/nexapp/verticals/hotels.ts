// verticals/hotels.ts · Philip 2026-08-30 · Directory Surface Architecture
//
// Hotels · Yogyakarta vertical descriptor. Second vertical registered
// against NexDirectorySurface (step 3 abstraction proof per
// project_nex_directory_surface_architecture_2026_08_30).
//
// DATA ONLY · no UI code. If this file compiles and shows up in-shell
// with cards, detail, and Ask NEX identical in behaviour to Food, the
// abstraction is proven and B-wide can proceed.

import { Bed, Waves, Star, MapPin, MessageCircle, CalendarCheck2, Tent } from "lucide-react";
import type {
  DirectoryVertical,
  DirectoryEntity,
} from "@/components/nexapp/NexDirectorySurface";

const HOTELS: DirectoryEntity[] = [
  {
    id: "melia-purosani",
    name: "Meliá Purosani",
    subtitle: "5-star hotel",
    rating: 4.7,
    distanceKm: 1.1,
    priceIndication: "Rp 1.2M/night",
    openStatus: "open",
    cardGradient: "linear-gradient(135deg, #0c4a6e 0%, #075985 50%, #0369a1 100%)",
  },
  {
    id: "greenhost-boutique",
    name: "Greenhost Boutique",
    subtitle: "Boutique",
    rating: 4.6,
    distanceKm: 0.7,
    priceIndication: "Rp 780k/night",
    openStatus: "open",
    cardGradient: "linear-gradient(135deg, #14532d 0%, #166534 50%, #15803d 100%)",
  },
  {
    id: "greenhouse-hostel",
    name: "Greenhouse Hostel Malioboro",
    subtitle: "Hostel",
    rating: 4.4,
    distanceKm: 0.9,
    priceIndication: "Rp 180k/bed",
    openStatus: "open",
    cardGradient: "linear-gradient(135deg, #422006 0%, #713f12 50%, #a16207 100%)",
  },
  {
    id: "phoenix-hotel",
    name: "The Phoenix Hotel",
    subtitle: "Heritage",
    rating: 4.5,
    distanceKm: 1.4,
    priceIndication: "Rp 950k/night",
    openStatus: "open",
    cardGradient: "linear-gradient(135deg, #3b0764 0%, #581c87 50%, #7e22ce 100%)",
  },
  {
    id: "jambuluwuk-malioboro",
    name: "Jambuluwuk Malioboro",
    subtitle: "4-star hotel",
    rating: 4.3,
    distanceKm: 1.8,
    priceIndication: "Rp 620k/night",
    openStatus: "closing-soon",
    cardGradient: "linear-gradient(135deg, #7c2d12 0%, #9a3412 50%, #c2410c 100%)",
  },
];

export const hotelsVertical: DirectoryVertical = {
  verticalId: "hotels",
  city: "Yogyakarta",
  headerLabel: "HOTELS · YOGYAKARTA",
  headerPrompt: "Where would you like to stay?",
  searchPlaceholder: "Find a place to stay…",
  backNoun: "Hotels",
  photoIcon: Bed,
  // Philip 2026-08-30 · added All + Camping to mirror the walker registry
  // (tourism-camping was added as id 88 · target=nex.accommodation_business).
  categoryChips: [
    { id: "all",        label: "All",         icon: Bed },
    { id: "hotels",     label: "Hotels",      icon: Bed },
    { id: "boutique",   label: "Boutique",    icon: Star },
    { id: "hostels",    label: "Hostels",     icon: Waves },
    { id: "camping",    label: "Camping",     icon: Tent },
  ],
  listings: HOTELS,
  detailActions: [
    { id: "book",       label: "Book",        icon: CalendarCheck2,  disabled: true },
    { id: "directions", label: "Directions",  icon: MapPin,          disabled: true },
    { id: "whatsapp",   label: "WhatsApp",    icon: MessageCircle,   disabled: true },
  ],
  entityToContext: (e) => ({
    id: e.id,
    name: e.name,
    // Hotels map their subtitle ("5-star hotel" / "Boutique" / etc.)
    // into the BusinessContext.cuisine slot until a generic
    // EntityContext shape is introduced.
    cuisine: e.subtitle,
    distanceKm: e.distanceKm,
    rating: e.rating,
    openStatus: e.openStatus,
  }),
};
