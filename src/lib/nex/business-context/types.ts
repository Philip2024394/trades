// NEX Business Context · types (Philip 2026-08-14).
//
// The "business identity" that both the customer branded shell AND the
// owner NEX workspace read from. Derived from an AppBlueprint — never
// hard-coded per business.

import type { AppBlueprint } from "@/lib/app-builder/blueprint-schema";

/** What the CUSTOMER sees. Purely branding + public-safe surface info. */
export type CustomerBusinessIdentity = {
  slug: string;
  displayName: string;
  tagline?: string;
  aboutBlurb?: string;
  brand: {
    primary: string;
    onPrimary: string;
    background: string;
    foreground: string;
    headingFamily: string;
    bodyFamily: string;
    accent?: string;
  };
  contact: {
    primaryEmail?: string;
    primaryPhone?: string;
    whatsapp?: string;
    hasServiceRadius: boolean;
  };
  vertical: {
    label: string;      // human-friendly, e.g. "staircase manufacture"
    slug: string;
  };
};

/** What the OWNER sees. Extends customer surface with private/operator fields. */
export type OwnerBusinessIdentity = CustomerBusinessIdentity & {
  legalName?: string;
  yearFounded?: number;
  teamSize?: string;
  serviceRadius?: {
    centre: unknown;
    radiusMiles: number;
  };
  locations: Array<{ id: string; label: string; addressLines: string[]; postcode?: string }>;
  blueprintId: string;
  blueprintRevision: number;
  provenanceKeys: string[];   // paths that have provenance records
};

/** Business record stored in the registry. */
export type BusinessRecord = {
  slug: string;
  blueprint: AppBlueprint;
  createdAt: string;
  updatedAt: string;
};

/** Session roles — enforced by API routes. */
export type NexRole = "customer" | "owner" | "anonymous";

export type NexSession = {
  role: NexRole;
  businessSlug?: string;   // required for role="owner" · customers scope to a business too
  customerId?: string;     // opaque id when the customer has one
  ownerAccountId?: string; // opaque id for owner accounts
};
