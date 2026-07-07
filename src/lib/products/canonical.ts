// Products — canonical (manufacturer-owned) publish + update helpers.
//
// Constitution:
//   • Writes require the caller to be the publisher OR hold the
//     products.manufacturer entitlement (checked at route layer).
//   • Every state change publishes a product.* event.
//   • os_products_canonical is OS-shared read; only helpers here + the
//     Products routes write.
import "server-only";
import { supabaseAdmin } from "@/lib/supabaseAdmin";
import { publish } from "@/lib/os/events";
import type { CanonicalProduct, ProductLifecycleStatus } from "./types";

export type PublishCanonicalInput = {
  publisherBusinessId: string;
  gtin?: string | null;
  mpn?: string | null;
  brandName: string;
  name: string;
  slug: string;
  description?: string | null;
  categoryPath: string[];
  taxonomyLeafSlug?: string | null;
  attributes?: Record<string, unknown>;
  heroImageUrl?: string | null;
  imageUrls?: string[];
  documents?: Array<{ kind: string; title: string; url: string }>;
  warrantyYears?: number | null;
  warrantyTermsUrl?: string | null;
  msrpPence?: number | null;
};

export async function publishCanonical(
  input: PublishCanonicalInput
): Promise<CanonicalProduct> {
  const now = new Date().toISOString();
  const { data, error } = await supabaseAdmin
    .from("os_products_canonical")
    .insert({
      publisher_business_id: input.publisherBusinessId,
      gtin: input.gtin ?? null,
      mpn: input.mpn ?? null,
      brand_name: input.brandName,
      name: input.name,
      slug: input.slug,
      description: input.description ?? null,
      category_path: input.categoryPath,
      taxonomy_leaf_slug: input.taxonomyLeafSlug ?? null,
      attributes: input.attributes ?? {},
      hero_image_url: input.heroImageUrl ?? null,
      image_urls: input.imageUrls ?? [],
      documents: input.documents ?? [],
      warranty_years: input.warrantyYears ?? null,
      warranty_terms_url: input.warrantyTermsUrl ?? null,
      msrp_pence: input.msrpPence ?? null,
      lifecycle_status: "active" as const,
      published_at: now
    })
    .select("*")
    .single();
  if (error || !data) {
    throw new Error(`Failed to publish canonical: ${error?.message}`);
  }
  const canonical = rowToCanonical(data);

  await publish({
    eventType: "product.published",
    publisherApp: "products",
    dedupKey: `canonical:${canonical.id}`,
    actorBusinessId: input.publisherBusinessId,
    subjectType: "product",
    subjectId: canonical.id,
    payload: {
      brand: canonical.brandName,
      name: canonical.name,
      gtin: canonical.gtin,
      category_path: canonical.categoryPath,
      taxonomy_leaf_slug: canonical.taxonomyLeafSlug
    }
  });

  return canonical;
}

export type UpdateCanonicalInput = Partial<
  Omit<PublishCanonicalInput, "publisherBusinessId" | "slug">
> & {
  canonicalId: string;
  publisherBusinessId: string; // for ownership check
};

export async function updateCanonical(
  input: UpdateCanonicalInput
): Promise<CanonicalProduct> {
  const patch: Record<string, unknown> = {};
  if (input.gtin !== undefined) patch.gtin = input.gtin;
  if (input.mpn !== undefined) patch.mpn = input.mpn;
  if (input.brandName !== undefined) patch.brand_name = input.brandName;
  if (input.name !== undefined) patch.name = input.name;
  if (input.description !== undefined) patch.description = input.description;
  if (input.categoryPath !== undefined) patch.category_path = input.categoryPath;
  if (input.taxonomyLeafSlug !== undefined)
    patch.taxonomy_leaf_slug = input.taxonomyLeafSlug;
  if (input.attributes !== undefined) patch.attributes = input.attributes;
  if (input.heroImageUrl !== undefined) patch.hero_image_url = input.heroImageUrl;
  if (input.imageUrls !== undefined) patch.image_urls = input.imageUrls;
  if (input.documents !== undefined) patch.documents = input.documents;
  if (input.warrantyYears !== undefined) patch.warranty_years = input.warrantyYears;
  if (input.warrantyTermsUrl !== undefined)
    patch.warranty_terms_url = input.warrantyTermsUrl;
  if (input.msrpPence !== undefined) patch.msrp_pence = input.msrpPence;

  const { data, error } = await supabaseAdmin
    .from("os_products_canonical")
    .update(patch)
    .eq("id", input.canonicalId)
    .eq("publisher_business_id", input.publisherBusinessId)
    .select("*")
    .single();
  if (error || !data) {
    throw new Error(`Failed to update canonical: ${error?.message}`);
  }
  const canonical = rowToCanonical(data);

  await publish({
    eventType: "product.updated",
    publisherApp: "products",
    dedupKey: `canonical:${canonical.id}:${canonical.updatedAt}`,
    actorBusinessId: input.publisherBusinessId,
    subjectType: "product",
    subjectId: canonical.id,
    payload: {
      brand: canonical.brandName,
      name: canonical.name,
      changed_fields: Object.keys(patch)
    }
  });

  return canonical;
}

export async function withdrawCanonical(input: {
  canonicalId: string;
  publisherBusinessId: string;
  reason?: string;
}): Promise<void> {
  const now = new Date().toISOString();
  await supabaseAdmin
    .from("os_products_canonical")
    .update({
      lifecycle_status: "withdrawn" as ProductLifecycleStatus,
      withdrawn_at: now
    })
    .eq("id", input.canonicalId)
    .eq("publisher_business_id", input.publisherBusinessId);

  await publish({
    eventType: "product.withdrawn",
    publisherApp: "products",
    dedupKey: `canonical:${input.canonicalId}:withdrawn`,
    actorBusinessId: input.publisherBusinessId,
    subjectType: "product",
    subjectId: input.canonicalId,
    payload: { reason: input.reason ?? null }
  });
}

// -------------------------------------------------------------------
// Row → typed record
// -------------------------------------------------------------------
export function rowToCanonical(row: Record<string, unknown>): CanonicalProduct {
  return {
    id: row.id as string,
    publisherBusinessId: row.publisher_business_id as string,
    gtin: (row.gtin as string) ?? null,
    mpn: (row.mpn as string) ?? null,
    brandName: row.brand_name as string,
    name: row.name as string,
    slug: row.slug as string,
    description: (row.description as string) ?? null,
    categoryPath: (row.category_path as string[]) ?? [],
    taxonomyLeafSlug: (row.taxonomy_leaf_slug as string) ?? null,
    attributes: (row.attributes as Record<string, unknown>) ?? {},
    heroImageUrl: (row.hero_image_url as string) ?? null,
    imageUrls: (row.image_urls as string[]) ?? [],
    documents:
      (row.documents as Array<{ kind: string; title: string; url: string }>) ??
      [],
    warrantyYears: (row.warranty_years as number) ?? null,
    warrantyTermsUrl: (row.warranty_terms_url as string) ?? null,
    msrpPence: (row.msrp_pence as number) ?? null,
    lifecycleStatus: row.lifecycle_status as ProductLifecycleStatus,
    publishedAt: (row.published_at as string) ?? null,
    withdrawnAt: (row.withdrawn_at as string) ?? null,
    createdAt: row.created_at as string,
    updatedAt: row.updated_at as string
  };
}
