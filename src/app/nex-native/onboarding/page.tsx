// src/app/nex-native/onboarding/page.tsx
//
// NEX Seller Central · multi-step onboarding wizard · sealed 2026-10-01.
// -----------------------------------------------------------------------------
// Server Component. Loads the data the wizard needs (verticals,
// professions, existing-shop warning banner, caller tier) and mounts
// the <SellerCentralWizard> client component.
//
// Steps (owned client-side):
//   1 · Shop URL + .nex slug (SlugInput with live availability)
//   2 · Logo upload (uploadOnboardingLogoAction → public URL)
//   3 · Lane picker + Category + Subcategory
//   4 · Review + Launch → createBusinessAction
//
// The old long-form "Your shop is live / Create form" page is retired.

import type * as React from "react";
import { redirect } from "next/navigation";
import { resolveNexAppSessionFromContext } from "@/lib/nex-native/app/session";
import * as businessService from "@/lib/nex-native/business-service";
import { effectiveTier } from "@/lib/nex-native/account-service";
import {
  listProfessions,
  listVerticals,
} from "@/lib/nex-native/terminology-service";
import { laneFromChooserType } from "@/lib/nex-native/seller-lanes";
import { SellerCentralWizard } from "./_wizard-client";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

interface PageProps {
  searchParams: Promise<{
    e?: string;
    m?: string;
    type?: string;
    commerce?: string;
  }>;
}

export default async function Page({ searchParams }: PageProps) {
  const sp = await searchParams;
  // Phase 1 launch gate · onboarding hidden by default · admins and
  // chat-chooser-authorised intent reach it via ?commerce=1.
  const { commerceEnabledForRequest } = await import(
    "@/lib/nex-native/launch-flags"
  );
  if (!commerceEnabledForRequest(sp)) {
    redirect("/nex-native/home");
  }
  const session = await resolveNexAppSessionFromContext();
  if (!session) redirect("/nex-native/sign-in");

  const [existing, verticals, professions] = await Promise.all([
    businessService.listBusinessesByOwner(session.account.id),
    listVerticals().catch(() => []),
    listProfessions().catch(() => []),
  ]);
  const owned = existing[0] ?? null;

  const viewerTier = effectiveTier({
    tier: session.account.tier,
    bisnis_expires_at: session.account.bisnis_expires_at,
    themes_trial_used_at: session.account.themes_trial_used_at ?? null,
  });

  const bannerCode = sp.e && sp.m ? { code: sp.e, message: sp.m } : null;
  const preselectLane = laneFromChooserType(sp.type);

  return (
    <SellerCentralWizard
      viewerTier={viewerTier === "pro" ? "bisnis" : viewerTier}
      verticals={verticals.map((v) => ({
        id: v.id,
        slug: v.slug,
        label: v.label,
      }))}
      professions={professions.map((p) => ({
        id: p.id,
        vertical_id: p.vertical_id,
        slug: p.slug,
        label: p.label,
      }))}
      preselectLane={preselectLane}
      existingShopSlug={owned?.slug ?? null}
      banner={bannerCode}
    />
  );
}
