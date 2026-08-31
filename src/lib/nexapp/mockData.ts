// NEX home · mock data.
//
// PHILIP EXPLICITLY AUTHORISED MOCKS (spec §16): "mocked/demo responses
// are acceptable if backend functionality is not connected. Structure
// the components so real NEX backend responses can replace the mock
// data later."
//
// Doctrine holds:
//   · No prices (per Owner-Provenanced Pricing doctrine · cards show
//     rating/distance/status only · no price fields).
//   · Business names + photos here are PLACEHOLDER · clearly demo · no
//     claim they represent real listings.
//   · When NEX Listings ships (Priority 4+ · deferred), this mock is
//     replaced by real owner-provenanced records.

export type BusinessCard = {
  id: string;
  name: string;
  imageUrl: string;
  ratingStars: number;      // 0-5, one decimal
  reviewCount: number;
  distanceKm: number;
  open: boolean;
  closesAt: string;         // "6PM" / "7PM"
};

// NEX FACT / NEX KNOWLEDGE badge on NEX messages (Philip 2026-08-28
// project_nex_fact_vs_knowledge_doctrine_2026_08_28.md). truthClass drives
// which pill renders next to the timestamp in NexWorkspaceChat. User
// messages never carry it (own words don't need self-labeling).
export type NexTruthClass =
  | "confirmed_fact"      // NEX FACT
  | "academic_reference"  // NEX FACT
  | "traditional_folk"    // NEX KNOWLEDGE
  | "spiritual_belief"    // NEX KNOWLEDGE
  | "unconfirmed"         // NEX KNOWLEDGE
  | "ai_generated";       // NEX KNOWLEDGE

export type Message =
  | { id: string; sender: "user"; text: string; time: string }
  | { id: string; sender: "nex";  text: string; time: string;
      cards?: BusinessCard[];
      truthClass?: NexTruthClass;
      truthSource?: string; };

// Placeholder tile-supplier photos from Unsplash (open licence).
// Replaced by real NEX Listings entries in Priority 4.
export const DEMO_CARDS: BusinessCard[] = [
  {
    id: "demo-tile-studio",
    name: "Tile Studio",
    imageUrl: "https://images.unsplash.com/photo-1620626011761-996317b8d101?w=400&q=70&auto=format",
    ratingStars: 4.8,
    reviewCount: 128,
    distanceKm: 1.2,
    open: true,
    closesAt: "6PM",
  },
  {
    id: "demo-design-tiles",
    name: "Design Tiles Gallery",
    imageUrl: "https://images.unsplash.com/photo-1600607687939-ce8a6c25118c?w=400&q=70&auto=format",
    ratingStars: 4.6,
    reviewCount: 96,
    distanceKm: 2.4,
    open: true,
    closesAt: "7PM",
  },
  {
    id: "demo-stone-world",
    name: "Tile & Stone World",
    imageUrl: "https://images.unsplash.com/photo-1600566753376-12c8ab7fb75b?w=400&q=70&auto=format",
    ratingStars: 4.5,
    reviewCount: 81,
    distanceKm: 3.1,
    open: true,
    closesAt: "6PM",
  },
];

export const INITIAL_CONVERSATION: Message[] = [
  {
    id: "m1",
    sender: "user",
    text: "Where can I buy bathroom tiles?",
    time: "09:40 AM",
  },
  {
    id: "m2",
    sender: "nex",
    text: "Here are some top-rated suppliers near you that have a wide range of bathroom tiles.",
    time: "09:40 AM",
    cards: DEMO_CARDS,
    truthClass: "confirmed_fact",
    truthSource: "NEX directory · 4 verified suppliers",
  },
  {
    id: "m3",
    sender: "user",
    text: "Book a plumber for tomorrow morning.",
    time: "09:41 AM",
  },
  {
    id: "m4",
    sender: "nex",
    text: "Sure, I can help you with that. What time works best for you?",
    time: "09:41 AM",
    truthClass: "ai_generated",
    truthSource: "NEX conversational response",
  },
];

// Legacy `CATEGORIES` (Food/Plumbers/Shopping/Services 4-position wheel)
// was removed 2026-08-23 as part of Directory Factory Phase 0 (Decision D5).
// Grep verified zero consumers before deletion:
//   · mockData.ts imported by NexAppHome.tsx (uses DEMO_CARDS + INITIAL_CONVERSATION + Message)
//   · mockData.ts imported by BusinessCarousel.tsx (uses BusinessCard type)
//   · No file imported the CATEGORIES constant.
// The wheel was replaced by NexExploreSatellites + NexDirectoryCards which
// now consume the canonical Category Registry.
// Doctrine anchors:
//   project_nex_directory_factory_doctrine_2026_08_22 (Decision #4)
//   docs/nex/directory-factory-phase-0-plan.md (Item 4a)
