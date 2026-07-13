// /trade/[slug]/trade-circle — the merchant's full Trade Circle page.
//
// Public. Renders the V2 two-mode Trade Circle (curated + auto-populated
// paid pool from complementary trades, daily-seeded rotation, host
// opt-out respected).

import { notFound } from "next/navigation";
import Link from "next/link";
import { ArrowLeft } from "lucide-react";
import { supabaseAdmin } from "@/lib/supabaseAdmin";
import { PageHeader } from "@/platform/ui";
import { TradeCircleRail } from "@/components/xrated/TradeCircleRail";

export const dynamic = "force-dynamic";
export const revalidate = 0;

export async function generateMetadata({
  params
}: {
  params: Promise<{ slug: string }>;
}) {
  const { slug } = await params;
  const { data } = await supabaseAdmin
    .from("os_business_listings")
    .select("display_name, primary_trade")
    .eq("slug", slug)
    .maybeSingle();
  const name = data?.display_name ?? slug;
  return {
    title: `${name} — Trade Circle · Thenetworkers`,
    description: `Trusted trades ${name} works with — recommended and verified.`
  };
}

export default async function TradeCirclePage({
  params
}: {
  params: Promise<{ slug: string }>;
}) {
  const { slug } = await params;
  const { data: business } = await supabaseAdmin
    .from("os_business_listings")
    .select("id, slug, display_name, primary_trade, city")
    .eq("slug", slug)
    .eq("status", "live")
    .maybeSingle();
  if (!business) notFound();

  return (
    <main className="mx-auto max-w-5xl p-4 md:p-6">
      <div className="mb-4">
        <Link
          href={`/trade/${business.slug}`}
          className="inline-flex items-center gap-1 text-[13px] font-semibold text-neutral-600 hover:text-neutral-900"
        >
          <ArrowLeft className="h-4 w-4" aria-hidden />
          Back to {business.display_name}
        </Link>
      </div>

      <PageHeader
        overline={`${business.display_name} · Trade Circle`}
        title="Trusted trades and merchants"
        subtitle={`Businesses ${business.display_name} works with — plus recommended local trades in complementary categories.`}
      />

      <TradeCircleRail slug={business.slug} variant="grid" limit={24} />
    </main>
  );
}
