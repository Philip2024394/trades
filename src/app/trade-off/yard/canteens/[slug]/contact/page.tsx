// /trade-off/yard/canteens/[slug]/contact — email + map contact page.
//
// Fallback contact surface for canteens whose host has NOT provided a
// WhatsApp number. Reached from the hero CTA when hostWhatsapp is null.
// Renders:
//   • Header with canteen + host context
//   • Email contact form (name, email, message)
//   • Address block + Google Maps embed (no API key required for the
//     basic q= embed URL) showing the host's showroom / postcode area
//
// The form POSTs to /api/canteens/[slug]/contact (to be built when
// server-side email routing lands). For now the client shell captures
// the submission and shows a success state — matches the pattern used
// by the compose overlay page.

import type { Metadata } from "next";
import { notFound } from "next/navigation";
import { canteenBySlugFromDb, adminForCanteenFromDb } from "@/lib/canteens.server";
import { BRAND, absolute } from "@/lib/seo";
import { CanteenContactShell } from "./CanteenContactShell";

export const dynamic = "force-dynamic";

export async function generateMetadata({
  params
}: {
  params: Promise<{ slug: string }>;
}): Promise<Metadata> {
  const { slug } = await params;
  const canteen = await canteenBySlugFromDb(slug);
  if (!canteen) return { title: "Contact | Thenetworkers" };
  return {
    title: `Contact ${canteen.hostDisplayName} · ${canteen.name} | Thenetworkers`,
    description: `Get in touch with ${canteen.hostDisplayName} about ${canteen.tradeLabel}.`,
    alternates: { canonical: `/trade-off/yard/canteens/${slug}/contact` },
    openGraph: {
      type: "website",
      siteName: BRAND.name,
      title: `Contact ${canteen.hostDisplayName}`,
      description: canteen.tagline,
      url: absolute(`/trade-off/yard/canteens/${slug}/contact`)
    }
  };
}

export default async function CanteenContactPage({
  params
}: {
  params: Promise<{ slug: string }>;
}) {
  const { slug } = await params;
  const canteen = await canteenBySlugFromDb(slug);
  if (!canteen) notFound();
  const admin = await adminForCanteenFromDb(canteen.id);

  const addressLine = admin?.showroom?.addressLine ?? null;
  const postcode = admin?.showroom?.postcode ?? admin?.postcodeArea ?? null;
  const city = admin?.city ?? null;

  return (
    <CanteenContactShell
      canteenSlug={canteen.slug}
      canteenName={canteen.name}
      tradeLabel={canteen.tradeLabel}
      hostDisplayName={canteen.hostDisplayName}
      headerBgUrl={canteen.headerBgUrl}
      addressLine={addressLine}
      postcode={postcode}
      city={city}
    />
  );
}
