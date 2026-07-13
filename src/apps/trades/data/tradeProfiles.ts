// Trade public profile — the customer-facing companion to R07's private
// Verified Trade Identity dashboard.
//
// Composition rule: this module holds ONLY the fields a customer needs
// to see. Verified layers come from R07, rates come from R08, reviews
// come from the review fixture below. The profile page glues them all
// into one surface.

export type TradeGalleryImage = {
  id: string;
  imageUrl: string;
  caption?: string;
  jobType: string;         // "Skim" / "Ceiling repair" / "External render"
  location?: string;
};

export type TradeTestimonial = {
  id: string;
  customerName: string;
  location: string;
  jobTitle: string;
  jobValueGbp?: number;
  starRating: number;
  createdAtIso: string;
  body: string;
  photoUrl?: string;
};

export type TradePublicProfile = {
  ownerTradeSlug: string;
  headline: string;                 // "West Manchester's plasterer for 11 years"
  bio: string;
  serviceAreaCities: string[];      // ["Manchester", "Salford", "Trafford"]
  serviceRadiusMiles: number;
  disciplines: string[];            // ["Skim", "Multi-finish", "Ceiling repair"]
  averageJobTurnaroundDays: number;
  responseTimeHoursMedian: number;
  gallery: TradeGalleryImage[];
  testimonials: TradeTestimonial[];
  socials?: {
    instagram?: string;
    website?: string;
  };
  acceptingWork: boolean;
  nextAvailableDateIso?: string;
};

export const TRADE_PROFILE_FIXTURES: TradePublicProfile[] = [
  {
    ownerTradeSlug: "bob-plastering",
    headline: "West Manchester's plasterer for 11 years",
    bio: "Watson Plastering runs the same crew of three every job — Bob, plus two long-standing skimmers he's trained. Domestic re-skims, ceiling repairs, and small commercial fit-outs across the M20/M21/M33 belt. Same-day quotes, published rates, no ties or ribbons.",
    serviceAreaCities: ["Manchester", "Salford", "Trafford", "Stockport"],
    serviceRadiusMiles: 15,
    disciplines: ["Skim (1 coat)", "Multi-finish", "Ceiling repair", "Bonding coat", "Small commercial fit-out"],
    averageJobTurnaroundDays: 3,
    responseTimeHoursMedian: 2,
    acceptingWork: true,
    nextAvailableDateIso: new Date(Date.now() + 12 * 24 * 60 * 60 * 1000).toISOString(),
    gallery: [
      {
        id: "g1",
        imageUrl: "https://ik.imagekit.io/9mrgsv2rp/ChatGPT%20Image%20Jul%2011,%202026,%2004_36_21%20AM.png",
        caption: "Full re-skim, Withington 3-bed semi",
        jobType: "Skim",
        location: "Withington, M20"
      },
      {
        id: "g2",
        imageUrl: "https://ik.imagekit.io/9mrgsv2rp/ChatGPT%20Image%20Jul%2011,%202026,%2004_06_22%20AM.png",
        caption: "Parkside Cafe fit-out — 5 walls + ceiling",
        jobType: "Commercial fit-out",
        location: "Chorlton, M21"
      },
      {
        id: "g3",
        imageUrl: "https://ik.imagekit.io/9mrgsv2rp/ChatGPT%20Image%20Jul%2011,%202026,%2004_11_36%20AM.png",
        caption: "Ceiling repair after blown plaster",
        jobType: "Ceiling repair",
        location: "Didsbury, M20"
      }
    ],
    testimonials: [
      {
        id: "t1",
        customerName: "David Watson",
        location: "Withington, M20",
        jobTitle: "Full re-skim + hallway ceiling",
        jobValueGbp: 3800,
        starRating: 5,
        createdAtIso: "2026-06-14T00:00:00Z",
        body:
          "Bob and the lads finished the whole house in four days. Clean site, walls like a mirror. Priced fair, no add-ons at the end. Would use again for the next place."
      },
      {
        id: "t2",
        customerName: "Sarah Birchfield",
        location: "Sale, M33",
        jobTitle: "Ceiling repair after leak",
        jobValueGbp: 480,
        starRating: 5,
        createdAtIso: "2026-05-22T00:00:00Z",
        body:
          "Insurance job. Bob quoted, came the following Tuesday, done in a day. My insurer paid direct via Trade Center Guaranteed which was a first for me — no chasing invoices."
      },
      {
        id: "t3",
        customerName: "Parkside Cafe Ltd",
        location: "Chorlton, M21",
        jobTitle: "Shop-fit skim",
        jobValueGbp: 5400,
        starRating: 4,
        createdAtIso: "2026-06-01T00:00:00Z",
        body:
          "Job went well, one snag on the counter wall needed a second visit — Bob came back same week no argument. Solid crew."
      }
    ],
    socials: {
      instagram: "watson_plastering"
    }
  },
  {
    ownerTradeSlug: "riverside-electrics",
    headline: "NICEIC-approved electrical work across Yorkshire",
    bio: "Riverside Electrics does domestic rewires, EV charger installs, and small commercial fit-outs across Leeds and the wider West Yorkshire area. NICEIC Approved Contractor, 18th Edition + Amendment 2 certified.",
    serviceAreaCities: ["Leeds", "Bradford", "Wakefield"],
    serviceRadiusMiles: 20,
    disciplines: ["Domestic rewire", "EV charger install", "Consumer unit upgrade", "Fault-finding"],
    averageJobTurnaroundDays: 5,
    responseTimeHoursMedian: 4,
    acceptingWork: true,
    gallery: [],
    testimonials: [
      {
        id: "rt1",
        customerName: "Michael Rees",
        location: "Leeds, LS11",
        jobTitle: "3-bed rewire",
        jobValueGbp: 3200,
        starRating: 5,
        createdAtIso: "2026-05-14T00:00:00Z",
        body: "Sarah's crew rewired the whole ground floor while we were on holiday — dust-free finish, minimal chasing, certificate emailed same day."
      }
    ]
  }
];

export function findTradeProfile(slug: string): TradePublicProfile | undefined {
  return TRADE_PROFILE_FIXTURES.find((p) => p.ownerTradeSlug === slug);
}

export function allTradeProfiles(): TradePublicProfile[] {
  return TRADE_PROFILE_FIXTURES;
}
