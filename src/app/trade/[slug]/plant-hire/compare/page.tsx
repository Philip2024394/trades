// /<slug>/plant-hire/compare — side-by-side machine comparison.
// URL: ?m=mini_excavator&m=midi_excavator&m=telehandler (max 4)

import type { Metadata } from "next";
import Link from "next/link";
import { notFound, redirect } from "next/navigation";
import { supabase } from "@/lib/supabase";
import { effectiveTier } from "@/lib/xratedTrades";
import { isPlantHireOn } from "@/lib/xratedAddons";
import { tradeLabel, whatsappDigits } from "@/lib/tradeOff";
import { TradeProfileHeader } from "@/components/xrated/TradeProfileHeader";
import { TradeProfileFooter } from "@/components/xrated/TradeProfileFooter";
import { PremiumHero } from "@/components/xrated/profile/PremiumHero";
import { adminWhatsapp } from "@/lib/whatsapp";
import {
  PLANT_CATEGORIES,
  isPlantHireConfigured,
  mergeSpecs,
  normalisePlantHireConfig,
  type PlantCategoryConfig,
  type PlantCategorySlug
} from "@/lib/plantHire";
import { PlantCompareSelector } from "@/components/xrated/profile/PlantCompareSelector";

export const revalidate = 60;

type SearchParams = Promise<{ m?: string | string[] }>;

export async function generateMetadata({
  params
}: {
  params: Promise<{ slug: string }>;
}): Promise<Metadata> {
  const { slug } = await params;
  return {
    title: `Compare machines — ${slug}`,
    alternates: { canonical: `/${slug}/plant-hire/compare` }
  };
}

export default async function PlantComparePage({
  params,
  searchParams
}: {
  params: Promise<{ slug: string }>;
  searchParams: SearchParams;
}) {
  const { slug } = await params;
  const sp = await searchParams;
  const rawMs = sp.m;
  const requested = Array.isArray(rawMs) ? rawMs : rawMs ? [rawMs] : [];

  const listingRes = await supabase
    .from("hammerex_trade_off_listings")
    .select("*")
    .eq("slug", slug)
    .eq("status", "live")
    .maybeSingle();
  if (!listingRes.data) notFound();
  const listing = listingRes.data;

  const tier = effectiveTier(listing);
  const isPaid = tier === "app_trial" || tier === "app_paid" || tier === "app_verified";
  if (!isPaid || !isPlantHireOn(listing)) redirect(`/${slug}`);

  const cfg = normalisePlantHireConfig(listing.plant_hire);
  if (!isPlantHireConfigured(cfg)) redirect(`/${slug}`);

  const validSlugs = new Set(PLANT_CATEGORIES.map((m) => m.slug));
  const selected = requested
    .filter((s): s is PlantCategorySlug => validSlugs.has(s as PlantCategorySlug))
    .filter((s) => cfg.categories[s]?.enabled)
    .slice(0, 4);

  const wa = whatsappDigits(listing.whatsapp ?? "");
  const waFinal = wa || adminWhatsapp();
  const waUrl = waFinal ? `https://wa.me/${waFinal}` : "#";
  const primary = tradeLabel(listing.primary_trade);
  const merchantName = listing.display_name ?? slug;
  const heroTier =
    tier === "app_paid" || tier === "app_verified"
      ? "paid"
      : tier === "app_trial"
        ? "paid"
        : "free";

  const fleet = PLANT_CATEGORIES.map((meta) => {
    const c = cfg.categories[meta.slug] as PlantCategoryConfig | undefined;
    if (!c?.enabled) return null;
    return { slug: meta.slug, label: meta.label, image_url: c.image_url ?? "" };
  }).filter((x): x is NonNullable<typeof x> => x !== null);

  const rows = selected.map((s) => {
    const meta = PLANT_CATEGORIES.find((m) => m.slug === s)!;
    const c = cfg.categories[s] as PlantCategoryConfig;
    const specs = mergeSpecs(s, c.specs);
    return { slug: s, meta, c, specs };
  });

  return (
    <main className="flex flex-1 flex-col bg-neutral-50 pb-16">
      <TradeProfileHeader listing={listing} appName={`${primary} Service`} backHref={`/${slug}`} />
      <PremiumHero listing={listing} waUrl={waUrl} currentPage="contact" tier={heroTier} />

      <nav
        aria-label="Breadcrumb"
        className="mx-auto flex w-full max-w-6xl items-center gap-2 px-4 pt-6 text-[11px] font-bold uppercase tracking-widest text-neutral-500 sm:px-6"
      >
        <Link href={`/${slug}`} className="transition hover:text-[#FFB300]">
          {merchantName}
        </Link>
        <span aria-hidden="true">›</span>
        <Link href={`/${slug}/plant-hire`} className="transition hover:text-[#FFB300]">
          Plant Hire
        </Link>
        <span aria-hidden="true">›</span>
        <span className="text-neutral-900">Compare</span>
      </nav>

      <section className="mx-auto w-full max-w-6xl px-4 pt-4 sm:px-6">
        <p className="text-[10px] font-extrabold uppercase tracking-[0.22em] text-[#FFB300]">
          Side-by-side comparison
        </p>
        <h1 className="mt-1 text-3xl font-extrabold text-neutral-900 sm:text-4xl">
          Compare machines
        </h1>
        <p className="mt-2 max-w-2xl text-[14px] leading-relaxed text-neutral-600">
          Pick up to 4 machines from our fleet — day/week rates, dig depth, reach, weight, transport
          dimensions and ULEZ compliance shown side by side.
        </p>
      </section>

      <section className="mx-auto w-full max-w-6xl px-4 pt-6 sm:px-6">
        <PlantCompareSelector merchantSlug={listing.slug} fleet={fleet} selected={selected} />
      </section>

      {rows.length >= 2 ? (
        <section className="mx-auto mt-6 w-full max-w-6xl px-4 sm:px-6">
          <div className="overflow-x-auto rounded-2xl border border-neutral-200 bg-white">
            <table className="w-full min-w-[720px] border-collapse">
              <thead>
                <tr className="border-b border-neutral-200 bg-neutral-50">
                  <th className="w-40 p-3 text-left text-[10px] font-extrabold uppercase tracking-widest text-neutral-500">
                    Spec
                  </th>
                  {rows.map((r) => (
                    <th key={r.slug} className="p-3 text-left">
                      <Link
                        href={`/${slug}/plant-hire/machines/${r.slug}`}
                        className="group flex flex-col gap-2"
                      >
                        <div className="grid aspect-video w-full place-items-center overflow-hidden rounded-xl bg-neutral-50">
                          {r.c.image_url ? (
                            // eslint-disable-next-line @next/next/no-img-element
                            <img
                              src={r.c.image_url}
                              alt={r.meta.label}
                              loading="lazy"
                              className="h-full w-full object-contain p-2"
                            />
                          ) : (
                            <span className="text-[9px] font-extrabold uppercase text-neutral-500">
                              Photo pending
                            </span>
                          )}
                        </div>
                        <p className="text-[12px] font-extrabold leading-tight text-neutral-900 group-hover:text-[#FFB300]">
                          {r.meta.label}
                        </p>
                      </Link>
                    </th>
                  ))}
                </tr>
              </thead>
              <tbody>
                {ROW_DEFS.map((def) => {
                  const cells = rows.map((r) => def.render(r.c, r.specs));
                  const hasAny = cells.some((c) => c !== null && c !== "");
                  if (!hasAny) return null;
                  return (
                    <tr key={def.label} className="border-b border-neutral-100 last:border-0">
                      <td className="p-3 align-top text-[11px] font-bold uppercase tracking-widest text-neutral-500">
                        {def.label}
                      </td>
                      {cells.map((c, i) => (
                        <td key={i} className="p-3 align-top text-[13px] font-bold text-neutral-900">
                          {c ?? "—"}
                        </td>
                      ))}
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>
        </section>
      ) : (
        <section className="mx-auto mt-6 w-full max-w-6xl px-4 sm:px-6">
          <div className="rounded-2xl border border-dashed border-neutral-300 bg-white p-6 text-center">
            <p className="text-[13px] font-bold text-neutral-600">
              Pick at least 2 machines above to see the comparison table.
            </p>
          </div>
        </section>
      )}

      <div className="mt-auto pt-12">
        <TradeProfileFooter listing={listing} appName={`${primary} Service`} />
      </div>
    </main>
  );
}

type Spec = ReturnType<typeof mergeSpecs>;
type Row = { label: string; render: (c: PlantCategoryConfig, s: Spec) => string | null };

const ROW_DEFS: Row[] = [
  { label: "Day rate", render: (c) => (c.price_day_pence ? `£${(c.price_day_pence / 100).toFixed(0)}` : null) },
  { label: "Week rate", render: (c) => (c.price_week_pence ? `£${(c.price_week_pence / 100).toFixed(0)}` : null) },
  { label: "Month rate", render: (c) => (c.price_month_pence ? `£${(c.price_month_pence / 100).toFixed(0)}` : null) },
  {
    label: "Operator premium/day",
    render: (c) => (c.operator_premium_day_pence ? `£${(c.operator_premium_day_pence / 100).toFixed(0)}` : null)
  },
  {
    label: "Wet hire rate/day",
    render: (c) => (c.wet_price_day_pence ? `£${(c.wet_price_day_pence / 100).toFixed(0)}` : null)
  },
  { label: "Weight", render: (_c, s) => (s.weight_kg ? `${s.weight_kg.toLocaleString()} kg` : null) },
  { label: "Dig depth", render: (_c, s) => (s.dig_depth_mm ? `${s.dig_depth_mm} mm` : null) },
  { label: "Reach", render: (_c, s) => (s.reach_mm ? `${s.reach_mm} mm` : null) },
  { label: "Bucket", render: (_c, s) => (s.bucket_l ? `${s.bucket_l} L` : null) },
  { label: "HP", render: (_c, s) => (s.hp ? `${s.hp} HP` : null) },
  { label: "Transport L×W×H",
    render: (_c, s) =>
      s.transport_length_mm && s.transport_width_mm && s.transport_height_mm
        ? `${s.transport_length_mm} × ${s.transport_width_mm} × ${s.transport_height_mm} mm`
        : null
  },
  { label: "Fuel", render: (_c, s) => (s.fuel_type ? s.fuel_type.replace("_", " ") : null) },
  { label: "Fuel tank", render: (_c, s) => (s.fuel_tank_l ? `${s.fuel_tank_l} L` : null) },
  { label: "Run time", render: (_c, s) => (s.run_time_hours ? `${s.run_time_hours} h` : null) },
  { label: "Emission", render: (_c, s) => (s.emission ? s.emission.replace("_", " ").toUpperCase() : null) },
  { label: "ULEZ", render: (_c, s) => (s.ulez_compliant === true ? "✓ Compliant" : s.ulez_compliant === false ? "✗ Not compliant" : null) },
  {
    label: "Noise (bystander)",
    render: (_c, s) => (s.noise_db_bystander ? `${s.noise_db_bystander} dB(A)` : null)
  },
  {
    label: "Ground pressure",
    render: (_c, s) => (s.ground_pressure_kpa ? `${s.ground_pressure_kpa} kPa` : null)
  },
  { label: "Sub-hire available", render: (c) => (c.sub_hire_available ? "✓ Yes" : null) }
];
