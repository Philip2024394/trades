// /plan/stone-effect-render — homeowner-facing wizard.
//
// Educational Step 1 (Philip's measure-your-house drawing), then
// interactive form: dimensions per elevation + opening dropdowns +
// postcode + optional finish detail. Generates a cited estimate
// using hammerex_trade_rates × regional multiplier.
//
// Explicit "extras on top" callout on every estimate. Trade
// confirms final price on site.

import type { Metadata } from "next";
import { SeoSiteHeader } from "@/components/seo/SeoSiteHeader";
import { WizardClient } from "./WizardClient";
import { BRAND, absolute } from "@/lib/seo";

export const dynamic = "force-dynamic";
export const revalidate = 300;

export const metadata: Metadata = {
  title:       "Stone-Effect Render — Plan your job · Networkers",
  description: "Free planning tool for UK stone-effect ashlar render jobs. Enter your wall measurements + finish choice → get a cited price range from published UK trade rates. Extras confirmed by your trade on site.",
  alternates:  { canonical: "/plan/stone-effect-render" },
  openGraph:   {
    type:     "website",
    siteName: BRAND.name,
    title:    "Plan your stone-effect render job — free calculator",
    description: "Cited UK trade rates. Regional postcode pricing. Extras clearly listed. Get 3 quotes from verified Networkers renderers.",
    url:      absolute("/plan/stone-effect-render")
  },
  robots: { index: true, follow: true }
};

export default function StoneEffectRenderPlanPage() {
  return (
    <main className="min-h-screen bg-[#FBF6EC]">
      <SeoSiteHeader/>
      <div className="mx-auto max-w-[1200px] px-4 py-6 md:px-6 md:py-8">
        <header className="mb-5">
          <p className="text-[10px] font-black uppercase tracking-[0.28em]" style={{ color: "#FFB300" }}>
            Free planning tool · Networkers
          </p>
          <h1 className="mt-1 text-[26px] font-black leading-tight text-neutral-900 md:text-[36px]">
            Plan your stone-effect render job
          </h1>
          <p className="mt-2 max-w-3xl text-[13.5px] leading-relaxed text-neutral-700 md:text-[15px]">
            Measure your walls with the guide below, choose your finish, get a UK-rate-based estimate.
            Rates cited from published UK trade sources · Extras confirmed by your trade on site · Always get 3 quotes.
          </p>
        </header>

        <WizardClient/>
      </div>
    </main>
  );
}
