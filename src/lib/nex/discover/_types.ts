// Discover — shared types for the People / Businesses / Communities
// discovery surface. The same DiscoverProfile shape represents each
// segment so the feed renderer stays trivial.
//
// V1: profiles are mock. V2 wires to a Postgres discovery service +
// per-user visibility preferences per platform architecture.

export type DiscoverSegment = "people" | "businesses" | "communities";

export type ConnectionPreference = "friends" | "business" | "community" | "anyone";

export type DiscoverProfile = {
  id:            string;
  segment:       DiscoverSegment;
  first_name:    string;                    // for businesses: display name
  city:          string;
  age?:          number;
  occupation?:   string;
  photo_url:     string;
  online:        boolean;
  verified:      boolean;
  languages?:    string[];
  interests:     string[];
  bio?:          string;
  rating?:       number;
  accepts_from:  ConnectionPreference[];
  // Universe filter fields
  gender?:       "male" | "female" | "other";
  availability?: "available_now" | "available_this_week" | "busy";
  distance_km?:  number;                    // rough distance from the user's home
  // ── Phase Social · added 2026-09-07 · optional · additive ──
  /** Meeting-preference ids from src/lib/nex/social/meeting-preferences.ts
   *  · what kind of first meeting this person is open to. Absent = we
   *  don't display anything · never invented. */
  meeting_preferences?: string[];
  /** Voluntarily-declared business/occupation label · displayed on the
   *  Social Card ONLY when present. Absent = we don't display an empty
   *  field. Never fabricated. */
  business_info?: string;
};
