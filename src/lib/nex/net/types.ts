// Nex Network Intelligence — contracts.
//
// The Network layer connects the entities Trade OS ALREADY stores:
//   • Trade merchants        (hammerex_trade_off_listings)
//   • Reviews                (hammerex_network_reviews)
//   • Project co-membership  (hammerex_sitebook_members)
//
// The spec asks for far more entities (apprentices / manufacturers /
// training providers / grant DBs / local authorities). Those don't
// have source tables. NET surfaces "no source yet" for them rather
// than pretending. Every recommendation includes evidence.

import type { Evidence } from "../pi/types";
export type { Evidence };

// ─── Business directory row ─────────────────────────────────────

export type NetworkBusiness = {
  slug:           string;
  display_name:   string;
  trading_name:   string | null;
  primary_trade:  string;
  secondary_trades: string[];
  city:           string;
  postcode_prefix: string | null;
  distance_km:    number | null;   // when caller passes a reference point
  evidence:       Evidence;
};

// ─── Trust profile ──────────────────────────────────────────────

export type TrustSignal = {
  score:   number | null;          // 0–100, null = no data yet
  weight:  number;                 // for the composite mean
  note:    string;
};

export type TrustProfile = {
  slug:            string;
  display_name:    string;
  overall_score:   number;         // 0–100
  band:            "excellent" | "healthy" | "steady" | "attention" | "critical";
  signals: {
    reviews:       TrustSignal;    // avg star × count
    completions:   TrustSignal;    // projects worked to completion
    reliability:   TrustSignal;    // response signal
    tenure:        TrustSignal;    // proxy from listing created_at
  };
  evidence:        Evidence;
};

// ─── Collaboration graph ────────────────────────────────────────

export type CollaborationRow = {
  partner_slug:    string;
  partner_name:    string;
  partner_trade:   string | null;
  projects_together: number;
  most_recent_at:  string | null;
  evidence:        Evidence;
};

// ─── Matchmaker ─────────────────────────────────────────────────

export type MatchIntent = {
  /** Requested trade (aliased/normalised). */
  trade:      string;
  /** Optional area — city name OR postcode-prefix. */
  area?:      string;
  /** Optional urgency — "today"|"this_week"|"open" — surfaced but
   *  not currently used for filtering (no availability source). */
  urgency?:   "today" | "this_week" | "open";
};

export type MatchResult = {
  intent:      MatchIntent;
  matches:     NetworkBusiness[];
  note:        string;              // honest note (e.g., "distance not available — postcode-prefix match only")
  evidence:    Evidence;
};

// ─── Referral opportunity ───────────────────────────────────────

export type ReferralOpportunity = {
  contact_id:      string;
  display_name:    string;
  reason:          string;           // "5★ review left last month"
  action:          string;           // "Ask for a referral"
  evidence:        Evidence;
};

// ─── The Network snapshot for a merchant ────────────────────────

export type NetworkSnapshot = {
  computed_at:     string;
  merchant_slug:   string;
  trust:           TrustProfile;
  collaborators:   CollaborationRow[];
  referrals:       ReferralOpportunity[];
  /** Missing dimensions the spec asks for. Surfaced honestly. */
  unavailable:     string[];
  errors:          Array<{ module: string; error: string }>;
};

export function evidenceFor(source: string, tables: string[] = []): Evidence {
  return {
    source,
    tables,
    computed_at: new Date().toISOString()
  };
}
