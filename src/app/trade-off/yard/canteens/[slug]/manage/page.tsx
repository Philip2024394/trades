// /trade-off/yard/canteens/[slug]/manage — host dashboard.
//
// Access: currently mocked to always allow (real gating lands with the
// auth + host-verification schema). Renders the CanteenManageShell
// with the current canteen + products so the host can edit banner,
// tagline, products, members, and see activity streak progress.

import type { Metadata } from "next";
import { notFound } from "next/navigation";
import {
  canteenBySlug,
  membersForCanteen,
  adminForCanteen,
  productsForCanteen
} from "@/lib/canteens";
import { CanteenManageShell } from "./CanteenManageShell";
import { BRAND, absolute } from "@/lib/seo";

export const dynamic = "force-dynamic";

export async function generateMetadata({
  params
}: {
  params: Promise<{ slug: string }>;
}): Promise<Metadata> {
  const { slug } = await params;
  const canteen = canteenBySlug(slug);
  if (!canteen) return { title: "Canteen — The Network" };
  return {
    title: `Manage ${canteen.name} — The Network`,
    description: `Host dashboard for ${canteen.name}. Manage banner, tagline, products, members, and activity.`,
    alternates: { canonical: `/trade-off/yard/canteens/${slug}/manage` },
    robots: { index: false, follow: false },
    openGraph: {
      type: "website",
      siteName: BRAND.name,
      title: `Manage ${canteen.name} — The Network`,
      url: absolute(`/trade-off/yard/canteens/${slug}/manage`)
    }
  };
}

export default async function CanteenManagePage({
  params
}: {
  params: Promise<{ slug: string }>;
}) {
  const { slug } = await params;
  const canteen = canteenBySlug(slug);
  if (!canteen) notFound();
  const members = membersForCanteen(canteen.id);
  const admin = adminForCanteen(canteen.id);
  const products = productsForCanteen(canteen.id);

  return (
    <CanteenManageShell
      canteen={canteen}
      admin={admin}
      members={members}
      products={products}
    />
  );
}
