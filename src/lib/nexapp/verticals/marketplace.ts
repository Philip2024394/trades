// verticals/marketplace.ts · Philip 2026-08-30 · B-wide
//
// Marketplace · Yogyakarta vertical descriptor. Local sellers + goods for
// sale. Fourth vertical registered against NexDirectorySurface, again
// descriptor-only. Uses statusLabels to reword the entity's availability
// pill into stock semantics ("In stock" / "Low stock" / "Sold out").

import {
  ShoppingBag, Sparkles, MessageCircle, CreditCard,
  Shirt, Gem, Watch, Footprints, Briefcase, Package,
  Leaf, Flame, Camera, Music, Trophy, Baby, PawPrint,
} from "lucide-react";
import type {
  DirectoryVertical,
  DirectoryEntity,
} from "@/components/nexapp/NexDirectorySurface";

const LISTINGS: DirectoryEntity[] = [
  {
    id: "handwoven-batik",
    name: "Handwoven Batik Cloth",
    subtitle: "Kotagede · Batik Pak Warto",
    rating: 4.9,
    distanceKm: 2.4,
    priceIndication: "Rp 320k",
    openStatus: "open",
    cardGradient: "linear-gradient(135deg, #422006 0%, #713f12 50%, #a16207 100%)",
  },
  {
    id: "vintage-teak-armchair",
    name: "Vintage Teak Armchair",
    subtitle: "Jl. Kaliurang · Rumah Kayu",
    rating: 4.7,
    distanceKm: 3.6,
    priceIndication: "Rp 1.85M",
    openStatus: "closing-soon",
    cardGradient: "linear-gradient(135deg, #451a03 0%, #78350f 50%, #b45309 100%)",
  },
  {
    id: "yamaha-nmax-2022",
    name: "Yamaha NMAX 2022",
    subtitle: "Bantul · Toko Motor Jaya",
    rating: 4.8,
    distanceKm: 5.1,
    priceIndication: "Rp 28.5M",
    openStatus: "open",
    cardGradient: "linear-gradient(135deg, #0c4a6e 0%, #075985 50%, #0369a1 100%)",
  },
  {
    id: "handmade-silver-earrings",
    name: "Handmade Silver Earrings",
    subtitle: "Kotagede · Perak Bu Sri",
    rating: 4.9,
    distanceKm: 2.6,
    priceIndication: "Rp 240k",
    openStatus: "open",
    cardGradient: "linear-gradient(135deg, #292524 0%, #57534e 50%, #a8a29e 100%)",
  },
  {
    id: "vintage-cassette-player",
    name: "Vintage Cassette Player",
    subtitle: "Malioboro · Antik Jogja",
    rating: 4.5,
    distanceKm: 1.1,
    priceIndication: "Rp 650k",
    openStatus: "closed",
    cardGradient: "linear-gradient(135deg, #164e63 0%, #155e75 50%, #0e7490 100%)",
  },
];

export const marketplaceVertical: DirectoryVertical = {
  verticalId: "marketplace",
  city: "Yogyakarta",
  headerLabel: "MARKETPLACE · YOGYAKARTA",
  headerPrompt: "What are you looking for?",
  searchPlaceholder: "Find something to buy…",
  backNoun: "Marketplace",
  photoIcon: ShoppingBag,
  // Philip 2026-08-30 · chip taxonomy expanded to cover the retail depth
  // added to the walker registry (jewelry · watches · handcrafts · leather ·
  // herbs · spices · tobacco · deli · beverages · alcohol · pet · musical
  // instruments · sports goods · photo · tea · confectionery · fabric · hobby).
  // Chip is visual navigation today · filter wiring is a follow-up slice.
  categoryChips: [
    { id: "all",         label: "All",         icon: ShoppingBag },
    { id: "fashion",     label: "Fashion",     icon: Shirt },
    { id: "jewelry",     label: "Jewelry",     icon: Gem },
    { id: "watches",     label: "Watches",     icon: Watch },
    { id: "shoes",       label: "Shoes",       icon: Footprints },
    { id: "bags",        label: "Bags",        icon: Briefcase },
    { id: "handcrafts",  label: "Handcrafts",  icon: Sparkles },
    { id: "leather",     label: "Leather",     icon: Package },
    { id: "herbs",       label: "Herbs",       icon: Leaf },
    { id: "spices",      label: "Spices",      icon: Flame },
    { id: "photo",       label: "Photo",       icon: Camera },
    { id: "music",       label: "Music",       icon: Music },
    { id: "sports",      label: "Sports",      icon: Trophy },
    { id: "toys",        label: "Toys",        icon: Baby },
    { id: "pet",         label: "Pet",         icon: PawPrint },
  ],
  listings: LISTINGS,
  detailActions: [
    { id: "buy",       label: "Buy",             icon: CreditCard,    disabled: true },
    { id: "message",   label: "Message seller",  icon: MessageCircle, disabled: true },
    { id: "wishlist",  label: "Wishlist",        icon: Sparkles,      disabled: true },
  ],
  // Stock semantics rather than opening-hours.
  statusLabels: {
    open: "In stock",
    "closing-soon": "Low stock",
    closed: "Sold out",
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
