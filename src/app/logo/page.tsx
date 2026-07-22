// /logo — landing hero for Logo Studio.
//
// Big statement, three trust-anchors, four pricing tiers, one CTA.
// No login required to reach here or the build flow. Sign-up happens
// post-purchase so we don't gate discovery.

import Link from "next/link";
import { ArrowRight, Zap, Palette, Download, Package, ShieldCheck } from "lucide-react";
import { LOGO_STYLES, styleBySlug } from "@/lib/logo/catalog";
import { StylePreviewTile } from "@/components/logo/StylePreviewTile";

const BRAND_YELLOW = "#FFB300";
const BRAND_BLACK  = "#0A0A0A";

const TIERS = [
  {
    name:  "Single",
    price: "£4.99",
    tag:   "One logo, one download",
    perks: ["1 style, one variant", "Transparent PNG at 2048px", "Personal-use licence"]
  },
  {
    name:  "Trade Kit",
    price: "£14.99",
    tag:   "Three variants for every surface",
    perks: ["Flat + 3D metallic + mono", "All social sizes", "Full commercial licence"],
    featured: true
  },
  {
    name:  "Van & Kit Pack",
    price: "£29.99",
    tag:   "Everything you need to look real",
    perks: ["Trade Kit above", "Hi-vis mockup + van wrap preview", "Business card + invoice header"]
  },
  {
    name:  "Own It",
    price: "£99.99",
    tag:   "The full rights",
    perks: ["Vector SVG + editable source", "Signed IP-assignment PDF", "Trademark-registration ready"]
  }
];

export default function LogoStudioHome() {
  // Hero reel — 6 real 3D-badge samples across trades, showing the
  // range we currently ship. When more style libraries land, rotate
  // this reel to feature the newest additions.
  const badgeStyle    = styleBySlug("3d-metallic-badge");
  const heroSamples   = (badgeStyle?.samples ?? []).slice(0, 6);

  return (
    <>
      {/* Hero */}
      <section className="mx-auto max-w-6xl px-4 pb-16 pt-14 sm:px-6 sm:pt-20">
        <div className="grid gap-10 lg:grid-cols-[1.1fr_1fr] lg:gap-16">
          <div className="flex flex-col justify-center">
            <span className="mb-3 inline-flex w-fit items-center gap-1.5 rounded-full border border-neutral-300 bg-white px-2.5 py-1 text-[10px] font-black uppercase tracking-[0.14em] text-neutral-600">
              <span className="inline-block h-1.5 w-1.5 rounded-full" style={{ backgroundColor: BRAND_YELLOW }}/>
              Logo Studio
            </span>
            <h1 className="text-4xl font-black leading-[1.05] tracking-tight sm:text-5xl lg:text-6xl">
              A proper logo. Built for trades. Ready in minutes.
            </h1>
            <p className="mt-4 max-w-xl text-[15px] leading-relaxed text-neutral-700">
              Pick your trade, pick a style, name your business. We hand you a logo that looks right on a van, a hi-vis, a business card and a Facebook page. No designer, no faff.
            </p>
            <div className="mt-6 flex flex-wrap items-center gap-3">
              <Link
                href="/logo/build"
                className="inline-flex items-center gap-2 rounded-full px-5 py-3 text-[14px] font-black transition hover:brightness-95"
                style={{ backgroundColor: BRAND_BLACK, color: BRAND_YELLOW }}
              >
                Start building <ArrowRight size={15}/>
              </Link>
              <Link href="#styles" className="text-[13px] font-black text-neutral-700 underline underline-offset-4 hover:text-neutral-900">
                See the styles
              </Link>
            </div>

            {/* Trust anchors */}
            <div className="mt-8 grid grid-cols-3 gap-2 text-[11px] font-semibold text-neutral-700">
              <TrustAnchor icon={<Zap size={13} strokeWidth={2.4}/>} label="Built in minutes"/>
              <TrustAnchor icon={<ShieldCheck size={13} strokeWidth={2.4}/>} label="Full commercial licence"/>
              <TrustAnchor icon={<Package size={13} strokeWidth={2.4}/>} label="All sizes included"/>
            </div>
          </div>

          {/* Hero preview reel — real 3D badge samples across trades */}
          <div className="grid grid-cols-3 gap-3">
            {badgeStyle && heroSamples.map((sample, i) => (
              <div key={sample.imageUrl} className={i === 1 || i === 4 ? "translate-y-4" : ""}>
                <StylePreviewTile style={badgeStyle} size="sm" imageUrl={sample.imageUrl} tradeSlug={sample.tradeSlug}/>
              </div>
            ))}
          </div>
        </div>
      </section>

      {/* Styles strip — inline preview so scrollers see the range */}
      <section id="styles" className="border-y border-neutral-200 bg-white/60 py-14">
        <div className="mx-auto max-w-6xl px-4 sm:px-6">
          <div className="mb-6 flex items-end justify-between gap-4">
            <div>
              <p className="text-[10px] font-black uppercase tracking-[0.14em] text-neutral-500">Eight styles. All trades.</p>
              <h2 className="mt-1 text-2xl font-black sm:text-3xl">Pick the feel that fits your work.</h2>
            </div>
            <Link href="/logo/build" className="hidden text-[13px] font-black text-neutral-700 hover:text-neutral-900 sm:inline">
              Open the builder →
            </Link>
          </div>
          <div className="grid grid-cols-2 gap-3 sm:grid-cols-4">
            {LOGO_STYLES.map((s) => (
              <StylePreviewTile key={s.slug} style={s} size="md"/>
            ))}
          </div>
        </div>
      </section>

      {/* Pricing */}
      <section id="pricing" className="mx-auto max-w-6xl px-4 py-16 sm:px-6">
        <div className="mb-8 text-center">
          <p className="text-[10px] font-black uppercase tracking-[0.14em] text-neutral-500">One-off pricing. No subscriptions.</p>
          <h2 className="mt-1 text-2xl font-black sm:text-3xl">Pay once. Own it. Move on.</h2>
        </div>
        <div className="grid gap-3 md:grid-cols-4">
          {TIERS.map((t) => (
            <div
              key={t.name}
              className={
                "flex flex-col rounded-2xl border bg-white p-5 " +
                (t.featured ? "border-neutral-900 ring-1 ring-neutral-900/10 shadow-lg" : "border-neutral-200")
              }
            >
              {t.featured && (
                <span className="mb-3 inline-flex w-fit rounded-full px-2 py-0.5 text-[9px] font-black uppercase tracking-[0.14em]" style={{ backgroundColor: BRAND_YELLOW, color: BRAND_BLACK }}>
                  Most popular
                </span>
              )}
              <p className="text-[11px] font-black uppercase tracking-[0.14em] text-neutral-500">{t.name}</p>
              <p className="mt-1 text-3xl font-black">{t.price}</p>
              <p className="mt-1 text-[12px] text-neutral-600">{t.tag}</p>
              <ul className="mt-4 space-y-1.5 border-t border-neutral-100 pt-4">
                {t.perks.map((p) => (
                  <li key={p} className="flex items-start gap-2 text-[12px]">
                    <Download size={11} strokeWidth={2.6} className="mt-0.5 shrink-0 text-neutral-500"/>
                    <span>{p}</span>
                  </li>
                ))}
              </ul>
              <Link
                href="/logo/build"
                className={
                  "mt-5 flex items-center justify-center rounded-full py-2 text-[12px] font-black transition " +
                  (t.featured ? "" : "border border-neutral-300 hover:bg-neutral-50")
                }
                style={t.featured ? { backgroundColor: BRAND_BLACK, color: BRAND_YELLOW } : undefined}
              >
                Choose {t.name}
              </Link>
            </div>
          ))}
        </div>
      </section>

      {/* How it works — three simple beats */}
      <section className="bg-white/60 py-14">
        <div className="mx-auto grid max-w-5xl grid-cols-1 gap-6 px-4 sm:grid-cols-3 sm:px-6">
          <Step n={1} icon={<Palette size={16}/>} title="Pick a style" body="Eight trade-native looks. From 3D metallic badges to clean flat vectors."/>
          <Step n={2} icon={<Zap    size={16}/>} title="Name your business" body="One input. We handle the layout, the tool icon, the colour balance."/>
          <Step n={3} icon={<Download size={16}/>} title="Download + own it" body="PNG for social, SVG for van wraps, IP-assignment PDF for peace of mind."/>
        </div>
      </section>
    </>
  );
}

function TrustAnchor({ icon, label }: { icon: React.ReactNode; label: string }) {
  return (
    <div className="flex items-center gap-1.5 rounded-full border border-neutral-200 bg-white px-2 py-1">
      <span className="text-neutral-700">{icon}</span>
      <span>{label}</span>
    </div>
  );
}

function Step({ n, icon, title, body }: { n: number; icon: React.ReactNode; title: string; body: string }) {
  return (
    <div>
      <div className="mb-2 flex items-center gap-2">
        <span className="flex h-6 w-6 items-center justify-center rounded-full text-[10px] font-black" style={{ backgroundColor: BRAND_YELLOW, color: BRAND_BLACK }}>{n}</span>
        <span className="text-neutral-700">{icon}</span>
      </div>
      <p className="text-[15px] font-black">{title}</p>
      <p className="mt-1 text-[12.5px] leading-relaxed text-neutral-600">{body}</p>
    </div>
  );
}
