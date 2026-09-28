// src/app/nex-native/shop-prototypes/story-reel/page.tsx
//
// Interactive live prototype · Story-Reel + Swipe-Up-Drawer shop card.
// -------------------------------------------------------------------
// Founder direction 2026-09-28 · "left or right swipe get the image
// some details and if interested swipe up for spec and lets go or
// chat for more info".
//
// This is the fully-gestural version of design 03 from the gallery:
//   · Full-screen hero image (per product).
//   · Instagram-style progress bars at the top · one per product ·
//     the current bar is filled, the rest are empty.
//   · Tap left third of the hero → previous product.
//   · Tap right two-thirds → next product.
//   · Peek drawer at the bottom (always visible) · shows name, price,
//     Add-to-cart primary CTA, and a "▲ Spec + Details" affordance.
//   · Swipe up ON THE HERO or drag the drawer handle → drawer
//     expands to reveal full spec (variants · ingredients · allergens
//     · delivery · seller info).
//   · Drawer expanded state is a real bottom sheet with drag-to-dismiss.
//   · Floating chat FAB migrates: floats free when the drawer is
//     peek, moves into the drawer header when expanded.
//
// Backend-free · this is a design tool. When the founder picks this
// direction, the real /nex-native/[businessSlug] surface gets
// refactored to render the same shell over the seller's real product
// stack.

import { StoryReelLive } from "./_client";

export const runtime = "nodejs";
export const dynamic = "force-static";

// Bridge 45h · social-proof avatar pool · reused across products
// (in real usage this would be the last N buyers' avatars pulled
// from nex_order joined to nex_account_profile.avatar_url).
const BUYER_AVATARS = [
  "https://images.unsplash.com/photo-1494790108377-be9c29b29330?w=120&h=120&fit=crop",
  "https://images.unsplash.com/photo-1500648767791-00dcc994a43e?w=120&h=120&fit=crop",
  "https://images.unsplash.com/photo-1544005313-94ddf0286df2?w=120&h=120&fit=crop",
  "https://images.unsplash.com/photo-1507003211169-0a1dd7228f2d?w=120&h=120&fit=crop",
  "https://images.unsplash.com/photo-1438761681033-6461ffad8d80?w=120&h=120&fit=crop",
];

const SAMPLE_STACK = [
  {
    id: "coconut-pandan",
    name: "Coconut Pandan Cake",
    seller: "Priya's Bakery",
    sellerLocation: "Mumbai",
    priceLabel: "Rp 85,000",
    imageUrl:
      "https://images.unsplash.com/photo-1578985545062-69928b1d9587?w=900&h=1200&fit=crop",
    imageAlt: "Coconut pandan layer cake",
    tagline: "Baked fresh 5am · same-day pickup",
    description:
      "Three layers of vanilla sponge, pandan cream, and toasted coconut. Baked fresh at 5am · order by noon for same-day pickup.",
    variants: [
      { id: "s", label: `Small · 6"`, price: "Rp 85,000" },
      { id: "m", label: `Medium · 9"`, price: "Rp 145,000" },
      { id: "l", label: `Large · 12"`, price: "Rp 220,000" },
    ],
    ingredients: ["Coconut", "Pandan", "Vanilla", "Wheat flour", "Eggs", "Cream", "Sugar"],
    allergens: ["Eggs", "Wheat", "Dairy"],
    deliveryNote: "Same-day pickup · Grab / Gojek delivery within Mumbai (Rp 12k-25k)",
    stockNote: "In stock · 4 available today",
    recentBuyerAvatars: [BUYER_AVATARS[0]!, BUYER_AVATARS[1]!, BUYER_AVATARS[2]!],
    recentBuyerCount: 14,
  },
  {
    id: "dark-choc-truffle",
    name: "Chili Dark Chocolate Truffle",
    seller: "Priya's Bakery",
    sellerLocation: "Mumbai",
    priceLabel: "Rp 95,000",
    imageUrl:
      "https://images.unsplash.com/photo-1606313564200-e75d5e30476c?w=900&h=1200&fit=crop",
    imageAlt: "Dark chocolate truffle cake with berries",
    tagline: "72% single-origin cacao · chili heat kick",
    description:
      "A dense fudgy centre made with 72% single-origin Belgian cacao, wrapped in a smooth ganache with a soft chili heat that hits after the sweet.",
    variants: [
      { id: "s", label: `Small · 6"`, price: "Rp 95,000" },
      { id: "m", label: `Medium · 9"`, price: "Rp 165,000" },
    ],
    ingredients: ["72% cacao", "Butter", "Eggs", "Sugar", "Chili powder", "Fresh berries"],
    allergens: ["Eggs", "Dairy", "May contain nuts"],
    deliveryNote: "Same-day pickup · order by 2pm for pickup by 6pm",
    stockNote: "In stock · 2 available today",
    spiceLevel: 2,
    recentBuyerAvatars: [BUYER_AVATARS[3]!, BUYER_AVATARS[4]!, BUYER_AVATARS[0]!],
    recentBuyerCount: 8,
  },
  {
    id: "croissant-six",
    name: "Butter Croissants · Six Pack",
    seller: "Priya's Bakery",
    sellerLocation: "Mumbai",
    priceLabel: "Rp 65,000",
    imageUrl:
      "https://images.unsplash.com/photo-1555507036-ab1f4038808a?w=900&h=1200&fit=crop",
    imageAlt: "Freshly baked butter croissants stacked",
    tagline: "48hr laminated · flaky · buttery · six pack",
    description:
      "Traditional French method · 48-hour laminated dough · a shattering flaky exterior with a soft honeycomb inside. Comes in a six pack.",
    variants: [
      { id: "6", label: "Six pack", price: "Rp 65,000" },
      { id: "12", label: "Dozen", price: "Rp 120,000" },
    ],
    ingredients: ["European butter", "Wheat flour", "Milk", "Sugar", "Sea salt", "Yeast"],
    allergens: ["Wheat", "Dairy"],
    deliveryNote: "Morning batch only · pre-order by 8pm the night before",
    stockNote: "Pre-order tomorrow's batch · 12 packs available",
    recentBuyerAvatars: [BUYER_AVATARS[2]!, BUYER_AVATARS[1]!, BUYER_AVATARS[4]!],
    recentBuyerCount: 27,
  },
  {
    id: "sourdough",
    name: "Country Sourdough Loaf",
    seller: "Priya's Bakery",
    sellerLocation: "Mumbai",
    priceLabel: "Rp 55,000",
    imageUrl:
      "https://images.unsplash.com/photo-1509440159596-0249088772ff?w=900&h=1200&fit=crop",
    imageAlt: "Rustic country sourdough loaf with scored top",
    tagline: "36hr slow-fermented · natural wild starter",
    description:
      "36-hour slow-fermented with our natural wild starter. Deep crust, chewy open crumb, mild tang. Perfect for toast, sandwiches, or dipping.",
    variants: [
      { id: "std", label: "Standard loaf · 800g", price: "Rp 55,000" },
      { id: "seed", label: "Seeded loaf · 800g", price: "Rp 65,000" },
    ],
    ingredients: ["Wheat flour", "Wild sourdough starter", "Filtered water", "Sea salt"],
    allergens: ["Wheat"],
    deliveryNote: "Fresh daily · pickup same day · delivery within 5km",
    stockNote: "In stock · 8 loaves today",
    recentBuyerAvatars: [BUYER_AVATARS[0]!, BUYER_AVATARS[3]!, BUYER_AVATARS[1]!],
    recentBuyerCount: 42,
  },
] as const;

export default function StoryReelLivePage() {
  return <StoryReelLive stack={SAMPLE_STACK} />;
}
