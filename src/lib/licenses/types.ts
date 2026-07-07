// Licence types — shared across the checkout, marketplace, and
// watermark-tier resolver.

export type LicenseTier =
  | "standard"
  | "extended"
  | "regional_exclusive"
  | "full_buyout"
  | "competitor";

export type LicenseStatus =
  | "pending"
  | "active"
  | "expired"
  | "refunded";

export type BuyerType = "merchant" | "external";

export type ImageLicense = {
  id: string;
  imageId: string;
  buyerType: BuyerType;
  buyerMerchantId: string | null;
  buyerEmail: string | null;
  licenseTier: LicenseTier;
  postcodePrefix: string | null;
  amountPence: number;
  currency: string;
  stripeSessionId: string | null;
  stripePaymentIntentId: string | null;
  status: LicenseStatus;
  startsAt: string;
  expiresAt: string | null;
  createdAt: string;
  updatedAt: string;
};

/** What tier of watermark to serve for a given (imageId, caller). Used
 *  by the /api/image/serve endpoint. */
export type ResolvedTier = "preview" | "standard" | "clean";

/** Map licence tier → served watermark tier. */
export function licenseTierToWatermarkTier(tier: LicenseTier): ResolvedTier {
  switch (tier) {
    case "full_buyout":
      return "clean";
    case "standard":
    case "extended":
    case "regional_exclusive":
    case "competitor":
      return "standard";
  }
}
