// src/app/nex-native/onboarding/first-product/page.tsx
//
// Seller Central · post-launch first product celebration page.
// Sealed 2026-10-01.
// -----------------------------------------------------------------------------
// Lands here immediately after createBusinessAction succeeds. Reads the
// freshly-created shop's slug from ?slug=xxx so we can confirm "your
// shop is live" by name and send the seller back to it after the first
// product is added.
//
// Server Component · loads the business, verifies owner, mounts the
// client-side first-product form. If the viewer doesn't own the shop
// slug they're bounced to /manage.

import type * as React from "react";
import { redirect } from "next/navigation";
import { resolveNexAppSessionFromContext } from "@/lib/nex-native/app/session";
import * as businessService from "@/lib/nex-native/business-service";
import { FirstProductClient } from "./_first-product-client";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

interface PageProps {
  searchParams: Promise<{
    slug?: string;
    e?: string;
    m?: string;
  }>;
}

export default async function Page({ searchParams }: PageProps) {
  const sp = await searchParams;
  const session = await resolveNexAppSessionFromContext();
  if (!session) redirect("/nex-native/sign-in");

  const slug = (sp.slug ?? "").trim().toLowerCase();
  if (!slug) redirect("/nex-native/manage");

  const business = await businessService
    .getBusinessBySlug(slug)
    .catch(() => null);
  if (!business || business.owner_account_id !== session.account.id) {
    redirect("/nex-native/manage");
  }

  const banner = sp.e && sp.m ? { code: sp.e, message: sp.m } : null;

  return (
    <FirstProductClient
      slug={business.slug}
      displayName={business.display_name}
      logoUrl={business.logo_url ?? null}
      banner={banner}
    />
  );
}
