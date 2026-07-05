// businessProfileRegistry — types.
//
// WHO the merchant is. Stable identity data. Rarely changes.

export type ServiceRadius =
  | { kind: "km"; value: number }
  | { kind: "postcodes"; postcodes: readonly string[] }
  | { kind: "regions"; regions: readonly string[] };

export type CustomerType = "residential" | "commercial" | "mixed" | "public-sector";

export type BusinessSize =
  | "solo"
  | "micro"        // 2-4 staff
  | "small"        // 5-20
  | "medium"       // 21-100
  | "large";       // 100+

export type Positioning =
  | "budget"
  | "value"
  | "premium"
  | "luxury";

export type BusinessProfileManifest = {
  manifestVersion: 1;
  slug: string;
  name: string;
  description: string;
  version: string;

  trade: string;
  country: string;              // ISO 3166 alpha-2
  regions?: readonly string[];  // sub-country regions
  currency: string;             // ISO 4217

  serviceRadius: ServiceRadius;
  yearsTrading: number;
  size: BusinessSize;
  customerType: CustomerType;
  positioning: Positioning;

  primaryServices: readonly string[];
  secondaryServices?: readonly string[];
  futureServices?: readonly string[];

  averageJobValue?: { min: number; max: number; currency: string };

  // Trait flags — used by playbook + recipe matching
  isPremium: boolean;
  isLuxury: boolean;
  isEmergency: boolean;
  isCommercial: boolean;
  isResidential: boolean;

  certifications?: readonly string[];
  targetCustomerNotes?: string;

  publisher?: { name: string; verified: boolean };
};

export type FrozenBusinessProfileManifest = Readonly<BusinessProfileManifest>;
