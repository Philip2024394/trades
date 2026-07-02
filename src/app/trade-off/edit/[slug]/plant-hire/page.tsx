// xratedtrade.com — Plant Hire service editor.
//
// Merchant enables / prices the 12 plant categories, picks fulfilment
// modes (collect / delivery / operator / long-term), sets years, damage
// waiver options, delivery zones, fuel policy, deposit, CPCS gating,
// yard address, banner + illustration, promo, headings and custom copy.

import type { Metadata } from "next";
import Link from "next/link";
import { DashboardHeader } from "@/components/trade-off/DashboardHeader";
import { DashboardFooter } from "@/components/trade-off/DashboardFooter";
import { supabaseAdmin } from "@/lib/supabaseAdmin";
import { PlantHireEditor } from "@/components/trade-off/PlantHireEditor";
import { normalisePlantHireConfig } from "@/lib/plantHire";
import { resolveAppHero } from "@/lib/tradeAppBanners";
import { tradeLabel } from "@/lib/tradeOff";

export const dynamic = "force-dynamic";

export const metadata: Metadata = {
  title: "Plant Hire | xratedtrade.com",
  robots: { index: false, follow: false }
};

type SearchParams = Promise<{ token?: string | string[] }>;
type Params = Promise<{ slug: string }>;

export default async function PlantHireEditPage({
  params,
  searchParams
}: {
  params: Params;
  searchParams: SearchParams;
}) {
  const { slug } = await params;
  const sp = await searchParams;
  const rawToken = Array.isArray(sp.token) ? sp.token[0] : sp.token;
  const token = typeof rawToken === "string" ? rawToken.trim() : "";
  if (!slug || !token) return <InvalidLink reason="missing-token" />;

  const row = await supabaseAdmin
    .from("hammerex_trade_off_listings")
    .select(
      "id, slug, edit_token, display_name, plant_hire, avatar_url, city, primary_trade, tier, last_payment_plan, custom_app_hero_url, trading_name, services_offered"
    )
    .eq("slug", slug)
    .maybeSingle();
  if (!row.data) return <InvalidLink reason="not-found" />;
  if (row.data.edit_token !== token) return <InvalidLink reason="bad-token" />;

  const backHref = `/trade-off/edit/${encodeURIComponent(slug)}?token=${encodeURIComponent(token)}`;
  const initial = normalisePlantHireConfig(row.data.plant_hire);
  const heroUrl = resolveAppHero({
    custom_app_hero_url: row.data.custom_app_hero_url ?? null,
    primary_trade: row.data.primary_trade ?? null,
    tier: row.data.tier ?? null,
    last_payment_plan: row.data.last_payment_plan ?? null
  });
  const previewSnapshot = {
    display_name: row.data.display_name ?? slug,
    trading_name: row.data.trading_name ?? "",
    services_offered: Array.isArray(row.data.services_offered)
      ? row.data.services_offered
      : [],
    city: row.data.city ?? "",
    avatar_url: row.data.avatar_url ?? "",
    hero_url: heroUrl ?? "",
    trade_label: tradeLabel(row.data.primary_trade)
  };

  return (
    <main className="min-h-screen bg-brand-bg text-brand-text">
      <DashboardHeader />
      <section className="mx-auto max-w-3xl px-4 pb-2 pt-10">
        <Link
          href={backHref}
          className="inline-flex h-9 items-center text-xs font-bold text-brand-muted transition hover:text-brand-accent"
        >
          &larr; Back to dashboard
        </Link>
      </section>
      <section className="mx-auto max-w-3xl px-4 pb-6 pt-4">
        <p className="text-xs font-bold uppercase tracking-widest text-brand-accent">
          Add-on &middot; Plant Hire
        </p>
        <h1 className="mt-2 text-3xl font-extrabold leading-tight sm:text-4xl">
          Plant Hire
        </h1>
        <p className="mt-3 max-w-2xl text-[13px] text-brand-muted">
          Enable the plant categories you hire, set day / week / month prices, choose fulfilment modes (collect / delivery / operator / long-term), and configure damage waivers + delivery zones. Everything renders on your public /<span className="font-mono">{slug}</span>/plant-hire page.
        </p>
        <div className="mt-4 flex gap-3">
          <Link
            href={`/${slug}/plant-hire`}
            target="_blank"
            className="inline-flex h-11 items-center rounded-xl bg-brand-accent px-4 text-[12px] font-extrabold uppercase tracking-widest text-black transition hover:opacity-90"
          >
            Preview live →
          </Link>
        </div>
      </section>

      <PlantHireEditor
        slug={slug}
        token={token}
        initial={initial}
        previewSnapshot={previewSnapshot}
      />

      <DashboardFooter slug={slug} token={token} />
    </main>
  );
}

function InvalidLink({ reason }: { reason: string }) {
  return (
    <main className="min-h-screen bg-brand-bg text-brand-text">
      <DashboardHeader />
      <section className="mx-auto max-w-md px-4 pb-24 pt-16 text-center">
        <h1 className="text-2xl font-extrabold">Link expired or invalid</h1>
        <p className="mt-3 text-[13px] text-brand-muted">
          Re-open your dashboard from the link in your email. ({reason})
        </p>
      </section>
    </main>
  );
}
