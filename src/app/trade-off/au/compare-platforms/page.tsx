// /trade-off/au/compare-platforms — public Australia-market
// comparison report. Mirrors /trade-off/compare-platforms (UK) with
// AU-specific dataset + legal framing (Australian Consumer Law
// s.18 + s.29, TMA 1995 Cth s.122(1)(f)).
//
// Data source: src/data/tradePlatformComparison.au.ts (research
// agent 2026-07-18). Evidence-or-silence — unverified features
// marked "—" not fabricated.

import type { Metadata } from "next";
import Link from "next/link";
import { ArrowLeft, Check, X } from "lucide-react";
import { XratedHeader } from "@/components/xrated/XratedHeader";
import { XratedFooter } from "@/components/xrated/XratedFooter";
import { FEATURE_COLUMNS } from "@/data/tradePlatformComparison";
import { TRADE_PLATFORMS_AU, comparisonStatsAU } from "@/data/tradePlatformComparison.au";

export const metadata: Metadata = {
  title:       "Networkers vs 15 Australian trade platforms — full comparison | The Network",
  description: "Australia trade-services directories + platforms scored side-by-side across 16 feature dimensions with current 2026 pricing. Compiled from each platform's public docs.",
  robots:      { index: true, follow: true }
};

export const revalidate = 3600;

const BRAND_YELLOW = "#FFB300";
const BRAND_GREEN  = "#166534";

export default function ComparePlatformsAuPage() {
  const stats = comparisonStatsAU();

  return (
    <main className="min-h-screen pb-24" style={{ backgroundColor: "#FBF6EC" }}>
      <XratedHeader/>

      <section className="mx-auto max-w-6xl px-4 pt-8 sm:px-6 sm:pt-12">
        <Link href="/trade-off" className="inline-flex items-center gap-1.5 text-[12px] font-bold text-neutral-600 hover:text-neutral-900">
          <ArrowLeft size={13} strokeWidth={2.4}/>
          Back to Thenetworkers
        </Link>

        <div className="mt-4 flex flex-wrap gap-2">
          <Link href="/trade-off/compare-platforms" className="rounded-full border px-3 py-1 text-[11px] font-black uppercase tracking-wider text-neutral-700 hover:bg-neutral-100" style={{ borderColor: "rgba(0,0,0,0.15)" }}>
            🇬🇧 UK
          </Link>
          <Link href="/trade-off/us/compare-platforms" className="rounded-full border px-3 py-1 text-[11px] font-black uppercase tracking-wider text-neutral-700 hover:bg-neutral-100" style={{ borderColor: "rgba(0,0,0,0.15)" }}>
            🇺🇸 USA
          </Link>
          <span className="rounded-full px-3 py-1 text-[11px] font-black uppercase tracking-wider text-white" style={{ backgroundColor: BRAND_GREEN }}>
            🇦🇺 Australia
          </span>
        </div>

        <p className="mt-6 text-xs font-bold uppercase tracking-[0.22em]" style={{ color: BRAND_YELLOW }}>
          The full report · Australia
        </p>
        <h1 className="mt-2 text-3xl font-extrabold leading-tight text-neutral-900 sm:text-4xl md:text-5xl">
          Networkers vs {stats.othersScanned} Australian trade platforms.
        </h1>
        <p className="mt-4 max-w-3xl text-sm leading-relaxed text-neutral-700 sm:text-base">
          Every major Australian trade-services directory + platform we could find, side by side, across {stats.totalFeatures} specific feature dimensions with current 2026 pricing.
          Facts as at <span className="font-black text-neutral-900">{new Date().toLocaleDateString("en-AU", { year: "numeric", month: "long" })}</span> from each platform&rsquo;s public pricing + docs.
          Where a feature couldn&rsquo;t be verified from public info we mark it &ldquo;—&rdquo;{" "}
          <span className="font-black text-neutral-900">rather than guess</span>.{" "}
          <a href="#methodology" className="font-black text-neutral-900 underline hover:text-neutral-700">Methodology &amp; corrections process ↓</a>
        </p>

        <div className="mt-8 grid grid-cols-2 gap-3 rounded-2xl bg-neutral-900 p-4 text-white sm:grid-cols-4">
          <Stat value={stats.usFeatureCount.toString()} label={`of ${stats.totalFeatures} features live on Networkers`}/>
          <Stat value={stats.othersScanned.toString()} label="AU competitors surveyed" />
          <Stat value="Free" label="Base tier — no card, no expiry"/>
          <Stat value="No" label="Commission taken from your jobs"/>
        </div>

        <div className="mt-8 overflow-x-auto rounded-2xl border shadow-sm sm:mt-10" style={{ borderColor: "rgba(0,0,0,0.08)", backgroundColor: "#FFFFFF" }}>
          <table className="w-full min-w-[1200px] border-collapse text-[11px]">
            <thead>
              <tr className="border-b" style={{ borderColor: "rgba(0,0,0,0.08)", backgroundColor: "#FBF6EC" }}>
                <th className="sticky left-0 z-10 bg-[#FBF6EC] px-3 py-3 text-left text-[10px] font-black uppercase tracking-wider text-neutral-600">
                  Platform
                </th>
                <th className="px-2 py-3 text-left text-[10px] font-black uppercase tracking-wider text-neutral-500">
                  Pricing (AUD, {new Date().toLocaleDateString("en-AU", { year: "numeric", month: "short" })})
                </th>
                {FEATURE_COLUMNS.map((col) => (
                  <th key={col.key} className="px-2 py-3 text-center text-[10px] font-black uppercase tracking-wider text-neutral-500" title={col.hint}>
                    {col.label}
                  </th>
                ))}
              </tr>
            </thead>
            <tbody>
              {TRADE_PLATFORMS_AU.map((p, i) => {
                const isUs = i === 0;
                const rowBg = isUs ? "rgba(255,179,0,0.10)" : (i % 2 === 1 ? "#FFFFFF" : "#FAFAFA");
                return (
                  <tr key={p.name} style={{ backgroundColor: rowBg }}>
                    <td className="sticky left-0 z-10 px-3 py-2.5 text-[11.5px] font-black text-neutral-900" style={{ backgroundColor: rowBg }}>
                      {isUs ? (
                        <a href={p.url} target="_blank" rel="noopener noreferrer">
                          <span
                            className="networkers-tick-heartbeat inline-flex items-center rounded-md px-2.5 py-1 text-[11px] font-black uppercase tracking-wider text-neutral-900 shadow-sm"
                            style={{ backgroundColor: BRAND_YELLOW }}
                          >
                            ★ {p.name}
                          </span>
                        </a>
                      ) : (
                        <a href={p.url} target="_blank" rel="noopener noreferrer" className="hover:underline">{p.name}</a>
                      )}
                    </td>
                    <td className="max-w-[280px] px-2 py-2.5 text-[10.5px] leading-snug text-neutral-600">
                      {p.pricing}
                    </td>
                    {FEATURE_COLUMNS.map((col) => (
                      <td key={col.key} className="px-2 py-2.5 text-center">
                        <Cell v={p.features[col.key]} accent={isUs && p.features[col.key] === true}/>
                      </td>
                    ))}
                  </tr>
                );
              })}
            </tbody>
          </table>
        </div>

        <div className="mx-auto mt-8 max-w-3xl rounded-2xl border p-5" style={{ borderColor: "rgba(0,0,0,0.08)", backgroundColor: "#FFFFFF" }}>
          <p className="text-[10px] font-black uppercase tracking-[0.16em] text-[#7A5B00]">
            Honest disclosure — where AU competitors beat us
          </p>
          <p className="mt-2 text-[13px] leading-relaxed text-neutral-700">
            We score ourselves the same way we score everyone else. Areas where established Australian competitors have the edge on us today:
          </p>
          <ul className="mt-3 space-y-1.5 text-[12.5px] leading-relaxed text-neutral-700">
            <li><span className="font-black text-neutral-900">AU brand recognition:</span> Hipages, Airtasker, and ServiceSeeking have national TV + brand presence dating back to 2004-2011. Networkers is a UK-launched product entering the AU market.</li>
            <li><span className="font-black text-neutral-900">AU tradie density:</span> Hipages holds decades of accumulated AU tradie profiles and job history. Our AU base is nascent.</li>
            <li><span className="font-black text-neutral-900">On-lead pricing:</span> Our washer packs cost AUD $0.09-0.19 per verified WhatsApp lead — cheaper than every pay-per-lead AU competitor surveyed, but not free. Confirmed truly-free-with-no-lead-fees AU alternatives: Google Business Profile, True Local, WOMO, dLook (all with narrower feature sets).</li>
          </ul>
          <p className="mt-3 text-[12.5px] leading-relaxed text-neutral-700">
            The comparison above is not a claim that Networkers is &ldquo;the best Australian trade platform&rdquo; overall. It is a scored comparison of {stats.totalFeatures} specific product dimensions on which Networkers is currently the most feature-complete of the {stats.othersScanned} AU platforms we surveyed.
          </p>
        </div>

        <div className="mt-10 rounded-2xl border p-6 text-center" style={{ borderColor: "rgba(22,101,52,0.30)", backgroundColor: "#ECFDF5" }}>
          <p className="text-[10px] font-black uppercase tracking-[0.16em] text-[#166534]">
            Ready to try
          </p>
          <p className="mt-2 text-[18px] font-black text-neutral-900">
            Get your own live trade site in 2 minutes.
          </p>
          <p className="mx-auto mt-2 max-w-md text-[12.5px] text-neutral-700">
            Free tier. No card. Every feature above except the paid ones.
          </p>
          <Link
            href="/trade-off/signup"
            className="mt-4 inline-flex h-11 items-center gap-1.5 rounded-full px-6 text-[12px] font-black uppercase tracking-wider text-white transition hover:brightness-95"
            style={{ backgroundColor: BRAND_GREEN }}
          >
            Join Networkers — free →
          </Link>
        </div>

        {/* Methodology + corrections — AU-specific legal framing.
            Australian Consumer Law (Sched 2, Competition and Consumer
            Act 2010 Cth) s.18 + s.29 govern misleading conduct + false
            representations about price. Trade Marks Act 1995 (Cth)
            s.122(1)(f) is the comparative-advertising defence — NOT
            s.122(1)(d) which is descriptive-use. Post-Nov-2022
            penalty regime: up to AUD $50M / 3x benefit / 30% adjusted
            turnover per corporate contravention. */}
        <div
          id="methodology"
          className="mt-14 rounded-2xl border p-6"
          style={{ borderColor: "rgba(0,0,0,0.08)", backgroundColor: "#FFFFFF" }}
        >
          <p className="text-[10px] font-black uppercase tracking-[0.16em] text-neutral-500">
            Methodology &amp; corrections
          </p>
          <h2 className="mt-1 text-[18px] font-black text-neutral-900">
            How this Australian comparison was compiled
          </h2>
          <ul className="mt-4 space-y-2 text-[12.5px] leading-relaxed text-neutral-700">
            <li><span className="font-black text-neutral-900">Scope.</span> Every score reflects only the {stats.totalFeatures} feature dimensions listed above. This is not an overall product ranking — competitors may score higher on features we didn&rsquo;t measure (e.g. AU brand history, AU-specific tradie licensing integrations, national TV advertising presence).</li>
            <li><span className="font-black text-neutral-900">Sources.</span> Each competitor&rsquo;s score was drawn from their own public pricing page, features page, help centre, and public app-store listings. Every price cites its source URL in our internal evidence file. Where a feature couldn&rsquo;t be verified from public info we mark &ldquo;—&rdquo; rather than assume.</li>
            <li><span className="font-black text-neutral-900">Dated as at {new Date().toLocaleDateString("en-AU", { year: "numeric", month: "long" })}.</span> AU pricing changes frequently (Hipages credit blocks and Airtasker tier commissions are dynamic). We re-verify quarterly. If you spot a stale row, contact us — post-Nov-2022 ACL amendments raised s.29 corporate penalties to the greater of AUD $50M, 3× benefit, or 30% of adjusted turnover per contravention so we take corrections extremely seriously.</li>
            <li><span className="font-black text-neutral-900">Corrections process.</span> If any competitor believes a row is wrong, email <a href="mailto:admin@thenetworkers.app?subject=AU%20comparison%20chart%20correction%20request" className="underline">admin@thenetworkers.app</a> with evidence. We commit to reviewing within 14 days and correcting or removing the row.</li>
            <li><span className="font-black text-neutral-900">Trade marks.</span> All Australian trade marks named (Hipages, ServiceSeeking, Airtasker, Oneflare, Yellow Pages Australia, True Local, Word of Mouth, Localsearch, Nextdoor, Google, Service.com.au, HomeImprovement2day, dLook, ProductReview, Facebook, and any others) are the property of their respective owners. Their inclusion is factual reference under the Trade Marks Act 1995 (Cth) s.122(1)(f) comparative-advertising defence — not endorsement, affiliation, or disparagement.</li>
            <li><span className="font-black text-neutral-900">Commercial intent.</span> Networkers is the product being compared. We monetise via subscription + washer packs. This chart is marketing content. See our <Link href="/trade-off/pricing" className="underline">pricing</Link> for full details.</li>
          </ul>
          <p className="mt-5 text-[10.5px] leading-snug text-neutral-500">
            Regulatory framing: this comparison is designed to meet the Australian Consumer Law (Schedule 2 to the Competition and Consumer Act 2010 (Cth)) s.18 (misleading or deceptive conduct) and s.29 (false or misleading representations, including sub-s.29(1)(i) on price), the Trade Marks Act 1995 (Cth) s.122(1)(f), and the ACCC&rsquo;s published guidance on comparative advertising.
          </p>
        </div>
      </section>

      <XratedFooter/>
    </main>
  );
}

function Stat({ value, label }: { value: string; label: string }) {
  return (
    <div className="rounded-lg bg-neutral-800 p-3 text-center">
      <p className="text-[24px] font-black leading-none" style={{ color: BRAND_YELLOW }}>{value}</p>
      <p className="mt-1 text-[10px] font-bold uppercase tracking-wider text-white/80">{label}</p>
    </div>
  );
}

function Cell({ v, accent }: { v: boolean | null; accent?: boolean }) {
  if (v === true) {
    return (
      <span
        className={`inline-flex h-5 w-5 items-center justify-center rounded-full${accent ? " networkers-tick-heartbeat" : ""}`}
        style={{ backgroundColor: accent ? BRAND_GREEN : "rgba(22,101,52,0.15)", color: accent ? "#FFFFFF" : BRAND_GREEN }}
        aria-label="Yes"
      >
        <Check size={11} strokeWidth={3}/>
      </span>
    );
  }
  if (v === false) {
    return (
      <span
        className="inline-flex h-5 w-5 items-center justify-center rounded-full"
        style={{ backgroundColor: "#DC2626", color: "#FFFFFF" }}
        aria-label="No"
      >
        <X size={11} strokeWidth={3}/>
      </span>
    );
  }
  return <span className="text-[11px] text-neutral-300" aria-label="Unknown">—</span>;
}
