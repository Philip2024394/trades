// /trade-off/edit/[slug]/templates — Merchant mobile app template picker.
//
// Server-loads the template catalogue + the merchant's currently
// applied template, then hands off to the client shell which renders
// each template inside an iPhone frame with a live preview of a
// reference canteen (Template 1 = Mike Watson's uk-kitchen-fitters).

import type { Metadata } from "next";
import { TemplatesShell } from "./TemplatesShell";
import { listAppTemplates, loadMerchantTemplate } from "@/lib/appTemplates";

export const dynamic = "force-dynamic";
export const metadata: Metadata = {
  title: "Choose your app template | Thenetworkers",
  robots: { index: false, follow: false }
};

export default async function TemplatesPage({
  params
}: {
  params: Promise<{ slug: string }>;
}) {
  const { slug } = await params;
  const [templates, applied] = await Promise.all([
    listAppTemplates(),
    loadMerchantTemplate(slug)
  ]);
  return (
    <TemplatesShell
      slug={slug}
      templates={templates}
      appliedSlug={applied.slug}
    />
  );
}
