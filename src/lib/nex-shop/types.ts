// src/lib/nex-shop/types.ts

export type MpSellerStatus =
  | "discovered"
  | "claimable"
  | "claimed"
  | "registered"
  | "verified"
  | "active"
  | "suspended";

export type MpProductCondition = "new" | "used" | "refurbished";

export interface Seller {
  sellerId: string;
  slug: string;
  displayName: string;
  city: string | null;
  jurisdiction: string;
  status: MpSellerStatus;
  bio: string | null;
  logoImageRef: string | null;
  coverImageRef: string | null;
}

export interface Category {
  categoryId: string;
  key: string;
  label: string;
  parentId: string | null;
  sortOrder: number;
}

export interface ProductOption {
  optionId: string;
  productId: string;
  name: string;
  sortOrder: number;
  values: ProductOptionValue[];
}

export interface ProductOptionValue {
  optionValueId: string;
  optionId: string;
  value: string;
  sortOrder: number;
}

export interface ProductVariant {
  variantId: string;
  productId: string;
  sku: string;
  priceIdr: number;
  stock: number;
  active: boolean;
  optionValueIds: string[];   // combination · sorted
}

export interface Product {
  productId: string;
  sellerId: string;
  categoryId: string | null;
  slug: string;
  name: string;
  description: string | null;
  condition: MpProductCondition;
  hasVariants: boolean;
  basePriceIdr: number | null;
  baseStock: number | null;
  baseSku: string | null;
  active: boolean;
  qtyPriceTiers: { minQty: number; pricePerUnitIdr: number }[];
  images: { imageId: string; url: string; sortOrder: number; altText: string | null }[];
  options: ProductOption[];
  variants: ProductVariant[];
}

export interface CommercePolicy {
  policyId: string;
  jurisdiction: string;
  categoryId: string | null;
  effectiveFrom: Date;
  effectiveTo: Date | null;
  sellerFeeRate: number;
  minFeeIdr: number;
  maxFeeIdr: number | null;
  currency: "IDR";
  notes: string | null;
}
