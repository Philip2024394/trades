// NEX Business Context · registry (Philip 2026-08-14).
//
// Reusable registry of businesses. Each business is an AppBlueprint plus
// a slug. This layer projects a Blueprint into the two identity shapes
// the customer + owner shells consume.
//
// In-memory for now (deterministic + local-first). Replace with the
// Studio DB once the business-publish path is wired.

import type { AppBlueprint } from "@/lib/app-builder/blueprint-schema";
import type {
  BusinessRecord,
  CustomerBusinessIdentity,
  OwnerBusinessIdentity
} from "./types";

// The registry must survive Next.js dev-mode module re-instantiation.
// Without the globalThis pin, each hot-reloaded route sees a fresh empty
// Map — publish succeeds in one module and getBusiness returns null in
// the next. The globalThis-cached singleton mirrors the process lifetime
// (which is what "in-memory" was intended to mean).
type Registry = Map<string, BusinessRecord>;
const REGISTRY: Registry = ((globalThis as unknown as { __NEX_BUSINESS_REGISTRY__?: Registry }).__NEX_BUSINESS_REGISTRY__ ??= new Map<string, BusinessRecord>());

/** Register a business from an AppBlueprint. Called at boot from seeds. */
export function registerBusiness(slug: string, blueprint: AppBlueprint): BusinessRecord {
  const rec: BusinessRecord = {
    slug,
    blueprint,
    createdAt: REGISTRY.get(slug)?.createdAt ?? new Date().toISOString(),
    updatedAt: new Date().toISOString()
  };
  REGISTRY.set(slug, rec);
  return rec;
}

export function getBusiness(slug: string): BusinessRecord | null {
  return REGISTRY.get(slug) ?? null;
}

export function listBusinesses(): BusinessRecord[] {
  return [...REGISTRY.values()];
}

/** Project a Blueprint into the CUSTOMER-safe identity shape. Never exposes
 *  provenance internals or blueprint id. */
export function toCustomerIdentity(rec: BusinessRecord): CustomerBusinessIdentity {
  const bp = rec.blueprint;
  return {
    slug: rec.slug,
    displayName: bp.identity.displayName,
    tagline: bp.tagline,
    aboutBlurb: bp.identity.aboutBlurb,
    brand: {
      primary:       bp.brand.palette.primary,
      onPrimary:     bp.brand.palette.onPrimary,
      background:    bp.brand.palette.background,
      foreground:    bp.brand.palette.foreground,
      headingFamily: bp.brand.typography.headingFamily,
      bodyFamily:    bp.brand.typography.bodyFamily,
      accent:        bp.brand.palette.accent
    },
    contact: {
      primaryEmail:   bp.identity.contact.primaryEmail,
      primaryPhone:   bp.identity.contact.primaryPhone,
      whatsapp:       bp.identity.contact.whatsapp,
      hasServiceRadius: !!bp.identity.contact.serviceRadius
    },
    vertical: {
      label: bp.vertical.taxonomySlug.replace(/-/g, " "),
      slug:  bp.vertical.taxonomySlug
    }
  };
}

/** Project into the OWNER shape (adds private/operator fields). */
export function toOwnerIdentity(rec: BusinessRecord): OwnerBusinessIdentity {
  const base = toCustomerIdentity(rec);
  const bp = rec.blueprint;
  return {
    ...base,
    legalName:   bp.identity.legalName,
    yearFounded: bp.identity.yearFounded,
    teamSize:    bp.identity.teamSize,
    serviceRadius: bp.identity.contact.serviceRadius,
    locations:   bp.identity.locations,
    blueprintId: bp.id,
    blueprintRevision: bp.meta.revision,
    provenanceKeys: Object.keys(bp.provenance)
  };
}

/** Test helper — wipe the registry between test runs. */
export function _resetRegistryForTest(): void {
  REGISTRY.clear();
}
