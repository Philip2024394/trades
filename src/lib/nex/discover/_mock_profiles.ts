// Mock discover profiles — V1 seed data so the Discover feed has
// something visible while the real discovery backend is being built.
// Photos from Unsplash. Every field placeholder-only.

import type { DiscoverProfile } from "./_types";

export const MOCK_PROFILES: DiscoverProfile[] = [
  // ─── People (mixed gender + availability + distance) ─────────────
  {
    id: "sarah-manchester",
    segment: "people", first_name: "Sarah", city: "Manchester", age: 29,
    occupation: "Interior Designer",
    photo_url: "https://images.unsplash.com/photo-1494790108377-be9c29b29330?w=400&q=80",
    online: true,  verified: true,
    languages: ["English", "French"],
    interests: ["Travel", "Photography", "Coffee"],
    bio: "I love modern homes and coffee.",
    rating: 5, accepts_from: ["friends", "business", "community"],
    gender: "female", availability: "available_now", distance_km: 2
  },
  {
    id: "james-leeds",
    segment: "people", first_name: "James", city: "Leeds", age: 34,
    occupation: "Carpenter",
    photo_url: "https://images.unsplash.com/photo-1500648767791-00dcc994a43e?w=400&q=80",
    online: false, verified: true,
    languages: ["English"],
    interests: ["Woodworking", "Cycling", "Real Ale"],
    bio: "Bespoke joinery. Twenty years in the trade.",
    rating: 5, accepts_from: ["business", "community"],
    gender: "male", availability: "available_this_week", distance_km: 62
  },
  {
    id: "aisha-bristol",
    segment: "people", first_name: "Aisha", city: "Bristol", age: 27,
    occupation: "Architect",
    photo_url: "https://images.unsplash.com/photo-1580489944761-15a19d654956?w=400&q=80",
    online: true, verified: true,
    languages: ["English", "Arabic", "Spanish"],
    interests: ["Sustainable Design", "Yoga", "Hiking"],
    bio: "Passive-house specialist. Always up for a coffee chat.",
    rating: 5, accepts_from: ["friends", "business"],
    gender: "female", availability: "available_now", distance_km: 210
  },
  {
    id: "michael-birmingham",
    segment: "people", first_name: "Michael", city: "Birmingham", age: 41,
    occupation: "Property Developer",
    photo_url: "https://images.unsplash.com/photo-1544005313-94ddf0286df2?w=400&q=80",
    online: true, verified: false,
    languages: ["English"],
    interests: ["Renovation", "Football", "Investing"],
    bio: "Renovating my third Victorian terrace this year.",
    accepts_from: ["business"],
    gender: "male", availability: "available_now", distance_km: 88
  },
  {
    id: "priya-edinburgh",
    segment: "people", first_name: "Priya", city: "Edinburgh", age: 31,
    occupation: "Landscape Designer",
    photo_url: "https://images.unsplash.com/photo-1573496359142-b8d87734a5a2?w=400&q=80",
    online: false, verified: true,
    languages: ["English", "Hindi"],
    interests: ["Gardens", "Watercolour", "Vegan Food"],
    bio: "Small courtyards a speciality.",
    rating: 4, accepts_from: ["friends", "business", "community"],
    gender: "female", availability: "available_this_week", distance_km: 320
  },
  {
    id: "tom-liverpool",
    segment: "people", first_name: "Tom", city: "Liverpool", age: 38,
    occupation: "Electrician",
    photo_url: "https://images.unsplash.com/photo-1507003211169-0a1dd7228f2d?w=400&q=80",
    online: true, verified: true,
    languages: ["English"],
    interests: ["Music", "Running", "DIY"],
    bio: "18th Ed certified. Fair rates, fast turnaround.",
    rating: 5, accepts_from: ["business", "community"],
    gender: "male", availability: "available_now", distance_km: 45
  },
  {
    id: "emma-manchester",
    segment: "people", first_name: "Emma", city: "Manchester", age: 26,
    occupation: "Photographer",
    photo_url: "https://images.unsplash.com/photo-1487412720507-e7ab37603c6f?w=400&q=80",
    online: true, verified: true,
    languages: ["English"],
    interests: ["Portraits", "Coffee", "Vinyl"],
    bio: "Weddings + events. Booking dates flexibly.",
    rating: 5, accepts_from: ["friends", "business"],
    gender: "female", availability: "available_now", distance_km: 3
  },
  {
    id: "daniel-stockport",
    segment: "people", first_name: "Daniel", city: "Stockport", age: 32,
    occupation: "Plumber",
    photo_url: "https://images.unsplash.com/photo-1519085360753-af0119f7cbe7?w=400&q=80",
    online: true, verified: true,
    languages: ["English"],
    interests: ["Football", "BBQ", "Dogs"],
    bio: "Same-day call-outs across Greater Manchester.",
    rating: 5, accepts_from: ["business", "community"],
    gender: "male", availability: "available_now", distance_km: 8
  },
  {
    id: "olivia-altrincham",
    segment: "people", first_name: "Olivia", city: "Altrincham", age: 30,
    occupation: "Kitchen Designer",
    photo_url: "https://images.unsplash.com/photo-1544717305-2782549b5136?w=400&q=80",
    online: true, verified: true,
    languages: ["English", "Italian"],
    interests: ["Cooking", "Travel", "Wine"],
    bio: "Bespoke kitchens across the North West.",
    rating: 5, accepts_from: ["friends", "business"],
    gender: "female", availability: "available_this_week", distance_km: 12
  },
  {
    id: "ben-manchester",
    segment: "people", first_name: "Ben", city: "Manchester", age: 35,
    occupation: "Interior Painter",
    photo_url: "https://images.unsplash.com/photo-1520975916090-3105956dac38?w=400&q=80",
    online: true, verified: true,
    languages: ["English"],
    interests: ["Cycling", "Art", "Craft Beer"],
    bio: "Ten years painting Manchester homes.",
    rating: 4, accepts_from: ["business", "community"],
    gender: "male", availability: "available_now", distance_km: 4
  },
  {
    id: "hannah-salford",
    segment: "people", first_name: "Hannah", city: "Salford", age: 28,
    occupation: "Structural Engineer",
    photo_url: "https://images.unsplash.com/photo-1554151228-14d9def656e4?w=400&q=80",
    online: false, verified: true,
    languages: ["English"],
    interests: ["Music", "Baking", "Cinema"],
    bio: "Loft-conversion calcs signed off in 48h.",
    rating: 5, accepts_from: ["business"],
    gender: "female", availability: "available_this_week", distance_km: 6
  },
  {
    id: "adam-oldham",
    segment: "people", first_name: "Adam", city: "Oldham", age: 40,
    occupation: "Roofer",
    photo_url: "https://images.unsplash.com/photo-1568602471122-7832951cc4c5?w=400&q=80",
    online: true, verified: true,
    languages: ["English"],
    interests: ["Football", "DIY", "Fishing"],
    bio: "Slate + tile specialist. 20 years covering the North West.",
    rating: 5, accepts_from: ["business", "community"],
    gender: "male", availability: "available_now", distance_km: 15
  },

  // ─── Businesses ────────────────────────────────────────────────
  {
    id: "stairplan-ltd",
    segment: "businesses", first_name: "Stairplan Ltd", city: "Manchester + 30mi",
    occupation: "Bespoke staircases",
    photo_url: "https://images.unsplash.com/photo-1600607687920-4e2a09cf159d?w=400&q=80",
    online: true, verified: true,
    languages: ["English"],
    interests: ["Oak", "Glass balustrades", "Loft conversions"],
    bio: "Bespoke and standard staircases across the North.",
    rating: 5, accepts_from: ["business", "community"],
    availability: "available_this_week", distance_km: 5
  },

  // ─── Communities ───────────────────────────────────────────────
  {
    id: "self-builders-uk",
    segment: "communities", first_name: "Self Builders UK", city: "Nationwide",
    occupation: "12,800 members",
    photo_url: "https://images.unsplash.com/photo-1503387762-592deb58ef4e?w=400&q=80",
    online: true, verified: true,
    interests: ["Self-build", "Planning", "Off-grid"],
    bio: "The UK's most active self-build community. Weekly meetups.",
    accepts_from: ["community", "anyone"],
    availability: "available_now", distance_km: 0
  }
];
