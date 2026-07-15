// /tc/rates/network — Network-wide rate browse page.
//
// Trades pick a discipline + rate type, then browse verified market
// rates across every UK city where enough data exists to publish an
// aggregate. Evidence-or-silence rule
// (project_evidence_or_silence.md) applies everywhere:
//   • Only cities with a verified aggregate appear in the table
//   • Government baseline (ONS ASHE) shown alongside for scale
//   • Every displayed row shows sample size + contributor count +
//     "last updated" freshness
//   • When no data exists for a trade, the page says so honestly
//     and links to the contribute form on /tc/rates
//
// Trade-only route per constitutional gate — DIY viewers won't see
// trade prices or trade rate methodology.

import Link from "next/link";
import { ArrowLeft, TrendingUp, ShieldCheck, Info, ExternalLink } from "lucide-react";
import { TradeCenterHeader } from "@/apps/tradecenter/components/TradeCenterHeader";
import { SOC_TO_TRADE_SLUG, UK_CITIES, citySlugToLabel } from "@/lib/rates/taxonomy";
import { listCityRates, getNetworkAverage } from "@/lib/rates/getMarketRate";
import { getGovernmentRate } from "@/lib/rates/getGovernmentRate";

export const dynamic = "force-dynamic";

const RATE_TYPES = ["hourly", "daily", "annual"] as const;

type SearchParams = Promise<{
  trade?: string;
  rateType?: string;
}>;

function normaliseTradeSlug(slug: string | undefined): string {
  const found = SOC_TO_TRADE_SLUG.find((t) => t.slug === slug);
  return found?.slug ?? SOC_TO_TRADE_SLUG[0].slug;
}

function normaliseRateType(v: string | undefined): (typeof RATE_TYPES)[number] {
  return (RATE_TYPES.find((t) => t === v) as (typeof RATE_TYPES)[number] | undefined) ?? "hourly";
}

export default async function NetworkRatesPage({
  searchParams
}: {
  searchParams: SearchParams;
}) {
  const params = await searchParams;
  const tradeSlug = normaliseTradeSlug(params.trade);
  const rateType = normaliseRateType(params.rateType);
  const tradeLabel = SOC_TO_TRADE_SLUG.find((t) => t.slug === tradeSlug)?.label ?? tradeSlug;

  const [cityRates, networkAvg] = await Promise.all([
    listCityRates({ tradeSlug, rateType }),
    getNetworkAverage({ tradeSlug, rateType })
  ]);

  return (
    <div className="flex min-h-screen flex-col bg-[#FBF6EC]">
      <TradeCenterHeader activeCategorySlug={null}/>
      <main className="mx-auto flex w-full max-w-5xl flex-1 flex-col gap-6 px-4 py-6 md:px-6 md:py-8">
        <div className="flex flex-wrap items-center gap-2">
          <Link
            href="/tc/rates"
            className="inline-flex h-9 items-center gap-1.5 rounded-full border bg-white px-3 text-[11px] font-black uppercase tracking-wider text-neutral-800 shadow-sm transition hover:bg-neutral-50"
            style={{ borderColor: "rgba(139,69,19,0.15)" }}
          >
            <ArrowLeft size={12}/>
            Back to my rates
          </Link>
        </div>

        <header>
          <div className="text-[10px] font-black uppercase tracking-[0.15em] text-neutral-500">
            Trade Center · Network rates
          </div>
          <h1 className="mt-1 text-[22px] font-black leading-tight text-neutral-900 md:text-[28px]">
            {tradeLabel} rates across the UK
          </h1>
          <p className="mt-1 max-w-2xl text-[12px] leading-snug text-neutral-600 md:text-[13px]">
            Verified market rates by city. We only publish an aggregate when at least 3 independent VTI-verified trades have submitted within a 3-month window and the standard deviation is under 15%. Silence means we don&apos;t have enough evidence — never a made-up number.
          </p>
        </header>

        {/* Trade + rate type filters. Simple GET form so the page
            reloads with the chosen filters in the URL — shareable. */}
        <form className="flex flex-wrap items-end gap-3 rounded-2xl border bg-white p-4 shadow-sm" style={{ borderColor: "rgba(139,69,19,0.15)" }}>
          <label className="flex flex-col gap-1">
            <span className="text-[10px] font-black uppercase tracking-wider text-neutral-600">Trade</span>
            <select
              name="trade"
              defaultValue={tradeSlug}
              className="min-h-[42px] rounded-md border bg-white px-3 text-[12.5px] text-neutral-900"
              style={{ borderColor: "rgba(139,69,19,0.18)" }}
            >
              {SOC_TO_TRADE_SLUG.map((t) => (
                <option key={t.slug} value={t.slug}>{t.label}</option>
              ))}
            </select>
          </label>
          <label className="flex flex-col gap-1">
            <span className="text-[10px] font-black uppercase tracking-wider text-neutral-600">Rate type</span>
            <select
              name="rateType"
              defaultValue={rateType}
              className="min-h-[42px] rounded-md border bg-white px-3 text-[12.5px] text-neutral-900"
              style={{ borderColor: "rgba(139,69,19,0.18)" }}
            >
              <option value="hourly">Hourly</option>
              <option value="daily">Daily</option>
              <option value="annual">Annual</option>
            </select>
          </label>
          <button
            type="submit"
            className="inline-flex h-11 items-center gap-1.5 rounded-full px-4 text-[11.5px] font-black uppercase tracking-wider text-white shadow-sm"
            style={{ backgroundColor: "#166534" }}
          >
            Update
          </button>
        </form>

        {/* Network summary card. Empty state honestly says "not enough
            data yet" and points at the contribute page. */}
        {networkAvg ? (
          <NetworkSummaryCard networkAvg={networkAvg} tradeLabel={tradeLabel} rateType={rateType}/>
        ) : (
          <EmptyNetworkCard tradeLabel={tradeLabel} rateType={rateType}/>
        )}

        {/* Per-city table. Every row has evidence trail. */}
        {cityRates.length > 0 && (
          <section className="flex flex-col gap-3">
            <div className="flex items-center gap-2">
              <TrendingUp size={14} className="text-neutral-700"/>
              <div className="text-[10px] font-black uppercase tracking-[0.15em] text-neutral-500">
                Verified city rates — sorted by median
              </div>
            </div>
            <div
              className="overflow-hidden rounded-2xl border bg-white shadow-sm"
              style={{ borderColor: "rgba(139,69,19,0.15)" }}
            >
              <table className="w-full text-[12px]">
                <thead className="bg-neutral-50">
                  <tr>
                    <th className="px-4 py-3 text-left text-[10px] font-black uppercase tracking-[0.14em] text-neutral-500">City</th>
                    <th className="px-4 py-3 text-right text-[10px] font-black uppercase tracking-[0.14em] text-neutral-500">Median</th>
                    <th className="px-4 py-3 text-right text-[10px] font-black uppercase tracking-[0.14em] text-neutral-500">Range (P25-P75)</th>
                    <th className="px-4 py-3 text-right text-[10px] font-black uppercase tracking-[0.14em] text-neutral-500">Sample</th>
                    <th className="px-4 py-3 text-right text-[10px] font-black uppercase tracking-[0.14em] text-neutral-500">Updated</th>
                  </tr>
                </thead>
                <tbody className="divide-y" style={{ borderColor: "rgba(139,69,19,0.08)" }}>
                  {cityRates.map((r) => (
                    <tr key={`${r.citySlug}-${r.windowEnd}`}>
                      <td className="px-4 py-3 font-bold text-neutral-900">
                        {r.citySlug ? citySlugToLabel(r.citySlug) : "—"}
                      </td>
                      <td className="px-4 py-3 text-right font-black text-neutral-900">
                        £{r.gbpMedian.toFixed(2)}
                      </td>
                      <td className="px-4 py-3 text-right text-neutral-600">
                        £{r.gbpP25.toFixed(2)}-£{r.gbpP75.toFixed(2)}
                      </td>
                      <td className="px-4 py-3 text-right text-neutral-600">
                        {r.sampleSize} rates<span className="text-neutral-400"> · </span>{r.contributorCount} trades
                      </td>
                      <td className="px-4 py-3 text-right text-neutral-500">
                        {r.freshnessDays === 0 ? "today" : `${r.freshnessDays}d ago`}
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
            <p className="text-[10.5px] leading-snug text-neutral-500">
              Every rate here meets our verified-market threshold: 3+ independent VTI-verified contributors within a 3-month window, standard deviation under 15% of median, no single contributor represents more than 40% of the sample. Cities missing from this table have insufficient evidence yet — <Link href="/tc/rates" className="font-black text-neutral-800 hover:underline">contribute your rate</Link> to help unlock them.
            </p>
          </section>
        )}

        {/* Government baseline reminder — always show at the bottom
            so trades can compare their city median against the ONS
            national baseline. */}
        <GovernmentBaselineReminder tradeSlug={tradeSlug} rateType={rateType} tradeLabel={tradeLabel}/>

        {/* Methodology footer */}
        <section
          className="rounded-2xl border p-5 shadow-sm"
          style={{ backgroundColor: "#F0FDF4", borderColor: "rgba(22,101,52,0.35)" }}
        >
          <div className="flex items-start gap-3">
            <div
              className="flex h-9 w-9 flex-shrink-0 items-center justify-center rounded-full"
              style={{ backgroundColor: "#166534", color: "#FFFFFF" }}
            >
              <ShieldCheck size={16} strokeWidth={2.5}/>
            </div>
            <div>
              <div className="text-[13px] font-black" style={{ color: "#166534" }}>
                How we know these numbers
              </div>
              <p className="mt-1 text-[11.5px] leading-snug text-neutral-700">
                Two sources: official government data (ONS ASHE, CITB Skills Network, HMRC PAYE — all publicly published, OGL v3.0) and verified user submissions (VTI-only, 3-contributor minimum, 3-month rolling window, standard deviation under 15% of median, one submission per trade × region × rate type × month). Contributor identity never appears with the displayed rate.
              </p>
              <p className="mt-2 text-[11px] leading-snug text-neutral-600">
                If you spot a number here that looks wrong, tell us — every claim is auditable via its source. We&apos;d rather show you nothing than fabricate a figure.
              </p>
            </div>
          </div>
        </section>
      </main>
    </div>
  );
}

// ── Sub-components ────────────────────────────────────────────────

function NetworkSummaryCard({
  networkAvg,
  tradeLabel,
  rateType
}: {
  networkAvg: NonNullable<Awaited<ReturnType<typeof getNetworkAverage>>>;
  tradeLabel: string;
  rateType: (typeof RATE_TYPES)[number];
}) {
  const rateTypeLabel = rateType === "hourly" ? "hourly rate" : rateType === "daily" ? "day rate" : "annual salary";
  return (
    <section
      className="rounded-2xl border p-5 shadow-sm"
      style={{ backgroundColor: "#FEF3C7", borderColor: "rgba(255,179,0,0.4)" }}
    >
      <div className="text-[10px] font-black uppercase tracking-[0.15em] text-neutral-700">
        Network average — {tradeLabel} · {rateTypeLabel}
      </div>
      <div className="mt-2 flex flex-wrap items-baseline gap-3">
        <div className="text-[36px] font-black leading-none text-neutral-900">
          £{networkAvg.weightedMedian.toFixed(2)}
        </div>
        <div className="text-[11.5px] text-neutral-600">
          weighted median across {networkAvg.cityCount} {networkAvg.cityCount === 1 ? "city" : "cities"} · {networkAvg.regionCount} {networkAvg.regionCount === 1 ? "region" : "regions"}
        </div>
      </div>
      <div className="mt-2 text-[10.5px] text-neutral-500">
        Based on {networkAvg.totalSampleSize} verified rates from VTI trades. Higher-contribution cities weighted more heavily. Freshest data: {daysAgo(networkAvg.freshestComputedAt)} ago.
      </div>
    </section>
  );
}

function EmptyNetworkCard({ tradeLabel, rateType }: { tradeLabel: string; rateType: string }) {
  return (
    <section
      className="rounded-2xl border p-5 shadow-sm"
      style={{ backgroundColor: "#FEF3C7", borderColor: "rgba(180,83,9,0.30)" }}
    >
      <div className="flex items-start gap-3">
        <div
          className="flex h-9 w-9 flex-shrink-0 items-center justify-center rounded-full"
          style={{ backgroundColor: "#0A0A0A", color: "#FFB300" }}
        >
          <Info size={16}/>
        </div>
        <div className="min-w-0 flex-1">
          <div className="text-[13px] font-black text-neutral-900">
            Not enough verified {rateType} rates yet for {tradeLabel}
          </div>
          <p className="mt-1 text-[11.5px] leading-snug text-neutral-700">
            No city in our network has yet reached the 3-contributor threshold within a 3-month window for this combination. Rather than fill this space with a made-up number, we&apos;re waiting for real evidence.
          </p>
          <Link
            href="/tc/rates"
            className="mt-3 inline-flex items-center gap-1 rounded-full px-4 py-2 text-[11px] font-black uppercase tracking-wider text-white shadow-sm"
            style={{ backgroundColor: "#166534" }}
          >
            Contribute your rate
          </Link>
        </div>
      </div>
    </section>
  );
}

async function GovernmentBaselineReminder({
  tradeSlug,
  rateType,
  tradeLabel
}: {
  tradeSlug: string;
  rateType: (typeof RATE_TYPES)[number];
  tradeLabel: string;
}) {
  // Try a national-scale lookup by picking any populated region — the
  // regional variation from ONS is intentionally NOT shown here since
  // the city table above is the finer signal. This block just points
  // trades at the raw ONS data for comparison.
  const anyGov = await getGovernmentRate({
    tradeSlug,
    regionCode: "UKI", // London — most-populated bucket typically populated first
    rateType
  });
  return (
    <section
      className="rounded-2xl border p-5 shadow-sm"
      style={{ backgroundColor: "#FBF6EC", borderColor: "rgba(139,69,19,0.15)" }}
    >
      <div className="flex items-start gap-3">
        <div
          className="flex h-9 w-9 flex-shrink-0 items-center justify-center rounded-full"
          style={{ backgroundColor: "#0A0A0A", color: "#FFB300" }}
        >
          <TrendingUp size={16}/>
        </div>
        <div className="min-w-0 flex-1">
          <div className="text-[13px] font-black text-neutral-900">
            Government baseline — ONS ASHE
          </div>
          {anyGov ? (
            <p className="mt-1 text-[11.5px] leading-snug text-neutral-700">
              ONS ASHE ({anyGov.sourceRelease}) reports a median {rateType} rate of <strong>£{anyGov.gbpMedian.toFixed(2)}</strong> for {tradeLabel} in {anyGov.regionLabel}. Regional variation is meaningful — use the city table above for your local market.
            </p>
          ) : (
            <p className="mt-1 text-[11.5px] leading-snug text-neutral-700">
              We haven&apos;t ingested the latest ONS ASHE release yet — check the raw dataset directly to compare against our verified market rates.
            </p>
          )}
          <a
            href="https://www.ons.gov.uk/employmentandlabourmarket/peopleinwork/earningsandworkingtime/bulletins/annualsurveyofhoursandearnings/latest"
            target="_blank"
            rel="noopener noreferrer"
            className="mt-3 inline-flex items-center gap-1 text-[11px] font-black uppercase tracking-wider text-neutral-800 hover:underline"
          >
            <ExternalLink size={11}/>
            View ONS ASHE Table 15
          </a>
        </div>
      </div>
    </section>
  );
}

function daysAgo(iso: string): string {
  const days = Math.max(0, Math.floor((Date.now() - new Date(iso).getTime()) / (1000 * 60 * 60 * 24)));
  if (days === 0) return "today";
  if (days === 1) return "1 day";
  return `${days} days`;
}
