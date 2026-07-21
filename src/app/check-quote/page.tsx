// /check-quote — Cost Sanity Checker.
//
// Interactive tool that scores any UK trade quote against the UK
// Trade Price Index data. Unique in the UK market — no competitor
// has the underlying data to run this comparison.
//
// SEO ranks for:
//   • "is my quote fair UK"
//   • "average plumber cost UK"
//   • "average electrician quote UK"
//   • "how much should X cost UK"
//   • "quote comparison UK trade"
//
// Growth loop:
//   1. User enters quote → sees verdict (fair/high/low)
//   2. If HIGH: prominent CTA to get second quote from verified trades
//   3. Every verdict is shareable ("my quote is 25% above average")
//   4. Every check hits the Price Index page + trade directory
//
// Server component wraps the client tool so metadata + JSON-LD
// still emit for SEO.

import type { Metadata } from "next";
import { BRAND, absolute } from "@/lib/seo";
import { CheckQuoteTool } from "./client";
import { SeoSiteHeader } from "@/components/seo/SeoSiteHeader";

export const dynamic  = "force-static";
export const revalidate = 86400;

export const metadata: Metadata = {
  title:       `Is Your UK Trade Quote Fair? · Free Quote Checker — ${BRAND.name}`,
  description: `Free UK trade quote checker. Compare any plumber, electrician, carpenter, plasterer or roofer quote against The Networkers' UK Trade Price Index. Instant fair/high/low verdict.`,
  alternates:  { canonical: `/check-quote` },
  openGraph:   {
    type:     "website",
    siteName: BRAND.name,
    title:    `Free UK Trade Quote Checker`,
    description: `Instant verdict on any UK trade quote. Compare against live UK pricing data.`,
    url:      absolute(`/check-quote`)
  },
  robots: { index: true, follow: true }
};

export default function CheckQuotePage() {
  const breadcrumbLd = {
    "@context": "https://schema.org",
    "@type":    "BreadcrumbList",
    itemListElement: [
      { "@type": "ListItem", position: 1, name: "Quote Checker", item: absolute("/check-quote") }
    ]
  };
  const softwareLd = {
    "@context":     "https://schema.org",
    "@type":        "WebApplication",
    name:           "UK Trade Quote Checker",
    url:            absolute("/check-quote"),
    applicationCategory: "FinanceApplication",
    operatingSystem: "Web",
    offers:         { "@type": "Offer", price: "0.00", priceCurrency: "GBP" },
    creator:        { "@type": "Organization", name: BRAND.name, url: absolute("/") }
  };
  const faqLd = {
    "@context": "https://schema.org",
    "@type":    "FAQPage",
    mainEntity: [
      {
        "@type": "Question",
        name: "How does the UK Trade Quote Checker work?",
        acceptedAnswer: { "@type": "Answer", text: "Enter the trade, city, rate type (hourly, day rate, or emergency callout), and the quote amount. The tool compares your figure against The Networkers' UK Trade Price Index for that trade + region and returns a fair, high, or low verdict — with the percentage difference and the underlying UK range." }
      },
      {
        "@type": "Question",
        name: "Where does the comparison data come from?",
        acceptedAnswer: { "@type": "Answer", text: "The UK Trade Price Index — a monthly-refreshed dataset combining live pricing from The Networkers' verified trade profiles with industry benchmarks from BCIS, Gas Safe Register, RICS, and the Federation of Master Builders. Every source is public + attributed at /price-index." }
      },
      {
        "@type": "Question",
        name: "Is the Quote Checker free?",
        acceptedAnswer: { "@type": "Answer", text: "Yes — free forever, no sign-up. We never store the quotes you check. The tool exists to help UK homeowners avoid overpaying and to introduce them to verified trades on The Networkers." }
      }
    ]
  };

  return (
    <main className="min-h-screen bg-[#FBF6EC]">
      <SeoSiteHeader/>
      <script type="application/ld+json" dangerouslySetInnerHTML={{ __html: JSON.stringify(breadcrumbLd) }}/>
      <script type="application/ld+json" dangerouslySetInnerHTML={{ __html: JSON.stringify(softwareLd) }}/>
      <script type="application/ld+json" dangerouslySetInnerHTML={{ __html: JSON.stringify(faqLd) }}/>

      <CheckQuoteTool/>
    </main>
  );
}
