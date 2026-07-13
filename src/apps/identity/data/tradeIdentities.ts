// Verified Trade Identity (R07) — fixture data for the trade user side.
//
// This is the mirror of the merchant trust score: a trade professional
// (plasterer / builder / electrician / roofer / carpenter) carries the
// SAME 8-layer credential as merchants do, once verified. Every feature
// that needs "is this real trade?" (Confidence Card / Account Application
// / Job Board / Sub Marketplace / Reference Requests / Credit Introducer)
// consumes this same shape.
//
// Constitution Rule #6: Trade Center is the pipe, not the bureau. The
// `verifiedBy` field on each layer records WHICH regulated / public
// source verified that layer. Trade Center never certifies anything of
// its own accord.

export type IdentityLayerKey =
  | "identity"
  | "business"
  | "skills"
  | "address"
  | "insurance"
  | "qualifications"
  | "reviews"
  | "yearsTrading";

export type IdentityLayerStatus = "verified" | "pending" | "expired" | "missing";

export type IdentityLayer = {
  key: IdentityLayerKey;
  label: string;
  status: IdentityLayerStatus;
  verifiedAtIso?: string;
  expiresAtIso?: string;
  verifiedBy?: string; // partner / public register that provided the verification
  detail?: string;     // one-line summary rendered on the panel
};

export type VerifiedTradeIdentity = {
  slug: string;
  displayName: string;
  legalName: string;
  tradeType: string;                  // "Plastering & Skimming"
  homeCity: string;
  headshotInitials: string;
  memberSinceIso: string;
  yearsTrading: number;
  vatNumber?: string;
  companiesHouseNumber?: string;
  layers: Record<IdentityLayerKey, IdentityLayer>;
  /** 0-100 composite. Only surfaced as a summary — Trade Center never
   *  publishes this as a score of its own; it's the count of verified
   *  layers weighted by recency, not a credit score. */
  compositeCompleteness: number;
};

const iso = (yearsAgo: number) => {
  const d = new Date();
  d.setFullYear(d.getFullYear() - yearsAgo);
  return d.toISOString();
};

const isoFuture = (yearsAhead: number) => {
  const d = new Date();
  d.setFullYear(d.getFullYear() + yearsAhead);
  return d.toISOString();
};

export const TRADE_IDENTITY_FIXTURES: VerifiedTradeIdentity[] = [
  {
    slug: "bob-plastering",
    displayName: "Bob Watson",
    legalName: "Watson Plastering Ltd",
    tradeType: "Plastering & Skimming",
    homeCity: "Manchester",
    headshotInitials: "BW",
    memberSinceIso: iso(3),
    yearsTrading: 11,
    vatNumber: "GB 384 2947 11",
    companiesHouseNumber: "09284712",
    compositeCompleteness: 96,
    layers: {
      identity: {
        key: "identity",
        label: "Identity",
        status: "verified",
        verifiedAtIso: iso(3),
        verifiedBy: "GOV.UK Identity Verification",
        detail: "Passport + selfie confirmed by GOV.UK Identity"
      },
      business: {
        key: "business",
        label: "Business",
        status: "verified",
        verifiedAtIso: iso(3),
        verifiedBy: "Companies House",
        detail: "Watson Plastering Ltd — active, 11 years filed accounts"
      },
      skills: {
        key: "skills",
        label: "Trade Skills",
        status: "verified",
        verifiedAtIso: iso(1),
        verifiedBy: "CITB / NVQ Register",
        detail: "NVQ Level 3 Plastering (CITB verified)"
      },
      address: {
        key: "address",
        label: "Address",
        status: "verified",
        verifiedAtIso: iso(3),
        verifiedBy: "Royal Mail PAF + utility bill",
        detail: "Registered trading address confirmed"
      },
      insurance: {
        key: "insurance",
        label: "Insurance",
        status: "verified",
        verifiedAtIso: iso(0),
        expiresAtIso: isoFuture(1),
        verifiedBy: "AXA (broker: Simply Business)",
        detail: "£5m Public Liability + £10m Employers Liability"
      },
      qualifications: {
        key: "qualifications",
        label: "Qualifications",
        status: "verified",
        verifiedAtIso: iso(0),
        expiresAtIso: isoFuture(4),
        verifiedBy: "CSCS Smart Check",
        detail: "CSCS Gold Card — Plasterer"
      },
      reviews: {
        key: "reviews",
        label: "Reviews",
        status: "verified",
        verifiedAtIso: iso(0),
        verifiedBy: "Trade Center (customer-signed reviews)",
        detail: "47 reviews, 4.9 average, all customer-signed"
      },
      yearsTrading: {
        key: "yearsTrading",
        label: "Years Trading",
        status: "verified",
        verifiedAtIso: iso(3),
        verifiedBy: "Companies House filing history",
        detail: "11 years continuous trading since 2015"
      }
    }
  },
  {
    slug: "riverside-electrics",
    displayName: "Sarah Kingsley",
    legalName: "Riverside Electrics Ltd",
    tradeType: "Electrical Installations",
    homeCity: "Leeds",
    headshotInitials: "SK",
    memberSinceIso: iso(2),
    yearsTrading: 6,
    vatNumber: "GB 942 8134 22",
    companiesHouseNumber: "11284833",
    compositeCompleteness: 82,
    layers: {
      identity: {
        key: "identity",
        label: "Identity",
        status: "verified",
        verifiedAtIso: iso(2),
        verifiedBy: "GOV.UK Identity Verification"
      },
      business: {
        key: "business",
        label: "Business",
        status: "verified",
        verifiedAtIso: iso(2),
        verifiedBy: "Companies House",
        detail: "Riverside Electrics Ltd — active, 6 years filed accounts"
      },
      skills: {
        key: "skills",
        label: "Trade Skills",
        status: "verified",
        verifiedAtIso: iso(1),
        verifiedBy: "NICEIC register",
        detail: "NICEIC Approved Contractor"
      },
      address: {
        key: "address",
        label: "Address",
        status: "verified",
        verifiedAtIso: iso(2),
        verifiedBy: "Royal Mail PAF"
      },
      insurance: {
        key: "insurance",
        label: "Insurance",
        status: "expired",
        verifiedAtIso: iso(2),
        expiresAtIso: iso(0),
        verifiedBy: "Aviva",
        detail: "£2m PL — renewal due"
      },
      qualifications: {
        key: "qualifications",
        label: "Qualifications",
        status: "verified",
        verifiedAtIso: iso(1),
        verifiedBy: "18th Edition Cert (City & Guilds)",
        detail: "BS 7671:2018+A2 verified"
      },
      reviews: {
        key: "reviews",
        label: "Reviews",
        status: "pending",
        detail: "3 reviews so far — 5 needed for verified status"
      },
      yearsTrading: {
        key: "yearsTrading",
        label: "Years Trading",
        status: "verified",
        verifiedAtIso: iso(2),
        verifiedBy: "Companies House filing history"
      }
    }
  }
];

export function findTradeIdentity(slug: string): VerifiedTradeIdentity | undefined {
  return TRADE_IDENTITY_FIXTURES.find((t) => t.slug === slug);
}

/** The "current viewer" for demo purposes — used by the dashboard and
 *  by the auto-fill on the Trade Account Application form. In production
 *  this comes from the auth session. */
export function currentViewerTrade(): VerifiedTradeIdentity {
  return TRADE_IDENTITY_FIXTURES[0];
}

export function countVerifiedLayers(t: VerifiedTradeIdentity): number {
  return Object.values(t.layers).filter((l) => l.status === "verified").length;
}
