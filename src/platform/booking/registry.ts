// Booking Registry — Milestone 3 · Batch 1.
//
// ─── Registry Metadata (RGP-2) ────────────────────────────────────
// Owner:      Platform Engineering
// Purpose:    Catalogue of merchant-facing booking flow templates
// Lifecycle:  alpha
// Since:      1.0.0
// Refs:       Constitution Amendments 2, 5
// ──────────────────────────────────────────────────────────────────

import type { Frozen, RegistrationBase } from "@/platform/registryKit";
import { createRegistry } from "@/platform/registryKit";
import { facetKindRegistry } from "@/platform/business/facets";
import type { BookingManifest } from "./types";
import type { ResolvedStrategy } from "@/platform/business/resolver";

export const REGISTRY_METADATA = {
  owner: "Platform Engineering",
  purpose:
    "Catalogue of booking flow templates. Each flow declares steps, integrations, and policies.",
  lifecycle: "alpha" as "alpha" | "beta" | "stable" | "deprecated",
  sinceVersion: "1.0.0",
  constitutionRefs: [
    "Amendment 2 §Business OS / Bookings",
    "Amendment 5 §RGP"
  ] as const,
  adrRefs: [] as const,
  pmmImpact: "Business OS · Bookings layer"
} as const;

type BookingRegistration = BookingManifest & RegistrationBase;
type FrozenBookingRegistration = Frozen<BookingRegistration>;

const inner = createRegistry<BookingRegistration>({
  label: "bookingRegistry",
  idFormat: "slug",
  validate: (m) => {
    if (m.manifestVersion !== 1) {
      throw new Error(
        `unsupported manifestVersion ${m.manifestVersion} for booking flow "${m.slug}".`
      );
    }
    if (!m.flowKind) {
      throw new Error(`booking "${m.slug}" must declare flowKind.`);
    }
    if (!Array.isArray(m.steps) || m.steps.length === 0) {
      throw new Error(
        `booking "${m.slug}" must declare at least one step.`
      );
    }
    // Steps must have distinct keys + monotonic order.
    const seen = new Set<string>();
    let prevOrder = -Infinity;
    for (const step of m.steps) {
      if (seen.has(step.key)) {
        throw new Error(
          `booking "${m.slug}" has duplicate step key "${step.key}".`
        );
      }
      seen.add(step.key);
      if (step.order <= prevOrder) {
        throw new Error(
          `booking "${m.slug}" step "${step.key}" order ${step.order} <= previous ${prevOrder}.`
        );
      }
      prevOrder = step.order;
    }
    if (!m.policy) {
      throw new Error(`booking "${m.slug}" must declare policy.`);
    }
    if (!Array.isArray(m.consumesFacets)) {
      throw new Error(`booking "${m.slug}" must declare consumesFacets.`);
    }
    for (const ref of m.consumesFacets) {
      if (!facetKindRegistry.has(ref.kind)) {
        throw new Error(
          `booking "${m.slug}" declares consumesFacets["${ref.kind}"] which is not registered.`
        );
      }
    }
    if (typeof m.renderer !== "function") {
      throw new Error(`booking "${m.slug}" must supply a renderer component.`);
    }
  },
  indexes: {
    byFlowKind: (m) => [m.flowKind],
    byTrade: (m) => m.trades ?? []
  }
});

function normalise(m: BookingManifest): BookingRegistration {
  return {
    ...m,
    id: m.slug,
    category: m.flowKind,
    tags: [
      m.flowKind,
      ...(m.trades ?? []),
      ...(m.requiresPayment ? ["payment-required"] : []),
      ...(m.requiresCalendarSync ? ["calendar-sync"] : [])
    ],
    searchKeywords: [m.description, m.flowKind, ...(m.trades ?? [])],
    author: m.publisher?.name ?? "Xrated Trades Platform"
  };
}

export const bookingRegistry = {
  register(manifest: BookingManifest): FrozenBookingRegistration {
    return inner.register(normalise(manifest));
  },
  get(slug: string): FrozenBookingRegistration | undefined {
    return inner.get(slug);
  },
  getOrThrow(slug: string): FrozenBookingRegistration {
    return inner.getOrThrow(slug);
  },
  has(slug: string): boolean {
    return inner.has(slug);
  },
  list(): FrozenBookingRegistration[] {
    return inner.list();
  },
  listByFlowKind(
    flowKind: BookingManifest["flowKind"]
  ): FrozenBookingRegistration[] {
    return inner.listByIndex("byFlowKind", flowKind);
  },
  listByTrade(tradeSlug: string): FrozenBookingRegistration[] {
    return inner.listByIndex("byTrade", tradeSlug);
  },
  /** Rank flows for a given ResolvedStrategy. Considers the
   *  `booking.flowKind` facet, trade slug, and profile flag hints. */
  rank(strategy: ResolvedStrategy): FrozenBookingRegistration[] {
    const preferredKind = strategy.domains.booking?.flowKind as
      | string
      | undefined;
    const profile = strategy.inputs.profile;
    const trade = profile.trade;
    const profileFlags = new Set<string>();
    if (profile.isPremium) profileFlags.add("premium");
    if (profile.isLuxury) profileFlags.add("luxury");
    if (profile.isEmergency) profileFlags.add("emergency");
    if (profile.isCommercial) profileFlags.add("commercial");
    if (profile.isResidential) profileFlags.add("residential");
    profileFlags.add(profile.positioning);

    return inner
      .list()
      .map((m) => {
        let score = 0;
        if (preferredKind && m.flowKind === preferredKind) score += 100;
        if (m.trades?.includes(trade)) score += 15;
        if (m.trades?.includes("*")) score += 1;
        for (const flag of m.profileFlags ?? []) {
          if (profileFlags.has(flag)) score += 10;
        }
        return { manifest: m, score };
      })
      .filter((r) => r.score > 0)
      .sort((a, b) => b.score - a.score)
      .map((r) => r.manifest);
  },
  /** Convenience — return the single best flow for a strategy. */
  recommend(strategy: ResolvedStrategy): FrozenBookingRegistration | undefined {
    return this.rank(strategy)[0];
  },
  listByCategory: inner.listByCategory,
  listByTag: inner.listByTag,
  size(): number {
    return inner.size();
  },
  search: inner.search,
  describe: inner.describe,
  categories: inner.categories,
  tags: inner.tags,
  counts: inner.counts,
  resolveAlias: inner.resolveAlias,
  selfCheck: inner.selfCheck,
  snapshot: inner.snapshot
};
