// verticals/food.ts · Philip 2026-08-30 · Directory Surface Architecture
//
// Food · Yogyakarta vertical descriptor. Seed vertical for NexDirectorySurface.
//
// Philip 2026-08-30 · world-class rebuild enriches the mock listings so the
// primitive's premium card + detail can render at full fidelity (cuisine ·
// price · tags · hours · description · reviewCount · chip mapping). Chip
// filtering wires through DirectoryEntity.chip when the primitive detects
// tagged listings. Adds "Desserts" chip per the food UI spec.
//
// Photography is intentionally not populated · walker image-enrichment (per
// ADR-0022 amendment · CC placeholder walker) supplies heroImageUrl and
// galleryImageUrls when they land. Cards fall back to the branded gradient.

import { Utensils, Coffee, MapPin, MessageCircle, Sandwich, Wine, IceCream, Croissant, ShoppingCart, Cake } from "lucide-react";
import type {
  DirectoryVertical,
  DirectoryEntity,
} from "@/components/nexapp/NexDirectorySurface";

const RESTAURANTS: DirectoryEntity[] = [
  {
    id: "gudeg-yu-djum",
    name: "Gudeg Yu Djum",
    subtitle: "Indonesian",
    rating: 4.6,
    distanceKm: 0.8,
    priceIndication: "Rp —",
    openStatus: "open",
    cardGradient: "linear-gradient(135deg, #78350f 0%, #b45309 50%, #d97706 100%)",
    chip: "restaurants",
    cuisine: "Traditional Javanese Cuisine",
    priceRange: "$$",
    hoursText: "Open · Closes 22:00",
    tags: ["Javanese", "Family Friendly", "Local Favourite"],
    reviewCount: 1240,
    ratingLabel: "Excellent",
    description: "Famous for authentic Gudeg with rich flavours passed down through generations.",
  },
  {
    id: "warung-legi",
    name: "Warung Legi",
    subtitle: "Javanese",
    rating: 4.5,
    distanceKm: 1.2,
    priceIndication: "Rp —",
    openStatus: "open",
    cardGradient: "linear-gradient(135deg, #7c2d12 0%, #9a3412 50%, #c2410c 100%)",
    chip: "restaurants",
    cuisine: "Javanese Street Food",
    priceRange: "$",
    hoursText: "Open · Closes 20:00",
    tags: ["Javanese", "Casual", "Local"],
    reviewCount: 480,
    ratingLabel: "Great",
    description: "Neighbourhood warung serving no-frills Javanese street classics all day.",
  },
  {
    id: "cafe-bunga",
    name: "Café Bunga",
    subtitle: "Coffee",
    rating: 4.4,
    distanceKm: 0.6,
    priceIndication: "Rp —",
    openStatus: "open",
    cardGradient: "linear-gradient(135deg, #292524 0%, #57534e 50%, #a8a29e 100%)",
    chip: "cafes",
    cuisine: "Specialty Coffee & Brunch",
    priceRange: "$$",
    hoursText: "Open · Closes 22:00",
    tags: ["Coffee", "Brunch", "Wi-Fi"],
    reviewCount: 612,
    ratingLabel: "Great",
    description: "Quiet corner café with single-origin beans and an all-day brunch menu.",
  },
  {
    id: "nasi-padang-sederhana",
    name: "Nasi Padang Sederhana",
    subtitle: "Padang",
    rating: 4.7,
    distanceKm: 1.5,
    priceIndication: "Rp —",
    openStatus: "open",
    cardGradient: "linear-gradient(135deg, #7f1d1d 0%, #991b1b 50%, #dc2626 100%)",
    chip: "restaurants",
    cuisine: "Padang Cuisine",
    priceRange: "$$",
    hoursText: "Open · Closes 23:00",
    tags: ["Padang", "Spicy", "Family Friendly"],
    reviewCount: 2130,
    ratingLabel: "Excellent",
    description: "Classic Padang counter with the full row of rendang, gulai, and sambal.",
  },
  {
    id: "ayam-geprek-jogja",
    name: "Ayam Geprek Jogja",
    subtitle: "Fried Chicken",
    rating: 4.3,
    distanceKm: 0.4,
    priceIndication: "Rp —",
    openStatus: "closing-soon",
    cardGradient: "linear-gradient(135deg, #92400e 0%, #b45309 50%, #f59e0b 100%)",
    chip: "fast-food",
    cuisine: "Crispy Fried Chicken",
    priceRange: "$",
    hoursText: "Closing soon · 21:30",
    tags: ["Fast", "Spicy", "Takeaway"],
    reviewCount: 890,
    ratingLabel: "Great",
    description: "Local fast-food spot best known for its geprek-style crushed fried chicken and sambal levels.",
  },
  {
    id: "es-krim-tentrem",
    name: "Es Krim Tentrem",
    subtitle: "Ice Cream Parlour",
    rating: 4.6,
    distanceKm: 1.1,
    priceIndication: "Rp —",
    openStatus: "open",
    cardGradient: "linear-gradient(135deg, #831843 0%, #9d174d 50%, #db2777 100%)",
    chip: "ice-cream",
    cuisine: "Old-Style Indonesian Ice Cream",
    priceRange: "$",
    hoursText: "Open · Closes 22:00",
    tags: ["Ice Cream", "Nostalgic", "Family Friendly"],
    reviewCount: 340,
    ratingLabel: "Great",
    description: "Heritage ice cream parlour serving the classic Jogja ice krim puter and sundaes.",
  },
  {
    id: "simply-cakes-jogja",
    name: "Simply Cakes Jogja",
    subtitle: "Bakery",
    rating: 4.5,
    distanceKm: 1.8,
    priceIndication: "Rp —",
    openStatus: "open",
    cardGradient: "linear-gradient(135deg, #422006 0%, #713f12 50%, #a16207 100%)",
    chip: "bakeries",
    cuisine: "Custom Cakes & Pastries",
    priceRange: "$$",
    hoursText: "Open · Closes 20:00",
    tags: ["Cakes", "Pastries", "Custom Orders"],
    reviewCount: 210,
    ratingLabel: "Great",
    description: "Neighbourhood bakery for birthday cakes, tarts and daily croissants.",
  },
  {
    id: "epilogue-desserts",
    name: "Epilogue Desserts",
    subtitle: "Desserts",
    rating: 4.8,
    distanceKm: 2.2,
    priceIndication: "Rp —",
    openStatus: "open",
    cardGradient: "linear-gradient(135deg, #3b0764 0%, #581c87 50%, #7e22ce 100%)",
    chip: "desserts",
    cuisine: "Modern Plated Desserts",
    priceRange: "$$$",
    hoursText: "Open · Closes 23:00",
    tags: ["Desserts", "Date Night", "Instagrammable"],
    reviewCount: 415,
    ratingLabel: "Excellent",
    description: "Small plated-dessert bar with a rotating chef's menu and matched drink pairings.",
  },
  {
    id: "malioboro-mart",
    name: "Malioboro Mart",
    subtitle: "Supermarket",
    rating: 4.2,
    distanceKm: 0.9,
    priceIndication: "Rp —",
    openStatus: "open",
    cardGradient: "linear-gradient(135deg, #164e63 0%, #155e75 50%, #0891b2 100%)",
    chip: "supermarkets",
    cuisine: "24/7 Grocery",
    priceRange: "$$",
    hoursText: "Open 24 hours",
    tags: ["Grocery", "24/7", "Convenience"],
    reviewCount: 720,
    ratingLabel: "Good",
    description: "Well-stocked local grocery with ready-to-eat and household essentials.",
  },
  {
    id: "kedai-kopi-tugu",
    name: "Kedai Kopi Tugu",
    subtitle: "Coffee Bar",
    rating: 4.7,
    distanceKm: 0.5,
    priceIndication: "Rp —",
    openStatus: "open",
    cardGradient: "linear-gradient(135deg, #451a03 0%, #78350f 50%, #b45309 100%)",
    chip: "cafes",
    cuisine: "Indonesian Single-Origin Coffee",
    priceRange: "$$",
    hoursText: "Open · Closes 23:00",
    tags: ["Coffee", "Local Roast", "Late Night"],
    reviewCount: 980,
    ratingLabel: "Excellent",
    description: "Tugu-area coffee bar with a rotating single-origin from Aceh, Toraja and Bali.",
  },
];

export const foodVertical: DirectoryVertical = {
  verticalId: "food",
  city: "Yogyakarta",
  headerLabel: "FOOD · YOGYAKARTA",
  // Philip 2026-08-30 · world-class Food spec · subtitle updated per doctrine.
  headerPrompt: "Discover amazing places to eat",
  searchPlaceholder: "Find food, cuisine or restaurant…",
  backNoun: "Food",
  photoIcon: Utensils,
  // Philip 2026-08-30 · Food-specific card action label per reference design.
  viewButtonLabel: "VIEW MENU",
  // Philip 2026-08-30 · Food-specific atmosphere backdrop. ImageKit-hosted
  // ChatGPT-generated food scene. Rendered with a dark gradient overlay so
  // header + cards + text remain readable.
  backgroundImageUrl:
    "https://ik.imagekit.io/ctlxgvqcm/ChatGPT%20Image%20Aug%2029,%202026,%2011_18_17%20AM.png?updatedAt=1787977117961",
  // Philip 2026-08-30 · Food chip taxonomy per world-class UI spec. Adds
  // Desserts (Cake icon) between Fast food and Bars. Chip filtering is now
  // active in the primitive · tapping a chip filters listings by their
  // `chip` field. Overflow (> CHIPS_INLINE_LIMIT) collapses into the
  // "Categories ›" bottom sheet from the prior UX doctrine slice.
  categoryChips: [
    { id: "all",          label: "All",          icon: Utensils },
    { id: "restaurants",  label: "Restaurants",  icon: Utensils },
    { id: "cafes",        label: "Cafés",        icon: Coffee },
    { id: "fast-food",    label: "Fast food",    icon: Sandwich },
    { id: "desserts",     label: "Desserts",     icon: Cake },
    { id: "bars",         label: "Bars",         icon: Wine },
    { id: "ice-cream",    label: "Ice cream",    icon: IceCream },
    { id: "bakeries",     label: "Bakeries",     icon: Croissant },
    { id: "supermarkets", label: "Supermarkets", icon: ShoppingCart },
  ],
  listings: RESTAURANTS,
  detailActions: [
    { id: "menu",       label: "Menu",       icon: Utensils,       disabled: true },
    { id: "directions", label: "Directions", icon: MapPin,         disabled: true },
    { id: "whatsapp",   label: "WhatsApp",   icon: MessageCircle,  disabled: true },
  ],
  entityToContext: (e) => ({
    id: e.id,
    name: e.name,
    // BusinessContext currently carries `cuisine` from the Food-only era.
    // Verticals map their subtitle into it until a generic EntityContext
    // shape is introduced (deferred per minimal-scope extraction rule).
    cuisine: e.cuisine ?? e.subtitle,
    distanceKm: e.distanceKm,
    rating: e.rating,
    openStatus: e.openStatus,
  }),
};
