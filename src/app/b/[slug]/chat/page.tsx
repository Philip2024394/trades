// NEX Business Context · /b/[slug]/chat · CUSTOMER branded surface (Philip 2026-08-14).

import { notFound } from "next/navigation";
import { BrandedCustomerShell } from "@/components/nex-business/BrandedCustomerShell";
import { ensureSeeded, getBusiness, toCustomerIdentity } from "@/lib/nex/business-context";

export const dynamic = "force-dynamic";
export async function generateMetadata({ params }: { params: Promise<{ slug: string }> }) {
  ensureSeeded();
  const { slug } = await params;
  const biz = getBusiness(slug);
  return {
    title: biz ? biz.blueprint.identity.displayName : "Business",
    robots: { index: false },
    // Phase 18 · PWA · installable per-business
    manifest: `/api/b/${slug}/manifest.json`,
    themeColor: biz?.blueprint.brand.palette.primary,
    appleWebApp: biz
      ? { capable: true, statusBarStyle: "default" as const, title: biz.blueprint.identity.displayName }
      : undefined
  };
}

export default async function BrandedChatPage({ params }: { params: Promise<{ slug: string }> }) {
  ensureSeeded();
  const { slug } = await params;
  const biz = getBusiness(slug);
  if (!biz) notFound();
  const identity = toCustomerIdentity(biz);
  return <BrandedCustomerShell business={identity} />;
}
